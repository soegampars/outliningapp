# Blocks & nesting

Real arguments have sub-arguments. A single "move" on your top-level map might itself
be a small chain of reasoning. **Blocks** let you open a move into its own internal
canvas — without losing the top-level legibility.

## Turning a move into a block

Open a node and click **Build internal structure ▸**. The move becomes a **block**:
it gets its own sub-canvas, seeded with one **output** node carrying its current
claim. On the parent canvas the block shows as a layered card (▸) displaying the
output's claim and the block's strength.

## Drilling in and out

- **Double-click a block** (or **Open block ▸**) to enter its sub-canvas.
- A **breadcrumb** shows where you are: `Top ▸ A ▸ B`. Click any crumb to jump
  there; press `Esc` or **↑ Up** to go up one level.
- The canvas re-centres on the level you land in.

## The output, and strength bridging

Inside a block, the **output** is its conclusion — the node nothing else inside
points to. Whatever you build inside flows to the output, and:

> **A block's strength = its inner output's effective strength** (capped by any
> strength set on the block itself), and that surfaces on the collapsed block and
> propagates onward.

So a weak link buried two levels down shows up as a soft box at the top. Sit at the
top level, spot the soft box, drill in — the weak inner link is right there. This is
the heart of how Spine helps you *notice* weakness.

Edges are **scoped to one level**: both ends of any connection live on the same
canvas. Only the output (its claim, upward) and the strength (upward) cross the
boundary.

## Depth limit

Nesting is capped at **three levels** (e.g. for a reductio argument that needs a
sub-sub-step). A move already two levels deep can't become a block.

## Dissolving a block

Made a block by accident, or no longer need the substructure? Open it and click
**Dissolve internal structure** (then confirm). The block becomes a plain node
again, keeping the output's claim; its inner chain is removed.
