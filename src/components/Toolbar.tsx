import { useReactFlow } from "@xyflow/react";
import { useSpine } from "../state/store";

export function Toolbar() {
  const nodeCount = useSpine((s) => s.nodes.length);
  const edgeCount = useSpine((s) => s.edges.length);
  const nodeTypes = useSpine((s) => s.nodeTypes);
  const addNode = useSpine((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();

  const onAdd = () => {
    const def = nodeTypes.find((t) => t.role === "structural") ?? nodeTypes[0];
    if (!def) return;
    const p = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    void addNode(def.id, p.x - 80, p.y - 28);
  };

  return (
    <header className="spine-toolbar">
      <span className="spine-toolbar__title">Spine</span>
      <button className="spine-btn" onClick={onAdd}>
        + Add node
      </button>
      <span className="spine-toolbar__hint">
        Double-click to add · drag to connect · Ctrl+D duplicate · click + Delete to remove
      </span>
      <span className="spine-toolbar__spacer" />
      <span className="spine-toolbar__count">
        {nodeCount} nodes · {edgeCount} edges
      </span>
    </header>
  );
}
