import { Fragment } from "react";
import { useSpine } from "../state/store";
import type { ArgNode } from "../model/types";
import { blockOutput } from "../model/blocks";

// Location bar shown while inside a block: Top ▸ A ▸ B. Each crumb jumps to that
// level; the last is the current block. Returns null at the top (concept v2-B,
// extended to the 3-layer trail in v3).
export function Breadcrumb() {
  const currentParentId = useSpine((s) => s.currentParentId);
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const drillTo = useSpine((s) => s.drillTo);
  const drillUp = useSpine((s) => s.drillUp);

  if (currentParentId == null) return null;

  // Walk from the current block up to the top, building the trail top-first.
  const chain: ArgNode[] = [];
  let cur: number | null = currentParentId;
  let guard = 0;
  while (cur != null && guard++ < 8) {
    const blk = nodes.find((n) => n.id === cur);
    if (!blk) break;
    chain.unshift(blk);
    cur = blk.parent_id;
  }
  const labelOf = (blk: ArgNode) => blockOutput(blk.id, nodes, edges)?.claim || blk.claim || "(block)";

  return (
    <div className="breadcrumb">
      <button className="breadcrumb__crumb" onClick={() => drillTo(null)}>
        Top
      </button>
      {chain.map((blk, i) => {
        const last = i === chain.length - 1;
        return (
          <Fragment key={blk.id}>
            <span className="breadcrumb__sep">▸</span>
            {last ? (
              <span className="breadcrumb__current" title={labelOf(blk)}>
                {labelOf(blk)}
              </span>
            ) : (
              <button
                className="breadcrumb__crumb"
                onClick={() => drillTo(blk.id)}
                title={labelOf(blk)}
              >
                {labelOf(blk)}
              </button>
            )}
          </Fragment>
        );
      })}
      <button
        className="breadcrumb__up"
        onClick={() => drillUp()}
        title="Back to the level above (Esc)"
      >
        ↑ Up
      </button>
    </div>
  );
}
