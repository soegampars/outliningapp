import { create } from "zustand";
import type { ArgNode, Edge, EdgeKind, NodeType, Source, Strength } from "../model/types";
import * as repo from "../data/repo";
import { entryToSource, parseBibtex } from "../lib/bibtex";
import { topoOrderIds } from "../model/order";

export type ViewMode = "graph" | "linear";

// In-memory projection of the model. Mutations write through to SQLite (repo)
// and update this store; every view reads from here.
interface SpineState {
  loaded: boolean;
  view: ViewMode;
  nodeTypes: NodeType[];
  nodeTypeById: Record<number, NodeType>;
  nodes: ArgNode[];
  edges: Edge[];
  sources: Source[];
  sourceById: Record<number, Source>;
  linearOrder: number[]; // curated reading order (node ids)
  selectedNodeId: number | null;
  selectedEdgeId: number | null;
  editingNodeId: number | null;

  load: () => Promise<void>;
  setView: (v: ViewMode) => void;
  addNode: (typeId: number, x: number, y: number) => Promise<void>;
  duplicateNode: (id: number) => Promise<void>;
  setNodeClaim: (id: number, claim: string) => Promise<void>;
  setNodeBody: (id: number, body: string) => Promise<void>;
  setNodeType: (id: number, typeId: number) => Promise<void>;
  setNodeStrength: (id: number, strength: Strength) => Promise<void>;
  setNodeAttention: (id: number, attention: number) => Promise<void>;
  moveNodeLocal: (id: number, x: number, y: number) => void;
  persistNodePosition: (id: number) => Promise<void>;
  removeNode: (id: number) => Promise<void>;
  addEdge: (fromId: number, toId: number) => Promise<void>;
  setEdgeKind: (id: number, kind: EdgeKind) => Promise<void>;
  removeEdge: (id: number) => Promise<void>;
  importBibtex: (text: string) => Promise<{ created: number; updated: number; total: number }>;
  ensureLinearOrder: () => Promise<void>;
  setLinearOrder: (ids: number[]) => Promise<void>;
  select: (nodeId: number | null, edgeId: number | null) => void;
  setEditing: (id: number | null) => void;
}

function indexSources(sources: Source[]): Record<number, Source> {
  const byId: Record<number, Source> = {};
  for (const s of sources) byId[s.id] = s;
  return byId;
}

export const useSpine = create<SpineState>((set, get) => ({
  loaded: false,
  view: "graph",
  nodeTypes: [],
  nodeTypeById: {},
  nodes: [],
  edges: [],
  sources: [],
  sourceById: {},
  linearOrder: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  editingNodeId: null,

  async load() {
    const [nodeTypes, nodes, edges, sources, linearOrder] = await Promise.all([
      repo.listNodeTypes(),
      repo.listNodes(),
      repo.listEdges(),
      repo.listSources(),
      repo.getLinearOrder(),
    ]);
    const nodeTypeById: Record<number, NodeType> = {};
    for (const t of nodeTypes) nodeTypeById[t.id] = t;
    set({
      nodeTypes,
      nodeTypeById,
      nodes,
      edges,
      sources,
      sourceById: indexSources(sources),
      linearOrder,
      loaded: true,
    });
  },

  setView(v) {
    if (v === "linear") void get().ensureLinearOrder();
    set({ view: v });
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
      linearOrder: s.linearOrder.filter((x) => x !== id),
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

  async setEdgeKind(id, kind) {
    await repo.updateEdgeKind(id, kind);
    set((s) => ({ edges: s.edges.map((e) => (e.id === id ? { ...e, kind } : e)) }));
  },

  async removeEdge(id) {
    await repo.deleteEdge(id);
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== id),
      selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId,
    }));
  },

  async importBibtex(text) {
    const entries = parseBibtex(text);
    const existing = new Set(get().sources.map((s) => s.key));
    let created = 0;
    let updated = 0;
    for (const e of entries) {
      const src = entryToSource(e);
      if (!src.key) continue;
      if (existing.has(src.key)) updated++;
      else {
        created++;
        existing.add(src.key);
      }
      await repo.upsertSource(src);
    }
    const sources = await repo.listSources();
    set({ sources, sourceById: indexSources(sources) });
    return { created, updated, total: entries.length };
  },

  // Normalise the curated order: keep the stored sequence (for existing nodes),
  // then append any nodes not yet placed, in proposed topological order.
  async ensureLinearOrder() {
    const { nodes, edges, linearOrder } = get();
    const existing = new Set(nodes.map((n) => n.id));
    const kept = linearOrder.filter((id) => existing.has(id));
    const inKept = new Set(kept);
    const missing = topoOrderIds(nodes, edges).filter((id) => !inKept.has(id));
    const order = [...kept, ...missing];
    set({ linearOrder: order });
    await repo.replaceLinearOrder(order);
  },

  async setLinearOrder(ids) {
    set({ linearOrder: ids });
    await repo.replaceLinearOrder(ids);
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
