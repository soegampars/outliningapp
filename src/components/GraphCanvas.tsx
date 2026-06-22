import { useCallback, useEffect, useMemo, useRef } from "react";
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
  type OnNodeDrag,
} from "@xyflow/react";
import { useSpine } from "../state/store";
import { computeEffectiveStrength } from "../model/strength";
import { gapTypeIds } from "../model/gaps";
import { derivedTypeIds, framingTypeIds } from "../model/strengthModes";
import { classifySpine } from "../model/spine";
import { blockOutput } from "../model/blocks";
import { ArgNodeView } from "./ArgNodeView";
import { ArrangeToolbar } from "./ArrangeToolbar";

const nodeTypes = { arg: ArgNodeView };
// Stable references — inline literals here would be new every render and feed
// React Flow's internal prop-sync churn.
const PRO_OPTIONS = { hideAttribution: true };
const PAN_ON_DRAG = [1, 2];
// Shift / Ctrl / Cmd + click toggles a node in/out of the selection.
const MULTI_SELECT_KEYS = ["Shift", "Meta", "Control"];

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

  const { screenToFlowPosition, fitView } = useReactFlow();
  // fitView's identity from useReactFlow isn't stable, so hold it in a ref and
  // keep effect deps free of it (listing it warns + churns React Flow's fit queue).
  const fitViewRef = useRef(fitView);
  fitViewRef.current = fitView;

  // Shift-drag locks a node's movement to one axis (precise alignment). Track the
  // Shift key and each dragged node's origin so onNodesChange can pin an axis.
  const shiftRef = useRef(false);
  const dragOrigins = useRef<Map<number, { x: number; y: number }> | null>(null);
  const dragPrimary = useRef<number | null>(null);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Re-centre when drilling between levels (the canvas doesn't remount, so a
  // fresh fit is needed). Poll until the DOM shows exactly this level's nodes,
  // measured (ResizeObserver lags the DOM), then fit once — fitting before the
  // store swap or before measurement lands on the wrong/empty set.
  useEffect(() => {
    const want = new Set(
      useSpine
        .getState()
        .nodes.filter((n) => (n.parent_id ?? null) === currentParentId)
        .map((n) => String(n.id)),
    );
    if (want.size === 0) return;
    let raf = 0;
    let tries = 0;
    let fits = 0;
    const tick = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(".react-flow__node"));
      const ids = els.map((e) => e.getAttribute("data-id"));
      const ready =
        ids.length === want.size &&
        ids.every((id) => id != null && want.has(id)) &&
        els[0]?.offsetWidth > 0;
      if (ready) {
        // Fit each frame for a short window: React Flow's measurement lags the
        // DOM, so the later (measured) calls land on the right place.
        fitViewRef.current({ duration: 0, padding: 0.2 });
        if (++fits < 12) raf = requestAnimationFrame(tick);
        return;
      }
      if (++tries < 60) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentParentId]);

  // Re-centre on window resize (nodes already measured, so fit next frame).
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => fitViewRef.current({ duration: 150, padding: 0.2 }));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

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

  // Nodes that have at least one edge anywhere — used to spot parked gaps.
  const connectedIds = useMemo(() => {
    const s = new Set<number>();
    for (const e of edges) {
      s.add(e.from_id);
      s.add(e.to_id);
    }
    return s;
  }, [edges]);

  // Computed over the whole graph so blocks surface their bridged inner strength.
  const gapIds = useMemo(() => gapTypeIds(allTypes), [allTypes]);
  const typeModes = useMemo(
    () => ({ gap: gapIds, derived: derivedTypeIds(allTypes), framing: framingTypeIds(allTypes) }),
    [gapIds, allTypes],
  );
  const effectiveById = useMemo(
    () => computeEffectiveStrength(nodes, edges, typeModes),
    [nodes, edges, typeModes],
  );

  // Spine vs lateral support (v2-E), derived from the curated order + edges.
  const { spine, lateral, terminusId } = useMemo(() => {
    const orderIndex = new Map<number, number>();
    linearOrder.forEach((id, i) => orderIndex.set(id, i));
    // Only connected nodes can be the terminus — a detached parking-lot gap is
    // not part of any spine and must never be picked as where the argument lands.
    const connectedAtLevel = new Set<number>();
    for (const e of visibleEdges) {
      connectedAtLevel.add(e.from_id);
      connectedAtLevel.add(e.to_id);
    }
    let terminusId: number | null = null;
    if (currentParentId != null) {
      terminusId = blockOutput(currentParentId, nodes, edges)?.id ?? null;
    } else {
      for (let i = linearOrder.length - 1; i >= 0; i--) {
        const id = linearOrder[i];
        if (visibleNodeIds.has(id) && connectedAtLevel.has(id)) {
          terminusId = id;
          break;
        }
      }
    }
    if (terminusId == null) {
      const hasOut = new Set(visibleEdges.map((e) => e.from_id));
      const sinks = visibleNodes.filter((n) => connectedAtLevel.has(n.id) && !hasOut.has(n.id));
      terminusId = sinks[sinks.length - 1]?.id ?? null;
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
            parked: gapIds.has(n.type_id) && !connectedIds.has(n.id),
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
      gapIds,
      connectedIds,
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

  // Selection is synced from React Flow's own change stream (onNodesChange /
  // onEdgesChange) — these fire as a discrete, in-click event. The deferred
  // onSelectionChange fires a frame late, so our controlled `selected` would
  // re-apply stale (unselected) nodes and clobber RF's instant selection, making
  // a click appear to do nothing until the next interaction.
  const onNodeDragStart = useCallback<OnNodeDrag>((_e, node, dragged) => {
    dragOrigins.current = new Map(
      dragged.map((n) => [Number(n.id), { x: n.position.x, y: n.position.y }]),
    );
    dragPrimary.current = Number(node.id);
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const st = useSpine.getState();
      const sel = new Set(st.selectedNodeIds);
      let selChanged = false;

      // Shift-drag axis-lock: pick the axis from the primary node's larger delta,
      // then pin the other axis (to its origin) for every node in the drag.
      const origins = dragOrigins.current;
      let lock: "x" | "y" | null = null;
      if (shiftRef.current && origins && origins.size) {
        const prim =
          changes.find(
            (c) => c.type === "position" && c.position && Number(c.id) === dragPrimary.current,
          ) ?? changes.find((c) => c.type === "position" && c.position);
        if (prim && prim.type === "position" && prim.position) {
          const o = origins.get(Number(prim.id));
          if (o) {
            lock = Math.abs(prim.position.x - o.x) >= Math.abs(prim.position.y - o.y) ? "y" : "x";
          }
        }
      }

      for (const c of changes) {
        if (c.type === "position") {
          if (c.position) {
            let { x, y } = c.position;
            if (lock && origins) {
              const o = origins.get(Number(c.id));
              if (o) {
                if (lock === "y") y = o.y;
                else x = o.x;
              }
            }
            moveNodeLocal(Number(c.id), x, y);
          }
          if (c.dragging === false) {
            void persistNodePosition(Number(c.id));
            dragOrigins.current = null;
          }
        } else if (c.type === "select") {
          selChanged = true;
          if (c.selected) sel.add(Number(c.id));
          else sel.delete(Number(c.id));
        }
      }
      if (selChanged) setSelection([...sel], st.selectedEdgeIds);
    },
    [moveNodeLocal, persistNodePosition, setSelection],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const st = useSpine.getState();
      const sel = new Set(st.selectedEdgeIds);
      let selChanged = false;
      for (const c of changes) {
        if (c.type === "select") {
          selChanged = true;
          if (c.selected) sel.add(Number(c.id));
          else sel.delete(Number(c.id));
        }
      }
      if (selChanged) setSelection(st.selectedNodeIds, [...sel]);
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
        onNodeDragStart={onNodeDragStart}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        colorMode="dark"
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        selectionOnDrag
        multiSelectionKeyCode={MULTI_SELECT_KEYS}
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

      <ArrangeToolbar />

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
