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
import { computeEffectiveStrength } from "../model/strength";
import { ArgNodeView } from "./ArgNodeView";

const nodeTypes = { arg: ArgNodeView };

export function GraphCanvas() {
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const supports = useSpine((s) => s.supports);
  const allTypes = useSpine((s) => s.nodeTypes);
  const selectedNodeIds = useSpine((s) => s.selectedNodeIds);
  const selectedEdgeIds = useSpine((s) => s.selectedEdgeIds);
  const focusedSourceId = useSpine((s) => s.focusedSourceId);
  const moveNodeLocal = useSpine((s) => s.moveNodeLocal);
  const persistNodePosition = useSpine((s) => s.persistNodePosition);
  const addEdge = useSpine((s) => s.addEdge);
  const addNode = useSpine((s) => s.addNode);
  const setSelection = useSpine((s) => s.setSelection);
  const setEditing = useSpine((s) => s.setEditing);

  const { screenToFlowPosition } = useReactFlow();

  const effectiveById = useMemo(() => computeEffectiveStrength(nodes, edges), [nodes, edges]);

  const footprint = useMemo(() => {
    const set = new Set<number>();
    if (focusedSourceId != null) {
      for (const s of supports) if (s.source_id === focusedSourceId) set.add(s.node_id);
    }
    return set;
  }, [supports, focusedSourceId]);

  const selectedNodeSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const selectedEdgeSet = useMemo(() => new Set(selectedEdgeIds), [selectedEdgeIds]);

  const rfNodes = useMemo<RFNode[]>(
    () =>
      nodes.map((n) => ({
        id: String(n.id),
        type: "arg",
        position: { x: n.pos_x, y: n.pos_y },
        selected: selectedNodeSet.has(n.id),
        className: footprint.has(n.id) ? "footprint" : undefined,
        data: {
          claim: n.claim,
          typeId: n.type_id,
          attention: n.attention,
          effective: effectiveById[n.id] ?? n.strength,
        },
      })),
    [nodes, selectedNodeSet, effectiveById, footprint],
  );

  const rfEdges = useMemo<RFEdge[]>(
    () =>
      edges.map((e) => ({
        id: String(e.id),
        source: String(e.from_id),
        target: String(e.to_id),
        selected: selectedEdgeSet.has(e.id),
        markerEnd: { type: MarkerType.ArrowClosed },
        style: e.kind === "disjunctive" ? { strokeDasharray: "7 5" } : undefined,
      })),
    [edges, selectedEdgeSet],
  );

  // Apply position live during drag (moves the whole selection together); persist
  // each node when its drag ends (dragging === false).
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === "position") {
          if (c.position) moveNodeLocal(Number(c.id), c.position.x, c.position.y);
          if (c.dragging === false) void persistNodePosition(Number(c.id));
        }
      }
    },
    [moveNodeLocal, persistNodePosition],
  );

  const onSelectionChange = useCallback(
    (p: OnSelectionChangeParams) => {
      setSelection(
        p.nodes.map((n) => Number(n.id)),
        p.edges.map((e) => Number(e.id)),
      );
    },
    [setSelection],
  );

  const onPaneClick = useCallback(() => setSelection([], []), [setSelection]);

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
        onEdgesChange={() => {}}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        colorMode="dark"
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        selectionOnDrag
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
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
