import { create } from "zustand";
import type { ArgNode, Edge, EdgeKind, NodeType, Source, Strength, Support } from "../model/types";
import * as repo from "../data/repo";
import { entryToSource, parseBibtex } from "../lib/bibtex";
import { topoOrderIds } from "../model/order";
import { blockOutput } from "../model/blocks";

// How deeply a node is nested: a top-level node is depth 0, a block child 1, etc.
// Used to enforce the 3-layer nesting cap (only depth 0-1 nodes may become blocks).
function nodeDepth(nodes: ArgNode[], id: number): number {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let depth = 0;
  let cur = byId.get(id);
  while (cur && cur.parent_id != null) {
    depth++;
    cur = byId.get(cur.parent_id);
    if (depth > 8) break;
  }
  return depth;
}
import { openProject, parseProject, saveProject, serializeProject } from "../lib/projectFile";

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
  supports: Support[];
  sources: Source[];
  sourceById: Record<number, Source>;
  linearOrder: number[];
  currentParentId: number | null; // which level the canvas shows (null = top, else a block)
  selectedNodeId: number | null;
  selectedEdgeId: number | null;
  selectedNodeIds: number[];
  selectedEdgeIds: number[];
  editingNodeId: number | null;
  sourcesOpen: boolean;
  focusedSourceId: number | null;
  currentFileName: string | null;
  currentFilePath: string | null;
  pendingFileAction: "new" | "open" | null;
  fileMessage: string;

  load: () => Promise<void>;
  newProject: () => Promise<void>;
  loadProjectData: (p: repo.ProjectData) => Promise<void>;
  setCurrentFile: (name: string | null, path: string | null) => Promise<void>;
  saveCurrent: (forceDialog: boolean) => Promise<void>;
  requestNewProject: () => void;
  requestOpenProject: () => void;
  confirmFileAction: () => Promise<void>;
  cancelFileAction: () => void;
  setView: (v: ViewMode) => void;
  addNode: (typeId: number, x: number, y: number) => Promise<void>;
  duplicateNode: (id: number) => Promise<void>;
  makeBlock: (id: number) => Promise<void>;
  dissolveBlock: (id: number) => Promise<void>;
  drillInto: (id: number) => void;
  drillUp: () => void;
  drillTo: (parentId: number | null) => void;
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
  removeSelected: () => Promise<void>;
  addSupport: (nodeId: number) => Promise<void>;
  setSupportText: (id: number, text: string) => Promise<void>;
  setSupportSource: (id: number, sourceId: number | null) => Promise<void>;
  removeSupport: (id: number) => Promise<void>;
  importBibtex: (text: string) => Promise<{ created: number; updated: number; total: number }>;
  ensureLinearOrder: () => Promise<void>;
  setLinearOrder: (ids: number[]) => Promise<void>;
  select: (nodeId: number | null, edgeId: number | null) => void;
  setSelection: (nodeIds: number[], edgeIds: number[]) => void;
  focusNode: (id: number) => void;
  setEditing: (id: number | null) => void;
  toggleSources: () => void;
  focusSource: (id: number | null) => void;
}

function indexSources(sources: Source[]): Record<number, Source> {
  const byId: Record<number, Source> = {};
  for (const s of sources) byId[s.id] = s;
  return byId;
}

const CLEARED_SELECTION = {
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedNodeIds: [] as number[],
  selectedEdgeIds: [] as number[],
  editingNodeId: null,
};

