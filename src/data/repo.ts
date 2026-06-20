import { getDb } from "../db";
import type {
  ArgNode,
  Edge,
  EdgeKind,
  NodeType,
  Source,
  Stance,
  Strength,
  Support,
} from "../model/types";
import { DEFAULT_NODE_TYPES } from "../db/schema";

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
    "SELECT id, type_id, claim, body, strength, attention, pos_x, pos_y, parent_id, is_block FROM node",
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
  parentId: number | null = null,
): Promise<number> {
  const db = await conn();
  const r = await db.execute(
    "INSERT INTO node (type_id, claim, pos_x, pos_y, parent_id) VALUES ($1, $2, $3, $4, $5)",
    [typeId, claim, x, y, parentId],
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

// Manual cascade (FK enforcement is unreliable across pooled connections). Also
// removes any internal children if the node is a block.
export async function deleteNode(id: number): Promise<void> {
  const db = await conn();
  const kids = await db.select<{ id: number }>("SELECT id FROM node WHERE parent_id = $1", [id]);
  for (const k of kids) await deleteNode(k.id);
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
    "SELECT id, node_id, text, source_id, sort_order, stance FROM support WHERE node_id = $1 ORDER BY sort_order, id",
    [nodeId],
  );
}

export async function listAllSupports(): Promise<Support[]> {
  const db = await conn();
  return db.select<Support>(
    "SELECT id, node_id, text, source_id, sort_order, stance FROM support ORDER BY node_id, sort_order, id",
  );
}

// --- Curated linear order (concept §3 view-state, §10.6) ---

export async function getLinearOrder(): Promise<number[]> {
  const db = await conn();
  const rows = await db.select<{ node_id: number }>(
    "SELECT node_id FROM linear_order ORDER BY position",
  );
  return rows.map((r) => r.node_id);
}

export async function replaceLinearOrder(ids: number[]): Promise<void> {
  const db = await conn();
  await db.execute("DELETE FROM linear_order");
  let pos = 0;
  for (const id of ids) {
    await db.execute("INSERT INTO linear_order (node_id, position) VALUES ($1, $2)", [id, pos++]);
  }
}

export async function createSupport(
  nodeId: number,
  text: string,
  sourceId: number | null,
  sortOrder: number,
  stance: Stance = null,
): Promise<number> {
  const db = await conn();
  const r = await db.execute(
    "INSERT INTO support (node_id, text, source_id, sort_order, stance) VALUES ($1, $2, $3, $4, $5)",
    [nodeId, text, sourceId, sortOrder, stance],
  );
  return Number(r.lastInsertId);
}

export async function updateSupportStance(id: number, stance: Stance): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE support SET stance = $1 WHERE id = $2", [stance, id]);
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

// Persist a new ordering of supports: sort_order becomes the array index.
export async function setSupportOrder(ids: number[]): Promise<void> {
  const db = await conn();
  let i = 0;
  for (const id of ids) {
    await db.execute("UPDATE support SET sort_order = $1 WHERE id = $2", [i++, id]);
  }
}

// --- Sources (populated by BibTeX import in Step 4) ---

export async function listSources(): Promise<Source[]> {
  const db = await conn();
  return db.select<Source>(
    "SELECT id, key, author, year, title, venue, raw_bibtex FROM source ORDER BY key",
  );
}

// Insert a node with all fields set (used by duplicate, makeBlock, import).
export async function createNodeFull(n: {
  type_id: number;
  claim: string;
  body: string;
  strength: Strength;
  attention: number;
  pos_x: number;
  pos_y: number;
  parent_id: number | null;
  is_block: number;
}): Promise<number> {
  const db = await conn();
  const r = await db.execute(
    "INSERT INTO node (type_id, claim, body, strength, attention, pos_x, pos_y, parent_id, is_block) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    [n.type_id, n.claim, n.body, n.strength, n.attention, n.pos_x, n.pos_y, n.parent_id, n.is_block],
  );
  return Number(r.lastInsertId);
}

// Turn a (top-level) node into a block: flag it and seed an internal output node
// carrying the block's current claim. Returns the output node id.
export async function makeBlock(node: ArgNode): Promise<number> {
  const db = await conn();
  await db.execute("UPDATE node SET is_block = 1, updated_at = datetime('now') WHERE id = $1", [
    node.id,
  ]);
  return createNodeFull({
    type_id: node.type_id,
    claim: node.claim,
    body: node.body,
    strength: node.strength,
    attention: 0,
    pos_x: 240,
    pos_y: 160,
    parent_id: node.id,
    is_block: 0,
  });
}

// Flip a node's block flag. Used to dissolve a block back into a plain node
// (the caller deletes the children first). See store.dissolveBlock.
export async function setNodeIsBlock(id: number, isBlock: number): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE node SET is_block = $1, updated_at = datetime('now') WHERE id = $2", [
    isBlock,
    id,
  ]);
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

