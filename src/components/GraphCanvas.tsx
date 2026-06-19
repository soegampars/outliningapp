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
// Stable references — inline literals here would be new every render and feed
// React Flow's internal prop-sync churn.
const PRO_OPTIONS = { hideAttribution: true };
const PAN_ON_DRAG = [1, 2];
const noop = () => {};

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
  const { spine, lateral, terminusId } = useMemo(() => {
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
    const cls = classifySpine(visibleNodes, visibleEdges, terminusId, orderIndex);
    return { spine: cls.spine, lateral: cls.lateral, terminusId };
  }, [visibleNodes, visibleEdges, visibleNodeIds, linearOrder, currentParentId, nodes, edges]);

  // Argument-position roles (v2-F). Inside a block the output node is special; at
  // the top the spine's end is the terminus (any type — never assumed "answer").
  const outputId = useMemo(
    () => (currentParentId != null ? (blockOutput(currentParentId, nodes, edges)?.id ?? null) : null),
    [currentParentId, nodes, edges],
  );
  const conclusionTypeIds = useMemo(
    () =>
      new Set(
        allTypes.filter((t) => t.name.trim().toUpperCase() === "CONCLUSION").map((t) => t.id),
      ),
    [allTypes],
  );

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
        const positionRole =
          outputId != null && n.id === outputId
            ? "output"
            : currentParentId == null && n.id === terminusId
              ? "terminus"
              : spine.has(n.id) && conclusionTypeIds.has(n.type_id)
                ? "section"
                : null;
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
            positionRole,
          },
        };
      }),
    [
      visibleNodes,
      nodes,
      edges,
      selectedNodeSet,
      effectiveById,
      footprint,
      spine,
      lateral,
      terminusId,
      outputId,
      currentParentId,
      conclusionTypeIds,
    ],
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
      const nodeIds = p.nodes.map((n) => Number(n.id));
      const edgeIds = p.edges.map((e) => Number(e.id));
      // React Flow emits a transient empty selection while it reconciles our
      // controlled nodes (e.g. on a fresh mount that already has a selection).
      // Writing that empty back clears the store, which makes RF re-apply and
      // re-emit, oscillating forever (a crash on mount, a render-commit lag in
      // place). Deliberate clears go through onPaneClick / Esc, so ignore empties
      // here and skip echoing an unchanged selection.
      if (nodeIds.length === 0 && edgeIds.length === 0) return;
      const st = useSpine.getState();
      const same = (a: number[], b: number[]) =>
        a.length === b.length && a.every((id) => b.includes(id));
      if (same(nodeIds, st.selectedNodeIds) && same(edgeIds, st.selectedEdgeIds)) return;
      setSelection(nodeIds, edgeIds);
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
        onEdgesChange={noop}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        colorMode="dark"
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        selectionOnDrag
        panOnDrag={PAN_ON_DRAG}
        panActivationKeyCode="Space"
        minZoom={0.2}
        maxZoom={2.5}
        fitView
        proOptions={PRO_OPTIONS}
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
