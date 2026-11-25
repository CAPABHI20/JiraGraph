"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Board } from "@/types";

interface Props {
  boards: Board[];
  activeId: number | null;
  onChanged: () => void;
}

export default function BoardSidebar({ boards, activeId, onChanged }: Props) {
  const router = useRouter();
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const createBoard = async () => {
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled board" }),
    });
    const json = await res.json();
    if (json.data?.id) router.push(`/playground/${json.data.id}`);
  };

  const commitRename = async (id: number) => {
    const name = renameValue.trim() || "Untitled board";
    await fetch(`/api/boards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setRenaming(null);
    onChanged();
  };

  const deleteBoard = async (id: number) => {
    if (!window.confirm("Delete this board and everything on it?")) return;
    await fetch(`/api/boards/${id}`, { method: "DELETE" });
    if (activeId === id) router.push("/playground");
    else onChanged();
  };

  return (
    <aside className="w-60 shrink-0 glass border-0 border-r flex flex-col" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--hairline)" }}>
        <span className="font-semibold text-slate-100 text-sm tracking-tight">Boards</span>
        <button
          onClick={createBoard}
          className="w-7 h-7 flex items-center justify-center rounded-lg btn-primary text-base leading-none"
          title="New board"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {boards.length === 0 && (
          <p className="text-slate-500 text-xs px-2 py-3">No boards yet. Create one with +</p>
        )}
        {boards.map((b) => (
          <div
            key={b.id}
            className={`group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer transition-all ${
              activeId === b.id
                ? "bg-violet-500/15 ring-1 ring-violet-500/40 text-white"
                : "hover:bg-white/5 ring-1 ring-transparent"
            }`}
            onClick={() => { if (renaming !== b.id) router.push(`/playground/${b.id}`); }}
          >
            {renaming === b.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(b.id); if (e.key === "Escape") setRenaming(null); }}
                onBlur={() => commitRename(b.id)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 input-dark px-1.5 py-0.5 text-xs"
              />
            ) : (
              <span
                className="flex-1 text-sm text-slate-200 truncate"
                onDoubleClick={(e) => { e.stopPropagation(); setRenaming(b.id); setRenameValue(b.name); }}
                title={b.name}
              >
                {b.name}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); deleteBoard(b.id); }}
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 text-sm leading-none transition-opacity"
              title="Delete board"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