export const useSpine = create<SpineState>((set, get) => {
  const flash = (msg: string) => {
    set({ fileMessage: msg });
    setTimeout(() => {
      if (get().fileMessage === msg) set({ fileMessage: "" });
    }, 3000);
  };

  return {
    loaded: false,
    view: "graph",
    nodeTypes: [],
    nodeTypeById: {},
    nodes: [],
    edges: [],
    supports: [],
    sources: [],
    sourceById: {},
    linearOrder: [],
    currentParentId: null,
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    editingNodeId: null,
    sourcesOpen: false,
    focusedSourceId: null,
    currentFileName: null,
    currentFilePath: null,
    pendingFileAction: null,
    fileMessage: "",

    async load() {
      const [nodeTypes, nodes, edges, supports, sources, linearOrder, fileName, filePath] =
        await Promise.all([
          repo.listNodeTypes(),
          repo.listNodes(),
          repo.listEdges(),
          repo.listAllSupports(),
          repo.listSources(),
          repo.getLinearOrder(),
          repo.getMeta("currentFileName"),
          repo.getMeta("currentFilePath"),
        ]);
      const nodeTypeById: Record<number, NodeType> = {};
      for (const t of nodeTypes) nodeTypeById[t.id] = t;
      set({
        nodeTypes,
        nodeTypeById,
        nodes,
        edges,
        supports,
        sources,
        sourceById: indexSources(sources),
        linearOrder,
        currentParentId: null,
        currentFileName: fileName,
        currentFilePath: filePath,
        loaded: true,
      });
    },

    async newProject() {
      await repo.wipeAll();
      await repo.seedDefaultTypes();
      await repo.setMeta("currentFileName", null);
      await repo.setMeta("currentFilePath", null);
      await get().load();
      set({ view: "graph", currentParentId: null, sourcesOpen: false, focusedSourceId: null, ...CLEARED_SELECTION });
    },

    async loadProjectData(p) {
      await repo.wipeAll();
      await repo.bulkInsert(p);
      await get().load();
      set({ view: "graph", currentParentId: null, sourcesOpen: false, focusedSourceId: null, ...CLEARED_SELECTION });
    },

    async setCurrentFile(name, path) {
      await repo.setMeta("currentFileName", name);
      await repo.setMeta("currentFilePath", path);
      set({ currentFileName: name, currentFilePath: path });
    },

    async saveCurrent(forceDialog) {
      const s = get();
      const text = serializeProject({
        nodeTypes: s.nodeTypes,
        nodes: s.nodes,
        edges: s.edges,
        sources: s.sources,
        supports: s.supports,
        linearOrder: s.linearOrder,
      });
      const res = await saveProject(
        text,
        s.currentFileName ?? "untitled.spine.json",
        s.currentFilePath,
        forceDialog,
      );
      if (res) {
        await get().setCurrentFile(res.name, res.path);
        flash(`Saved ${res.name}`);
      }
    },

    requestNewProject() {
      set({ pendingFileAction: "new" });
    },

    requestOpenProject() {
      set({ pendingFileAction: "open" });
    },

    async confirmFileAction() {
      const kind = get().pendingFileAction;
      set({ pendingFileAction: null });
      if (kind === "new") {
        await get().newProject();
        flash("Started a new project");
      } else if (kind === "open") {
        const res = await openProject();
        if (!res) return;
        try {
          const data = parseProject(res.text);
          await get().loadProjectData(data);
          await get().setCurrentFile(res.name, res.path);
          flash(`Opened ${res.name}`);
        } catch (e) {
          flash(`Couldn't open: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    },

    cancelFileAction() {
      set({ pendingFileAction: null });
    },

    setView(v) {
      if (v === "linear") void get().ensureLinearOrder();
      set({ view: v });
    },

    async addNode(typeId, x, y) {
      const parentId = get().currentParentId;
      const id = await repo.createNode(typeId, x, y, "", parentId);
      const node: ArgNode = {
        id,
        type_id: typeId,
        claim: "",
        body: "",
        strength: "unfinished",
        attention: 0,
        pos_x: x,
        pos_y: y,
        parent_id: parentId,
        is_block: 0,
      };
      set((s) => ({
        nodes: [...s.nodes, node],
        selectedNodeId: id,
        selectedEdgeId: null,
        selectedNodeIds: [id],
        selectedEdgeIds: [],
      }));
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
        parent_id: src.parent_id,
        is_block: 0,
      };
      const newId = await repo.createNodeFull(fields);
      const srcSupports = get().supports.filter((s) => s.node_id === id);
      const newSupports: Support[] = [];
      for (const s of srcSupports) {
        const sid = await repo.createSupport(newId, s.text, s.source_id, s.sort_order);
        newSupports.push({
          id: sid,
          node_id: newId,
          text: s.text,
          source_id: s.source_id,
          sort_order: s.sort_order,
        });
      }
      set((s) => ({
        nodes: [...s.nodes, { id: newId, ...fields }],
        supports: [...s.supports, ...newSupports],
        selectedNodeId: newId,
        selectedEdgeId: null,
        selectedNodeIds: [newId],
        selectedEdgeIds: [],
      }));
    },

    // Turn a top-level node into a block and drill into its (seeded) sub-canvas.
    async makeBlock(id) {
      const node = get().nodes.find((n) => n.id === id);
      // 3-layer cap: a node already at depth 2 (layer 3) can't own a sub-canvas.
      if (!node || node.is_block || nodeDepth(get().nodes, id) > 1) return;
      const outId = await repo.makeBlock(node);
      const out: ArgNode = {
        id: outId,
        type_id: node.type_id,
        claim: node.claim,
        body: node.body,
        strength: node.strength,
        attention: 0,
        pos_x: 240,
        pos_y: 160,
        parent_id: id,
        is_block: 0,
      };
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, is_block: 1 } : n)).concat(out),
        currentParentId: id,
        ...CLEARED_SELECTION,
        selectedNodeId: outId,
        selectedNodeIds: [outId],
      }));
    },

    drillInto(id) {
      set({ currentParentId: id, ...CLEARED_SELECTION });
    },

    drillUp() {
      const cur = get().currentParentId;
      const block = cur != null ? get().nodes.find((n) => n.id === cur) : null;
      set({ currentParentId: block?.parent_id ?? null, ...CLEARED_SELECTION });
    },

    drillTo(parentId) {
      set({ currentParentId: parentId, ...CLEARED_SELECTION });
    },

    async dissolveBlock(id) {
      const { nodes, edges } = get();
      const node = nodes.find((n) => n.id === id);
      if (!node || !node.is_block) return;
      // Keep the visible text: the collapsed block mirrors its output's claim.
      const keepClaim = blockOutput(id, nodes, edges)?.claim ?? node.claim;
      // Every node nested under this block, at any depth.
      const descendants = new Set<number>();
      const collect = (pid: number) => {
        for (const n of nodes)
          if (n.parent_id === pid && !descendants.has(n.id)) {
            descendants.add(n.id);
            collect(n.id);
          }
      };
      collect(id);
      // Persist: deleting the direct children cascades to the rest (repo.deleteNode).
      for (const cid of nodes.filter((n) => n.parent_id === id).map((n) => n.id)) {
        await repo.deleteNode(cid);
      }
      await repo.updateNodeClaim(id, keepClaim);
      await repo.setNodeIsBlock(id, 0);
      set((s) => {
        const insideDissolved =
          s.currentParentId != null &&
          (s.currentParentId === id || descendants.has(s.currentParentId));
        return {
          nodes: s.nodes
            .filter((n) => !descendants.has(n.id))
            .map((n) => (n.id === id ? { ...n, is_block: 0, claim: keepClaim } : n)),
          edges: s.edges.filter(
            (e) => !descendants.has(e.from_id) && !descendants.has(e.to_id),
          ),
          linearOrder: s.linearOrder.filter((nid) => !descendants.has(nid)),
          currentParentId: insideDissolved ? (node.parent_id ?? null) : s.currentParentId,
          ...CLEARED_SELECTION,
        };
      });
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
      set((s) => {
        const del = new Set<number>([id]);
        for (const n of s.nodes) if (n.parent_id === id) del.add(n.id);
        return {
          nodes: s.nodes.filter((n) => !del.has(n.id)),
          edges: s.edges.filter((e) => !del.has(e.from_id) && !del.has(e.to_id)),
          supports: s.supports.filter((x) => !del.has(x.node_id)),
          linearOrder: s.linearOrder.filter((x) => !del.has(x)),
          selectedNodeId: s.selectedNodeId != null && del.has(s.selectedNodeId) ? null : s.selectedNodeId,
          selectedNodeIds: s.selectedNodeIds.filter((x) => !del.has(x)),
          editingNodeId: s.editingNodeId != null && del.has(s.editingNodeId) ? null : s.editingNodeId,
        };
      });
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
        selectedEdgeIds: s.selectedEdgeIds.filter((x) => x !== id),
      }));
    },

    async removeSelected() {
      const { selectedNodeIds, selectedEdgeIds, nodes } = get();
      for (const id of selectedEdgeIds) await repo.deleteEdge(id);
      for (const id of selectedNodeIds) await repo.deleteNode(id);
      const del = new Set<number>();
      for (const id of selectedNodeIds) {
        del.add(id);
        for (const n of nodes) if (n.parent_id === id) del.add(n.id);
      }
      const delEdges = new Set(selectedEdgeIds);
      set((s) => ({
        nodes: s.nodes.filter((n) => !del.has(n.id)),
        edges: s.edges.filter(
          (e) => !del.has(e.from_id) && !del.has(e.to_id) && !delEdges.has(e.id),
        ),
        supports: s.supports.filter((x) => !del.has(x.node_id)),
        linearOrder: s.linearOrder.filter((x) => !del.has(x)),
        ...CLEARED_SELECTION,
        editingNodeId:
          s.editingNodeId != null && del.has(s.editingNodeId) ? null : s.editingNodeId,
      }));
    },

    async addSupport(nodeId) {
      const order = get().supports.filter((s) => s.node_id === nodeId).length;
      const id = await repo.createSupport(nodeId, "", null, order);
      set((s) => ({
        supports: [
          ...s.supports,
          { id, node_id: nodeId, text: "", source_id: null, sort_order: order },
        ],
      }));
    },

    async setSupportText(id, text) {
      await repo.updateSupportText(id, text);
      set((s) => ({ supports: s.supports.map((x) => (x.id === id ? { ...x, text } : x)) }));
    },

    async setSupportSource(id, sourceId) {
      await repo.updateSupportSource(id, sourceId);
      set((s) => ({
        supports: s.supports.map((x) => (x.id === id ? { ...x, source_id: sourceId } : x)),
      }));
    },

    async removeSupport(id) {
      await repo.deleteSupport(id);
      set((s) => ({ supports: s.supports.filter((x) => x.id !== id) }));
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

    async ensureLinearOrder() {
      const { nodes, edges, linearOrder, currentParentId } = get();
      const levelNodes = nodes.filter((n) => (n.parent_id ?? null) === currentParentId);
      const levelIds = new Set(levelNodes.map((n) => n.id));
      const existing = new Set(levelNodes.map((n) => n.id));
      const kept = linearOrder.filter((id) => existing.has(id));
      const inKept = new Set(kept);
      const levelEdges = edges.filter((e) => levelIds.has(e.from_id) && levelIds.has(e.to_id));
      const missing = topoOrderIds(levelNodes, levelEdges).filter((id) => !inKept.has(id));
      const order = [...kept, ...missing];
      set({ linearOrder: order });
      await repo.replaceLinearOrder(order);
    },

    async setLinearOrder(ids) {
      set({ linearOrder: ids });
      await repo.replaceLinearOrder(ids);
    },

    select(nodeId, edgeId) {
      set({
        selectedNodeId: nodeId,
        selectedEdgeId: edgeId,
        selectedNodeIds: nodeId != null ? [nodeId] : [],
        selectedEdgeIds: edgeId != null ? [edgeId] : [],
      });
    },

    focusNode(id) {
      // Open a node in the graph from elsewhere (e.g. the linear view): switch to
      // the level it lives on so it is actually visible, then select it.
      const n = get().nodes.find((x) => x.id === id);
      set({
        view: "graph",
        currentParentId: n?.parent_id ?? null,
        sourcesOpen: false,
        selectedNodeId: id,
        selectedEdgeId: null,
        selectedNodeIds: [id],
        selectedEdgeIds: [],
      });
    },

    setSelection(nodeIds, edgeIds) {
      // Value-stable: if the selection is unchanged, keep the existing array refs
      // so downstream memos (and React Flow's controlled nodes) don't churn.
      const s = get();
      const sameSet = (a: number[], b: number[]) =>
        a.length === b.length && a.every((id) => b.includes(id));
      if (sameSet(nodeIds, s.selectedNodeIds) && sameSet(edgeIds, s.selectedEdgeIds)) return;
      set({
        selectedNodeIds: nodeIds,
        selectedEdgeIds: edgeIds,
        selectedNodeId: nodeIds.length === 1 ? nodeIds[0] : null,
        selectedEdgeId: edgeIds.length === 1 && nodeIds.length === 0 ? edgeIds[0] : null,
      });
    },

    setEditing(id) {
      set({ editingNodeId: id });
    },

    toggleSources() {
      set((s) => ({
        sourcesOpen: !s.sourcesOpen,
        selectedNodeId: !s.sourcesOpen ? null : s.selectedNodeId,
        focusedSourceId: s.sourcesOpen ? null : s.focusedSourceId,
      }));
    },

    focusSource(id) {
      set((s) => ({ focusedSourceId: s.focusedSourceId === id ? null : id }));
    },
  };
});

// Dev-only handle for debugging and automated verification from the console.
if (import.meta.env.DEV) {
  (window as unknown as { __spine?: typeof useSpine }).__spine = useSpine;
}
