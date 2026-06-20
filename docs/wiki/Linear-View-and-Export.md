# Linear view & export

A graph is the right shape for *building* an argument. A line is the right shape for
*writing* it. Spine gives you both, and a clean way to hand the argument off.

## Linear / drafting view

Switch to **Linear** (toolbar) to read the whole argument top to bottom in a curated
order, with supports inline — the "dimension reduction" from graph to draft.

- **Reorder** the top-level thread with the **↑ ↓** buttons; the order is saved and
  is the same order used by the export.
- A **block's inner chain** appears **indented and dimmed** beneath it, so the main
  thread stays dominant while the substructure is still visible in place (nested up
  to the 3-level cap).
- **Click any claim** to jump back to it in the graph (drilling to its level).

Use this view to find ordering problems — a conclusion that arrives before its
support, a section that doesn't follow — before you commit a word to prose.

## Markdown export

**Export** produces self-describing Markdown — a clean, portable snapshot of the
argument's structure:

- **Complete (lossless)** — every move, edge, strength, support, citation, and
  for/against stance. It opens with a short legend, so a human *or an LLM* can reason
  about weakest-link strength and evidence monoculture straight from the text.
- **Skeleton only** — just the moves and connections.

Copy to the clipboard or download a `.md`. A common workflow: export *complete* and
paste it into an LLM conversation to pressure-test the argument — "where is this
weakest? what's resting on a single source? where does it actually land?"

Spine doesn't write your paper. It makes sure the argument underneath it holds up,
then hands you a clean version to write from.
