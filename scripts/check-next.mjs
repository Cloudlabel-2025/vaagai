import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const production = process.argv.includes("--production");
const directory = await mkdtemp(path.join(tmpdir(), "jaguar-http-"));
const origin = "http://127.0.0.1:3197";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", production ? "start" : "dev", "--hostname", "127.0.0.1", "--port", "3197"], {
  cwd: process.cwd(), windowsHide: true,
  env: { ...process.env, JAGUAR_DATA_DIR: directory, JAGUAR_TRUST_AUTH_HEADERS: "false", NEXT_TELEMETRY_DISABLED: "1" },
});
let log = "";
child.stdout.on("data", data => { log = (log + data).slice(-6000); });
child.stderr.on("data", data => { log = (log + data).slice(-6000); });
const stopped = new Promise(resolve => child.on("exit", resolve));
const request = (route, cookie, body) => fetch(origin + route, {
  method: body ? "POST" : "GET",
  headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: origin, "Content-Type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
async function signIn(email, returnTo = "/") {
  const response = await fetch(origin + "/signin-with-chatgpt", { method: "POST", headers: { Origin: origin }, body: new URLSearchParams({ email, return_to: returnTo }), redirect: "manual" });
  assert.equal(response.status, 303, await response.text());
  assert.equal(response.headers.get("location"), origin + returnTo);
  return response.headers.get("set-cookie").split(";")[0];
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(log);
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, log);
  for (const section of ["overview", "onboarding", "project", "tasks", "meetings", "community", "evidence", "raid", "c310", "growth", "control", "guide"]) {
    assert.equal((await request(`/${section}`)).status, 200, `Direct navigation to /${section}`);
  }
  assert.equal((await request("/unknown-workspace-section")).status, 404);
  assert.equal((await request("/api/crew")).status, 401);
  assert.equal((await fetch(origin + "/api/me", { headers: { "oai-authenticated-user-id": "forged", "oai-authenticated-user-email": "lavanyabalaji123@gmail.com" } })).status, 401);
  if (production) {
    assert.equal((await request("/signin-with-chatgpt")).status, 503);
    assert.equal((await fetch(origin + "/signin-with-chatgpt", { method: "POST" })).status, 404);
    console.log("Production: page served, anonymous/forged identity denied, development sign-in disabled.");
  } else {
    const owner = await signIn("lavanyabalaji123@gmail.com", "/growth"), rider = await signIn("sasiabinesh292@gmail.com"), other = await signIn("suryasurjith1997@gmail.com");
    assert.equal((await (await request("/api/me", owner)).json()).role, "owner");
    assert.equal((await request("/api/growth", owner)).status, 200);
    assert.equal((await request("/api/growth", rider)).status, 403);
    assert.equal((await fetch(origin + "/api/crew", { method: "POST", headers: { Cookie: owner, Origin: "https://other.example", "Content-Type": "application/json" }, body: JSON.stringify({ op: "post", text: "Blocked origin" }) })).status, 403);
    const task = { op: "task", title: "Integration test", description: "Test task", owner: "sasiabinesh292@gmail.com", dueAt: "2026-11-01T10:00:00Z", criteria: "Evidence verified" };
    assert.equal((await request("/api/crew", rider, task)).status, 403);
    assert.equal((await request("/api/crew", owner, task)).status, 200);
    assert.equal((await request("/api/crew", rider, { op: "post", text: "Shared integration record" })).status, 200);
    const shared = await (await request("/api/crew", other)).json();
    assert.ok(shared.records.some(record => record.data.text === "Shared integration record"));
    assert.equal((await request("/api/c310", rider)).status, 200);
    assert.equal((await request("/api/c310", rider, { op: "new" })).status, 200);
    const form = new FormData(); form.set("file", new File(["private evidence"], "evidence.txt", { type: "text/plain" }));
    const upload = await fetch(origin + "/api/files", { method: "POST", headers: { Cookie: rider, Origin: origin }, body: form });
    assert.equal(upload.status, 200); const file = await upload.json();
    assert.equal(await (await request(`/api/files/${file.id}`, rider)).text(), "private evidence");
    assert.equal((await request(`/api/files/${file.id}`, other)).status, 403);
    const logout = await fetch(origin + "/signout-with-chatgpt", { headers: { Cookie: rider }, redirect: "manual" });
    assert.equal(logout.status, 303); assert.ok(logout.headers.get("set-cookie").includes("Max-Age=0"));
    console.log("Development: sign-in, roles, shared persistence, C310, upload/download privacy and logout passed.");
  }
} catch (error) { console.error(log); throw error; }
finally {
  child.kill(); await stopped;
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
