import { getDb } from "./index";
import type { Note, NoteCreateInput } from "@/types";

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as number,
    ticketKey: row.ticket_key as string,
    content: row.content as string,
    source: row.source as "text" | "voice",
    linkedTicketKeys: JSON.parse(row.linked_ticket_keys as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function getNotesByTicket(ticketKey: string): Note[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM notes WHERE ticket_key = ? ORDER BY created_at DESC")
    .all(ticketKey) as Record<string, unknown>[];
  return rows.map(rowToNote);
}

export function createNote(input: NoteCreateInput, linkedKeys: string[] = []): Note {
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO notes (ticket_key, content, source, linked_ticket_keys) VALUES (?, ?, ?, ?)"
    )
    .run(input.ticketKey, input.content, input.source, JSON.stringify(linkedKeys));
  const row = db
    .prepare("SELECT * FROM notes WHERE id = ?")
    .get(result.lastInsertRowid) as Record<string, unknown>;
  return rowToNote(row);
}

export function updateNote(id: number, content: string): Note | null {
  const db = getDb();
  db.prepare(
    "UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(content, id);
  const row = db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToNote(row) : null;
}

export function deleteNote(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}
