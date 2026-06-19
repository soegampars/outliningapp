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
  skipFeeder?: (fromId: number) => boolean,
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
      // Framing feeders don't impose a cap — their quality is judged separately.
      if (skipFeeder && skipFeeder(e.from_id)) continue;
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

const EMPTY: Set<number> = new Set();

// The type-mode sets that shape strength (concept v3): gap holes, `derived` types
// whose strength comes only from their premises, and `framing` types judged on a
// separate basis that do not propagate their weakness.
export interface TypeModes {
  gap?: Set<number>;
  derived?: Set<number>;
  framing?: Set<number>;
}

// Effective (propagated) strength for every node, bridging block boundaries
// (concept §3 + v2-C) and accounting for gaps (v2-D) and type modes (v3).
//
// - gap with downstream dependents -> broken (poisons what rests on it); a gap
//   with none is a legitimate open ending and keeps its own strength.
// - derived type (conclusion/implication) -> strength is the weakest of its
//   (non-framing) premises; with no premise support it reads unfinished.
// - framing type -> keeps its own strength and does NOT cap what builds on it.
export function computeEffectiveStrength(
  nodes: ArgNode[],
  edges: Edge[],
  modes: TypeModes = {},
): Record<number, Strength> {
  const gapTypeIds = modes.gap ?? EMPTY;
  const derivedTypeIds = modes.derived ?? EMPTY;
  const framingTypeIds = modes.framing ?? EMPTY;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const own = (n: ArgNode) => RANK[n.strength];
  const isFraming = (id: number) => {
    const n = byId.get(id);
    return !!n && framingTypeIds.has(n.type_id);
  };

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
  // In-degree counting only real (non-framing) support, for derived nodes.
  const supportInDeg = new Map<number, number>();
  for (const e of edges) {
    outDeg.set(e.from_id, (outDeg.get(e.from_id) ?? 0) + 1);
    if (!isFraming(e.from_id)) supportInDeg.set(e.to_id, (supportInDeg.get(e.to_id) ?? 0) + 1);
  }
  const hasDependents = (id: number) => (outDeg.get(id) ?? 0) > 0;
  const hasSupport = (id: number) => (supportInDeg.get(id) ?? 0) > 0;
  const isGap = (n: ArgNode) => gapTypeIds.has(n.type_id);

  const result = new Map<number, number>();
  const computed = new Set<number | null>();

  // Recursively propagate each level (top, then each block's inner level), so an
  // inner weak link bridges up through any depth (capped to 3 by the UI).
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
      if (framingTypeIds.has(n.type_id)) return own(n);
      // Derived: own strength is ignored — the weakest premise governs (computed
      // by propagateLevel from feeders); with no real support, it's a stub.
      if (derivedTypeIds.has(n.type_id)) return hasSupport(id) ? RANK.strong : RANK.unfinished;
      return isGap(n) && hasDependents(id) ? 0 : own(n);
    };
    const eff = propagateLevel(levelNodes, edges, baseRank, isFraming);
    for (const [id, r] of eff) result.set(id, r);
  };

  computeLevel(null);

  const out: Record<number, Strength> = {};
  for (const n of nodes) out[n.id] = BY_RANK[result.get(n.id) ?? own(n)];
  return out;
}
