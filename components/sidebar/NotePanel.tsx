"use client";

import { useState } from "react";
import DOMPurify from "dompurify";
import type { Note, NoteCreateInput } from "@/types";
import RichNoteEditor from "@/components/notes/RichNoteEditor";

interface Props {
  notes: Note[];
  onAdd: (input: Omit<NoteCreateInput, "ticketKey">) => Promise<Note | undefined>;
  onDelete: (id: number) => void;
  onEdit: (id: number, content: string) => Promise<void>;
  allTicketKeys: string[];
}

function NoteItem({
  note,
  onDelete,
  onEdit,
}: {
  note: Note;
  onDelete: (id: number) => void;
  onEdit: (id: number, content: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden group">
      {editing ? (
        <div className="p-2">
          <RichNoteEditor
            content={note.content}
            placeholder="Edit your note…"
            saveLabel="Update"
            onSave={async (html) => {
              await onEdit(note.id, html);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="p-3">
          <div
            className="note-rendered-content"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content) }}
          />
          {note.linkedTicketKeys.length > 0 && (
            <p className="mt-2 text-indigo-400 font-mono text-xs">
              Linked: {note.linkedTicketKeys.join(", ")}
            </p>
          )}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
            <span className="text-slate-600 text-[10px]">
              {note.source === "voice" ? "🎤 " : ""}
              {new Date(note.createdAt).toLocaleDateString(undefined, {
                month: "short", day: "numeric", year: "numeric",
              })}
            </span>
            <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export default function NotePanel({ notes, onAdd, onDelete, onEdit }: Props) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="border-t border-slate-700/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Notes {notes.length > 0 && <span className="text-slate-400">({notes.length})</span>}
        </p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
        >
          {adding ? "Cancel" : "+ Add note"}
        </button>
      </div>

      {adding && (
        <RichNoteEditor
          onSave={async (html, source) => {
            await onAdd({ content: html, source });
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {notes.length === 0 && !adding && (
        <p className="text-slate-600 text-xs italic">No notes yet.</p>
      )}

      <ul className="space-y-2">
        {notes.map((note) => (
          <NoteItem key={note.id} note={note} onDelete={onDelete} onEdit={onEdit} />
        ))}
      </ul>
    </div>
  );
}
