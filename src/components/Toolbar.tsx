import { useRef, useState, type ChangeEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import { useSpine } from "../state/store";
import { ExportMenu } from "./ExportMenu";

export function Toolbar() {
  const nodeCount = useSpine((s) => s.nodes.length);
  const edgeCount = useSpine((s) => s.edges.length);
  const sourceCount = useSpine((s) => s.sources.length);
  const nodeTypes = useSpine((s) => s.nodeTypes);
  const addNode = useSpine((s) => s.addNode);
  const importBibtex = useSpine((s) => s.importBibtex);
  const { screenToFlowPosition } = useReactFlow();

  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  const onAdd = () => {
    const def = nodeTypes.find((t) => t.role === "structural") ?? nodeTypes[0];
    if (!def) return;
    const p = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    void addNode(def.id, p.x - 80, p.y - 28);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    const text = await file.text();
    const r = await importBibtex(text);
    setMsg(`Imported ${r.total} — ${r.created} new, ${r.updated} refreshed`);
    window.setTimeout(() => setMsg(""), 4000);
  };

  return (
    <header className="spine-toolbar">
      <span className="spine-toolbar__title">Spine</span>
      <button className="spine-btn" onClick={onAdd}>
        + Add node
      </button>
      <button className="spine-btn" onClick={() => fileRef.current?.click()}>
        Import .bib
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".bib,.bibtex,text/plain"
        style={{ display: "none" }}
        onChange={onFile}
      />
      <ExportMenu />
      <span className="spine-toolbar__hint">
        Double-click to add · drag to connect · Ctrl+D duplicate · click + Delete to remove
      </span>
      <span className="spine-toolbar__spacer" />
      {msg && <span className="spine-toolbar__msg">{msg}</span>}
      <span className="spine-toolbar__count">
        {nodeCount} nodes · {edgeCount} edges · {sourceCount} sources
      </span>
    </header>
  );
}
