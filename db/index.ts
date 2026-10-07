import { drizzle } from "drizzle-orm/sqlite-proxy";
import { sqlite } from "../lib/storage";
import type { SQLOutputValue } from "node:sqlite";
import * as schema from "./schema";

export function getDb() {
  return drizzle(async (sql, params, method) => {
    const query = sqlite().prepare(sql);
    if (method === "run") { query.run(...params); return { rows: [] }; }
    query.setReturnArrays(true);
    const rows = (method === "get" ? query.get(...params) : query.all(...params)) as unknown as SQLOutputValue[] | SQLOutputValue[][] | undefined;
    return { rows: rows ?? [] };
  }, { schema });
}