// --- Project files: wipe / seed / bulk insert, and app metadata (Save/Open) ---

export interface ProjectData {
  nodeTypes: NodeType[];
  nodes: ArgNode[];
  edges: Edge[];
  sources: Source[];
  supports: Support[];
  linearOrder: number[];
}

export async function wipeAll(): Promise<void> {
  const db = await conn();
  await db.execute("DELETE FROM linear_order");
  await db.execute("DELETE FROM support");
  await db.execute("DELETE FROM edge");
  await db.execute("DELETE FROM node");
  await db.execute("DELETE FROM source");
  await db.execute("DELETE FROM node_type");
}

export async function seedDefaultTypes(): Promise<void> {
  const db = await conn();
  let i = 0;
  for (const t of DEFAULT_NODE_TYPES) {
    await db.execute(
      "INSERT INTO node_type (name, role, sort_order, builtin) VALUES ($1, $2, $3, 1)",
      [t.name, t.role, i++],
    );
  }
}

export async function bulkInsert(p: ProjectData): Promise<void> {
  const db = await conn();
  for (const t of p.nodeTypes) {
    await db.execute(
      "INSERT INTO node_type (id, name, icon, role, sort_order, builtin) VALUES ($1, $2, $3, $4, $5, $6)",
      [t.id, t.name, t.icon, t.role, t.sort_order, t.builtin],
    );
  }
  for (const s of p.sources) {
    await db.execute(
      "INSERT INTO source (id, key, author, year, title, venue, raw_bibtex) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [s.id, s.key, s.author, s.year, s.title, s.venue, s.raw_bibtex],
    );
  }
  for (const n of p.nodes) {
    await db.execute(
      "INSERT INTO node (id, type_id, claim, body, strength, attention, pos_x, pos_y, parent_id, is_block) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
      [
        n.id,
        n.type_id,
        n.claim,
        n.body,
        n.strength,
        n.attention,
        n.pos_x,
        n.pos_y,
        n.parent_id ?? null,
        n.is_block ?? 0,
      ],
    );
  }
  for (const e of p.edges) {
    await db.execute("INSERT INTO edge (id, from_id, to_id, kind) VALUES ($1, $2, $3, $4)", [
      e.id,
      e.from_id,
      e.to_id,
      e.kind,
    ]);
  }
  for (const s of p.supports) {
    await db.execute(
      "INSERT INTO support (id, node_id, text, source_id, sort_order, stance) VALUES ($1, $2, $3, $4, $5, $6)",
      [s.id, s.node_id, s.text, s.source_id, s.sort_order, s.stance ?? null],
    );
  }
  let pos = 0;
  for (const id of p.linearOrder) {
    await db.execute("INSERT INTO linear_order (node_id, position) VALUES ($1, $2)", [id, pos++]);
  }
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await conn();
  const rows = await db.select<{ value: string | null }>(
    "SELECT value FROM app_meta WHERE key = $1",
    [key],
  );
  return rows.length ? (rows[0]?.value ?? null) : null;
}

export async function setMeta(key: string, value: string | null): Promise<void> {
  const db = await conn();
  await db.execute(
    "INSERT INTO app_meta (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}
