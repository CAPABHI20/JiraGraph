#!/usr/bin/env node
/**
 * OAuth2 PKCE auth flow for the Jira MCP server.
 * Run once: npm run bridge:auth
 * Stores tokens in bridge/.tokens.json — never commit this file.
 */

const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TOKENS_FILE = path.join(__dirname, ".tokens.json");

const MCP_BASE = process.env.MCP_URL ? new URL(process.env.MCP_URL).origin : "https://your-jira-mcp-server";
const REDIRECT_PORT = 9999;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPE = "mcp openid profile email";

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function generateVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

function generateChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// ── Dynamic client registration ───────────────────────────────────────────────

async function registerClient() {
  const res = await fetch(`${MCP_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "JiraGraph Bridge",
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    }),
  });
  if (!res.ok) throw new Error(`Registration failed: ${await res.text()}`);
  return res.json();
}

// ── Authorization code exchange ───────────────────────────────────────────────

async function exchangeCode(code, verifier, clientId) {
  const res = await fetch(`${MCP_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshTokens() {
  if (!fs.existsSync(TOKENS_FILE)) throw new Error("No tokens file — run: npm run bridge:auth");
  const stored = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));

  const res = await fetch(`${MCP_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
      client_id: stored.client_id,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const tokens = await res.json();
  saveTokens(stored.client_id, tokens);
  return tokens;
}

// ── Load / save ───────────────────────────────────────────────────────────────

function saveTokens(clientId, tokens) {
  fs.writeFileSync(
    TOKENS_FILE,
    JSON.stringify({ client_id: clientId, ...tokens, saved_at: Date.now() }, null, 2)
  );
}

function loadTokens() {
  if (!fs.existsSync(TOKENS_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
}

function isTokenExpired(tokens) {
  if (!tokens?.expires_in || !tokens?.saved_at) return true;
  const expiresAt = tokens.saved_at + tokens.expires_in * 1000;
  return Date.now() > expiresAt - 60_000;
}

// ── Open browser cross-platform ───────────────────────────────────────────────

function openBrowser(url) {
  try {
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    execSync(`${cmd} "${url}"`);
  } catch {
    console.log(`Could not auto-open browser. Visit manually:\n${url}`);
  }
}

// ── Main auth flow ────────────────────────────────────────────────────────────

async function main() {
  const existing = loadTokens();
  if (existing && !isTokenExpired(existing)) {
    console.log("✅ Already authenticated — tokens are still valid.");
    console.log("   Start the bridge: npm run bridge");
    return;
  }

  console.log("Registering OAuth client…");
  const { client_id } = await registerClient();
  console.log(`Client registered: ${client_id}`);

  const verifier = generateVerifier();
  const challenge = generateChallenge(verifier);
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = new URL(`${MCP_BASE}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname !== "/callback") return;

      const returnedState = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<html><body style="font-family:sans-serif;padding:2rem">
          <h2>${error ? "❌ Auth failed" : "✅ Authenticated!"}</h2>
          <p>${error || "You can close this tab and return to the terminal."}</p>
        </body></html>`
      );
      server.close();

      if (error) return reject(new Error(`OAuth error: ${error}`));
      if (returnedState !== state) return reject(new Error("State mismatch"));
      resolve(code);
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`\nOpening browser for Jira login…\n${authUrl.toString()}\n`);
      openBrowser(authUrl.toString());
    });

    server.on("error", reject);
  });

  console.log("Exchanging authorization code for tokens…");
  const tokens = await exchangeCode(code, verifier, client_id);
  saveTokens(client_id, tokens);
  console.log("✅ Tokens saved to bridge/.tokens.json");
  console.log("You can now start the bridge: npm run bridge");
}

module.exports = { loadTokens, isTokenExpired, refreshTokens };

// Run main only when executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error("Auth failed:", err.message);
    process.exit(1);
  });
}
