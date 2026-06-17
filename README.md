# Spine

**Argument-mapping for research outlining** — organise the *skeleton* of a paper's argument before you bury it in prose and citations.

Spine is a single-user, local-first desktop app for the structural stage of writing a research paper: building the chain of an argument — premises, tensions, implications, conclusions — and judging how well it holds together, **before** drafting prose.

It is deliberately **not** a reference manager, **not** a prose word-processor, and **not** a note vault. The actual writing and your reference library live elsewhere (Zotero, your editor of choice). Spine serves the one stage those tools handle badly: keeping the high-order argument legible while you work.

> **Status: early, actively developed.** The core model and the skeleton-graph canvas are working (Step 1 of the roadmap below). Expect rough edges.

<!-- ![Spine canvas](docs/screenshot.png) -->

---

## The problem it solves

The author builds an argument skeleton in a state of high-order thinking, then spends a day filling each point with supporting evidence from the literature. On returning, the supporting detail has buried the skeleton — the high-order thread is no longer legible at a glance, and the time spent reconstructing it kills momentum.

Spine attacks this **re-entry cost** by keeping two things separate:

- **Skeleton** — the bare argument: typed moves and the logical connections between them. This is all the canvas shows.
- **Flesh** — the supporting evidence (paraphrases, quotes, your own reasoning) attached to each move. Summoned on demand in a detail panel, never cluttering the canvas.

Crucially, *skeleton vs flesh* is orthogonal to *depth in the tree*: a load-bearing conclusion can sit deep, and a citation can sit shallow. Visibility is driven by a node's **type/role**, never its depth.

## Design principles

- **Don't automate the fun; eliminate the mechanical labour.** Organising, connecting, and choosing a linear reading order stay manual — that's the author's work and the source of the joy. The tool only removes friction: re-finding state, navigating buried structure, source clutter.
- **Single source of truth.** The meaning is stored once, in SQLite. Every view (graph, detail panel, linear view) is a *projection* that reads the same model and draws it differently. Nothing is duplicated or hand-synced.
- **Responsiveness is a feature.** Local-first storage and a lean canvas that renders skeleton only — pan, zoom, drag, and typing should feel immediate.
- **Local-first and private.** Your model is a SQLite file you own — offline, backup-able, no cloud, no account.

## Tech stack

- **[Tauri 2](https://tauri.app/)** — lightweight Rust shell, packaged as a native Windows app (uses the OS WebView). The Rust side is intentionally minimal.
- **React 19 + TypeScript + [Vite](https://vite.dev/)** — all UI/UX lives in the web frontend.
- **[React Flow](https://reactflow.dev/) (`@xyflow/react`)** — the graph canvas (pan/zoom/drag, custom nodes and edges).
- **[Zustand](https://github.com/pmndrs/zustand)** — in-memory store (a projection of the model).
- **SQLite** — the model. Native via [`@tauri-apps/plugin-sql`](https://github.com/tauri-apps/plugins-workspace) in the desktop app; [`sql.js`](https://github.com/sql-js/sql.js) (WASM SQLite, persisted to IndexedDB) when run in a plain browser. Both speak identical SQL, so the optional browser build is a small step, not a rewrite.

## Getting started

### Prerequisites

- **Node.js** 20.19+ or 22.12+
- **Rust** (stable; the MSVC toolchain on Windows) — only needed for the desktop build
- **Windows:** Microsoft C++ Build Tools and WebView2 (WebView2 ships with Windows 11). On macOS/Linux, install the [standard Tauri prerequisites](https://tauri.app/start/prerequisites/).

### Run the desktop app (dev)

```bash
git clone https://github.com/soegampars/outliningapp.git
cd outliningapp
npm install
npm run tauri dev
```

The first launch compiles the Rust side (a minute or two), then opens the native Spine window. Your model is stored as a SQLite file in the app's data directory.

### Run in the browser (no Rust required)

```bash
npm install
npm run dev      # http://localhost:1420
```

This serves the frontend with an in-browser SQLite store (sql.js + IndexedDB) — handy for quick UI work. The desktop build is the durable target.

### Build a Windows installer

```bash
npm run tauri build
```

## How it works — the data model

Four object types plus edges, stored in one SQLite file:

| Object | What it is |
|---|---|
| **Node** | An argument move: a `type` (PREMISE, TENSION, CONCLUSION, …), a short `claim`, an optional longer `body`, a manual `strength` (`strong` / `unfinished` / `weak`), and an `attention` pin. |
| **Edge** | A logical connection from a supporting move → the move it supports, with a `kind`: **conjunctive** (jointly required) or **disjunctive** (redundant alternative). |
| **Support** | One use of evidence on one node — a paraphrase, quote, or your own gloss. Optionally linked to a Source (present = a citation; absent = your own reasoning). |
| **Source** | A cached *identity* of a paper (from a BibTeX import), not a library. Matched on a stable key so re-importing refreshes in place. |

Node types are **data, not code** — extensible in-app. Strength feeds a (planned) weakest-link propagation so that softening one premise visibly softens every conclusion that depends on it.

## Project layout

```
src/                React frontend — all UI/UX
  db/               storage abstraction: Db interface + tauri/sql.js backends + schema
  data/             repository (SQL CRUD over the model)
  state/            zustand store (in-memory projection of the model)
  components/       graph canvas, argument node, toolbar
  model/            domain types
  styles/           dark-mode theme tokens + canvas styling
src-tauri/          Rust shell (registers the SQL + opener plugins; otherwise minimal)
```

## Interactions

- **Double-click the canvas** — add a node
- **Double-click a node** — edit its claim
- **Drag** from a node's bottom handle to another node's top handle — connect (supporter → supported)
- **Select + Delete / Backspace** — remove a node or edge
- The node's **type badge** is a dropdown; the canvas pans, zooms, and drags freely

## Roadmap

The build order — each step leaves a usable app:

- [x] **Core model + skeleton-graph canvas** — typed nodes, edges, pan/zoom/drag, persistence
- [ ] **Peek / inspector panel** — edit claim/body/strength/attention and manage supports, with the skeleton on screen
- [ ] **Strength colouring + weakest-link propagation + conjunctive/disjunctive edge rendering**
- [ ] **BibTeX import & refresh** + a source info bar
- [ ] **Markdown export** — lossless and self-describing, so a fresh LLM conversation can reason over the argument's structure
- [ ] **Linear / drafting view** + curated ordering
- [ ] **Provenance / "monoculture of evidence" tools** — source footprint, load counts, single-point-of-failure detection

## License

Not yet licensed. A `LICENSE` file should be added before any public release — [MIT](https://choosealicense.com/licenses/mit/) is a reasonable permissive default.

## Acknowledgements

Built with [Tauri](https://tauri.app/), [React Flow](https://reactflow.dev/), and [sql.js](https://github.com/sql-js/sql.js).
