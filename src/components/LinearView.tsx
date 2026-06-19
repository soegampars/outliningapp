import { useMemo } from "react";
import { useSpine } from "../state/store";
import type { ArgNode, Support } from "../model/types";
import { computeEffectiveStrength } from "../model/strength";
import { gapTypeIds } from "../model/gaps";
import { shortLabel } from "../lib/bibtex";

// Linear / drafting view (§4.3): the whole argument top-to-bottom in the curated
// order, supports inline, read as a document. An occasional global switch — not
// the side panel. The author reshapes the order here (the "dimension reduction").
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
  const gapIds = useMemo(() => gapTypeIds(nodeTypeById), [nodeTypeById]);
  const effectiveById = useMemo(
    () => computeEffectiveStrength(nodes, edges, gapIds),
    [nodes, edges, gapIds],
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

  const ordered = linearOrder.map((id) => nodeById.get(id)).filter((n): n is ArgNode => !!n);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= linearOrder.length) return;
    const arr = [...linearOrder];
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    void setLinearOrder(arr);
  };

  const open = (id: number) => focusNode(id);

  return (
    <div className="linear-view">
      {ordered.length === 0 ? (
        <div className="linear-empty">No moves yet — add some in the graph view.</div>
      ) : (
        <div className="linear-doc">
          {ordered.map((n, i) => {
            const eff = effectiveById[n.id] ?? n.strength;
            const sups = supportsByNode.get(n.id) ?? [];
            return (
              <section key={n.id} className="linear-item">
                <div className="linear-item__bar">
                  <span className={"linear-badge strength-text-" + eff}>
                    {nodeTypeById[n.type_id]?.name ?? "NODE"} · {eff}
                  </span>
                  {n.attention ? (
                    <span className="linear-attention" title="Attention">
                      ⚑
                    </span>
                  ) : null}
                  <span className="linear-item__spacer" />
                  <button
                    className="linear-move"
                    title="Move up"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    ↑
                  </button>
                  <button
                    className="linear-move"
                    title="Move down"
                    onClick={() => move(i, 1)}
                    disabled={i === ordered.length - 1}
                  >
                    ↓
                  </button>
                </div>
                <h3 className="linear-claim" onClick={() => open(n.id)} title="Open in the graph">
                  {n.claim || "(untitled)"}
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
