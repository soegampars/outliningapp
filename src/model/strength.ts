import type { ArgNode, Edge, Strength } from "./types";
import { blockOutput } from "./blocks";

const RANK: Record<Strength, number> = { weak: 0, unfinished: 1, strong: 2 };
const BY_RANK: Strength[] = ["weak", "unfinished", "strong"];

export function strengthRank(s: Strength): number {
  return RANK[s];
}

// Weakest-link propagation over a single level (concept §3): conjunctive feeders
// combine by MIN, a disjunctive set by MAX, capped by the node's baseline rank.
// `baseRank` is the node's own contribution (its manual strength, or — for a
// block — its bridged inner strength). Cycles fall back to the baseline.
function propagateLevel(
  levelNodes: ArgNode[],
  edges: Edge[],
  baseRank: (id: number) => number,
): Map<number, number> {
  const ids = new Set(levelNodes.map((n) => n.id));
  const feedersByTarget = new Map<number, Edge[]>();
  for (const e of edges) {
    if (!ids.has(e.from_id) || !ids.has(e.to_id)) continue;
    const a = feedersByTarget.get(e.to_id);
    if (a) a.push(e);
    else feedersByTarget.set(e.to_id, [e]);
  }

  const memo = new Map<number, number>();
  const visiting = new Set<number>();
  const eff = (id: number): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return baseRank(id);
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

    let val = baseRank(id);
    if (legs.length) val = Math.min(val, ...legs);

    visiting.delete(id);
    memo.set(id, val);
    return val;
  };

  const out = new Map<number, number>();
  for (const n of levelNodes) out.set(n.id, eff(n.id));
  return out;
}

// Effective (propagated) strength for every node, bridging block boundaries
// (concept §3 + v2-C). A block's effective = its output node's effective within
// the block, capped by the block's own strength; that surfaces on the collapsed
// block and propagates onward at the parent level.
export function computeEffectiveStrength(nodes: ArgNode[], edges: Edge[]): Record<number, Strength> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const own = (n: ArgNode) => RANK[n.strength];
  const ownById = (id: number) => {
    const n = byId.get(id);
    return n ? own(n) : 1;
  };
  const result = new Map<number, number>();

  // 1. Inside each block: propagate over its children, then bridge the output up
  //    to a baseline for the block (capped by the block's own strength).
  const blockBase = new Map<number, number>();
  for (const block of nodes) {
    if (!block.is_block) continue;
    const children = nodes.filter((n) => n.parent_id === block.id);
    const childEff = propagateLevel(children, edges, ownById);
    for (const [cid, r] of childEff) result.set(cid, r);
    const output = blockOutput(block.id, nodes, edges);
    const outRank = output ? (childEff.get(output.id) ?? own(output)) : own(block);
    blockBase.set(block.id, Math.min(own(block), outRank));
  }

  // 2. Top level: each node's baseline is its bridged block strength (if a block)
  //    or its own strength.
  const top = nodes.filter((n) => (n.parent_id ?? null) === null);
  const topEff = propagateLevel(top, edges, (id) => {
    const n = byId.get(id);
    if (!n) return 1;
    return n.is_block ? (blockBase.get(id) ?? own(n)) : own(n);
  });
  for (const [id, r] of topEff) result.set(id, r);

  const out: Record<number, Strength> = {};
  for (const n of nodes) out[n.id] = BY_RANK[result.get(n.id) ?? own(n)];
  return out;
}
