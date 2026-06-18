import type { ArgNode, Edge } from "./types";

// Nested blocks (concept v2-B). A node with is_block owns an internal sub-canvas;
// its children are the nodes whose parent_id is that block. Edges are scoped to a
// single level (both endpoints share a parent).

export function childrenOf(parentId: number | null, nodes: ArgNode[]): ArgNode[] {
  return nodes.filter((n) => (n.parent_id ?? null) === parentId);
}

// Edges visible at one level: both endpoints live at that level.
export function edgesAtLevel(parentId: number | null, nodes: ArgNode[], edges: Edge[]): Edge[] {
  const atLevel = new Set(childrenOf(parentId, nodes).map((n) => n.id));
  return edges.filter((e) => atLevel.has(e.from_id) && atLevel.has(e.to_id));
}

// A block's output = its conclusion: the child with no outgoing internal edge
// (the sink). On ties or none, fall back to the most-recently-created child.
export function blockOutput(blockId: number, nodes: ArgNode[], edges: Edge[]): ArgNode | null {
  const kids = nodes.filter((n) => n.parent_id === blockId);
  if (kids.length === 0) return null;
  const kidIds = new Set(kids.map((k) => k.id));
  const hasOutgoing = new Set(
    edges.filter((e) => kidIds.has(e.from_id) && kidIds.has(e.to_id)).map((e) => e.from_id),
  );
  const sinks = kids.filter((k) => !hasOutgoing.has(k.id));
  const pool = sinks.length ? sinks : kids;
  return pool.reduce((a, b) => (b.id > a.id ? b : a));
}
