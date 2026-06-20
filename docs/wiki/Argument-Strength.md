# Argument strength

Strength is how Spine makes fragility *visible*. Every move carries a strength, and
weakness flows along the edges so you can see what's load-bearing and what's thin.

## The three values

- **strong** (green) · **unfinished** (amber) · **weak** (rose)

Shown as a coloured left accent on each node. The colour is the **effective**
strength — what's left after propagation — which may differ from what you set.

## Weakest-link propagation

A move's effective strength is the weakest path into it, capped by its own:

- **all-of (conjunctive)** feeders combine by the **minimum** — a chain is only as
  strong as its weakest required step.
- **any-of (disjunctive)** feeders combine by the **maximum** — the best of several
  redundant alternatives carries the step.

So softening one premise visibly softens every conclusion that depends on it — across
[block boundaries](Blocks-and-Nesting) too.

## How a move's *own* strength is decided

This depends on the move's **type** — because not every kind of claim is judged the
same way:

- **Manual** (e.g. `PREMISE`, `TENSION`, `CAVEAT`) — you set the strength directly.
- **Derived** (`CONCLUSION`, `IMPLICATION`, `REDUCTIO`) — these have *no* strength of
  their own. Their strength is computed entirely from their premises, so the manual
  control is hidden. A derived move with no real support reads **unfinished** (a
  stub). This stops you from declaring a conclusion "strong" when its premises
  aren't.
- **Framing** (`PROBLEM FRAMING`) — judged on its **own scale**
  (*solid · provisional · shaky*) and **excluded from propagation**: a shaky framing
  does *not* drag down the chain that builds on it. How well-posed a framing is, is a
  different question from how well-supported a claim is, so Spine keeps them apart.

## Gaps and brokenness

A **gap** that something depends on propagates as **broken** (maximally weak) and
poisons everything downstream until you fill it — impossible to ignore. A gap at the
very end of the argument, with nothing resting on it, is a legitimate **open
ending** and is not flagged. See [Gaps & open endings](Gaps-and-Open-Endings).

## Effective vs own

When a move's effective strength differs from what you set (because a feeder is
weaker), the inspector shows an **"Effective: …"** note explaining why. That gap
between intended and effective is exactly where your argument needs attention.
