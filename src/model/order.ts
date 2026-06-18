import type { ArgNode, Edge } from "./types";

// Proposed reading order: feeders before the moves they support (Kahn's
// topological sort). Cycles and leftovers are appended by id. This is the
// "proposed initial order" of §7/§4.3 that the author then reshapes.
export function topoOrderIds(nodes: ArgNode[], edges: Edge[]): number[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indeg = new Map<number, number>();
  for (const n of nodes) indeg.set(n.id, 0);
  const outAdj = new Map<number, number[]>();
  for (const e of edges) {
    if (!byId.has(e.from_id) || !byId.has(e.to_id)) continue;
    indeg.set(e.to_id, (indeg.get(e.to_id) ?? 0) + 1);
    const arr = outAdj.get(e.from_id);
    if (arr) arr.push(e.to_id);
    else outAdj.set(e.from_id, [e.to_id]);
  }
  const queue = nodes
    .filter((n) => (indeg.get(n.id) ?? 0) === 0)
    .map((n) => n.id)
    .sort((a, b) => a - b);
  const ordered: number[] = [];
  const seen = new Set<number>();
  while (queue.length) {
    const id = queue.shift() as number;
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
    for (const to of (outAdj.get(id) ?? []).slice().sort((a, b) => a - b)) {
      indeg.set(to, (indeg.get(to) ?? 1) - 1);
      if ((indeg.get(to) ?? 0) === 0 && !seen.has(to)) queue.push(to);
    }
  }
  for (const n of nodes) if (!seen.has(n.id)) ordered.push(n.id);
  return ordered;
}
