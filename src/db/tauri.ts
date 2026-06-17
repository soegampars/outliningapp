import type { Db, ExecResult } from "./types";

// Native SQLite backend (packaged app). The Rust side is just the registered
// plugin; the DB is a real local file in the app config dir (concept §8).
export async function createTauriDb(): Promise<Db> {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load("sqlite:spine.db");

  return {
    async execute(sql: string, params: unknown[] = []): Promise<ExecResult> {
      const r = await db.execute(sql, params);
      return { rowsAffected: r.rowsAffected, lastInsertId: r.lastInsertId ?? undefined };
    },
    async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      return (await db.select(sql, params)) as T[];
    },
  };
}
