import { useState } from "react";
import { useSpine } from "../state/store";
import { openProject, parseProject, saveProject, serializeProject } from "../lib/projectFile";

const DEFAULT_NAME = "untitled.spine.json";

interface Confirm {
  title: string;
  body: string;
  ok: string;
  action: () => Promise<void> | void;
}

// File menu: New / Open / Save / Save As, over .spine.json project files.
// New and Open replace the working project, so both go behind a cautionary
// confirmation.
export function FileMenu() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [note, setNote] = useState("");

  const newProject = useSpine((s) => s.newProject);
  const loadProjectData = useSpine((s) => s.loadProjectData);
  const setCurrentFile = useSpine((s) => s.setCurrentFile);
  const currentFileName = useSpine((s) => s.currentFileName);
  const currentFilePath = useSpine((s) => s.currentFilePath);
  const nodeTypes = useSpine((s) => s.nodeTypes);
  const nodes = useSpine((s) => s.nodes);
  const edges = useSpine((s) => s.edges);
  const sources = useSpine((s) => s.sources);
  const supports = useSpine((s) => s.supports);
  const linearOrder = useSpine((s) => s.linearOrder);

  const flash = (m: string) => {
    setNote(m);
    window.setTimeout(() => setNote(""), 3000);
  };
  const serialize = () =>
    serializeProject({ nodeTypes, nodes, edges, sources, supports, linearOrder });
  const suggested = () => currentFileName ?? DEFAULT_NAME;

  const doSave = async (forceDialog: boolean) => {
    setOpen(false);
    const res = await saveProject(serialize(), suggested(), currentFilePath, forceDialog);
    if (res) {
      await setCurrentFile(res.name, res.path);
      flash(`Saved ${res.name}`);
    }
  };

  const doOpen = () => {
    setOpen(false);
    setConfirm({
      title: "Open a project?",
      body: "This replaces the project currently on the canvas. Unsaved changes will be lost.",
      ok: "Open…",
      action: async () => {
        const res = await openProject();
        if (!res) return;
        let data;
        try {
          data = parseProject(res.text);
        } catch (e) {
          flash(`Couldn't open: ${e instanceof Error ? e.message : String(e)}`);
          return;
        }
        await loadProjectData(data);
        await setCurrentFile(res.name, res.path);
        flash(`Opened ${res.name}`);
      },
    });
  };

  const doNew = () => {
    setOpen(false);
    setConfirm({
      title: "Start a new project?",
      body: "The current canvas will be cleared. Unsaved changes will be lost — Save first if you want to keep them.",
      ok: "New project",
      action: async () => {
        await newProject();
        flash("Started a new project");
      },
    });
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
            <button onClick={doNew}>New</button>
            <button onClick={doOpen}>Open…</button>
            <button onClick={() => void doSave(false)}>Save</button>
            <button onClick={() => void doSave(true)}>Save As…</button>
          </div>
        </>
      )}
      {note && <span className="spine-toolbar__msg">{note}</span>}

      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__title">{confirm.title}</div>
            <div className="modal__body">{confirm.body}</div>
            <div className="modal__actions">
              <button className="spine-btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="spine-btn modal__danger"
                onClick={() => {
                  const action = confirm.action;
                  setConfirm(null);
                  void action();
                }}
              >
                {confirm.ok}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
