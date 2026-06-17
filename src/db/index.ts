import type { Db, DbBackend } from "./types";
import { initSchema } from "./schema";

// Pick the storage backend at runtime: native SQLite inside Tauri, sql.js in a
// plain browser. The choice is invisible to the rest of the app.
export function detectBackend(): DbBackend {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? "tauri" : "browser";
}

let _dbPromise: Promise<{ db: Db; backend: DbBackend }> | null = null;

// Memoised so React StrictMode's double-invoked effects share one connection.
export function getDb(): Promise<{ db: Db; backend: DbBackend }> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const backend = detectBackend();
      const db =
        backend === "tauri"
          ? await (await import("./tauri")).createTauriDb()
          : await (await import("./browser")).createBrowserDb();
      await initSchema(db);
      return { db, backend };
    })();
  }
  return _dbPromise;
}
