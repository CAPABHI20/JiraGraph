"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Board } from "@/types";
import BoardSidebar from "@/components/playground/BoardSidebar";
import Spinner from "@/components/ui/Spinner";

export default function PlaygroundHome() {
  const [boards, setBoards] = useState<Board[] | null>(null);

  const load = useCallback(() => {
    fetch("/api/boards")
      .then((r) => r.json())
      .then((json) => setBoards(json.data ?? []));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex h-screen bg-transparent">
      {boards && <BoardSidebar boards={boards} activeId={null} onChanged={load} />}

      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 glass border-0 border-b" style={{ borderColor: "var(--hairline)" }}>
          <Link href="/graph" className="btn btn-ghost">
            ← Back to graph
          </Link>
          <span className="font-semibold text-slate-100 text-sm tracking-tight">My Boards</span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {!boards ? (
            <Spinner />
          ) : boards.length === 0 ? (
            <div className="text-center space-y-2">
              <p className="text-slate-300 text-sm">No boards yet</p>
              <p className="text-slate-500 text-xs">Create your first board with the + in the sidebar</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 p-8 max-w-3xl">
              {boards.map((b) => (
                <Link
                  key={b.id}
                  href={`/playground/${b.id}`}
                  className="group aspect-video rounded-xl card-elev hover:border-violet-500/60 transition-all hover:-translate-y-0.5 flex items-center justify-center p-4 text-center relative overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "radial-gradient(400px 200px at 50% 0%, var(--accent-soft), transparent 70%)" }} />
                  <span className="text-slate-100 text-sm font-medium relative">{b.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
