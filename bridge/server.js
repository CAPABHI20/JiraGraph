#!/usr/bin/env node
/**
 * MCP Bridge server — proxies HTTP requests from Next.js to the Jira MCP server.
 * Start: npm run bridge  (runs on http://localhost:3002)
 */

const http = require("http");
const { loadTokens, isTokenExpired, refreshTokens } = require("./auth");
const path = require("path");
const fs = require("fs");

const PORT = 3002;
const MCP_URL = process.env.MCP_URL || "https://your-jira-mcp-server/mcp";
let requestId = 1;

// ── Token management ──────────────────────────────────────────────────────────

let refreshPromise = null;

async function getAccessToken() {
  let tokens = loadTokens();
  if (!tokens) throw new Error("Not authenticated. Run: npm run bridge:auth");
  if (isTokenExpired(tokens)) {
    if (!refreshPromise) {
      console.log("[bridge] Token expired, refreshing…");
      refreshPromise = refreshTokens().finally(() => { refreshPromise = null; });
    }
    tokens = await refreshPromise;
  }
  return tokens.access_token;
}

// ── MCP call ──────────────────────────────────────────────────────────────────

async function mcpCall(method, params = {}) {
  const token = await getAccessToken();
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: requestId++, method, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP ${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  let json;

  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data:"));
    if (lines.length === 0) throw new Error("Empty SSE response");
    json = JSON.parse(lines[lines.length - 1].replace(/^data:\s*/, ""));
  } else {
    json = await res.json();
  }

  if (json.error) throw new Error(`MCP error: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function callTool(toolName, toolParams = {}) {
  const result = await mcpCall("tools/call", { name: toolName, arguments: toolParams });
  return parseToolResult(result);
}

// ── Parse tool result ─────────────────────────────────────────────────────────

function parseToolResult(result) {
  if (!result) return null;

  let data = result;
  if (Array.isArray(result?.content)) {
    const textBlock = result.content.find((c) => c.type === "text");
    if (textBlock?.text) {
      try { data = JSON.parse(textBlock.text); } catch { return textBlock.text; }
    }
  }

  if (data && typeof data.result === "string") {
    try { data = JSON.parse(data.result); } catch { return data.result; }
  }

  return data;
}

// ── Jira helpers ──────────────────────────────────────────────────────────────

async function listTools() {
  const result = await mcpCall("tools/list");
  return result?.tools ?? result;
}

async function getProjects() {
  const USER = process.env.JIRA_USER || "";
  // Cast a wide net — assignee, reporter, watcher, mention
  const queries = [
    `assignee = ${USER} ORDER BY updated DESC`,
    `reporter = ${USER} ORDER BY updated DESC`,
    `watcher = ${USER} ORDER BY updated DESC`,
  ];

  const seen = new Map();

  for (const jql of queries) {
    try {
      const data = await callTool("jira_search", { jql, fields: "project", limit: 100 });
      const issues = data?.issues ?? (Array.isArray(data) ? data : []);
      for (const issue of issues) {
        const proj = issue?.project;
        if (proj?.key) seen.set(proj.key, proj.name && proj.name !== proj.key ? proj.name : proj.key);
      }
    } catch {
      // ignore individual query failures
    }
  }

  return Array.from(seen.entries())
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

async function searchTickets(jql, maxTickets = 300) {
  const allTickets = [];
  let startAt = 0;
  const limit = 50;
  const FIELDS = "summary,description,status,issuetype,priority,assignee,reporter,parent,subtasks,issuelinks,labels,created,updated,customfield_10014,customfield_10020";

  while (allTickets.length < maxTickets) {
    const data = await callTool("jira_search", {
      jql,
      fields: FIELDS,
      limit,
      start_at: startAt,
    });

    const issues = data?.issues ?? (Array.isArray(data) ? data : []);
    if (issues.length === 0) break;

    allTickets.push(...issues);

    const total = data?.total ?? issues.length;
    if (allTickets.length >= total) break;
    startAt += issues.length;

    await new Promise((r) => setTimeout(r, 150));
  }

  return allTickets.slice(0, maxTickets);
}

// Collect all linked/child/parent ticket keys from a set of issues
function extractLinkedKeys(issues) {
  const keys = new Set(issues.map((i) => i.key));
  const linked = new Set();

  for (const issue of issues) {
    // subtasks
    for (const s of issue.subtasks ?? []) {
      if (s.key && !keys.has(s.key)) linked.add(s.key);
    }
    // parent
    if (issue.parent?.key && !keys.has(issue.parent.key)) linked.add(issue.parent.key);
    // issuelinks
    for (const l of issue.issuelinks ?? []) {
      const k = l.outward_issue?.key ?? l.outwardIssue?.key ?? l.inward_issue?.key ?? l.inwardIssue?.key;
      if (k && !keys.has(k)) linked.add(k);
    }
    // epic
    if (issue.customfield_10014?.value && !keys.has(issue.customfield_10014.value)) {
      linked.add(issue.customfield_10014.value);
    }
  }

  return [...linked];
}

async function fetchByKeys(keys) {
  if (keys.length === 0) return [];
  const FIELDS = "summary,description,status,issuetype,priority,assignee,reporter,parent,subtasks,issuelinks,labels,created,updated,customfield_10014,customfield_10020";
  // Fetch in batches of 50
  const results = [];
  for (let i = 0; i < keys.length; i += 50) {
    const batch = keys.slice(i, i + 50);
    const jql = `issue in (${batch.join(",")})`;
    try {
      const data = await callTool("jira_search", { jql, fields: FIELDS, limit: 50, start_at: 0 });
      const issues = data?.issues ?? (Array.isArray(data) ? data : []);
      results.push(...issues);
    } catch {
      // ignore batch failures
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return results;
}

async function getTickets(projectKey, maxTickets = 300, extraJql = "") {
  // If extraJql provided, use it directly (already scoped by caller)
  let issues;
  if (extraJql) {
    issues = await searchTickets(extraJql, maxTickets);
  } else if (projectKey) {
    issues = await searchTickets(`project = "${projectKey}" ORDER BY updated DESC`, maxTickets);
  } else {
    issues = await searchTickets(`assignee = ${process.env.JIRA_USER} OR reporter = ${process.env.JIRA_USER} ORDER BY updated DESC`, maxTickets);
  }

  // If small result set (e.g. single ticket search), expand linked tickets one level deep
  if (issues.length <= 10) {
    const linkedKeys = extractLinkedKeys(issues);
    if (linkedKeys.length > 0) {
      console.log(`[bridge] Expanding ${linkedKeys.length} linked tickets…`);
      const linked = await fetchByKeys(linkedKeys);
      const seen = new Set(issues.map((i) => i.key));
      for (const l of linked) {
        if (!seen.has(l.key)) { issues.push(l); seen.add(l.key); }
      }
    }
  }

  return issues;
}

async function getTicket(key) {
  return callTool("jira_get_issue", { issue_key: key });
}

// ── Auth flow (in-process PKCE) ───────────────────────────────────────────────

const crypto = require("crypto");
const { execSync } = require("child_process");

const MCP_BASE = process.env.MCP_URL ? new URL(process.env.MCP_URL).origin : "https://your-jira-mcp-server";
const REDIRECT_PORT = 9999;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPE = "mcp openid profile email";
const TOKENS_FILE = path.join(__dirname, ".tokens.json");

let authInProgress = false;

function openBrowser(url) {
  try {
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    execSync(`${cmd} "${url}"`);
  } catch {
    console.log(`[bridge] Could not auto-open browser. Visit:\n${url}`);
  }
}

async function startAuthFlow() {
  if (authInProgress) return;
  authInProgress = true;

  try {
    console.log("[bridge] Starting OAuth PKCE flow…");

    const regRes = await fetch(`${MCP_BASE}/register`, {
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
    if (!regRes.ok) throw new Error(`Registration failed: ${await regRes.text()}`);
    const { client_id } = await regRes.json();

    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
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
        res.end(`<html><body style="font-family:sans-serif;padding:2rem">
          <h2>${error ? "❌ Auth failed" : "✅ Connected to Jira!"}</h2>
          <p>${error || "You can close this tab and return to JiraGraph."}</p>
        </body></html>`);
        server.close();
        if (error) return reject(new Error(`OAuth error: ${error}`));
        if (returnedState !== state) return reject(new Error("State mismatch"));
        resolve(code);
      });
      server.listen(REDIRECT_PORT, () => {
        console.log("[bridge] Waiting for OAuth callback…");
        openBrowser(authUrl.toString());
      });
      server.on("error", reject);
    });

    const tokenRes = await fetch(`${MCP_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id,
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
    const tokens = await tokenRes.json();
    fs.writeFileSync(TOKENS_FILE, JSON.stringify({ client_id, ...tokens, saved_at: Date.now() }, null, 2));
    console.log("[bridge] ✅ Authenticated successfully");
  } finally {
    authInProgress = false;
  }
}

function getAuthStatus() {
  const tokens = loadTokens();
  if (!tokens) return { authenticated: false, reason: "no_tokens" };
  if (isTokenExpired(tokens)) return { authenticated: false, reason: "expired" };
  return { authenticated: true };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("Invalid JSON body")); }
    });
  });
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "http://localhost:3000",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  console.log(`[bridge] ${req.method} ${pathname}`);

  try {
    if (req.method === "GET" && pathname === "/auth/status") {
      return sendJson(res, 200, getAuthStatus());
    }

    if (req.method === "POST" && pathname === "/auth/start") {
      if (authInProgress) return sendJson(res, 200, { started: false, reason: "already_in_progress" });
      startAuthFlow().catch((err) => console.error("[bridge] Auth flow error:", err.message));
      return sendJson(res, 200, { started: true });
    }

    if (req.method === "GET" && pathname === "/tools") {
      return sendJson(res, 200, { data: await listTools() });
    }

    if (req.method === "POST" && pathname === "/call") {
      const { tool, params } = await parseBody(req);
      if (!tool) return sendJson(res, 400, { error: "tool required" });
      return sendJson(res, 200, { data: await callTool(tool, params ?? {}) });
    }

    if (req.method === "GET" && pathname === "/projects") {
      return sendJson(res, 200, { data: await getProjects() });
    }

    if (req.method === "GET" && pathname === "/tickets") {
      const project = url.searchParams.get("project") ?? "";
      const max = parseInt(url.searchParams.get("max") ?? "300", 10);
      const jql = url.searchParams.get("jql") ?? "";
      const tickets = await getTickets(project, max, jql);
      return sendJson(res, 200, { data: tickets, total: tickets.length });
    }

    const ticketMatch = pathname.match(/^\/ticket\/([A-Z0-9]+-\d+)$/i);
    if (req.method === "GET" && ticketMatch) {
      return sendJson(res, 200, { data: await getTicket(ticketMatch[1].toUpperCase()) });
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(`[bridge] Error:`, err.message);
    const status = err.message.includes("Not authenticated") ? 401 : 500;
    sendJson(res, status, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n🌉 JiraGraph Bridge running on http://localhost:${PORT}`);
  console.log(`   Proxying to: ${MCP_URL}\n`);
  const status = getAuthStatus();
  if (status.authenticated) {
    console.log(`✅ Authenticated — ready to proxy Jira requests\n`);
  } else {
    const hint = status.reason === "no_tokens"
      ? "No tokens found. Run: npm run bridge:auth"
      : "Tokens expired. Run: npm run bridge:auth";
    console.log(`⚠  ${hint}\n`);
  }
});
