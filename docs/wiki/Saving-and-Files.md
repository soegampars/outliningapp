# Saving & files

## Projects are plain `.spine.json` files

A Spine project is the whole model — moves, edges, supports, sources, and the linear
order — serialised as readable JSON. That means your work is:

- **portable** — one file you can move, email, or drop in a shared folder;
- **diffable** — track it in Git if you like;
- **backup-able** — it's just a file you own, offline, no account, no cloud.

## Save / Open / New

- **`Ctrl+S`** — Save (writes back to the current file, or prompts the first time).
- **`Ctrl+O`** — Open a `.spine.json` project.
- **`Ctrl+N`** — New project (clears the canvas, with a cautionary prompt first so
  you don't lose unsaved work).

These are also under the **File** menu in the toolbar. The current file name is shown
beside it.

## One project at a time

Spine has **no tabs** by design — one argument on the canvas at a time. To work on a
different project, Open it (you'll be warned about unsaved changes first). Keeping a
single argument in view is part of the point.

## Where your data lives

- **Desktop app:** your model is a SQLite database in the app's data directory, and
  you Save/Open `.spine.json` files anywhere you like.
- **Browser build:** the working model is kept in the browser (IndexedDB); use
  Save/Open to move it in and out as `.spine.json`.

Either way, the `.spine.json` file is the durable, portable artifact — save often.
