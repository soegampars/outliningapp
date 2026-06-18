import type { ArgNode, Edge, Strength } from "./types";

const RANK: Record<Strength, number> = { weak: 0, unfinished: 1, strong: 2 };
const BY_RANK: Strength[] = ["weak", "unfinished", "strong"];

export function strengthRank(s: Strength): number {
  return RANK[s];
}

// Weakest-link effective strength (concept §3, §6.2).
//
// - Conjunctive feeders combine by MIN (the weakest necessary support).
// - A set of disjunctive feeders combines by MAX (the strongest sufficient leg).
// - The disjunctive set then acts as a single leg among the conjunctive minimums.
// - The result is capped by the node's own manual strength.
// - A node with no feeders shows its own strength.
//
// Cycles (which shouldn't occur in a sound argument) fall back to own strength
// to keep the computation total.
export function computeEffectiveStrength(
  nodes: ArgNode[],
  edges: Edge[],
): Record<number, Strength> {
  const own: Record<number, number> = {};
  for (const n of nodes) own[n.id] = RANK[n.strength];

  const feedersByTarget = new Map<number, Edge[]>();
  for (const e of edges) {
    const arr = feedersByTarget.get(e.to_id);
    if (arr) arr.push(e);
    else feedersByTarget.set(e.to_id, [e]);
  }

  const memo = new Map<number, number>();
  const visiting = new Set<number>();

  const eff = (id: number): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return own[id] ?? 1; // cycle guard
    visiting.add(id);

    const feeders = feedersByTarget.get(id) ?? [];
    const conjunctive: number[] = [];
    const disjunctive: number[] = [];
    for (const e of feeders) {
      const v = eff(e.from_id);
      if (e.kind === "disjunctive") disjunctive.push(v);
      else conjunctive.push(v);
    }

    const legs = [...conjunctive];
    if (disjunctive.length) legs.push(Math.max(...disjunctive));

    let val = own[id] ?? 1;
    if (legs.length) val = Math.min(val, ...legs);

    visiting.delete(id);
    memo.set(id, val);
    return val;
  };

  const out: Record<number, Strength> = {};
  for (const n of nodes) out[n.id] = BY_RANK[eff(n.id)];
  return out;
}
