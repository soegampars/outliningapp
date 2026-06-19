import { useEffect, useMemo, useState } from "react";
import { useSpine } from "../state/store";
import { STRENGTHS } from "../model/types";
import { computeEffectiveStrength } from "../model/strength";
import { gapTypeIds, isGapTypeName } from "../model/gaps";
import { shortLabel } from "../lib/bibtex";

// The minute-to-minute inspector (§4.2). Opens beside the canvas — the skeleton
// stays on screen; this is not a mode switch. Edits write straight through the
// store to SQLite.
export function PeekPanel() {
  const node = useSpine((s) => s.nodes.find((n) => n.id === s.selectedNodeId) ?? null);
  const selectedNodeId = useSpine((s) => s.selectedNodeId);
  const nodeTypes = useSpine((s) => s.nodeTypes);
  const nodeTypeById = useSpine((s) => s.nodeTypeById);
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const allSupports = useSpine((s) => s.supports);
  const sources = useSpine((s) => s.sources);
  const sourceById = useSpine((s) => s.sourceById);
  const setNodeClaim = useSpine((s) => s.setNodeClaim);
  const setNodeBody = useSpine((s) => s.setNodeBody);
  const setNodeType = useSpine((s) => s.setNodeType);
  const setNodeStrength = useSpine((s) => s.setNodeStrength);
  const setNodeAttention = useSpine((s) => s.setNodeAttention);
  const setEdgeKind = useSpine((s) => s.setEdgeKind);
  const addSupport = useSpine((s) => s.addSupport);
  const setSupportText = useSpine((s) => s.setSupportText);
  const setSupportSource = useSpine((s) => s.setSupportSource);
  const removeSupport = useSpine((s) => s.removeSupport);
  const select = useSpine((s) => s.select);
  const makeBlock = useSpine((s) => s.makeBlock);
  const dissolveBlock = useSpine((s) => s.dissolveBlock);
  const drillInto = useSpine((s) => s.drillInto);

  const [claim, setClaim] = useState("");
  const [body, setBody] = useState("");
  const [confirmDissolve, setConfirmDissolve] = useState(false);

  const gapIds = useMemo(() => gapTypeIds(nodeTypes), [nodeTypes]);
  const effectiveById = useMemo(
    () => computeEffectiveStrength(nodes, edges, gapIds),
    [nodes, edges, gapIds],
  );
  const supports = useMemo(
    () => allSupports.filter((s) => s.node_id === selectedNodeId),
    [allSupports, selectedNodeId],
  );

  useEffect(() => {
    setClaim(node?.claim ?? "");
    setBody(node?.body ?? "");
    setConfirmDissolve(false);
  }, [selectedNodeId, node?.claim, node?.body]);

  if (!node) return null;
  const nid = node.id;
  const effective = effectiveById[nid] ?? node.strength;

  const feeders = edges.filter((e) => e.to_id === nid);
  const dependents = edges.filter((e) => e.from_id === nid);
  const isGapNode = isGapTypeName(nodeTypeById[node.type_id]?.name);
  const nodeById = (id: number) => nodes.find((n) => n.id === id);
  const typeName = (id: number) => {
    const n = nodeById(id);
    return n ? (nodeTypeById[n.type_id]?.name ?? "") : "";
  };
  const kindLabel = (kind: string) => (kind === "disjunctive" ? "any-of" : "all-of");

  return (
    <aside className="peek-panel">
      <div className="peek-head">
        <select
          className="peek-type"
          value={node.type_id}
          title="Node type"
          onChange={(e) => void setNodeType(nid, Number(e.target.value))}
        >
          {nodeTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          className={"peek-iconbtn" + (node.attention ? " active" : "")}
          title="Attention — come back to this"
          onClick={() => void setNodeAttention(nid, node.attention ? 0 : 1)}
        >
          ⚑
        </button>
        <button className="peek-iconbtn" title="Close" onClick={() => select(null, null)}>
          ×
        </button>
      </div>

      {node.parent_id == null && (
        <div className="peek-section">
          {node.is_block ? (
            <>
              <button className="peek-blockbtn" onClick={() => drillInto(nid)}>
                Open block ▸
              </button>
              <span className="peek-blocknote">
                The claim shown on the canvas mirrors this block's output node.
              </span>
              {confirmDissolve ? (
                <div className="peek-confirm">
                  <span className="peek-blocknote">
                    Delete the inner chain? The node stays; everything inside it is removed.
                  </span>
                  <div className="peek-confirm__row">
                    <button
                      className="peek-confirm__danger"
                      onClick={() => {
                        void dissolveBlock(nid);
                        setConfirmDissolve(false);
                      }}
                    >
                      Dissolve
                    </button>
                    <button onClick={() => setConfirmDissolve(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="peek-blockbtn subtle" onClick={() => setConfirmDissolve(true)}>
                  Dissolve internal structure
                </button>
              )}
            </>
          ) : (
            <button className="peek-blockbtn" onClick={() => void makeBlock(nid)}>
              Build internal structure ▸
            </button>
          )}
        </div>
      )}

      <div className="peek-section">
        <label className="peek-section__label">Claim</label>
        <input
          className="peek-input"
          value={claim}
          placeholder="Short claim shown on the canvas"
          onChange={(e) => setClaim(e.target.value)}
          onBlur={() => void setNodeClaim(nid, claim)}
        />
      </div>

      <div className="peek-section">
        <label className="peek-section__label">Body</label>
        <textarea
          className="peek-textarea"
          value={body}
          placeholder="Longer statement of the claim (shown in detail / linear views)"
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => void setNodeBody(nid, body)}
        />
      </div>

      <div className="peek-section">
        <label className="peek-section__label">Strength</label>
        <div className="peek-strength">
          {STRENGTHS.map((s) => (
            <button
              key={s}
              className={node.strength === s ? "active " + s : ""}
              onClick={() => void setNodeStrength(nid, s)}
            >
              {s}
            </button>
          ))}
        </div>
        {effective !== node.strength && (
          <div className="peek-effective">
            Effective: <b className={"eff-" + effective}>{effective}</b> — weakest link through its
            feeders
          </div>
        )}
        {isGapNode && (
          <div className={"peek-gapnote " + (dependents.length ? "broken" : "open")}>
            {dependents.length
              ? "Load-bearing gap — everything resting on it reads as broken until you fill it."
              : "Terminus gap — a legitimate open ending; it is not flagged as a defect."}
          </div>
        )}
      </div>

      <div className="peek-section">
        <label className="peek-section__label">Supports ({supports.length})</label>
        {supports.map((s) => {
          const src = s.source_id != null ? sourceById[s.source_id] : undefined;
          const isCite = s.source_id != null;
          return (
            <div key={s.id} className={"peek-support" + (isCite ? " citation" : "")}>
              <div className="peek-support__row">
                <span className={"peek-support__kind " + (isCite ? "citation" : "own")}>
                  {isCite ? "citation" : "own reasoning"}
                </span>
                <select
                  value={s.source_id ?? ""}
                  title="Attach a source (citation) or leave as your own reasoning"
                  onChange={(e) =>
                    void setSupportSource(s.id, e.target.value === "" ? null : Number(e.target.value))
                  }
                >
                  <option value="">Own reasoning</option>
                  {sources.map((src2) => (
                    <option key={src2.id} value={src2.id}>
                      {src2.key}
                    </option>
                  ))}
                </select>
                <button
                  className="peek-del"
                  title="Remove support"
                  onClick={() => void removeSupport(s.id)}
                >
                  ✕
                </button>
              </div>
              {src && (
                <div className="peek-cite">
                  <span className="peek-cite__label">{shortLabel(src.author, src.year)}</span>
                  {src.title ? <span> — {src.title}</span> : null}
                  {src.venue ? <span className="peek-cite__venue"> · {src.venue}</span> : null}
                </div>
              )}
              <textarea
                key={`txt-${s.id}`}
                defaultValue={s.text}
                placeholder="Paraphrase, quote, or your own gloss"
                onBlur={(e) => {
                  if (e.target.value !== s.text) void setSupportText(s.id, e.target.value);
                }}
              />
            </div>
          );
        })}
        {sources.length === 0 && (
          <span className="peek-empty">
            Import a .bib file (toolbar) to attach citations; supports are your own reasoning until
            then.
          </span>
        )}
        <button className="peek-btn-add" onClick={() => void addSupport(nid)}>
          + Add support
        </button>
      </div>

      <div className="peek-section">
        <label className="peek-section__label">Supported by ({feeders.length})</label>
        {feeders.length === 0 && <span className="peek-empty">Nothing feeds this node yet.</span>}
        {feeders.map((e) => (
          <button key={e.id} className="peek-conn" onClick={() => select(e.from_id, null)}>
            <span className="peek-conn__type">{typeName(e.from_id)}</span>
            <span className="peek-claim-line">{nodeById(e.from_id)?.claim || "(untitled)"}</span>
            <span
              className="peek-conn__kind"
              title="Toggle all-of / any-of"
              onClick={(ev) => {
                ev.stopPropagation();
                void setEdgeKind(e.id, e.kind === "disjunctive" ? "conjunctive" : "disjunctive");
              }}
            >
              {kindLabel(e.kind)}
            </span>
          </button>
        ))}
      </div>

      <div className="peek-section">
        <label className="peek-section__label">Feeds into ({dependents.length})</label>
        {dependents.length === 0 && (
          <span className="peek-empty">This node feeds nothing yet.</span>
        )}
        {dependents.map((e) => (
          <button key={e.id} className="peek-conn" onClick={() => select(e.to_id, null)}>
            <span className="peek-conn__type">{typeName(e.to_id)}</span>
            <span className="peek-claim-line">{nodeById(e.to_id)?.claim || "(untitled)"}</span>
            <span
              className="peek-conn__kind"
              title="Toggle all-of / any-of"
              onClick={(ev) => {
                ev.stopPropagation();
                void setEdgeKind(e.id, e.kind === "disjunctive" ? "conjunctive" : "disjunctive");
              }}
            >
              {kindLabel(e.kind)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
