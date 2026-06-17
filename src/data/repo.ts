import { getDb } from "../db";
import type { ArgNode, Edge, EdgeKind, NodeType } from "../model/types";

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

export async function updateNodeType(id: number, typeId: number): Promise<void> {
  const db = await conn();
  await db.execute("UPDATE node SET type_id = $1, updated_at = datetime('now') WHERE id = $2", [
    typeId,
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
