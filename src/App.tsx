import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useSpine } from "./state/store";
import { GraphCanvas } from "./components/GraphCanvas";
import { Toolbar } from "./components/Toolbar";
import { PeekPanel } from "./components/PeekPanel";
import { SourcesPanel } from "./components/SourcesPanel";
import { LinearView } from "./components/LinearView";

export default function App() {
  const load = useSpine((s) => s.load);
  const loaded = useSpine((s) => s.loaded);
  const view = useSpine((s) => s.view);
  const selectedNodeId = useSpine((s) => s.selectedNodeId);
  const sourcesOpen = useSpine((s) => s.sourcesOpen);

  useEffect(() => {
    void load();
  }, [load]);

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
              <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                <GraphCanvas />
              </div>
              {selectedNodeId != null ? <PeekPanel /> : sourcesOpen ? <SourcesPanel /> : null}
            </>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
