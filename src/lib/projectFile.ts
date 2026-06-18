import type { ProjectData } from "../data/repo";

// Save/Open project files. Format: a .spine.json file = the whole model
// serialised as JSON (portable, human-readable, the same shape used for import).
// Native file dialogs go through the Tauri dialog plugin + the read/write
// commands; a plain browser falls back to download / file-input.

const PROJECT_VERSION = 1;
const FILTERS = [{ name: "Spine project", extensions: ["json"] }];

interface ProjectFile extends ProjectData {
  spine: number;
  savedAt: string;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function serializeProject(data: ProjectData): string {
  const file: ProjectFile = {
    spine: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    nodeTypes: data.nodeTypes,
    nodes: data.nodes,
    edges: data.edges,
    sources: data.sources,
    supports: data.supports,
    linearOrder: data.linearOrder,
  };
  return JSON.stringify(file, null, 2);
}

export function parseProject(text: string): ProjectData {
  const raw = JSON.parse(text) as Partial<ProjectFile>;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.nodes) || !Array.isArray(raw.nodeTypes)) {
    throw new Error("Not a valid Spine project file.");
  }
  return {
    nodeTypes: raw.nodeTypes ?? [],
    nodes: raw.nodes ?? [],
    edges: raw.edges ?? [],
    sources: raw.sources ?? [],
    supports: raw.supports ?? [],
    linearOrder: raw.linearOrder ?? [],
  };
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export interface SaveResult {
  name: string;
  path: string | null;
}

export interface OpenResult {
  name: string;
  text: string;
  path: string | null;
}

// --- Browser fallback ---
function browserDownload(text: string, suggestedName: string): SaveResult {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return { name: suggestedName, path: null };
}

function browserOpen(): Promise<OpenResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.spine,application/json";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      void f.text().then((text) => resolve({ name: f.name, text, path: null }));
    };
    input.click();
  });
}

// --- Public API ---

// forceDialog = true for "Save As"; otherwise reuse currentPath when present.
export async function saveProject(
  text: string,
  suggestedName: string,
  currentPath: string | null,
  forceDialog: boolean,
): Promise<SaveResult | null> {
  if (!isTauri()) return browserDownload(text, suggestedName);

  const { save } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  let path = !forceDialog && currentPath ? currentPath : null;
  if (!path) path = await save({ defaultPath: suggestedName, filters: FILTERS });
  if (!path) return null;
  await invoke("write_text_file", { path, contents: text });
  return { name: basename(path), path };
}

export async function openProject(): Promise<OpenResult | null> {
  if (!isTauri()) return browserOpen();

  const { open } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  const path = await open({ multiple: false, directory: false, filters: FILTERS });
  if (!path || typeof path !== "string") return null;
  const text = await invoke<string>("read_text_file", { path });
  return { name: basename(path), text, path };
}
