import { useMemo, useState } from "react";
import { useSpine } from "../state/store";
import type { ArgNode, Support } from "../model/types";
import { computeEffectiveStrength } from "../model/strength";
import { gapTypeIds } from "../model/gaps";
import { derivedTypeIds, framingTypeIds } from "../model/strengthModes";
import { topoOrderIds } from "../model/order";
import { childrenOf, edgesAtLevel, blockOutput } from "../model/blocks";
import { shortLabel } from "../lib/bibtex";

// Linear / drafting view (§4.3, integrated in v3): the whole argument top-to-
// bottom in the curated order, with each block's inner chain shown beneath it,
// indented and dimmed so the top-level thread stays dominant. The author reshapes
// the top-level order here; sub-levels follow their own dependency order.
export function LinearView() {
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const allSupports = useSpine((s) => s.supports);
  const linearOrder = useSpine((s) => s.linearOrder);
  const nodeTypeById = useSpine((s) => s.nodeTypeById);
  const sourceById = useSpine((s) => s.sourceById);
  const setLinearOrder = useSpine((s) => s.setLinearOrder);
  const focusNode = useSpine((s) => s.focusNode);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const typeModes = useMemo(
    () => ({
      gap: gapTypeIds(nodeTypeById),
      derived: derivedTypeIds(nodeTypeById),
      framing: framingTypeIds(nodeTypeById),
    }),
    [nodeTypeById],
  );
  const effectiveById = useMemo(
    () => computeEffectiveStrength(nodes, edges, typeModes),
    [nodes, edges, typeModes],
  );
  const supportsByNode = useMemo(() => {
    const m = new Map<number, Support[]>();
    for (const s of allSupports) {
      const a = m.get(s.node_id);
      if (a) a.push(s);
      else m.set(s.node_id, [s]);
    }
    return m;
  }, [allSupports]);

  // The curated top-level sequence: the saved order, plus any new top-level nodes.
  const topSeq = useMemo(() => {
    const top = childrenOf(null, nodes);
    const ids = new Set(top.map((n) => n.id));
    const seq = linearOrder.filter((id) => ids.has(id));
    const seen = new Set(seq);
    for (const n of top) if (!seen.has(n.id)) seq.push(n.id);
    return seq;
  }, [nodes, linearOrder]);

  // Flatten the tree into ordered rows with a nesting depth: top level in the
  // curated order, each block's children (in dependency order) right beneath it.
  const rows = useMemo(() => {
    const out: { node: ArgNode; depth: number }[] = [];
    const walk = (depth: number, order: number[]) => {
      for (const id of order) {
        const n = nodeById.get(id);
        if (!n) continue;
        out.push({ node: n, depth });
        if (n.is_block) {
          const kids = childrenOf(n.id, nodes);
          walk(depth + 1, topoOrderIds(kids, edgesAtLevel(n.id, nodes, edges)));
        }
      }
    };
    walk(0, topSeq);
    return out;
  }, [nodes, edges, nodeById, topSeq]);

  const move = (nodeId: number, dir: -1 | 1) => {
    const arr = [...topSeq];
    const i = arr.indexOf(nodeId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    void setLinearOrder(arr);
  };

  // Top-level drag reorder (v3). Only depth-0 rows are draggable; sub-levels keep
  // their own dependency order. Drops the dragged id immediately before the target.
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dropLinearOn = (targetId: number) => {
    if (dragId == null || dragId === targetId) return;
    const arr = topSeq.filter((id) => id !== dragId);
    const at = arr.indexOf(targetId);
    if (at < 0) return;
    arr.splice(at, 0, dragId);
    void setLinearOrder(arr);
  };

  const open = (id: number) => focusNode(id);
  const labelOf = (n: ArgNode) =>
    (n.is_block ? blockOutput(n.id, nodes, edges)?.claim || n.claim : n.claim) || "(untitled)";

  return (
    <div className="linear-view">
      {rows.length === 0 ? (
        <div className="linear-empty">No moves yet — add some in the graph view.</div>
      ) : (
        <div className="linear-doc">
          {rows.map(({ node: n, depth }) => {
            const eff = effectiveById[n.id] ?? n.strength;
            const sups = supportsByNode.get(n.id) ?? [];
            const topIndex = depth === 0 ? topSeq.indexOf(n.id) : -1;
            return (
              <section
                key={n.id}
                className={
                  "linear-item" +
                  (depth > 0 ? " linear-item--nested" : "") +
                  (dragId === n.id ? " linear-item--dragging" : "") +
                  (dragOverId === n.id ? " linear-item--dragover" : "")
                }
                style={depth > 0 ? { marginLeft: depth * 26 } : undefined}
                onDragOver={(e) => {
                  if (depth !== 0) return;
                  if (!e.dataTransfer.types.includes("application/x-spine-linear")) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverId !== n.id) setDragOverId(n.id);
                }}
                onDragLeave={() => {
                  if (depth !== 0) return;
                  setDragOverId((cur) => (cur === n.id ? null : cur));
                }}
                onDrop={(e) => {
                  if (depth !== 0) return;
                  if (!e.dataTransfer.types.includes("application/x-spine-linear")) return;
                  e.preventDefault();
                  dropLinearOn(n.id);
                  setDragId(null);
                  setDragOverId(null);
                }}
              >
                <div className="linear-item__bar">
                  {depth === 0 && (
                    <span
                      className="linear-grip"
                      title="Drag to reorder"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-spine-linear", String(n.id));
                        e.dataTransfer.setData("text/plain", String(n.id));
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(n.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOverId(null);
                      }}
                    >
                      ⠿
                    </span>
                  )}
                  <span className={"linear-badge strength-text-" + eff}>
                    {nodeTypeById[n.type_id]?.name ?? "NODE"} · {eff}
                    {n.is_block ? " ▸" : ""}
                  </span>
                  {n.attention ? (
                    <span className="linear-attention" title="Attention">
                      ⚑
                    </span>
                  ) : null}
                  <span className="linear-item__spacer" />
                  {depth === 0 && (
                    <>
                      <button
                        className="linear-move"
                        title="Move up"
                        onClick={() => move(n.id, -1)}
                        disabled={topIndex <= 0}
                      >
                        ↑
                      </button>
                      <button
                        className="linear-move"
                        title="Move down"
                        onClick={() => move(n.id, 1)}
                        disabled={topIndex === topSeq.length - 1}
                      >
                        ↓
                      </button>
                    </>
                  )}
                </div>
                <h3 className="linear-claim" onClick={() => open(n.id)} title="Open in the graph">
                  {labelOf(n)}
                </h3>
                {n.body ? <p className="linear-body">{n.body}</p> : null}
                {sups.length > 0 && (
                  <ul className="linear-supports">
                    {sups.map((s) => {
                      const src = s.source_id != null ? sourceById[s.source_id] : undefined;
                      return (
                        <li key={s.id} className={src ? "cite" : "own"}>
                          <span className="linear-support__tag">
                            {src ? shortLabel(src.author, src.year) : "own"}
                          </span>
                          {s.text ? <span> {s.text}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
