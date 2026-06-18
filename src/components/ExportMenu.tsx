import { useState } from "react";
import { useSpine } from "../state/store";
import { computeEffectiveStrength } from "../model/strength";
import { buildExport, type ExportScope } from "../lib/export";

// Export to self-describing Markdown (§7). Copy straight to the clipboard for
// pasting into a Claude conversation, or download a .md file.
export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const nodeTypeById = useSpine((s) => s.nodeTypeById);
  const allSupports = useSpine((s) => s.supports);
  const sources = useSpine((s) => s.sources);
  const linearOrder = useSpine((s) => s.linearOrder);

  const gather = (scope: ExportScope) => {
    const supports = scope === "complete" ? allSupports : [];
    const effectiveById = computeEffectiveStrength(nodes, edges);
    const md = buildExport(
      scope,
      { nodes, edges, nodeTypeById, supports, sources, effectiveById },
      linearOrder,
    );
    if (import.meta.env.DEV) (window as unknown as { __lastExport?: string }).__lastExport = md;
    return md;
  };

  const flash = (text: string) => {
    setNote(text);
    setOpen(false);
    window.setTimeout(() => setNote(""), 3000);
  };

  const onCopy = async (scope: ExportScope) => {
    await navigator.clipboard.writeText(gather(scope));
    flash(`Copied ${scope} export to clipboard`);
  };

  const onDownload = (scope: ExportScope) => {
    const url = URL.createObjectURL(new Blob([gather(scope)], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `spine-${scope}.md`;
    a.click();
    URL.revokeObjectURL(url);
    flash(`Downloaded spine-${scope}.md`);
  };

  return (
    <div className="export-menu">
      <button className="spine-btn" onClick={() => setOpen((o) => !o)}>
        Export ▾
      </button>
      {open && (
        <>
          <div className="export-menu__backdrop" onClick={() => setOpen(false)} />
          <div className="export-menu__pop">
            {(["complete", "skeleton"] as ExportScope[]).map((scope) => (
              <div key={scope} className="export-menu__group">
                <div className="export-menu__label">
                  {scope === "complete" ? "Complete (lossless)" : "Skeleton only"}
                </div>
                <button onClick={() => void onCopy(scope)}>Copy</button>
                <button onClick={() => onDownload(scope)}>Download .md</button>
              </div>
            ))}
          </div>
        </>
      )}
      {note && <span className="spine-toolbar__msg">{note}</span>}
    </div>
  );
}
