import { getDb } from "./index";
import type {
  Board,
  BoardNode,
  BoardEdge,
  BoardSticky,
  BoardShape,
  BoardBundle,
  Urgency,
  ShapeKind,
} from "@/types";

// ── Row mappers ────────────────────────────────────────────────────────────

function rowToBoard(r: Record<string, unknown>): Board {
  return {
    id: r.id as number,
    name: r.name as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
function rowToNode(r: Record<string, unknown>): BoardNode {
  return {
    id: r.id as number,
    boardId: r.board_id as number,
    ticketKey: r.ticket_key as string,
    x: r.x as number,
    y: r.y as number,
    urgency: r.urgency as Urgency,
    addedAt: r.added_at as string,
  };
}
function rowToEdge(r: Record<string, unknown>): BoardEdge {
  return {
    id: r.id as number,
    boardId: r.board_id as number,
    fromKey: r.from_key as string,
    toKey: r.to_key as string,
    label: r.label as string,
    color: r.color as string,
    style: r.style as "dashed" | "solid",
    createdAt: r.created_at as string,
  };
}
function rowToSticky(r: Record<string, unknown>): BoardSticky {
  return {
    id: r.id as number,
    boardId: r.board_id as number,
    content: r.content as string,
    x: r.x as number,
    y: r.y as number,
    color: r.color as string,
    createdAt: r.created_at as string,
  };
}
function rowToShape(r: Record<string, unknown>): BoardShape {
  return {
    id: r.id as number,
    boardId: r.board_id as number,
    kind: r.kind as ShapeKind,
    x: r.x as number,
    y: r.y as number,
    w: r.w as number,
    h: r.h as number,
    text: r.text as string,
    color: r.color as string,
    createdAt: r.created_at as string,
  };
}

// ── Boards ───────────────────────────────────────────────────────────────────

export function listBoards(): Board[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM boards ORDER BY updated_at DESC").all() as Record<string, unknown>[];
  return rows.map(rowToBoard);
}

export function createBoard(name: string): Board {
  const db = getDb();
  const result = db.prepare("INSERT INTO boards (name) VALUES (?)").run(name || "Untitled board");
  const row = db.prepare("SELECT * FROM boards WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
  return rowToBoard(row);
}

export function renameBoard(id: number, name: string): void {
  const db = getDb();
  db.prepare("UPDATE boards SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
}

export function deleteBoard(id: number): void {
  const db = getDb();
  const tx = db.transaction((bid: number) => {
    db.prepare("DELETE FROM board_edges WHERE board_id = ?").run(bid);
    db.prepare("DELETE FROM board_nodes WHERE board_id = ?").run(bid);
    db.prepare("DELETE FROM board_stickies WHERE board_id = ?").run(bid);
    db.prepare("DELETE FROM board_shapes WHERE board_id = ?").run(bid);
    db.prepare("DELETE FROM boards WHERE id = ?").run(bid);
  });
  tx(id);
}

export function getBoardBundle(id: number): BoardBundle | null {
  const db = getDb();
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!board) return null;
  const nodes = (db.prepare("SELECT * FROM board_nodes WHERE board_id = ? ORDER BY added_at ASC").all(id) as Record<string, unknown>[]).map(rowToNode);
  const edges = (db.prepare("SELECT * FROM board_edges WHERE board_id = ? ORDER BY created_at ASC").all(id) as Record<string, unknown>[]).map(rowToEdge);
  const stickies = (db.prepare("SELECT * FROM board_stickies WHERE board_id = ? ORDER BY created_at ASC").all(id) as Record<string, unknown>[]).map(rowToSticky);
  const shapes = (db.prepare("SELECT * FROM board_shapes WHERE board_id = ? ORDER BY created_at ASC").all(id) as Record<string, unknown>[]).map(rowToShape);
  return { board: rowToBoard(board), nodes, edges, stickies, shapes };
}

function touchBoard(boardId: number): void {
  getDb().prepare("UPDATE boards SET updated_at = datetime('now') WHERE id = ?").run(boardId);
}

// ── Nodes ─────────────────────────────────────────────────────────────────────

export function addNode(boardId: number, ticketKey: string, x = 0, y = 0): BoardNode {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO board_nodes (board_id, ticket_key, x, y) VALUES (?, ?, ?, ?)"
  ).run(boardId, ticketKey, x, y);
  touchBoard(boardId);
  const row = db
    .prepare("SELECT * FROM board_nodes WHERE board_id = ? AND ticket_key = ?")
    .get(boardId, ticketKey) as Record<string, unknown>;
  return rowToNode(row);
}

export function updateNode(
  id: number,
  fields: { x?: number; y?: number; urgency?: Urgency }
): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.x !== undefined) { sets.push("x = ?"); vals.push(fields.x); }
  if (fields.y !== undefined) { sets.push("y = ?"); vals.push(fields.y); }
  if (fields.urgency !== undefined) { sets.push("urgency = ?"); vals.push(fields.urgency); }
  if (sets.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE board_nodes SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function removeNode(id: number): void {
  const db = getDb();
  const row = db.prepare("SELECT board_id, ticket_key FROM board_nodes WHERE id = ?").get(id) as
    | { board_id: number; ticket_key: string }
    | undefined;
  if (!row) return;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM board_edges WHERE board_id = ? AND (from_key = ? OR to_key = ?)").run(
      row.board_id, row.ticket_key, row.ticket_key
    );
    db.prepare("DELETE FROM board_nodes WHERE id = ?").run(id);
  });
  tx();
}

