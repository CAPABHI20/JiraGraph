"use client";

import { useEffect, useState, useCallback } from "react";

type AuthState = "checking" | "authenticated" | "unauthenticated" | "connecting" | "bridge_down";

export default function AuthBanner() {
  const [state, setState] = useState<AuthState>("checking");

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      if (res.status === 503) return setState("bridge_down");
      setState(data.authenticated ? "authenticated" : "unauthenticated");
    } catch {
      setState("bridge_down");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Poll every 3s while connecting, so banner disappears as soon as auth completes
  useEffect(() => {
    if (state !== "connecting") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/status");
        const data = await res.json();
        if (data.authenticated) setState("authenticated");
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [state]);

  const handleConnect = async () => {
    setState("connecting");
    try {
      await fetch("/api/auth/start", { method: "POST" });
    } catch {
      setState("unauthenticated");
    }
  };

  if (state === "checking" || state === "authenticated") return null;

  if (state === "bridge_down") {
    return (
      <div className="w-full bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-3 text-sm">
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
        <span className="text-slate-300">Bridge server is not running.</span>
        <span className="text-slate-500">Start it with <code className="text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded text-xs">npm run bridge</code> in a terminal.</span>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-800 border-b border-amber-700/50 px-4 py-2 flex items-center gap-3 text-sm">
      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
      {state === "connecting" ? (
        <>
          <span className="text-slate-300">Waiting for Jira login in your browser…</span>
          <span className="text-slate-500 text-xs">Complete the login then return here.</span>
        </>
      ) : (
        <>
          <span className="text-slate-300">Not connected to Jira.</span>
          <button
            onClick={handleConnect}
            className="ml-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded text-xs transition-colors cursor-pointer"
          >
            Connect to Jira
          </button>
        </>
      )}
    </div>
  );
}
