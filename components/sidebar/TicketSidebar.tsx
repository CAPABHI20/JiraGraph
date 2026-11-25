"use client";

import { useEffect, useRef, useState } from "react";
import { useGraphStore } from "@/store/graphStore";
import { useTicketDetail } from "@/hooks/useTicketDetail";
import { useNotes } from "@/hooks/useNotes";
import type { Board } from "@/types";
import TicketDetail from "./TicketDetail";
import NotePanel from "./NotePanel";
import Spinner from "@/components/ui/Spinner";

interface Props {
  allTicketKeys: string[];
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 860;
const DEFAULT_WIDTH = 420;

export default function TicketSidebar({ allTicketKeys }: Props) {
  const { selectedNodeId, setSelectedNode } = useGraphStore();
  const { ticket, loading, error } = useTicketDetail(selectedNodeId);
  const { notes, fetchNotes, addNote, removeNote, editNote } = useNotes(selectedNodeId, allTicketKeys);

  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [expanded, setExpanded] = useState(false);
  const [boardPickerOpen, setBoardPickerOpen] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(DEFAULT_WIDTH);

  const openBoardPicker = async () => {
    const json = await fetch("/api/boards").then((r) => r.json());
    setBoards(json.data ?? []);
    setBoardPickerOpen(true);
  };

  const addToBoard = async (boardId: number, boardName: string) => {
    if (!selectedNodeId) return;
    await fetch(`/api/boards/${boardId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketKey: selectedNodeId }),
    });
    setBoardPickerOpen(false);
    setAddedMsg(`Added to ${boardName}`);
    window.setTimeout(() => setAddedMsg(null), 1800);
  };

  const createBoardAndAdd = async () => {
    if (!selectedNodeId) return;
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${selectedNodeId} board` }),
    });
    const json = await res.json();
    if (json.data?.id) await addToBoard(json.data.id, json.data.name);
  };

  useEffect(() => {
    if (selectedNodeId) fetchNotes();
  }, [selectedNodeId, fetchNotes]);

  // Drag-to-resize
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + delta));
      setWidth(newW);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [width]);

  const toggleExpand = () => {
    if (expanded) {
      setWidth(DEFAULT_WIDTH);
      setExpanded(false);
    } else {
      setWidth(MAX_WIDTH);
      setExpanded(true);
    }
  };

  const open = !!selectedNodeId;
  const sidebarWidth = open ? width : 0;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSelectedNode(null)}
        />
      )}

      <aside
        style={{ width: sidebarWidth, background: "var(--surface-1)", borderColor: "var(--hairline)" }}
        className={`fixed top-0 right-0 h-full border-l shadow-2xl z-30 flex flex-col
          transition-[transform] duration-300 ease-in-out overflow-hidden
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize z-10 group hover:bg-indigo-500/40 transition-colors"
          title="Drag to resize"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 shrink-0 min-w-0">
          <span className="font-mono text-indigo-400 text-sm font-semibold tracking-wide truncate mr-2">
            {selectedNodeId ?? "Ticket detail"}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {/* Send to a board (picker popover) */}
            <div className="relative">
              <button
                onClick={openBoardPicker}
                title="Add to a board"
                className="px-2 h-7 flex items-center rounded-md text-xs text-indigo-300 hover:text-white hover:bg-indigo-600 transition-colors"
              >
                {addedMsg ? "✓ Added" : "+ Board"}
              </button>
              {boardPickerOpen && (
                <div className="absolute top-full right-0 mt-1 w-52 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 overflow-hidden">
                  <p className="px-3 pt-2 pb-1 text-[10px] text-slate-500 uppercase tracking-widest">Add to board</p>
                  <div className="max-h-48 overflow-y-auto">
                    {boards.length === 0 && (
                      <p className="px-3 py-2 text-xs text-slate-500">No boards yet</p>
                    )}
                    {boards.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => addToBoard(b.id, b.name)}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 truncate"
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={createBoardAndAdd}
                    className="w-full text-left px-3 py-2 text-xs text-indigo-300 hover:bg-slate-700 border-t border-slate-700"
                  >
                    + New board
                  </button>
                </div>
              )}
            </div>
            {/* Expand / collapse */}
            <button
              onClick={toggleExpand}
              title={expanded ? "Collapse" : "Expand"}
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              {expanded ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l6 6m0-6l-6 6" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
              )}
            </button>
            {/* Close */}
            <button
              onClick={() => setSelectedNode(null)}
              title="Close"
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          {loading && (
            <div className="flex justify-center pt-10">
              <Spinner />
            </div>
          )}
          {error && (
            <p className="text-red-400 text-sm p-5 break-words">{error}</p>
          )}
          {ticket && !loading && (
            <>
              <TicketDetail ticket={ticket} />
              <NotePanel
                notes={notes}
                onAdd={addNote}
                onDelete={removeNote}
                onEdit={editNote}
                allTicketKeys={allTicketKeys}
              />
            </>
          )}
        </div>
      </aside>
    </>
  );
}