// ── Edges ─────────────────────────────────────────────────────────────────────

export function addEdge(boardId: number, fromKey: string, toKey: string, label = ""): BoardEdge {
  const db = getDb();
  const result = db
    .prepare("INSERT OR IGNORE INTO board_edges (board_id, from_key, to_key, label) VALUES (?, ?, ?, ?)")
    .run(boardId, fromKey, toKey, label);
  touchBoard(boardId);
  const row =
    result.changes > 0
      ? (db.prepare("SELECT * FROM board_edges WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>)
      : (db.prepare("SELECT * FROM board_edges WHERE board_id = ? AND from_key = ? AND to_key = ?").get(boardId, fromKey, toKey) as Record<string, unknown>);
  return rowToEdge(row);
}

export function updateEdge(
  id: number,
  fields: { label?: string; color?: string; style?: "dashed" | "solid" }
): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.label !== undefined) { sets.push("label = ?"); vals.push(fields.label); }
  if (fields.color !== undefined) { sets.push("color = ?"); vals.push(fields.color); }
  if (fields.style !== undefined) { sets.push("style = ?"); vals.push(fields.style); }
  if (sets.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE board_edges SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function removeEdge(id: number): void {
  getDb().prepare("DELETE FROM board_edges WHERE id = ?").run(id);
}

// ── Stickies ──────────────────────────────────────────────────────────────────

export function addSticky(boardId: number, x = 0, y = 0): BoardSticky {
  const db = getDb();
  const result = db.prepare("INSERT INTO board_stickies (board_id, x, y) VALUES (?, ?, ?)").run(boardId, x, y);
  touchBoard(boardId);
  const row = db.prepare("SELECT * FROM board_stickies WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
  return rowToSticky(row);
}

export function updateSticky(
  id: number,
  fields: { content?: string; x?: number; y?: number; color?: string }
): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.content !== undefined) { sets.push("content = ?"); vals.push(fields.content); }
  if (fields.x !== undefined) { sets.push("x = ?"); vals.push(fields.x); }
  if (fields.y !== undefined) { sets.push("y = ?"); vals.push(fields.y); }
  if (fields.color !== undefined) { sets.push("color = ?"); vals.push(fields.color); }
  if (sets.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE board_stickies SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function removeSticky(id: number): void {
  getDb().prepare("DELETE FROM board_stickies WHERE id = ?").run(id);
}

// ── Shapes (text / rect / ellipse / frame) ─────────────────────────────────────

export function addShape(
  boardId: number,
  kind: ShapeKind,
  x = 0, y = 0, w = 240, h = 140
): BoardShape {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO board_shapes (board_id, kind, x, y, w, h) VALUES (?, ?, ?, ?, ?, ?)")
    .run(boardId, kind, x, y, w, h);
  touchBoard(boardId);
  const row = db.prepare("SELECT * FROM board_shapes WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
  return rowToShape(row);
}

export function updateShape(
  id: number,
  fields: { x?: number; y?: number; w?: number; h?: number; text?: string; color?: string }
): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  (["x", "y", "w", "h", "text", "color"] as const).forEach((k) => {
    if (fields[k] !== undefined) { sets.push(`${k} = ?`); vals.push(fields[k]); }
  });
  if (sets.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE board_shapes SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function removeShape(id: number): void {
  getDb().prepare("DELETE FROM board_shapes WHERE id = ?").run(id);
}
