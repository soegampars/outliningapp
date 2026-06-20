# The canvas

The graph is the main workspace: typed argument **moves** (nodes) joined by logical
**connections** (edges). It shows the skeleton only — the evidence lives in the
[inspector](Sources-and-the-Debate).

## Working with moves

- **Add** — double-click empty canvas, or **+ Add node**. (For a placeholder, use
  **+ Gap** — see [Gaps](Gaps-and-Open-Endings).)
- **Edit the claim** — double-click a node, type, `Enter` to commit (`Esc` cancels).
- **Set the type** — the dropdown on the top-left badge. Types are extensible and
  rename-able; a move's type decides how its strength is judged.
- **Duplicate** — select and press `Ctrl+D`.
- **Delete** — select and press `Delete` / `Backspace`.

## Connecting moves

Drag from a node's **bottom** handle to another node's **top** handle. The edge
points *supporter → supported* ("this holds because of that").

Each edge has a **kind** — double-click it to toggle:

- **all-of (conjunctive)** — every feeder is jointly required (solid line). The
  step is only as strong as its weakest required input.
- **any-of (disjunctive)** — redundant alternatives (dashed line). The strongest
  alternative carries it.

## Selecting, panning, zooming

- **Click** a node or edge to select it (and open the inspector for a node).
- **Left-drag on empty canvas** draws a marquee — everything inside is selected,
  and selected nodes **move together**.
- **Right-drag**, or hold **Space** and drag, to **pan**. Scroll to zoom.
- The view **re-centres** automatically when you switch views, drill in/out of a
  [block](Blocks-and-Nesting), or resize the window.

## Reading the canvas at a glance

- **Colour** = effective strength (green strong · amber unfinished · rose weak).
  See [Argument strength](Argument-Strength).
- A **▸ layered card** is a [block](Blocks-and-Nesting) — it contains an inner chain.
- A **dashed sticky note** is a [gap / parking-lot placeholder](Gaps-and-Open-Endings).
- A **bold backbone** is the main spine; **lighter side-connectors** are lateral
  supports propping a step from the side.
- Small tags name a move's role: **lands here** (the terminus — where the argument
  ends), **block output**, **section** (an intermediate conclusion). Hover any tag
  for an explanation.
