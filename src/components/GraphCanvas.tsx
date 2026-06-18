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
import { gapTypeIds } from "../model/gaps";
import { classifySpine } from "../model/spine";
import { blockOutput } from "../model/blocks";
import { ArgNodeView } from "./ArgNodeView";

const nodeTypes = { arg: ArgNodeView };

export function GraphCanvas() {
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const supports = useSpine((s) => s.supports);
  const allTypes = useSpine((s) => s.nodeTypes);
  const currentParentId = useSpine((s) => s.currentParentId);
  const linearOrder = useSpine((s) => s.linearOrder);
  const selectedNodeIds = useSpine((s) => s.selectedNodeIds);
  const selectedEdgeIds = useSpine((s) => s.selectedEdgeIds);
  const focusedSourceId = useSpine((s) => s.focusedSourceId);
  const moveNodeLocal = useSpine((s) => s.moveNodeLocal);
  const persistNodePosition = useSpine((s) => s.persistNodePosition);
  const addEdge = useSpine((s) => s.addEdge);
  const addNode = useSpine((s) => s.addNode);
  const setSelection = useSpine((s) => s.setSelection);
  const setEditing = useSpine((s) => s.setEditing);
  const drillInto = useSpine((s) => s.drillInto);

  const { screenToFlowPosition } = useReactFlow();

  // Only the current level is shown; edges whose endpoints are both at this level.
  const visibleNodes = useMemo(
    () => nodes.filter((n) => (n.parent_id ?? null) === currentParentId),
    [nodes, currentParentId],
  );
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleNodeIds.has(e.from_id) && visibleNodeIds.has(e.to_id)),
    [edges, visibleNodeIds],
  );

  // Computed over the whole graph so blocks surface their bridged inner strength.
  const gapIds = useMemo(() => gapTypeIds(allTypes), [allTypes]);
  const effectiveById = useMemo(
    () => computeEffectiveStrength(nodes, edges, gapIds),
    [nodes, edges, gapIds],
  );

  // Spine vs lateral support (v2-E), derived from the curated order + edges.
  const { spine, lateral } = useMemo(() => {
    const orderIndex = new Map<number, number>();
    linearOrder.forEach((id, i) => orderIndex.set(id, i));
    let terminusId: number | null = null;
    if (currentParentId != null) {
      terminusId = blockOutput(currentParentId, nodes, edges)?.id ?? null;
    } else {
      for (let i = linearOrder.length - 1; i >= 0; i--) {
        if (visibleNodeIds.has(linearOrder[i])) {
          terminusId = linearOrder[i];
          break;
        }
      }
    }
    if (terminusId == null) {
      const hasOut = new Set(visibleEdges.map((e) => e.from_id));
      const sinks = visibleNodes.filter((n) => !hasOut.has(n.id));
      terminusId = (sinks[sinks.length - 1] ?? visibleNodes[visibleNodes.length - 1])?.id ?? null;
    }
    return classifySpine(visibleNodes, visibleEdges, terminusId, orderIndex);
  }, [visibleNodes, visibleEdges, visibleNodeIds, linearOrder, currentParentId, nodes, edges]);

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
      visibleNodes.map((n) => {
        const isBlock = !!n.is_block;
        const output = isBlock ? blockOutput(n.id, nodes, edges) : null;
        return {
          id: String(n.id),
          type: "arg",
          position: { x: n.pos_x, y: n.pos_y },
          selected: selectedNodeSet.has(n.id),
          className: footprint.has(n.id) ? "footprint" : undefined,
          data: {
            claim: isBlock ? (output?.claim ?? n.claim) : n.claim,
            typeId: n.type_id,
            attention: n.attention,
            effective: effectiveById[n.id] ?? n.strength,
            isBlock,
            spineRole: spine.has(n.id) ? "spine" : lateral.has(n.id) ? "lateral" : null,
          },
        };
      }),
    [visibleNodes, nodes, edges, selectedNodeSet, effectiveById, footprint, spine, lateral],
  );

  const rfEdges = useMemo<RFEdge[]>(
    () =>
      visibleEdges.map((e) => {
        const onSpine = spine.has(e.from_id) && spine.has(e.to_id);
        const isLateral = lateral.has(e.from_id) && spine.has(e.to_id);
        return {
          id: String(e.id),
          source: String(e.from_id),
          target: String(e.to_id),
          selected: selectedEdgeSet.has(e.id),
          className: onSpine ? "spine-edge" : isLateral ? "lateral-edge" : undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: e.kind === "disjunctive" ? { strokeDasharray: "7 5" } : undefined,
        };
      }),
    [visibleEdges, selectedEdgeSet, spine, lateral],
  );

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

  // Double-click a block opens its sub-canvas; a normal node edits its claim.
  const onNodeDoubleClick = useCallback(
    (_e: ReactMouseEvent, node: RFNode) => {
      const n = useSpine.getState().nodes.find((x) => x.id === Number(node.id));
      if (n?.is_block) drillInto(n.id);
      else setEditing(Number(node.id));
    },
    [drillInto, setEditing],
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

      {visibleNodes.length === 0 && (
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
          Double-click anywhere to add{" "}
          {currentParentId == null ? "your first argument move." : "a step inside this block."}
        </div>
      )}
    </div>
  );
}
