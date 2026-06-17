// The single SQL surface shared by both storage backends.
//
// Spine stores its meaning once, in SQLite (concept §2.4, §3). In the packaged
// Tauri app that is a real local file via @tauri-apps/plugin-sql; in a plain
// browser (used for fast dev/preview, and the "small later step" browser build
// of §8) it is sql.js persisted to IndexedDB. Both speak identical SQLite SQL.
//
// Queries use $1, $2, … positional placeholders (plugin-sql's documented style);
// the browser adapter maps them onto sql.js named binds.

export interface ExecResult {
  rowsAffected: number;
  lastInsertId?: number;
}

export interface Db {
  execute(sql: string, params?: unknown[]): Promise<ExecResult>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export type DbBackend = "tauri" | "browser";
