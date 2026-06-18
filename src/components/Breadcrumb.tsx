import { useSpine } from "../state/store";
import { blockOutput } from "../model/blocks";

// Location bar shown while inside a block: Top ▸ <block claim>. Returns null at
// the top level (concept v2-B navigation).
export function Breadcrumb() {
  const currentParentId = useSpine((s) => s.currentParentId);
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const drillUp = useSpine((s) => s.drillUp);

  if (currentParentId == null) return null;
  const block = nodes.find((n) => n.id === currentParentId);
  const output = block ? blockOutput(block.id, nodes, edges) : null;
  const label = output?.claim || block?.claim || "(block)";

  return (
    <div className="breadcrumb">
      <button className="breadcrumb__crumb" onClick={() => drillUp()}>
        Top
      </button>
      <span className="breadcrumb__sep">▸</span>
      <span className="breadcrumb__current" title={label}>
        {label}
      </span>
      <button className="breadcrumb__up" onClick={() => drillUp()} title="Back to the level above (Esc)">
        ↑ Up
      </button>
    </div>
  );
}
