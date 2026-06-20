# Why Spine?

## The moment this is built for

Most research arguments are born in a burst of high-order thinking. You sketch the
spine of the paper — *this tension motivates this question; these premises support
this claim; therefore this conclusion* — and it feels clear and alive.

Then you go to the literature. You spend days, sometimes weeks, filling each move
with evidence: quotes, paraphrases, citations, caveats. Good, necessary work.

But when you come back to the whole, the skeleton has vanished under the flesh. The
argument that was obvious in your head is now spread across notes, PDFs, and
half-finished paragraphs. Before you can make progress you have to **reconstruct
your own argument** — and that re-entry cost quietly kills momentum, over and over.

Spine attacks that one problem.

## The core idea: skeleton vs flesh

Spine keeps two things deliberately separate:

- **The skeleton** — the bare argument: the typed moves and the logical connections
  between them. This, and only this, is what the canvas shows.
- **The flesh** — the supporting evidence attached to each move. It's always there,
  but summoned on demand in a side panel, never cluttering the map.

This separation is the whole point. The skeleton stays legible no matter how much
evidence you pile on, so the re-entry cost drops to near zero: open the file, see the
argument, keep thinking.

Crucially, *skeleton vs flesh* is not the same as *important vs unimportant*. A
load-bearing conclusion and a throwaway citation can sit anywhere. What belongs on
the canvas is decided by a move's **type and role**, not by how deep it is.

## How it maps to how researchers actually argue

Researchers don't think in flat outlines; they think in **claims that depend on
other claims**, with varying confidence, sometimes resting on contested evidence.
Spine tries to mirror that directly:

- **Dependencies, not just order.** An edge means "this holds *because* of that."
  The map is a graph of support, not a list — so you can see what rests on what.
- **Confidence you can see.** Every move has a strength, and weakness flows
  downstream by a weakest-link rule. A shaky premise visibly weakens the conclusions
  built on it. You notice fragility instead of discovering it in review.
- **Some things aren't yours to assert.** A *conclusion* shouldn't be "strong"
  just because you want it to be — its strength comes from its premises. Spine
  builds that in (see [Argument strength](Argument-Strength)).
- **The framing is judged differently.** How well-posed your problem framing is
  isn't a logical link in the chain; it's a separate kind of judgement. Spine treats
  it on its own scale.
- **Debate is first-class.** Real arguments have evidence on both sides. You can
  mark each support as arguing **for** or **against** a claim, so the map documents
  the live debate, not just your conclusion.
- **Known unknowns belong on the map.** The step you know you need but haven't made
  yet is a **gap** — and a gap that something depends on visibly breaks the chain
  until you fill it. The holes are part of the thinking, not hidden.

## What you get out the other end

When the shape is right, Spine helps you *leave*: a **linear view** reads the whole
argument top to bottom in your chosen order, and a **Markdown export** produces a
clean, self-describing version you can hand to a co-author — or paste into an LLM to
pressure-test the structure. Spine doesn't write the paper; it makes sure the
argument underneath it is sound first.

## What Spine is not

To stay good at its one job, Spine deliberately avoids being:

- a **reference manager** — keep your library in Zotero; Spine only caches the
  identity of papers you cite (via BibTeX import);
- a **prose word-processor** — write the actual paper in your editor;
- a **note vault** — supports are short pointers to evidence, not a second brain.

Next: **[Getting started](Getting-Started)**.
