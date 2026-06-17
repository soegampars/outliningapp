import { useCallback, useMemo } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeChange,
  type OnConnect,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { useSpine } from "../state/store";
import { ArgNodeView } from "./ArgNodeView";

const nodeTypes = { arg: ArgNodeView };

export function GraphCanvas() {
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const allTypes = useSpine((s) => s.nodeTypes);
  const selectedNodeId = useSpine((s) => s.selectedNodeId);
  const selectedEdgeId = useSpine((s) => s.selectedEdgeId);
  const moveNodeLocal = useSpine((s) => s.moveNodeLocal);
  const persistNodePosition = useSpine((s) => s.persistNodePosition);
  const removeNode = useSpine((s) => s.removeNode);
  const removeEdge = useSpine((s) => s.removeEdge);
  const addEdge = useSpine((s) => s.addEdge);
  const addNode = useSpine((s) => s.addNode);
  const select = useSpine((s) => s.select);
  const setEditing = useSpine((s) => s.setEditing);

  const { screenToFlowPosition } = useReactFlow();

  const rfNodes = useMemo<RFNode[]>(
    () =>
      nodes.map((n) => ({
        id: String(n.id),
        type: "arg",
        position: { x: n.pos_x, y: n.pos_y },
        selected: n.id === selectedNodeId,
        data: {
          claim: n.claim,
          typeId: n.type_id,
          strength: n.strength,
          attention: n.attention,
        },
      })),
    [nodes, selectedNodeId],
  );

  const rfEdges = useMemo<RFEdge[]>(
    () =>
      edges.map((e) => ({
        id: String(e.id),
        source: String(e.from_id),
        target: String(e.to_id),
        selected: e.id === selectedEdgeId,
        markerEnd: { type: MarkerType.ArrowClosed },
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
    },
    [moveNodeLocal],
  );

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

  const onNodesDelete = useCallback(
    (deleted: RFNode[]) => {
      for (const n of deleted) void removeNode(Number(n.id));
    },
    [removeNode],
  );

  const onEdgesDelete = useCallback(
    (deleted: RFEdge[]) => {
      for (const e of deleted) void removeEdge(Number(e.id));
    },
    [removeEdge],
  );

  const onSelectionChange = useCallback(
    (p: OnSelectionChangeParams) => {
      select(
        p.nodes.length ? Number(p.nodes[0].id) : null,
        p.edges.length ? Number(p.edges[0].id) : null,
      );
    },
    [select],
  );

  const onNodeDoubleClick = useCallback(
    (_e: ReactMouseEvent, node: RFNode) => setEditing(Number(node.id)),
    [setEditing],
  );

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
        onEdgesChange={() => {}}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={onSelectionChange}
        colorMode="dark"
        zoomOnDoubleClick={false}
        deleteKeyCode={["Delete", "Backspace"]}
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
