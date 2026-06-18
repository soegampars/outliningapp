import type { Db } from "./types";

// Default extensible node types (concept §3, §6.1). A type is data, not code:
// the user can add/rename/retype these in-app. `role` decides skeleton visibility
// ('structural' shown on the canvas, 'aside' hidden). Everything seeds as
// structural per §6.1's default; the user reassigns as they wish.
export const DEFAULT_NODE_TYPES: { name: string; role: "structural" | "aside" }[] = [
  { name: "PREMISE", role: "structural" },
  { name: "TENSION", role: "structural" },
  { name: "REDUCTIO", role: "structural" },
  { name: "IMPLICATION", role: "structural" },
  { name: "CONCLUSION", role: "structural" },
  { name: "QUESTION", role: "structural" },
  { name: "PROPOSAL", role: "structural" },
  { name: "OPEN GAP", role: "structural" },
  { name: "GAP", role: "structural" },
  { name: "CAVEAT", role: "structural" },
];

// Idempotent schema setup. Run once per connection on startup. We keep schema in
// TS (not Rust migrations) so model changes don't require touching the backend.
// Foreign keys are documented here but cascades are enforced in the data layer,
// since PRAGMA foreign_keys is unreliable across a pooled connection.
export async function initSchema(db: Db): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS node_type (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      icon       TEXT,
      role       TEXT NOT NULL DEFAULT 'structural' CHECK (role IN ('structural','aside')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      builtin    INTEGER NOT NULL DEFAULT 0
    )`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS node (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type_id    INTEGER NOT NULL REFERENCES node_type(id),
      claim      TEXT NOT NULL DEFAULT '',
      body       TEXT NOT NULL DEFAULT '',
      strength   TEXT NOT NULL DEFAULT 'unfinished' CHECK (strength IN ('strong','unfinished','weak')),
      attention  INTEGER NOT NULL DEFAULT 0,
      pos_x      REAL NOT NULL DEFAULT 0,
      pos_y      REAL NOT NULL DEFAULT 0,
      parent_id  INTEGER REFERENCES node(id),
      is_block   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS edge (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER NOT NULL REFERENCES node(id),
      to_id   INTEGER NOT NULL REFERENCES node(id),
      kind    TEXT NOT NULL DEFAULT 'conjunctive' CHECK (kind IN ('conjunctive','disjunctive')),
      UNIQUE (from_id, to_id)
    )`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS source (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key        TEXT NOT NULL UNIQUE,
      author     TEXT,
      year       TEXT,
      title      TEXT,
      venue      TEXT,
      raw_bibtex TEXT
    )`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS support (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id    INTEGER NOT NULL REFERENCES node(id),
      text       TEXT NOT NULL DEFAULT '',
      source_id  INTEGER REFERENCES source(id),
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);

  // Curated reading sequence — a first-class object (concept §3 view-state).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS linear_order (
      node_id  INTEGER PRIMARY KEY REFERENCES node(id),
      position INTEGER NOT NULL
    )`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )`);

  // Migrations for databases created before nested blocks (v2-B). SQLite has no
  // "ADD COLUMN IF NOT EXISTS", so check the columns first.
  const nodeCols = await db.select<{ name: string }>("PRAGMA table_info(node)");
  const names = new Set(nodeCols.map((c) => c.name));
  if (!names.has("parent_id")) {
    await db.execute("ALTER TABLE node ADD COLUMN parent_id INTEGER");
  }
  if (!names.has("is_block")) {
    await db.execute("ALTER TABLE node ADD COLUMN is_block INTEGER NOT NULL DEFAULT 0");
  }

  const rows = await db.select<{ n: number }>(`SELECT COUNT(*) AS n FROM node_type`);
  if (Number(rows[0]?.n ?? 0) === 0) {
    let i = 0;
    for (const t of DEFAULT_NODE_TYPES) {
      await db.execute(
        `INSERT INTO node_type (name, role, sort_order, builtin) VALUES ($1, $2, $3, 1)`,
        [t.name, t.role, i++],
      );
    }
  }
}
