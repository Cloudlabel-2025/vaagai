import "server-only";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

// Preserve the route handlers' prepared-query interface while running on Node.js.
const state = globalThis as typeof globalThis & { jaguarDatabase?: DatabaseSync };
export function sqlite() {
  if (state.jaguarDatabase) return state.jaguarDatabase;
  const directory = process.env.JAGUAR_DATA_DIR
    ? path.resolve(/* turbopackIgnore: true */ process.env.JAGUAR_DATA_DIR)
    : path.join(process.cwd(), "data");
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, "jaguar.sqlite"));
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY NOT NULL)");
  const migrationDirectory = path.join(process.cwd(), "drizzle");
  for (const name of readdirSync(migrationDirectory).filter(n => n.endsWith(".sql")).sort()) {
    if (db.prepare("SELECT name FROM _migrations WHERE name=?").get(name)) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(readFileSync(path.join(migrationDirectory, name), "utf8"));
      db.prepare("INSERT INTO _migrations(name) VALUES(?)").run(name);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); db.close(); throw error; }
  }
  state.jaguarDatabase = db;
  return db;
}

class PreparedQuery {
  constructor(readonly sql: string, readonly values: SQLInputValue[] = []) {}
  bind(...values: SQLInputValue[]) { return new PreparedQuery(this.sql, values); }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (sqlite().prepare(this.sql).get(...this.values) as T | undefined) ?? null;
  }
  async all<T = Record<string, unknown>>() {
    return { results: sqlite().prepare(this.sql).all(...this.values) as T[], success: true };
  }
  execute() {
    const result = sqlite().prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
  async run() { return this.execute(); }
}

export const localDatabase = {
  prepare(sql: string) { return new PreparedQuery(sql); },
  async batch(queries: PreparedQuery[]) {
    const db = sqlite();
    db.exec("BEGIN IMMEDIATE");
    try {
      const results = queries.map(query => query.execute());
      db.exec("COMMIT");
      return results;
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  },
};

function filePath(key: string) {
  // Only application-generated keys are accepted; uploads are never served publicly.
  if (!/^jaguar\/[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid storage key");
  const directory = process.env.JAGUAR_DATA_DIR
    ? path.join(path.resolve(/* turbopackIgnore: true */ process.env.JAGUAR_DATA_DIR), "uploads")
    : path.join(process.cwd(), "data", "uploads");
  mkdirSync(directory, { recursive: true });
  return path.join(directory, key.slice(7));
}
export const localBucket = {
  async put(key: string, bytes: ArrayBuffer, _options?: unknown) {
    await writeFile(filePath(key), Buffer.from(bytes));
  },
  async get(key: string) {
    try { return { body: new Uint8Array(await readFile(/* turbopackIgnore: true */ filePath(key))) }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  },
  async delete(key: string) {
    try { await unlink(filePath(key)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  },
};
