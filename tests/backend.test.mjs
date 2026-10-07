import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const modules = new Map();
function load(relative) {
  const filename = path.resolve(relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const nativeRequire = createRequire(filename);
  const require = id => id === "server-only" ? {} : id.startsWith(".") ? load(path.resolve(path.dirname(filename), id + ".ts")) : nativeRequire(id);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(require, module, module.exports);
  return module.exports;
}

test("SQLite migrations, optimistic writes, atomic rollback and private uploads", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "jaguar-test-"));
  process.env.JAGUAR_DATA_DIR = directory;
  const { sqlite, localDatabase: db, localBucket: bucket } = load("lib/storage.ts");
  try {
    assert.equal(sqlite().prepare("SELECT count(*) AS total FROM _migrations").get().total, 3);
    const insert = id => db.prepare("INSERT INTO crew_records(id,kind,author,data,created_at,updated_at,revision) VALUES(?,?,?,?,?,?,1)").bind(id, "post", "test", "{}", "now", "now");
    await insert("existing").run();
    assert.equal((await db.prepare("UPDATE crew_records SET revision=revision+1 WHERE id=? AND revision=?").bind("existing", 1).run()).meta.changes, 1);
    assert.equal((await db.prepare("UPDATE crew_records SET revision=revision+1 WHERE id=? AND revision=?").bind("existing", 1).run()).meta.changes, 0);
    await assert.rejects(db.batch([insert("rolled-back"), insert("existing")]));
    assert.equal(await db.prepare("SELECT id FROM crew_records WHERE id=?").bind("rolled-back").first(), null);
    const key = "jaguar/00000000-0000-4000-8000-000000000001";
    await bucket.put(key, new TextEncoder().encode("private evidence").buffer);
    assert.equal(new TextDecoder().decode((await bucket.get(key)).body), "private evidence");
    await assert.rejects(bucket.get("../../outside"));
    await bucket.delete(key);
    assert.equal(await bucket.get(key), null);
  } finally {
    globalThis.jaguarDatabase?.close();
    delete globalThis.jaguarDatabase;
    delete process.env.JAGUAR_DATA_DIR;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Development sessions reject forgery and are disabled in production", () => {
  const previous = process.env.NODE_ENV, auth = load("lib/local-auth.ts");
  try {
    process.env.NODE_ENV = "development";
    const token = auth.createDevelopmentSession("lavanyabalaji123@gmail.com");
    assert.equal(auth.developmentMember(token).role, "owner");
    assert.equal(auth.developmentMember(token + "tampered"), null);
    assert.equal(auth.developmentMember(auth.createDevelopmentSession("outsider@example.com")), null);
    process.env.NODE_ENV = "production";
    assert.equal(auth.developmentAuthEnabled(), false);
    assert.equal(auth.developmentMember(token), null);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});
