import type { ArgNode, Edge, Source, Support } from "./types";

// Provenance / "monoculture of evidence" tools (concept §6.4).

// Footprint: the node ids that cite a given source.
export function sourceFootprint(sourceId: number, supports: Support[]): Set<number> {
  const ids = new Set<number>();
  for (const s of supports) if (s.source_id === sourceId) ids.add(s.node_id);
  return ids;
}

// "Stakes" of a node = 1 + number of moves that transitively rest on it (reached
// by following outgoing feeder edges). A load-bearing premise scores high; a
// leaf elaboration scores 1.
function stakesByNode(nodes: ArgNode[], edges: Edge[]): Map<number, number> {
  const outAdj = new Map<number, number[]>();
  for (const e of edges) {
    const a = outAdj.get(e.from_id);
    if (a) a.push(e.to_id);
    else outAdj.set(e.from_id, [e.to_id]);
  }
  const reach = (start: number): number => {
    const seen = new Set<number>();
    const stack = [start];
    while (stack.length) {
      const id = stack.pop() as number;
      for (const to of outAdj.get(id) ?? []) {
        if (!seen.has(to)) {
          seen.add(to);
          stack.push(to);
        }
      }
    }
    return seen.size;
  };
  const m = new Map<number, number>();
  for (const n of nodes) m.set(n.id, 1 + reach(n.id));
  return m;
}

export interface SourceLoad {
  nodeCount: number; // footprint size
  supportCount: number; // total supports citing it
  weight: number; // sum of stakes of the nodes it backs
}

export function sourceLoads(
  sources: Source[],
  supports: Support[],
  nodes: ArgNode[],
  edges: Edge[],
): Map<number, SourceLoad> {
  const stakes = stakesByNode(nodes, edges);
  const m = new Map<number, SourceLoad>();
  for (const src of sources) m.set(src.id, { nodeCount: 0, supportCount: 0, weight: 0 });
  const countedNodes = new Map<number, Set<number>>();
  for (const s of supports) {
    if (s.source_id == null) continue;
    const load = m.get(s.source_id);
    if (!load) continue;
    load.supportCount++;
    let set = countedNodes.get(s.source_id);
    if (!set) {
      set = new Set();
      countedNodes.set(s.source_id, set);
    }
    if (!set.has(s.node_id)) {
      set.add(s.node_id);
      load.nodeCount++;
      load.weight += stakes.get(s.node_id) ?? 1;
    }
  }
  return m;
}

export interface Spof {
  nodeId: number;
  sourceId: number;
}

// Single-point-of-failure: a node whose justification collapses if some one
// source is pulled (no source-independent path). Walks the conjunctive (all
// required) / disjunctive (any sufficient) feeder structure plus the node's own
// supports.
export function singlePointsOfFailure(
  nodes: ArgNode[],
  edges: Edge[],
  supports: Support[],
): Spof[] {
  const supportsByNode = new Map<number, Support[]>();
  for (const s of supports) {
    const a = supportsByNode.get(s.node_id);
    if (a) a.push(s);
    else supportsByNode.set(s.node_id, [s]);
  }
  const feedersByNode = new Map<number, Edge[]>();
  for (const e of edges) {
    const a = feedersByNode.get(e.to_id);
    if (a) a.push(e);
    else feedersByNode.set(e.to_id, [e]);
  }

  // Does node N still stand if source S is removed?
  const standsWithout = (nodeId: number, S: number, visiting: Set<number>): boolean => {
    if (visiting.has(nodeId)) return true; // cycle guard
    visiting.add(nodeId);
    const sups = supportsByNode.get(nodeId) ?? [];
    const feeders = feedersByNode.get(nodeId) ?? [];
    const localIndependent = sups.some((s) => s.source_id == null || s.source_id !== S);
    let result: boolean;
    if (feeders.length === 0) {
      result = sups.length === 0 ? true : localIndependent;
    } else {
      const conjOK = feeders
        .filter((e) => e.kind !== "disjunctive")
        .every((e) => standsWithout(e.from_id, S, visiting));
      const disj = feeders.filter((e) => e.kind === "disjunctive");
      const disjOK = disj.length === 0 || disj.some((e) => standsWithout(e.from_id, S, visiting));
      result = (conjOK && disjOK) || localIndependent;
    }
    visiting.delete(nodeId);
    return result;
  };

  // Sources appearing anywhere in a node's support subtree.
  const subtreeSources = (nodeId: number, seen: Set<number>, acc: Set<number>): void => {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    for (const s of supportsByNode.get(nodeId) ?? []) if (s.source_id != null) acc.add(s.source_id);
    for (const e of feedersByNode.get(nodeId) ?? []) subtreeSources(e.from_id, seen, acc);
  };

  const out: Spof[] = [];
  for (const n of nodes) {
    const srcs = new Set<number>();
    subtreeSources(n.id, new Set(), srcs);
    if (srcs.size === 0) continue;
    for (const S of srcs) {
      if (!standsWithout(n.id, S, new Set())) {
        out.push({ nodeId: n.id, sourceId: S });
        break;
      }
    }
  }
  return out;
}
