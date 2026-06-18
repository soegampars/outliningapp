import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useSpine } from "./state/store";
import { GraphCanvas } from "./components/GraphCanvas";
import { Toolbar } from "./components/Toolbar";
import { PeekPanel } from "./components/PeekPanel";
import { SourcesPanel } from "./components/SourcesPanel";
import { LinearView } from "./components/LinearView";
import { ConfirmModal } from "./components/ConfirmModal";
import { Breadcrumb } from "./components/Breadcrumb";

export default function App() {
  const load = useSpine((s) => s.load);
  const loaded = useSpine((s) => s.loaded);
  const view = useSpine((s) => s.view);
  const selectedNodeId = useSpine((s) => s.selectedNodeId);
  const sourcesOpen = useSpine((s) => s.sourcesOpen);
  const pendingFileAction = useSpine((s) => s.pendingFileAction);
  const confirmFileAction = useSpine((s) => s.confirmFileAction);
  const cancelFileAction = useSpine((s) => s.cancelFileAction);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      const st = useSpine.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        void st.saveCurrent(false);
        return;
      }
      if (mod && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        st.requestOpenProject();
        return;
      }
      if (mod && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        st.requestNewProject();
        return;
      }

      if (inField) return;

      if (mod && (e.key === "d" || e.key === "D")) {
        if (st.view === "graph" && st.selectedNodeId != null) {
          e.preventDefault();
          void st.duplicateNode(st.selectedNodeId);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (st.view === "graph" && (st.selectedNodeIds.length || st.selectedEdgeIds.length)) {
          e.preventDefault();
          void st.removeSelected();
        }
        return;
      }
      if (e.key === "Escape") {
        if (st.pendingFileAction) st.cancelFileAction();
        else if (st.editingNodeId != null) st.setEditing(null);
        else if (st.view === "graph" && st.currentParentId != null) st.drillUp();
        else st.setSelection([], []);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ReactFlowProvider>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Toolbar />
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {!loaded ? (
            <div style={{ padding: 24, color: "var(--text-secondary)" }}>Opening model…</div>
          ) : view === "linear" ? (
            <LinearView />
          ) : (
            <>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                <Breadcrumb />
                <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
                  <GraphCanvas />
                </div>
              </div>
              {selectedNodeId != null ? <PeekPanel /> : sourcesOpen ? <SourcesPanel /> : null}
            </>
          )}
        </div>
      </div>

      {pendingFileAction && (
        <ConfirmModal
          title={pendingFileAction === "new" ? "Start a new project?" : "Open a project?"}
          body={
            pendingFileAction === "new"
              ? "The current canvas will be cleared. Unsaved changes will be lost — Save first if you want to keep them."
              : "This replaces the project currently on the canvas. Unsaved changes will be lost."
          }
          okLabel={pendingFileAction === "new" ? "New project" : "Open…"}
          onCancel={cancelFileAction}
          onConfirm={() => void confirmFileAction()}
        />
      )}
    </ReactFlowProvider>
  );
}
