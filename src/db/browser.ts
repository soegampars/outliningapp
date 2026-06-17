import initSqlJs from "sql.js";
import type { BindParams, Database as SqlJsDatabase, SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { Db, ExecResult } from "./types";

// Browser backend: sql.js (WASM SQLite) persisted to IndexedDB. Used for dev
// preview and the optional browser build. Identical SQL dialect to the native
// backend; only the bind/persist plumbing differs.

const IDB_NAME = "spine";
const IDB_STORE = "kv";
const DB_KEY = "spine.db";

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(key: string): Promise<Uint8Array | undefined> {
  return idbOpen().then(
    (db) =>
      new Promise<Uint8Array | undefined>((resolve, reject) => {
        const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut(key: string, val: Uint8Array): Promise<void> {
  return idbOpen().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(val, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

// $1, $2, … -> sql.js named binds ("$1", "$2"), coercing JS values to SqlValue.
function toNamed(params: unknown[]): BindParams {
  const o: Record<string, SqlValue> = {};
  params.forEach((v, i) => {
    let val: SqlValue;
    if (v === undefined || v === null) val = null;
    else if (typeof v === "boolean") val = v ? 1 : 0;
    else if (typeof v === "number" || typeof v === "string" || v instanceof Uint8Array) val = v;
    else val = String(v);
    o["$" + (i + 1)] = val;
  });
  return o;
}

export async function createBrowserDb(): Promise<Db> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await idbGet(DB_KEY);
  const sqldb: SqlJsDatabase = saved ? new SQL.Database(saved) : new SQL.Database();

  let timer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void idbPut(DB_KEY, sqldb.export()), 150);
  };

  return {
    async execute(sql: string, params: unknown[] = []): Promise<ExecResult> {
      sqldb.run(sql, toNamed(params));
      const rowsAffected = sqldb.getRowsModified();
      let lastInsertId: number | undefined;
      const res = sqldb.exec("SELECT last_insert_rowid() AS id");
      if (res.length && res[0].values.length) lastInsertId = Number(res[0].values[0][0]);
      persist();
      return { rowsAffected, lastInsertId };
    },
    async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = sqldb.prepare(sql);
      try {
        stmt.bind(toNamed(params));
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
  };
}
