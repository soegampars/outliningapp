import { getDb } from "../db";
import type { ArgNode, Edge, EdgeKind, NodeType, Source, Strength, Support } from "../model/types";

// CRUD over the SQLite model. SQLite stays the single source of truth (§2.4);
// the in-memory store (state/store.ts) is a projection hydrated from here.

async function conn() {
  return (await getDb()).db;
}

export async function listNodeTypes(): Promise<NodeType[]> {
  const db = await conn();
  return db.select<NodeType>(
    "SELECT id, name, icon, role, sort_order, builtin FROM node_type ORDER BY sort_order, name",
  );
}

export async function listNodes(): Promise<ArgNode[]> {
  const db = await conn();
  return db.select<ArgNode>(
    "SELECT id, type_id, claim, body, strength, attention, pos_x, pos_y FROM node",
  );
}

export async function listEdges(): Promise<Edge[]> {
  const db = await conn();
  return db.select<Edge>("SELECT id, from_id, to_id, kind FROM edge");
}

export async function createNode(
  typeId: number,
  x: number,
  y: number,
  claim = "",
): Promise<number> {
  const db = await conn();
  const r = await db.execute(
    "INSERT INTO node (type_id, claim, pos_x, pos_y) VALUES ($1, $2, $3, $4)",
    [typeId, claim, x, y],
  );
  return Number(r.lastInsertId);
}

export async function updateNodeClaim(id: number, claim: string): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE node SET claim = $1, updated_at = datetime('now') WHERE id = $2", [
    claim,
    id,
  ]);
}

export async function updateNodeBody(id: number, body: string): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE node SET body = $1, updated_at = datetime('now') WHERE id = $2", [
    body,
    id,
  ]);
}

export async function updateNodeType(id: number, typeId: number): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE node SET type_id = $1, updated_at = datetime('now') WHERE id = $2", [
    typeId,
    id,
  ]);
}

export async function updateNodeStrength(id: number, strength: Strength): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE node SET strength = $1, updated_at = datetime('now') WHERE id = $2", [
    strength,
    id,
  ]);
}

export async function updateNodeAttention(id: number, attention: number): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE node SET attention = $1, updated_at = datetime('now') WHERE id = $2", [
    attention,
    id,
  ]);
}

export async function updateNodePosition(id: number, x: number, y: number): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE node SET pos_x = $1, pos_y = $2 WHERE id = $3", [x, y, id]);
}

// Manual cascade (FK enforcement is unreliable across pooled connections).
export async function deleteNode(id: number): Promise<void> {
  const db = await conn();
  await db.execute("DELETE FROM support WHERE node_id = $1", [id]);
  await db.execute("DELETE FROM edge WHERE from_id = $1 OR to_id = $1", [id]);
  await db.execute("DELETE FROM linear_order WHERE node_id = $1", [id]);
  await db.execute("DELETE FROM node WHERE id = $1", [id]);
}

export async function createEdge(
  fromId: number,
  toId: number,
  kind: EdgeKind = "conjunctive",
): Promise<number> {
  const db = await conn();
  const r = await db.execute("INSERT INTO edge (from_id, to_id, kind) VALUES ($1, $2, $3)", [
    fromId,
    toId,
    kind,
  ]);
  return Number(r.lastInsertId);
}

export async function deleteEdge(id: number): Promise<void> {
  const db = await conn();
  await db.execute("DELETE FROM edge WHERE id = $1", [id]);
}

export async function updateEdgeKind(id: number, kind: EdgeKind): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE edge SET kind = $1 WHERE id = $2", [kind, id]);
}

// --- Supports (one use of evidence on one node; §3) ---

export async function listSupportsForNode(nodeId: number): Promise<Support[]> {
  const db = await conn();
  return db.select<Support>(
    "SELECT id, node_id, text, source_id, sort_order FROM support WHERE node_id = $1 ORDER BY sort_order, id",
    [nodeId],
  );
}

export async function createSupport(
  nodeId: number,
  text: string,
  sourceId: number | null,
  sortOrder: number,
): Promise<number> {
  const db = await conn();
  const r = await db.execute(
    "INSERT INTO support (node_id, text, source_id, sort_order) VALUES ($1, $2, $3, $4)",
    [nodeId, text, sourceId, sortOrder],
  );
  return Number(r.lastInsertId);
}

export async function updateSupportText(id: number, text: string): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE support SET text = $1 WHERE id = $2", [text, id]);
}

export async function updateSupportSource(id: number, sourceId: number | null): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE support SET source_id = $1 WHERE id = $2", [sourceId, id]);
}

export async function deleteSupport(id: number): Promise<void> {
  const db = await conn();
  await db.execute("DELETE FROM support WHERE id = $1", [id]);
}

// --- Sources (populated by BibTeX import in Step 4) ---

export async function listSources(): Promise<Source[]> {
  const db = await conn();
  return db.select<Source>(
    "SELECT id, key, author, year, title, venue, raw_bibtex FROM source ORDER BY key",
  );
}

// Insert a node with all fields set (used by duplicate).
export async function createNodeFull(n: {
  type_id: number;
  claim: string;
  body: string;
  strength: Strength;
  attention: number;
  pos_x: number;
  pos_y: number;
}): Promise<number> {
  const db = await conn();
  const r = await db.execute(
    "INSERT INTO node (type_id, claim, body, strength, attention, pos_x, pos_y) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [n.type_id, n.claim, n.body, n.strength, n.attention, n.pos_x, n.pos_y],
  );
  return Number(r.lastInsertId);
}

// Import-only, refresh-by-stable-key (concept §3, §6.5): match on citekey and
// update the record in place, never creating a duplicate. The canonical library
// stays in Zotero.
export async function upsertSource(s: {
  key: string;
  author: string | null;
  year: string | null;
  title: string | null;
  venue: string | null;
  raw_bibtex: string;
}): Promise<void> {
  const db = await conn();
  await db.execute(
    `INSERT INTO source (key, author, year, title, venue, raw_bibtex)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(key) DO UPDATE SET
       author = excluded.author,
       year = excluded.year,
       title = excluded.title,
       venue = excluded.venue,
       raw_bibtex = excluded.raw_bibtex`,
    [s.key, s.author, s.year, s.title, s.venue, s.raw_bibtex],
  );
}
