import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useSpine } from "./state/store";
import { GraphCanvas } from "./components/GraphCanvas";
import { Toolbar } from "./components/Toolbar";

export default function App() {
  const load = useSpine((s) => s.load);
  const loaded = useSpine((s) => s.loaded);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ReactFlowProvider>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Toolbar />
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          {loaded ? (
            <GraphCanvas />
          ) : (
            <div style={{ padding: 24, color: "var(--text-secondary)" }}>Opening model…</div>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
