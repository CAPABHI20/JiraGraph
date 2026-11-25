"use client";

import { useState } from "react";
import { usePlaygroundStore, type Tool } from "@/store/playgroundStore";

interface Props {
  onAddTicket: (key: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/i;

const TOOLS: { id: Tool; label: string; icon: string; title: string }[] = [
  { id: "select", label: "Select", icon: "⤢", title: "Select & move (V)" },
  { id: "sticky", label: "Sticky", icon: "▨", title: "Add sticky note — click canvas to drop" },
  { id: "text", label: "Text", icon: "T", title: "Add text — click canvas to drop" },
  { id: "frame", label: "Frame", icon: "▢", title: "Add a frame — click canvas to drop" },
  { id: "connect", label: "Connect", icon: "↝", title: "Connect: hover a ticket and drag from its handle" },
];

export default function BoardToolbar({ onAddTicket, onZoomIn, onZoomOut, onFit }: Props) {
  const { activeTool, setActiveTool } = usePlaygroundStore();
  const [addOpen, setAddOpen] = useState(false);
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submitAdd = () => {
    const k = key.trim().toUpperCase();
    if (!KEY_RE.test(k)) { setErr("e.g. ECP-1234"); return; }
    onAddTicket(k);
    setKey("");
    setErr(null);
    setAddOpen(false);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 glass rounded-2xl px-2 py-1.5">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          onClick={() => setActiveTool(t.id)}
          title={t.title}
          className={`w-9 h-9 flex flex-col items-center justify-center rounded-xl text-xs transition-all ${
            activeTool === t.id
              ? "text-white shadow-[0_0_16px_-4px_var(--accent-glow)]"
              : "text-slate-300 hover:bg-white/10"
          }`}
          style={activeTool === t.id ? { background: "linear-gradient(135deg, var(--accent), var(--accent-2))" } : undefined}
        >
          <span className="text-base leading-none">{t.icon}</span>
        </button>
      ))}

      <div className="w-px h-6 mx-1" style={{ background: "var(--hairline)" }} />

      {/* Add ticket */}
      <div className="relative">
        <button
          onClick={() => setAddOpen((o) => !o)}
          title="Add ticket by key"
          className="h-9 px-3 flex items-center rounded-xl text-xs font-medium text-violet-300 hover:bg-white/10 transition-colors"
        >
          + Ticket
        </button>
        {addOpen && (
          <div className="absolute top-full left-0 mt-2 glass rounded-xl p-2">
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={key}
                onChange={(e) => { setKey(e.target.value); setErr(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") setAddOpen(false); }}
                placeholder="ECP-1234"
                className="w-32 input-dark px-2 py-1 text-xs"
              />
              <button onClick={submitAdd} className="btn btn-primary px-2 py-1">Add</button>
            </div>
            {err && <p className="text-[10px] text-red-400 mt-1">{err}</p>}
          </div>
        )}
      </div>

      <div className="w-px h-6 mx-1" style={{ background: "var(--hairline)" }} />

      {/* Zoom */}
      <button onClick={onZoomOut} title="Zoom out" className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 text-lg leading-none transition-colors">−</button>
      <button onClick={onFit} title="Fit to content" className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 text-xs transition-colors">Fit</button>
      <button onClick={onZoomIn} title="Zoom in" className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 text-lg leading-none transition-colors">+</button>
    </div>
  );
}
