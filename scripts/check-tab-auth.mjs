import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { spawn } from "node:child_process";
import { createHash, scryptSync } from "node:crypto";
import assert from "node:assert/strict";

const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const origin = "http://127.0.0.1:3198";
const client = await new MongoClient(replica.getUri()).connect();
const db = client.db("jaguar_tab_http_test");
const fixtureEmail = "auth-test@example.com", fixturePassword = "DisposableTest@2026";
const salt = "test-fixture-salt";
const hash = "scrypt:" + salt + ":" + scryptSync(fixturePassword, salt, 64).toString("hex");
const fixture = { _id: fixtureEmail, email: fixtureEmail, name: "Auth Test Owner", role: "owner", active: true,
  passwordHash: hash, passwordVersion: 1, mustChangePassword: false, createdAt: new Date(), updatedAt: new Date() };
await db.collection("approved_users").insertOne(fixture);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3198"], {
  cwd: process.cwd(), windowsHide: true,
  env: { ...process.env, MONGODB_URI: replica.getUri(), MONGODB_DB: "jaguar_tab_http_test", JAGUAR_APP_ORIGIN: origin, NEXT_TELEMETRY_DISABLED: "1" },
});
let log = "";
child.stdout.on("data", data => { log = (log + data).slice(-6000); });
child.stderr.on("data", data => { log = (log + data).slice(-6000); });
const stopped = new Promise(resolve => child.on("exit", resolve));
const tabA = "a".repeat(32), tabB = "b".repeat(32), tabC = "c".repeat(32);
const request = (path, cookie = "", tab = "", method = "GET", source = origin) => fetch(origin + path, {
  method, headers: { Cookie: cookie, ...(tab ? { "x-workspace-tab": tab } : {}), ...(method !== "GET" ? { Origin: source } : {}) },
});
function formFrom(html, values) {
  const form = (html.match(/<form\b[\s\S]*?<\/form>/g) || []).find(value => value.includes('name="password"'));
  assert.ok(form, "Sign-in form is rendered");
  const data = new FormData();
  const decode = value => value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  for (const tag of form.match(/<input\b[^>]*>/g) || []) {
    if (!/type="hidden"/.test(tag)) continue;
    const name = tag.match(/name="([^"]+)"/)?.[1], value = tag.match(/value="([^"]*)"/)?.[1] || "";
    if (name) data.set(decode(name), decode(value));
  }
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}
let signin;
async function login(tabId, password = fixturePassword, cookie = "") {
  return fetch(origin + "/signin", { method: "POST", redirect: "manual", headers: { Origin: origin, Cookie: cookie },
    body: formFrom(signin, { tabId, email: fixtureEmail, password, return_to: "/overview" }) });
}
const cookieFrom = (response, tab) => response.headers.getSetCookie().find(value => value.startsWith(`__Host-jaguar-tab-${tab}=`))?.split(";")[0];
try {
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (child.exitCode !== null) throw new Error(log);
    try { if ((await fetch(origin + "/signin", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, log);
  signin = await (await request("/signin")).text();
  assert.ok(signin.includes("Forgot your password?"));
  assert.equal((await request("/api/me")).status, 401);
  assert.equal((await request("/signin-with-chatgpt", "", "", "POST")).status, 404);
  const wrong = await login(tabA, "incorrect");
  assert.ok((await wrong.text()).includes("Invalid email or password"));
  assert.equal(cookieFrom(wrong, tabA), undefined);
  const first = await login(tabA);
  assert.equal(first.status, 200, await first.clone().text());
  const cookieA = cookieFrom(first, tabA);
  assert.ok(cookieA, "Real server-action login issues a tab-specific cookie");
  const flags = first.headers.getSetCookie().find(value => value.startsWith("__Host-jaguar-tab-"));
  assert.match(flags, /HttpOnly/i); assert.match(flags, /Secure/i); assert.match(flags, /SameSite=strict/i);
  assert.equal((await request("/api/me", cookieA)).status, 401, "Cookie without a tab selector is rejected");
  assert.equal((await request("/api/me", cookieA, tabB)).status, 401, "New tabs cannot reuse another tab's cookie");
  assert.equal((await (await request("/api/me", cookieA, tabA)).json()).role, "owner");
  const second = await login(tabB, fixturePassword, cookieA);
  const cookieB = cookieFrom(second, tabB); assert.ok(cookieB);
  const both = cookieA + "; " + cookieB;
  assert.equal((await request("/api/crew", both, tabA)).status, 200);
  assert.equal((await request("/api/crew", both, tabB)).status, 200);
  const adminHtml = await (await request("/admin/users", both)).text();
  assert.ok(!adminHtml.includes(fixtureEmail), "Server-rendered admin page cannot disclose private roster before tab authentication");
  assert.equal((await request("/api/session", both, tabA, "DELETE", "https://untrusted.example")).status, 403);
  assert.equal((await request("/api/session", both, tabA, "DELETE")).status, 200);
  assert.equal((await request("/api/me", both, tabA)).status, 401);
  assert.equal((await request("/api/me", both, tabB)).status, 200, "Other tabs survive sign-out");
  const tokenB = cookieB.slice(cookieB.indexOf("=") + 1);
  const keyB = createHash("sha256").update(tokenB).digest("hex");
  const before = await db.collection("password_sessions").findOne({ _id: keyB });
  await request("/api/session", both, tabB);
  assert.equal((await db.collection("password_sessions").findOne({ _id: keyB })).idleExpires.getTime(), before.idleExpires.getTime());
  await db.collection("password_sessions").updateOne({ _id: keyB }, { $set: { idleExpires: new Date(0) } });
  assert.equal((await request("/api/session", both, tabB, "POST")).status, 401, "Expired sessions cannot be revived");
  assert.equal((await request("/api/me", both, tabB)).status, 401);
  const third = await login(tabC), cookieC = cookieFrom(third, tabC); assert.ok(cookieC);
  await db.collection("password_sessions").updateMany({ email: fixtureEmail }, { $set: { expires: new Date(0) } });
  assert.equal((await request("/api/me", cookieC, tabC)).status, 401, "Absolute expiry is enforced");
  const fourth = await login(tabC), cookieD = cookieFrom(fourth, tabC); assert.ok(cookieD);
  await db.collection("approved_users").updateOne({ _id: fixtureEmail }, { $set: { active: false } });
  assert.equal((await request("/api/me", cookieD, tabC)).status, 401);
  await db.collection("approved_users").updateOne({ _id: fixtureEmail }, { $set: { active: true }, $inc: { passwordVersion: 1 } });
  assert.equal((await request("/api/me", cookieD, tabC)).status, 401, "Password resets revoke prior sessions");
  await db.collection("approved_users").updateOne({ _id: fixtureEmail }, { $set: { mustChangePassword: true } });
  const setup = await login(tabA), setupCookie = cookieFrom(setup, tabA); assert.ok(setupCookie);
  assert.equal((await request("/api/me", setupCookie, tabA)).status, 401);
  const setupInfo = await (await request("/api/session", setupCookie, tabA)).json();
  assert.equal(setupInfo.setup, true);
  assert.ok(setupInfo.expires - Date.now() <= 15 * 60 * 1000);
  console.log("Production HTTP auth passed: real login action, cookie flags, independent tabs, logout, CSRF, idle/max expiry, disabled users, reset revocation, setup restrictions and private admin rendering.");
  if (process.argv.includes("--serve")) {
    await db.collection("approved_users").updateOne({ _id: fixtureEmail }, { $set: { mustChangePassword: false } });
    console.log(`Disposable browser preview: ${origin}/signin | ${fixtureEmail} | ${fixturePassword}`);
    await new Promise(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  }
} catch (error) { console.error(log); throw error; }
finally {
  child.kill(); await stopped;
  await client.close(); await replica.stop();
}

