import { useState } from "react";
import { useSpine } from "../state/store";

// File menu: New / Open / Save / Save As. The actual orchestration lives in the
// store (so the Ctrl+S/O/N shortcuts reuse it); New and Open raise a cautionary
// confirmation, rendered globally in App.
export function FileMenu() {
  const [open, setOpen] = useState(false);
  const requestNewProject = useSpine((s) => s.requestNewProject);
  const requestOpenProject = useSpine((s) => s.requestOpenProject);
  const saveCurrent = useSpine((s) => s.saveCurrent);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="file-menu">
      <button className="spine-btn" onClick={() => setOpen((o) => !o)}>
        File ▾
      </button>
      {open && (
        <>
          <div className="export-menu__backdrop" onClick={() => setOpen(false)} />
          <div className="export-menu__pop file-menu__pop">
            <button onClick={() => run(requestNewProject)}>New</button>
            <button onClick={() => run(requestOpenProject)}>Open…</button>
            <button onClick={() => run(() => void saveCurrent(false))}>Save</button>
            <button onClick={() => run(() => void saveCurrent(true))}>Save As…</button>
          </div>
        </>
      )}
    </div>
  );
}
