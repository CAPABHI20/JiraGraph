import type Database from "better-sqlite3";

export function runSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_key TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('text','voice')),
      linked_ticket_keys TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notes_ticket_key ON notes(ticket_key);

    CREATE TABLE IF NOT EXISTS semantic_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_key TEXT NOT NULL,
      tickets_hash TEXT NOT NULL,
      edges_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_key, tickets_hash)
    );

    CREATE TABLE IF NOT EXISTS playground_nodes (
      ticket_key TEXT PRIMARY KEY,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playground_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_key TEXT NOT NULL,
      to_key TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(from_key, to_key)
    );

    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Untitled board',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS board_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      ticket_key TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      urgency TEXT NOT NULL DEFAULT 'none',
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(board_id, ticket_key)
    );

    CREATE INDEX IF NOT EXISTS idx_board_nodes_board ON board_nodes(board_id);

    CREATE TABLE IF NOT EXISTS board_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      from_key TEXT NOT NULL,
      to_key TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#38BDF8',
      style TEXT NOT NULL DEFAULT 'dashed',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(board_id, from_key, to_key)
    );

    CREATE INDEX IF NOT EXISTS idx_board_edges_board ON board_edges(board_id);

    CREATE TABLE IF NOT EXISTS board_stickies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#FBBF24',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_board_stickies_board ON board_stickies(board_id);

    CREATE TABLE IF NOT EXISTS board_shapes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'text',
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      w REAL NOT NULL DEFAULT 240,
      h REAL NOT NULL DEFAULT 140,
      text TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#8B5CF6',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_board_shapes_board ON board_shapes(board_id);
  `);
}
