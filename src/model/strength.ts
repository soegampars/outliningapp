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

const NO_GAPS: Set<number> = new Set();

// Effective (propagated) strength for every node, bridging block boundaries
// (concept §3 + v2-C) and accounting for gaps (v2-D). A block's effective = its
// output node's effective within the block, capped by the block's own strength;
// that surfaces on the collapsed block and propagates onward at the parent level.
//
// `gapTypeIds` marks the hole types (Gap / Open gap / Question). A gap with
// downstream dependents is forced to broken (maximally weak) and poisons whatever
// rests on it; a gap with no dependents is the spine terminus — a legitimate open
// ending — and keeps its own strength untouched.
export function computeEffectiveStrength(
  nodes: ArgNode[],
  edges: Edge[],
  gapTypeIds: Set<number> = NO_GAPS,
): Record<number, Strength> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const own = (n: ArgNode) => RANK[n.strength];

  const childrenByParent = new Map<number | null, ArgNode[]>();
  for (const n of nodes) {
    const p = n.parent_id ?? null;
    const a = childrenByParent.get(p);
    if (a) a.push(n);
    else childrenByParent.set(p, [n]);
  }

  // Out-edges = downstream dependents (edges are scoped to one level, so a node's
  // out-degree counts dependents at its own level; a block's counts at its level).
  const outDeg = new Map<number, number>();
  for (const e of edges) outDeg.set(e.from_id, (outDeg.get(e.from_id) ?? 0) + 1);
  const hasDependents = (id: number) => (outDeg.get(id) ?? 0) > 0;
  const isGap = (n: ArgNode) => gapTypeIds.has(n.type_id);

  const result = new Map<number, number>();
  const computed = new Set<number | null>();

  // Recursively propagate each level (top, then each block's inner level), so an
  // inner weak link bridges up through any depth (capped to 3 by the UI). A node's
  // baseline: a block contributes its inner output's effective (capped by its own,
  // broken if that output is a load-bearing gap); a load-bearing gap contributes
  // broken; everything else its own strength.
  const computeLevel = (parentId: number | null) => {
    if (computed.has(parentId)) return;
    computed.add(parentId);
    const levelNodes = childrenByParent.get(parentId) ?? [];
    const baseRank = (id: number): number => {
      const n = byId.get(id);
      if (!n) return 1;
      if (n.is_block) {
        computeLevel(n.id);
        const output = blockOutput(n.id, nodes, edges);
        let outRank = output ? (result.get(output.id) ?? own(output)) : own(n);
        if (output && isGap(output) && hasDependents(n.id)) outRank = 0;
        return Math.min(own(n), outRank);
      }
      return isGap(n) && hasDependents(id) ? 0 : own(n);
    };
    const eff = propagateLevel(levelNodes, edges, baseRank);
    for (const [id, r] of eff) result.set(id, r);
  };

  computeLevel(null);

  const out: Record<number, Strength> = {};
  for (const n of nodes) out[n.id] = BY_RANK[result.get(n.id) ?? own(n)];
  return out;
}
