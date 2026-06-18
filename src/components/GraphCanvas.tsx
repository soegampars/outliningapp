import { useCallback, useEffect, useMemo } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type Edge as RFEdge,
  type EdgeChange,
  type Node as RFNode,
  type NodeChange,
  type OnConnect,
} from "@xyflow/react";
import { useSpine } from "../state/store";
import { computeEffectiveStrength } from "../model/strength";
import { ArgNodeView } from "./ArgNodeView";

const nodeTypes = { arg: ArgNodeView };

export function GraphCanvas() {
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const supports = useSpine((s) => s.supports);
  const allTypes = useSpine((s) => s.nodeTypes);
  const selectedNodeId = useSpine((s) => s.selectedNodeId);
  const selectedEdgeId = useSpine((s) => s.selectedEdgeId);
  const focusedSourceId = useSpine((s) => s.focusedSourceId);
  const moveNodeLocal = useSpine((s) => s.moveNodeLocal);
  const persistNodePosition = useSpine((s) => s.persistNodePosition);
  const addEdge = useSpine((s) => s.addEdge);
  const addNode = useSpine((s) => s.addNode);
  const select = useSpine((s) => s.select);
  const setEditing = useSpine((s) => s.setEditing);

  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (inField) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        const sel = useSpine.getState().selectedNodeId;
        if (sel != null) {
          e.preventDefault();
          void useSpine.getState().duplicateNode(sel);
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const st = useSpine.getState();
        if (st.selectedEdgeId != null) {
          e.preventDefault();
          void st.removeEdge(st.selectedEdgeId);
        } else if (st.selectedNodeId != null) {
          e.preventDefault();
          void st.removeNode(st.selectedNodeId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const effectiveById = useMemo(() => computeEffectiveStrength(nodes, edges), [nodes, edges]);

  // Footprint: nodes citing the focused source (§6.4 highlight).
  const footprint = useMemo(() => {
    const set = new Set<number>();
    if (focusedSourceId != null) {
      for (const s of supports) if (s.source_id === focusedSourceId) set.add(s.node_id);
    }
    return set;
  }, [supports, focusedSourceId]);

  const rfNodes = useMemo<RFNode[]>(
    () =>
      nodes.map((n) => ({
        id: String(n.id),
        type: "arg",
        position: { x: n.pos_x, y: n.pos_y },
        selected: n.id === selectedNodeId,
        className: footprint.has(n.id) ? "footprint" : undefined,
        data: {
          claim: n.claim,
          typeId: n.type_id,
          attention: n.attention,
          effective: effectiveById[n.id] ?? n.strength,
        },
      })),
    [nodes, selectedNodeId, effectiveById, footprint],
  );

  const rfEdges = useMemo<RFEdge[]>(
    () =>
      edges.map((e) => ({
        id: String(e.id),
        source: String(e.from_id),
        target: String(e.to_id),
        selected: e.id === selectedEdgeId,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: e.kind === "disjunctive" ? { strokeDasharray: "7 5" } : undefined,
      })),
    [edges, selectedEdgeId],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === "position" && c.position) {
          moveNodeLocal(Number(c.id), c.position.x, c.position.y);
        }
      }
      const sel = changes.find((c) => c.type === "select" && c.selected);
      if (sel && sel.type === "select") select(Number(sel.id), null);
    },
    [moveNodeLocal, select],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const sel = changes.find((c) => c.type === "select" && c.selected);
      if (sel && sel.type === "select") select(null, Number(sel.id));
    },
    [select],
  );

  const onPaneClick = useCallback(() => select(null, null), [select]);

  const onNodeDragStop = useCallback(
    (_e: MouseEvent | TouchEvent, node: RFNode) => {
      moveNodeLocal(Number(node.id), node.position.x, node.position.y);
      void persistNodePosition(Number(node.id));
    },
    [moveNodeLocal, persistNodePosition],
  );

  const onConnect = useCallback<OnConnect>(
    (c) => {
      if (c.source && c.target) void addEdge(Number(c.source), Number(c.target));
    },
    [addEdge],
  );

  const onNodeDoubleClick = useCallback(
    (_e: ReactMouseEvent, node: RFNode) => setEditing(Number(node.id)),
    [setEditing],
  );

  const onEdgeDoubleClick = useCallback((_e: ReactMouseEvent, edge: RFEdge) => {
    const cur = useSpine.getState().edges.find((x) => x.id === Number(edge.id));
    if (cur)
      void useSpine
        .getState()
        .setEdgeKind(cur.id, cur.kind === "conjunctive" ? "disjunctive" : "conjunctive");
  }, []);

  const onPaneDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("react-flow__pane")) return;
      const def = allTypes.find((t) => t.role === "structural") ?? allTypes[0];
      if (!def) return;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      void addNode(def.id, p.x - 80, p.y - 28);
    },
    [allTypes, addNode, screenToFlowPosition],
  );

  return (
    <div style={{ position: "absolute", inset: 0 }} onDoubleClick={onPaneDoubleClick}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        colorMode="dark"
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        minZoom={0.2}
        maxZoom={2.5}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {nodes.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            color: "var(--text-secondary)",
            fontSize: 14,
          }}
        >
          Double-click anywhere to add your first argument move.
        </div>
      )}
    </div>
  );
}
