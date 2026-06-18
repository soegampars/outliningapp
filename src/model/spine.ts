import type { ArgNode, Edge } from "./types";

// Spine vs lateral support (concept v2-E) — derived, no new data. The spine is
// the main argumentative thread: the chain that ends at the terminus, choosing at
// each step the feeder that sits closest before it in the curated linear order.
// A node off that chain that nonetheless points into a spine node is a lateral
// support — it props a step up from the side rather than advancing the thread.

export interface SpineClass {
  spine: Set<number>; // node ids on the main path
  lateral: Set<number>; // off-path node ids that feed a spine node
}

export function classifySpine(
  levelNodes: ArgNode[],
  levelEdges: Edge[],
  terminusId: number | null,
  orderIndex: Map<number, number>,
): SpineClass {
  const ids = new Set(levelNodes.map((n) => n.id));
  const feedersByTarget = new Map<number, number[]>();
  for (const e of levelEdges) {
    if (!ids.has(e.from_id) || !ids.has(e.to_id)) continue;
    const a = feedersByTarget.get(e.to_id);
    if (a) a.push(e.from_id);
    else feedersByTarget.set(e.to_id, [e.from_id]);
  }

  const spine = new Set<number>();
  let cur: number | null = terminusId != null && ids.has(terminusId) ? terminusId : null;
  while (cur != null && !spine.has(cur)) {
    spine.add(cur);
    const feeders = feedersByTarget.get(cur) ?? [];
    if (feeders.length === 0) break;
    // Primary feeder = the one latest in the curated order (closest before it);
    // unordered feeders rank lowest, tie-broken by id for stability.
    let best: number | null = null;
    let bestIdx = -Infinity;
    for (const f of feeders) {
      const idx = orderIndex.has(f) ? (orderIndex.get(f) as number) : -1;
      if (idx > bestIdx || (idx === bestIdx && best != null && f > best)) {
        bestIdx = idx;
        best = f;
      }
    }
    cur = best;
  }

  const lateral = new Set<number>();
  for (const e of levelEdges) {
    if (ids.has(e.from_id) && !spine.has(e.from_id) && spine.has(e.to_id)) {
      lateral.add(e.from_id);
    }
  }

  return { spine, lateral };
}
