# Getting started

## Install

**The easy way (Windows):** download the latest `.msi` or `.exe` from the
**[Releases page](https://github.com/soegampars/outliningapp/releases/latest)** and
run it. The installer isn't code-signed yet, so Windows SmartScreen may say "Windows
protected your PC" — click **More info → Run anyway**.

**From source** (any platform with the [Tauri prerequisites](https://tauri.app/start/prerequisites/)):

```bash
git clone https://github.com/soegampars/outliningapp.git
cd outliningapp
npm install
npm run tauri dev      # native app, or `npm run dev` for the browser build
```

## Your first argument in five minutes

1. **Add a move.** Double-click the empty canvas (or **+ Add node**). A new node
   appears — by default a `PREMISE`.
2. **Name it.** Double-click the node, type a short claim, press `Enter`.
3. **Change its type.** Use the dropdown on the node's top-left badge — try
   `PROBLEM FRAMING` for the question your paper addresses, or `CONCLUSION` for where
   it lands.
4. **Add another move and connect them.** Drag from the **bottom** handle of the
   supporting move to the **top** handle of the move it supports. The arrow points
   *supporter → supported*.
5. **Judge it.** Open a node (single click) to reveal the inspector on the right.
   Set its **strength** (strong / unfinished / weak). Watch how a weak premise tints
   the conclusions that depend on it.
6. **Attach evidence.** In the inspector, **+ Add support** — a paraphrase, a quote,
   or (after a [BibTeX import](Sources-and-the-Debate)) a citation. Mark it **for**
   or **against** the claim if it takes a side.
7. **Save.** `Ctrl+S` writes a portable `.spine.json` file you own.

That's the loop: lay out moves, connect them, judge strength, attach evidence, and
keep the skeleton legible while you do.

## Where to go next

- [The canvas](The-Canvas) — every interaction in the graph.
- [Argument strength](Argument-Strength) — how strength is decided and how it flows.
- [Blocks & nesting](Blocks-and-Nesting) — open a move into its own sub-argument.
- [Gaps & open endings](Gaps-and-Open-Endings) — mark what's missing.
- [Sources & the debate](Sources-and-the-Debate) — citations and for/against.
- [Linear view & export](Linear-View-and-Export) — read it straight through; hand it off.
