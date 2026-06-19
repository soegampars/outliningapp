# Spine — Features

A complete guide to what Spine does and how to use it. Spine is a single-user,
local-first Windows desktop app for mapping the **skeleton** of a research paper's
argument — the moves and how they hold together — before you bury it in prose.

The guiding idea: keep the high-order argument legible. The canvas shows only the
skeleton; the supporting evidence ("flesh") is summoned on demand, never cluttering
the map.

---

## The canvas

The graph is the main workspace — typed argument moves (nodes) joined by logical
connections (edges).

- **Add a node** — double-click empty canvas, or the **+ Add node** button.
- **Add a parking-lot gap** — the **+ Gap** button (see *Gaps* below).
- **Edit a claim** — double-click a node, type, `Enter` to commit (`Esc` cancels).
- **Set the type** — the dropdown on the node's top-left badge.
- **Connect** — drag from a node's bottom handle to another's top handle. The edge
  points *supporter → supported*.
- **Edge kind** — double-click an edge (or use the inspector) to toggle:
  - **all-of (conjunctive)** — every feeder is jointly required (solid line).
  - **any-of (disjunctive)** — redundant alternatives (dashed line).
- **Select** — click a node/edge; left-drag on empty canvas draws a marquee
  (multi-select). Selected nodes move together.
- **Pan** — right-drag or hold **Space** and drag. Scroll to zoom.
- **Re-centre** — the canvas re-fits when you switch views, drill between levels,
  or resize the window.

## Node types

Types are **data, not code** — extensible and renamable in-app via the badge
dropdown. Built-ins include `PROBLEM FRAMING`, `PREMISE`, `TENSION`, `REDUCTIO`,
`IMPLICATION`, `CONCLUSION`, `QUESTION`, `PROPOSAL`, `OPEN GAP`, `GAP`, `CAVEAT`.

A node's type determines **how its strength is decided** (see below).

## Strength & propagation

Each node carries a strength — **strong / unfinished / weak** — shown as a coloured
left accent. Strength flows along the edges by a **weakest-link** rule:

- **all-of** feeders combine by the *minimum* (the chain is only as strong as its
  weakest required step).
- **any-of** feeders combine by the *maximum* (the best alternative carries it).
- A node's effective strength is the weakest path into it, capped by its own.

So softening one premise visibly softens every conclusion that depends on it.

**Type-specific strength (v3):**

- **Derived types** (`CONCLUSION`, `IMPLICATION`, `REDUCTIO`) have *no* manual
  strength — it is computed entirely from their premises. (With no support, they
  read *unfinished*.)
- **Problem framing** (`PROBLEM FRAMING`) is judged on its **own scale**
  (*solid / provisional / shaky*) and does **not** propagate its weakness into the
  chain that builds on it — a paper's framing is assessed differently from a logical
  step.
- Everything else is **manual** — you set the strength.

## Gaps, placeholders & the open terminus

Holes are first-class, because making weakness visible is the point.

- A **load-bearing gap** (a `GAP`/`OPEN GAP`/`QUESTION` with something depending on
  it) propagates as **broken** and poisons everything downstream until filled.
- A gap at the **end of the spine** with no dependents is a legitimate **open
  ending** — it is *not* flagged as a defect. A finished argument may rightly land
  on an open question.
- A **parking-lot gap** (the **+ Gap** button, or any gap with no connections yet) is
  a placeholder for "I know I need this, I just don't know where." It renders as a
  distinct dashed sticky note, doesn't poison anything, and isn't part of the spine.
  Wire it in (or change its type) to bring it into the argument.

## Spine vs lateral support

Derived from the curated order plus the edges (no extra data):

- The **spine** is the main argumentative thread — a bold backbone.
- A **lateral support** props a step from the side — it attaches with a lighter
  side-connector and reads as recessed, so the through-line stays obvious.

## Argument-position roles

- **Terminus** — where the argument lands (tagged *lands here*). It can be *any*
  type, including an open question — Spine never assumes "answer."
- **Block output** — the node a block represents one level up.
- **Section** — an intermediate conclusion on the spine, distinct from the terminus.

(Hover any role tag for an explanation.)

## Nested argument blocks (up to 3 levels)

Any node can open into its own internal argument chain.

- **Build internal structure** (inspector) turns a node into a **block**, seeding its
  current claim as the block's **output**.
- **Double-click a block** (or *Open block*) to drill into its sub-canvas.
- A **breadcrumb** (`Top ▸ A ▸ B`) shows where you are; click any crumb, press `Esc`,
  or use **↑ Up** to come back.
- A block's strength **= its inner output's effective strength** (capped by its own),
  surfaced on the collapsed block and propagated onward — so a weak link buried two
  levels down shows as a soft box at the top.
- Nesting is capped at **3 levels**.
- **Dissolve internal structure** (inspector) turns a block back into a plain node,
  removing its inner chain (it keeps the output's claim).

## Inspector (peek panel)

Open a node to edit it without leaving the skeleton on screen:

- Claim, body, type, strength, **attention** flag (⚑ "come back to this").
- **Supports** — the flesh: paraphrases, quotes, or your own reasoning attached to a
  node. A support linked to a source is a **citation**; otherwise it's your own
  reasoning. Supports never clutter the canvas.
- Feeders ("supported by") and dependents ("feeds into"), each clickable to navigate.

## Sources & provenance

- **Import .bib** — pull a BibTeX file; sources are matched by citekey and refreshed
  in place (re-importing never duplicates). The canonical library stays in Zotero.
- **Sources** panel — see each source's **footprint** (which nodes it supports),
  stakes-weighted **load**, and **single points of failure** (a strong conclusion
  resting on one source) — the "monoculture of evidence" check.

## Linear / drafting view

A top-to-bottom reading of the whole argument in your curated order, supports inline.

- Reorder the top-level thread with **↑ ↓**.
- A block's inner chain appears **indented and dimmed** beneath it, so the main
  thread stays dominant while the substructure is still visible in place.
- Click any claim to open it back in the graph (drilling to its level).

## Markdown export

**Export** produces self-describing Markdown so a fresh LLM conversation (or a
co-author) can reason over the argument's structure:

- **Complete** — lossless: every node, edge, strength, support, and citation.
- **Skeleton only** — just the argument moves and connections.

Copy to clipboard or download a `.md`.

## Projects: Save / Open / New

- Projects are plain **`.spine.json`** files — the whole model serialised as JSON,
  so a project is portable, diffable, and trivially backed up.
- **File ▸ New / Open / Save** — `Ctrl+N` / `Ctrl+O` / `Ctrl+S`. New and Open warn
  before discarding unsaved work.
- One project on the canvas at a time (no tabs); switch with Open.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+S` / `Ctrl+O` / `Ctrl+N` | Save / Open / New |
| `Ctrl+D` | Duplicate the selected node |
| `Delete` / `Backspace` | Remove the selection |
| `Esc` | Clear selection · exit a block · cancel a dialog |
| Double-click node | Edit claim (or drill into a block) |
| Double-click edge | Toggle all-of / any-of |
| Right-drag / Space-drag | Pan |
