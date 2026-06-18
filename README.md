# Spine

**Argument-mapping for research outlining** — organise the *skeleton* of a paper's argument before you bury it in prose and citations.

Spine is a single-user, local-first desktop app for the structural stage of writing a research paper: building the chain of an argument — premises, tensions, implications, conclusions — and judging how well it holds together, **before** drafting prose.

It is deliberately **not** a reference manager, **not** a prose word-processor, and **not** a note vault. The actual writing and your reference library live elsewhere (Zotero, your editor of choice). Spine serves the one stage those tools handle badly: keeping the high-order argument legible while you work.

> **Status: feature-complete (v1 + v2), actively developed.** The whole v1 roadmap — model, inspector, weakest-link strength propagation, BibTeX import, Markdown export, linear view, provenance tools — is working, along with the v2 mechanics: nested argument blocks, cross-level strength, gap/terminus handling, and spine-vs-lateral rendering. Expect rough edges.

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
| **Node** | An argument move: a `type` (PREMISE, TENSION, CONCLUSION, QUESTION, GAP, …), a short `claim`, an optional longer `body`, a manual `strength` (`strong` / `unfinished` / `weak`), and an `attention` pin. A node can also become a **block** that owns its own internal sub-canvas (see below). |
| **Edge** | A logical connection from a supporting move → the move it supports, with a `kind`: **conjunctive** (jointly required) or **disjunctive** (redundant alternative). |
| **Support** | One use of evidence on one node — a paraphrase, quote, or your own gloss. Optionally linked to a Source (present = a citation; absent = your own reasoning). |
| **Source** | A cached *identity* of a paper (from a BibTeX import), not a library. Matched on a stable key so re-importing refreshes in place. |

Node types are **data, not code** — extensible in-app. Strength feeds a **weakest-link propagation** so that softening one premise visibly softens every conclusion that depends on it — *conjunctive* feeders combine by the minimum, a *disjunctive* set by the maximum, each capped by a node's own strength.

## Key mechanics

These build on the model above; all of them are projections of the same SQLite store, computed on the fly.

- **Nested argument blocks (two levels).** Any node can "build internal structure" and open into its own sub-canvas with its own moves and edges. The block's **output** (its internal conclusion — the node with no outgoing internal edge) is mirrored, read-only, on the collapsed block one level up. Double-click a block to drill in; a breadcrumb (or `Esc`) walks back out. Edges are scoped to a single level — only the output (claim) and strength cross the boundary.
- **Cross-level strength bridge.** A block's effective strength *is* the propagated strength of its inner output, capped by any strength set on the block itself. So a weak link buried inside a block surfaces as a soft box at the top level — sit at the top, see which box is soft, drill in, and the weak internal link is right there.
- **Gaps and the open terminus.** Two built-in "hole" types — **Gap** (a known missing step) and **Question / Open gap** (a slot to fill later). A gap with something resting on it propagates as *broken* and poisons everything downstream until filled. But a gap with **no dependents** — the end of the spine — is a legitimate **open ending** and is never flagged: a finished argument may rightly land on an open question.
- **Spine vs lateral support.** Derived from the curated linear order plus the edges: the main thread renders as a bold **backbone**, while off-path moves that merely prop up a step attach from the side with a lighter **side-connector** — so it stays obvious which boxes advance the argument and which support it.
- **Argument-position roles.** The **terminus** (where the argument lands — *any* type, including an open question) and a block's **output** get a distinct frame, and intermediate/section conclusions read differently from the final terminus, so the overall shape stays legible.

## Saving & opening

Projects are plain **`.spine.json`** files — the whole model (nodes, edges, supports, sources, linear order) serialised as JSON, so a project is portable, diffable, and trivially backed up. **File ▸ New / Open / Save** (or `Ctrl+N` / `Ctrl+O` / `Ctrl+S`); New and Open warn before discarding unsaved work. There are deliberately **no tabs** — one project on the canvas at a time.

## Project layout

```
src/                React frontend — all UI/UX
  db/               storage abstraction: Db interface + tauri/sql.js backends + schema/migrations
  data/             repository (SQL CRUD over the model)
  state/            zustand store (in-memory projection of the model + all actions)
  components/       canvas, argument node, peek/inspector, toolbar, linear view,
                    sources, export menu, breadcrumb, confirm modal
  model/            domain types + pure logic: strength, order, blocks, gaps, spine, provenance
  lib/              bibtex import, markdown export, .spine.json project files
  styles/           dark-mode theme tokens + canvas styling
src-tauri/          Rust shell (registers the SQL, dialog + opener plugins; file read/write commands)
```

## Interactions

- **Double-click the canvas** — add a node
- **Double-click a node** — edit its claim (or, if it's a block, drill into its sub-canvas)
- **Drag** from a node's bottom handle to another node's top handle — connect (supporter → supported)
- **Double-click an edge** — toggle conjunctive ↔ disjunctive
- **Left-drag on empty canvas** — marquee multi-select; selected nodes move together
- **Right-drag** (or **Space**-drag) — pan; scroll to zoom
- **`Ctrl+D`** — duplicate the selected node · **Delete / Backspace** — remove the selection · **`Esc`** — clear selection / exit a block
- **`Ctrl+S` / `Ctrl+O` / `Ctrl+N`** — Save / Open / New project
- The node's **type badge** is a dropdown; the inspector (open a node) edits claim, body, strength, attention, and supports

## Roadmap

The build order — each step leaves a usable app.

**v1 — the core tool:**

- [x] **Core model + skeleton-graph canvas** — typed nodes, edges, pan/zoom/drag, persistence
- [x] **Peek / inspector panel** — edit claim/body/strength/attention and manage supports, with the skeleton on screen
- [x] **Strength colouring + weakest-link propagation + conjunctive/disjunctive edge rendering**
- [x] **BibTeX import & refresh** + a source info bar
- [x] **Markdown export** — lossless and self-describing, so a fresh LLM conversation can reason over the argument's structure
- [x] **Linear / drafting view** + curated ordering
- [x] **Provenance / "monoculture of evidence" tools** — source footprint, load counts, single-point-of-failure detection
- [x] **Save / Open** `.spine.json` projects + guarded New

**v2 — shaping it to the way the argument is actually built:**

- [x] **Canvas interaction polish** — marquee multi-select, move-together, pan, keyboard shortcuts
- [x] **Nested argument blocks** (two levels) — drill in/out with a breadcrumb
- [x] **Cross-level strength bridge** — an inner weak link surfaces on the collapsed block above
- [x] **Gap / placeholder nodes** — load-bearing gaps break downstream; a terminus gap is a legitimate open ending
- [x] **Spine vs lateral support** — main thread as a backbone, side supports with a lighter connector
- [x] **Argument-position roles** — a distinct terminus (any type) and block-output / section-conclusion rendering

**Possible next:** raising the two-level nesting cap, richer export targets, and quality-of-life polish driven by real use.

## License

Not yet licensed. A `LICENSE` file should be added before any public release — [MIT](https://choosealicense.com/licenses/mit/) is a reasonable permissive default.

## Acknowledgements

Built with [Tauri](https://tauri.app/), [React Flow](https://reactflow.dev/), and [sql.js](https://github.com/sql-js/sql.js).
