import { useMemo } from "react";
import { useSpine } from "../state/store";
import { singlePointsOfFailure, sourceLoads } from "../model/provenance";
import { shortLabel } from "../lib/bibtex";

// Provenance / "monoculture of evidence" panel (§6.4). Click a source to light
// up its footprint on the canvas; see weighted load per source; and the
// single-point-of-failure list (conclusions that rest on one paper).
export function SourcesPanel() {
  const sources = useSpine((s) => s.sources);
  const supports = useSpine((s) => s.supports);
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const sourceById = useSpine((s) => s.sourceById);
  const focusedSourceId = useSpine((s) => s.focusedSourceId);
  const focusSource = useSpine((s) => s.focusSource);
  const toggleSources = useSpine((s) => s.toggleSources);
  const select = useSpine((s) => s.select);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const loads = useMemo(
    () => sourceLoads(sources, supports, nodes, edges),
    [sources, supports, nodes, edges],
  );
  const spofs = useMemo(
    () => singlePointsOfFailure(nodes, edges, supports),
    [nodes, edges, supports],
  );

  const maxWeight = useMemo(
    () => Math.max(1, ...sources.map((s) => loads.get(s.id)?.weight ?? 0)),
    [sources, loads],
  );
  const sorted = useMemo(
    () => [...sources].sort((a, b) => (loads.get(b.id)?.weight ?? 0) - (loads.get(a.id)?.weight ?? 0)),
    [sources, loads],
  );

  return (
    <aside className="peek-panel">
      <div className="peek-head">
        <span className="peek-panel__title">Sources</span>
        <span className="peek-head__spacer" />
        <button className="peek-iconbtn" title="Close" onClick={() => toggleSources()}>
          ×
        </button>
      </div>

      <div className="peek-section">
        <label className="peek-section__label">Source load ({sources.length})</label>
        {sources.length === 0 && (
          <span className="peek-empty">No sources yet — import a .bib file.</span>
        )}
        {sorted.map((src) => {
          const load = loads.get(src.id);
          const focused = focusedSourceId === src.id;
          const pct = Math.round(((load?.weight ?? 0) / maxWeight) * 100);
          return (
            <button
              key={src.id}
              className={"src-row" + (focused ? " focused" : "")}
              title="Highlight this source's footprint on the canvas"
              onClick={() => focusSource(src.id)}
            >
              <div className="src-row__top">
                <span className="src-row__key">{src.key}</span>
                <span className="src-row__count">{load?.nodeCount ?? 0} nodes</span>
              </div>
              <div className="src-row__meta">
                {shortLabel(src.author, src.year)}
                {src.title ? ` — ${src.title}` : ""}
              </div>
              <div className="src-row__loadbar">
                <span className="src-row__fill" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="peek-section">
        <label className="peek-section__label">Single points of failure ({spofs.length})</label>
        {spofs.length === 0 ? (
          <span className="peek-empty">
            No node collapses on a single source — every source-backed claim has an independent
            path.
          </span>
        ) : (
          spofs.map((s) => (
            <button
              key={`${s.nodeId}-${s.sourceId}`}
              className="spof-row"
              title="Pulling this one source would break a necessary sub-chain. Click to inspect."
              onClick={() => select(s.nodeId, null)}
            >
              <span className="spof-row__node">{nodeById.get(s.nodeId)?.claim || "(untitled)"}</span>
              <span className="spof-row__src">rests solely on {sourceById[s.sourceId]?.key ?? "?"}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
