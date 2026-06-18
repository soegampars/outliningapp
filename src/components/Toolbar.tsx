import { useRef, useState, type ChangeEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import { useSpine } from "../state/store";
import { ExportMenu } from "./ExportMenu";
import { FileMenu } from "./FileMenu";

export function Toolbar() {
  const nodeCount = useSpine((s) => s.nodes.length);
  const edgeCount = useSpine((s) => s.edges.length);
  const sourceCount = useSpine((s) => s.sources.length);
  const nodeTypes = useSpine((s) => s.nodeTypes);
  const addNode = useSpine((s) => s.addNode);
  const importBibtex = useSpine((s) => s.importBibtex);
  const view = useSpine((s) => s.view);
  const setView = useSpine((s) => s.setView);
  const sourcesOpen = useSpine((s) => s.sourcesOpen);
  const toggleSources = useSpine((s) => s.toggleSources);
  const currentFileName = useSpine((s) => s.currentFileName);
  const fileMessage = useSpine((s) => s.fileMessage);
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
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const r = await importBibtex(text);
    setMsg(`Imported ${r.total} — ${r.created} new, ${r.updated} refreshed`);
    window.setTimeout(() => setMsg(""), 4000);
  };

  return (
    <header className="spine-toolbar">
      <span className="spine-toolbar__title">Spine</span>
      <FileMenu />
      <span className="spine-toolbar__file" title={currentFileName ?? "Unsaved project"}>
        {currentFileName ?? "untitled"}
      </span>

      <div className="spine-seg">
        <button
          className={"spine-seg__btn" + (view === "graph" ? " active" : "")}
          onClick={() => setView("graph")}
        >
          Graph
        </button>
        <button
          className={"spine-seg__btn" + (view === "linear" ? " active" : "")}
          onClick={() => setView("linear")}
        >
          Linear
        </button>
      </div>

      {view === "graph" && (
        <button className="spine-btn" onClick={onAdd}>
          + Add node
        </button>
      )}
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
      {view === "graph" && (
        <button
          className={"spine-btn" + (sourcesOpen ? " active" : "")}
          onClick={() => toggleSources()}
        >
          Sources
        </button>
      )}

      <span className="spine-toolbar__hint">
        {view === "graph"
          ? "Double-click to add · drag to connect · Ctrl+D duplicate · click + Delete to remove"
          : "Reorder with ↑ ↓ · click a claim to open it in the graph"}
      </span>
      <span className="spine-toolbar__spacer" />
      {(msg || fileMessage) && (
        <span className="spine-toolbar__msg">{msg || fileMessage}</span>
      )}
      <span className="spine-toolbar__count">
        {nodeCount} nodes · {edgeCount} edges · {sourceCount} sources
      </span>
    </header>
  );
}
