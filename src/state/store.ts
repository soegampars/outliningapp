import { create } from "zustand";
import type { ArgNode, Edge, NodeType, Strength } from "../model/types";
import * as repo from "../data/repo";

// In-memory projection of the model. Mutations write through to SQLite (repo)
// and update this store; every view reads from here.
interface SpineState {
  loaded: boolean;
  nodeTypes: NodeType[];
  nodeTypeById: Record<number, NodeType>;
  nodes: ArgNode[];
  edges: Edge[];
  selectedNodeId: number | null;
  selectedEdgeId: number | null;
  editingNodeId: number | null; // node whose claim is being edited inline

  load: () => Promise<void>;
  addNode: (typeId: number, x: number, y: number) => Promise<void>;
  duplicateNode: (id: number) => Promise<void>;
  setNodeClaim: (id: number, claim: string) => Promise<void>;
  setNodeBody: (id: number, body: string) => Promise<void>;
  setNodeType: (id: number, typeId: number) => Promise<void>;
  setNodeStrength: (id: number, strength: Strength) => Promise<void>;
  setNodeAttention: (id: number, attention: number) => Promise<void>;
  moveNodeLocal: (id: number, x: number, y: number) => void; // live, during drag
  persistNodePosition: (id: number) => Promise<void>; // on drag stop
  removeNode: (id: number) => Promise<void>;
  addEdge: (fromId: number, toId: number) => Promise<void>;
  removeEdge: (id: number) => Promise<void>;
  select: (nodeId: number | null, edgeId: number | null) => void;
  setEditing: (id: number | null) => void;
}

export const useSpine = create<SpineState>((set, get) => ({
  loaded: false,
  nodeTypes: [],
  nodeTypeById: {},
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  editingNodeId: null,

  async load() {
    const [nodeTypes, nodes, edges] = await Promise.all([
      repo.listNodeTypes(),
      repo.listNodes(),
      repo.listEdges(),
    ]);
    const nodeTypeById: Record<number, NodeType> = {};
    for (const t of nodeTypes) nodeTypeById[t.id] = t;
    set({ nodeTypes, nodeTypeById, nodes, edges, loaded: true });
  },

  async addNode(typeId, x, y) {
    const id = await repo.createNode(typeId, x, y);
    const node: ArgNode = {
      id,
      type_id: typeId,
      claim: "",
      body: "",
      strength: "unfinished",
      attention: 0,
      pos_x: x,
      pos_y: y,
    };
    set((s) => ({ nodes: [...s.nodes, node], selectedNodeId: id, selectedEdgeId: null }));
  },

  // Duplicate a node with its content and its supports (not its edges).
  async duplicateNode(id) {
    const src = get().nodes.find((n) => n.id === id);
    if (!src) return;
    const fields = {
      type_id: src.type_id,
      claim: src.claim,
      body: src.body,
      strength: src.strength,
      attention: src.attention,
      pos_x: src.pos_x + 32,
      pos_y: src.pos_y + 32,
    };
    const newId = await repo.createNodeFull(fields);
    const sups = await repo.listSupportsForNode(id);
    for (const s of sups) await repo.createSupport(newId, s.text, s.source_id, s.sort_order);
    set((s) => ({
      nodes: [...s.nodes, { id: newId, ...fields }],
      selectedNodeId: newId,
      selectedEdgeId: null,
    }));
  },

  async setNodeClaim(id, claim) {
    await repo.updateNodeClaim(id, claim);
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, claim } : n)) }));
  },

  async setNodeBody(id, body) {
    await repo.updateNodeBody(id, body);
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, body } : n)) }));
  },

  async setNodeType(id, typeId) {
    await repo.updateNodeType(id, typeId);
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, type_id: typeId } : n)) }));
  },

  async setNodeStrength(id, strength) {
    await repo.updateNodeStrength(id, strength);
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, strength } : n)) }));
  },

  async setNodeAttention(id, attention) {
    await repo.updateNodeAttention(id, attention);
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, attention } : n)) }));
  },

  moveNodeLocal(id, x, y) {
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, pos_x: x, pos_y: y } : n)) }));
  },

  async persistNodePosition(id) {
    const n = get().nodes.find((m) => m.id === id);
    if (n) await repo.updateNodePosition(id, n.pos_x, n.pos_y);
  },

  async removeNode(id) {
    await repo.deleteNode(id);
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.from_id !== id && e.to_id !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      editingNodeId: s.editingNodeId === id ? null : s.editingNodeId,
    }));
  },

  async addEdge(fromId, toId) {
    if (fromId === toId) return;
    if (get().edges.some((e) => e.from_id === fromId && e.to_id === toId)) return;
    const id = await repo.createEdge(fromId, toId);
    set((s) => ({
      edges: [...s.edges, { id, from_id: fromId, to_id: toId, kind: "conjunctive" }],
    }));
  },

  async removeEdge(id) {
    await repo.deleteEdge(id);
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== id),
      selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId,
    }));
  },

  select(nodeId, edgeId) {
    set({ selectedNodeId: nodeId, selectedEdgeId: edgeId });
  },

  setEditing(id) {
    set({ editingNodeId: id });
  },
}));

// Dev-only handle for debugging and automated verification from the console.
if (import.meta.env.DEV) {
  (window as unknown as { __spine?: typeof useSpine }).__spine = useSpine;
}
