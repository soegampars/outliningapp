# Gaps & open endings

Holes are first-class in Spine, because making weakness visible is the whole point.
A gap is a step you know the argument needs but haven't made yet — and Spine treats
it differently depending on whether anything rests on it.

## The hole types

Set a move's type to one of the built-in hole types: **`GAP`** ("a missing step"),
**`OPEN GAP`**, or **`QUESTION`** (a placeholder for an answer you haven't decided).
They render with a dashed outline.

## The one rule that matters

- **A load-bearing gap** — a gap with something depending on it (mid-chain) —
  propagates as **broken** (maximally weak) and poisons everything downstream until
  you fill it. You can't quietly ship an argument with a hole in the middle.
- **A terminus gap** — a `QUESTION` or `OPEN GAP` at the *end* of the spine, with
  nothing resting on it — is your **intended open ending**, and is **not** flagged
  as a defect. A finished argument may legitimately land on an open question.

In short: *brokenness flows only from gaps that have something resting on them.*

## Parking-lot gaps

Sometimes you know you need *something* but don't yet know where it fits. Click
**+ Gap** to drop a **parking-lot gap**: a detached, distinct sticky-note
placeholder (marked 📌 PARKED) that:

- sits unconnected without poisoning anything,
- is excluded from the spine and never mistaken for where the argument lands,
- is "promoted" simply by wiring it into the argument (or changing its type) when you
  figure out where it goes.

It's a way to capture "I need a citation for this / I'm missing a step here" without
derailing your current train of thought.

## Landing on a question

Because a terminus can be *any* type, Spine lets the argument end on an open
question and renders it distinctly ("lands here") rather than pretending it's an
answer. That's a feature: honest research often ends by sharpening the next question.
