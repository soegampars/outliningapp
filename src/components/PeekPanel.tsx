import { useEffect, useMemo, useState } from "react";
import { useSpine } from "../state/store";
import * as repo from "../data/repo";
import type { Source, Support } from "../model/types";
import { STRENGTHS } from "../model/types";
import { computeEffectiveStrength } from "../model/strength";

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
  const setNodeClaim = useSpine((s) => s.setNodeClaim);
  const setNodeBody = useSpine((s) => s.setNodeBody);
  const setNodeType = useSpine((s) => s.setNodeType);
  const setNodeStrength = useSpine((s) => s.setNodeStrength);
  const setNodeAttention = useSpine((s) => s.setNodeAttention);
  const setEdgeKind = useSpine((s) => s.setEdgeKind);
  const select = useSpine((s) => s.select);

  const [claim, setClaim] = useState("");
  const [body, setBody] = useState("");
  const [supports, setSupports] = useState<Support[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  const effectiveById = useMemo(() => computeEffectiveStrength(nodes, edges), [nodes, edges]);

  useEffect(() => {
    if (selectedNodeId == null) return;
    void repo.listSupportsForNode(selectedNodeId).then(setSupports);
    void repo.listSources().then(setSources);
  }, [selectedNodeId]);

  // Keep claim/body drafts in sync with the selected node (store only changes on
  // commit, so this never clobbers in-progress typing).
  useEffect(() => {
    setClaim(node?.claim ?? "");
    setBody(node?.body ?? "");
  }, [selectedNodeId, node?.claim, node?.body]);

  if (!node) return null;
  const nid = node.id;
  const effective = effectiveById[nid] ?? node.strength;

  const feeders = edges.filter((e) => e.to_id === nid);
  const dependents = edges.filter((e) => e.from_id === nid);
  const nodeById = (id: number) => nodes.find((n) => n.id === id);
  const typeName = (id: number) => {
    const n = nodeById(id);
    return n ? (nodeTypeById[n.type_id]?.name ?? "") : "";
  };

  const addSupport = async () => {
    const id = await repo.createSupport(nid, "", null, supports.length);
    setSupports((prev) => [
      ...prev,
      { id, node_id: nid, text: "", source_id: null, sort_order: prev.length },
    ]);
  };
  const commitSupportText = async (s: Support, text: string) => {
    if (text === s.text) return;
    await repo.updateSupportText(s.id, text);
    setSupports((prev) => prev.map((x) => (x.id === s.id ? { ...x, text } : x)));
  };
  const setSupportSource = async (s: Support, sourceId: number | null) => {
    await repo.updateSupportSource(s.id, sourceId);
    setSupports((prev) => prev.map((x) => (x.id === s.id ? { ...x, source_id: sourceId } : x)));
  };
  const removeSupport = async (s: Support) => {
    await repo.deleteSupport(s.id);
    setSupports((prev) => prev.filter((x) => x.id !== s.id));
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
      </div>

      <div className="peek-section">
        <label className="peek-section__label">Supports ({supports.length})</label>
        {supports.map((s) => {
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
                    void setSupportSource(s, e.target.value === "" ? null : Number(e.target.value))
                  }
                >
                  <option value="">Own reasoning</option>
                  {sources.map((src) => (
                    <option key={src.id} value={src.id}>
                      {src.key}
                    </option>
                  ))}
                </select>
                <button
                  className="peek-del"
                  title="Remove support"
                  onClick={() => void removeSupport(s)}
                >
                  ✕
                </button>
              </div>
              <textarea
                defaultValue={s.text}
                placeholder="Paraphrase, quote, or your own gloss"
                onBlur={(e) => void commitSupportText(s, e.target.value)}
              />
            </div>
          );
        })}
        {sources.length === 0 && (
          <span className="peek-empty">
            Import BibTeX sources (Step 4) to attach citations; supports are your own reasoning for
            now.
          </span>
        )}
        <button className="peek-btn-add" onClick={() => void addSupport()}>
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
