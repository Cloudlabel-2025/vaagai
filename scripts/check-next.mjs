import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";


if (process.argv.includes("--production")) { await import("./check-tab-auth.mjs"); process.exit(0); }
const replica=await MongoMemoryReplSet.create({replSet:{count:1}});
const production = process.argv.includes("--production");
const directory = await mkdtemp(path.join(tmpdir(), "jaguar-http-"));
const origin = "http://127.0.0.1:3197";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", production ? "start" : "dev", "--hostname", "127.0.0.1", "--port", "3197"], {
  cwd: process.cwd(), windowsHide: true,
  env: { ...process.env, MONGODB_URI: replica.getUri(), MONGODB_DB: "jaguar_http_test", AUTH_SECRET: "test-only-secret-with-at-least-thirty-two-bytes", AUTH_URL: origin, AUTH_TRUST_HOST: "true", AUTH_GOOGLE_ID: "test-client", AUTH_GOOGLE_SECRET: "test-secret", JAGUAR_APP_ORIGIN: origin, JAGUAR_TRUST_AUTH_HEADERS: "false", NEXT_TELEMETRY_DISABLED: "1" },
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
function formData(html, fields) {
  const data = new FormData();
  const forms = html.match(/<form\b[\s\S]*?<\/form>/g) || [];
  const form = fields.currentPassword !== undefined ? forms.find(value => value.includes('name="currentPassword"')) : fields.password !== undefined ? forms.find(value => value.includes('name="password"')) : forms[0];
  assert.ok(form, "Expected the submitted form to be present");
  const decode = value => value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  for (const tag of form.match(/<input\b[^>]*>/g) || []) {
    if (!/type="hidden"/.test(tag)) continue;
    const name = tag.match(/name="([^"]+)"/)?.[1], value = tag.match(/value="([^"]*)"/)?.[1] || "";
    if (name) data.set(decode(name), decode(value));
  }
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}
async function submitForm(route, html, fields, cookie) {
  return fetch(origin + route, { method: "POST", redirect: "manual", headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: formData(html, fields) });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(log);
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, log);
  for (const section of ["overview", "onboarding", "project", "tasks", "meetings", "community", "evidence", "raid", "control", "guide"]) {
    assert.equal((await request(`/${section}`)).status, 200, `Direct navigation to /${section}`);
  }
  assert.equal((await request("/unknown-workspace-section")).status, 404);
  assert.equal((await request("/api/crew")).status, 401);
  assert.equal((await fetch(origin + "/api/me", { headers: { "oai-authenticated-user-id": "forged", "oai-authenticated-user-email": "lavanyabalaji123@gmail.com" } })).status, 401);
  {
    const owner = await signIn("lavanyabalaji123@gmail.com", "/overview"), rider = await signIn("sasiabinesh292@gmail.com"), other = await signIn("suryasurjith1997@gmail.com");
    assert.equal((await (await request("/api/me", owner)).json()).role, "owner");
    assert.equal((await fetch(origin + "/api/crew", { method: "POST", headers: { Cookie: owner, Origin: "https://other.example", "Content-Type": "application/json" }, body: JSON.stringify({ op: "post", text: "Blocked origin" }) })).status, 403);
    const task = { op: "task", title: "Integration test", description: "Test task", owner: "sasiabinesh292@gmail.com", dueAt: "2026-11-01T10:00:00Z", criteria: "Evidence verified" };
    assert.equal((await request("/api/crew", rider, task)).status, 403);
    assert.equal((await request("/api/crew", owner, task)).status, 200);
    assert.equal((await request("/api/crew", rider, { op: "post", text: "Shared integration record" })).status, 200);
    const shared = await (await request("/api/crew", other)).json();
    assert.ok(shared.records.some(record => record.data.text === "Shared integration record"));
    const form = new FormData(); form.set("file", new File(["private evidence"], "evidence.txt", { type: "text/plain" }));
    const upload = await fetch(origin + "/api/files", { method: "POST", headers: { Cookie: rider, Origin: origin }, body: form });
    assert.equal(upload.status, 200); const file = await upload.json();
    assert.equal(await (await request(`/api/files/${file.id}`, rider)).text(), "private evidence");
    assert.equal((await request(`/api/files/${file.id}`, other)).status, 403);
    const logout = await fetch(origin + "/signout-with-chatgpt", { headers: { Cookie: rider }, redirect: "manual" });
    assert.equal(logout.status, 303); assert.ok(logout.headers.get("set-cookie").includes("Max-Age=0"));
    console.log("Development: sign-in, roles, shared persistence, upload/download privacy and logout passed.");
  }
} catch (error) { console.error(log); throw error; }
finally {
  child.kill(); await stopped;
  await replica.stop();
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
