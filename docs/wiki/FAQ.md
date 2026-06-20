# FAQ

**Is Spine a reference manager?**
No. Keep your library in Zotero. Spine only caches the *identity* of papers you cite
(via BibTeX import) so you can attach citations to moves. See
[Sources & the debate](Sources-and-the-Debate).

**Is it a word processor?**
No. Write the actual paper in your editor. Spine owns the stage *before* prose:
getting the argument's shape right. The [linear view & export](Linear-View-and-Export)
hand the structure off when you're ready to write.

**Where is my data? Is anything sent to the cloud?**
Nothing leaves your machine. Your project is a local `.spine.json` file (and a local
database while the app is open). No account, no sync, no telemetry. See
[Saving & files](Saving-and-Files).

**How is a node's strength decided?**
By its type. Most types are manual; *conclusions/implications* derive their strength
from their premises; *problem framing* is judged on its own scale and doesn't drag
the chain down. Weakness then flows by a weakest-link rule. Full detail in
[Argument strength](Argument-Strength).

**Why can't I set the strength of my conclusion?**
Because it's a *derived* type — its strength comes from its premises, by design. If
the conclusion looks weak, strengthen what supports it.

**What does the `section` tag mean?**
It marks an intermediate conclusion that sits on the main thread but isn't the final
**terminus** ("lands here"). It's assigned automatically; hover it for a note.

**Can I nest deeper than three levels?**
Not currently — nesting is capped at three. See [Blocks & nesting](Blocks-and-Nesting).

**The installer warns "Windows protected your PC."**
The installer isn't code-signed yet. Click **More info → Run anyway**, or build from
source. See [Getting started](Getting-Started).

**I made a move into a block by accident. Can I undo it?**
Yes — open it and choose **Dissolve internal structure**. The block becomes a plain
node again. See [Blocks & nesting](Blocks-and-Nesting).

**Can I use it on macOS / Linux?**
The released installer is Windows-only for now, but the app is built on Tauri and
runs from source on macOS/Linux with the standard Tauri prerequisites.

**Who made this?**
Spine was built by Claude Opus 4.8 (Anthropic) in collaboration with its author, and
is free software under the GNU GPL v3.
