import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { createHash, randomBytes } from "node:crypto";

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
  for (const section of ["overview", "onboarding", "project", "tasks", "meetings", "community", "evidence", "raid", "c310", "growth", "control", "guide"]) {
    assert.equal((await request(`/${section}`)).status, 200, `Direct navigation to /${section}`);
  }
  assert.equal((await request("/unknown-workspace-section")).status, 404);
  assert.equal((await request("/api/crew")).status, 401);
  assert.equal((await fetch(origin + "/api/me", { headers: { "oai-authenticated-user-id": "forged", "oai-authenticated-user-email": "lavanyabalaji123@gmail.com" } })).status, 401);
  if (production) {
    assert.equal((await request("/signin-with-chatgpt")).status, 200);
    assert.equal((await fetch(origin + "/signin-with-chatgpt", { method: "POST" })).status, 404);
    const signin = await (await request("/signin")).text();
    assert.ok(signin.includes("Username / email") && signin.includes('name="password"'));
    assert.ok(!signin.includes("Continue with Google") && !signin.includes("Google sign-in is not configured"), "Only password sign-in is displayed");
    assert.ok(signin.includes("lucide-waves") && !signin.includes("lucide-sprout"), "Login uses the workspace river logo");
    assert.ok((await (await request("/signin?error=PasswordSetupRequired")).text()).includes("Please complete your first login."));
    assert.ok((await (await request("/signin?error=InvalidGoogleAccount")).text()).includes("Please use an email ID approved for this website."));
    assert.equal((await fetch(origin, { redirect: "manual" })).headers.get("location"), "/signin");
    const client = await new MongoClient(replica.getUri()).connect();
    try {
      const db = client.db("jaguar_http_test");
      // Exercise real Next/React server-action forms without a Google provider connection.
      const passwordLogin = await submitForm("/signin", signin, { email: "lavanyabalaji123@gmail.com", password: "Chc@2025", return_to: "/overview" });
      assert.equal(passwordLogin.status, 303, await passwordLogin.clone().text());
      assert.ok(passwordLogin.headers.get("location").includes("/change-password"));
      const setupCookie = passwordLogin.headers.getSetCookie().find(value => value.startsWith("jaguar-password-session="))?.split(";")[0];
      assert.ok(setupCookie);
      assert.equal((await request("/api/me", setupCookie)).status, 401);
      const setupPage = await (await request("/change-password", setupCookie)).text();
      const changed = await submitForm("/change-password", setupPage, { password: "HttpPassword@2026", confirmation: "HttpPassword@2026", return_to: "/overview" }, setupCookie);
      assert.equal(changed.status, 303, await changed.clone().text());
      const fullCookie = changed.headers.getSetCookie().find(value => value.startsWith("jaguar-password-session=") && !value.startsWith("jaguar-password-session=;"))?.split(";")[0];
      assert.ok(fullCookie);
      assert.equal((await (await request("/api/me", fullCookie)).json()).role, "owner");
      assert.equal((await request("/api/me", setupCookie)).status, 401);
      const adminPage = await (await request("/admin/users", fullCookie)).text();
      const invited = await submitForm("/admin/users", adminPage, { email: "http-invite@example.com", name: "HTTP Invite", role: "learner", active: "true", temporaryPassword: "HttpInvite@2026" }, fullCookie);
      assert.equal(invited.status, 303, await invited.clone().text());
      assert.ok(invited.headers.get("location").includes("saved=1"));
      assert.equal((await db.collection("approved_users").findOne({ _id: "http-invite@example.com" })).mustChangePassword, true);
      assert.ok(adminPage.includes("Search members by name or email") && adminPage.includes("Your password"));
      const ownerChanged = await submitForm("/admin/users", adminPage, { currentPassword: "HttpPassword@2026", password: "HttpOwnerChanged@2026", confirmation: "HttpOwnerChanged@2026" }, fullCookie);
      assert.equal(ownerChanged.status, 200, await ownerChanged.clone().text());
      const changedCookie = ownerChanged.headers.getSetCookie().find(value => value.startsWith("jaguar-password-session=") && !value.startsWith("jaguar-password-session=;"))?.split(";")[0];
      assert.ok(changedCookie);
      assert.equal((await request("/api/me", fullCookie)).status, 401, "Owner password change revokes the previous session");
      assert.equal((await (await request("/api/me", changedCookie)).json()).role, "owner");
      assert.equal((await db.collection("approved_users").findOne({ _id: "lavanyabalaji123@gmail.com" })).mustChangePassword, false);
      const logoutPage = await (await request("/signout", changedCookie)).text();
      const passwordLogout = await submitForm("/signout", logoutPage, {}, changedCookie);
      assert.equal(passwordLogout.status, 303, await passwordLogout.clone().text());
      assert.equal((await request("/api/me", fullCookie)).status, 401);
      const userId = new ObjectId(), token = "http-test-session-only";
      await db.collection("auth_users").insertOne({ _id: userId, email: "sasiabinesh292@gmail.com", name: "Abinesh" });
      await db.collection("auth_sessions").insertOne({ sessionToken: token, userId, expires: new Date(Date.now() + 60000) });
      await db.collection("approved_users").updateOne({ _id: "sasiabinesh292@gmail.com" }, { $set: {
        email: "sasiabinesh292@gmail.com", name: "Abinesh", role: "learner", active: true,
        passwordHash: "test-fixture-only", passwordVersion: 1, mustChangePassword: false,
      } }, { upsert: true });
      const cookie = `authjs.session-token=${token}`;
      assert.equal((await (await request("/api/me", cookie)).json()).role, "learner");
      assert.equal((await request("/api/growth", cookie)).status, 403);
      assert.ok((await (await request("/admin/users", cookie)).text()).includes("Owner access required"));
      await db.collection("approved_users").updateOne({ _id: "sasiabinesh292@gmail.com" }, { $set: { active: false } });
      assert.equal((await request("/api/me", cookie)).status, 401);
      await db.collection("approved_users").updateOne({ _id: "sasiabinesh292@gmail.com" }, { $set: { active: true } });
      await db.collection("auth_sessions").updateOne({ sessionToken: token }, { $set: { expires: new Date(0) } });
      assert.equal((await request("/api/me", cookie)).status, 401);
      await db.collection("auth_users").updateOne({ _id: userId }, { $set: { email: "lavanyabalaji123@gmail.com" } });
      await db.collection("approved_users").updateOne({ _id: "lavanyabalaji123@gmail.com" }, { $set: { mustChangePassword: false } });
      await db.collection("auth_sessions").insertOne({ sessionToken: "owner-http-session", userId, expires: new Date(Date.now() + 60000) });
      const ownerCookie = "authjs.session-token=owner-http-session";
      assert.ok((await (await request("/admin/users", ownerCookie)).text()).includes("Invite a member"));
      const csrfResponse = await request("/api/auth/csrf", ownerCookie), csrf = await csrfResponse.json();
      const csrfCookies = csrfResponse.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
      const logout = await fetch(origin + "/api/auth/signout", { method: "POST", redirect: "manual",
        headers: { Cookie: `${ownerCookie}; ${csrfCookies}`, Origin: origin },
        body: new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: origin + "/signin" }) });
      assert.equal(logout.status, 302);
      assert.equal((await request("/api/me", ownerCookie)).status, 401);
      assert.equal(await db.collection("auth_sessions").countDocuments({ sessionToken: "owner-http-session" }), 0);
      const passwordToken = randomBytes(32).toString("hex");
      await db.collection("password_sessions").insertOne({ _id: createHash("sha256").update(passwordToken).digest("hex"),
        email: "sasiabinesh292@gmail.com", passwordVersion: 1, setup: true, expires: new Date(Date.now() + 60000) });
      const passwordCookie = `jaguar-password-session=${passwordToken}`;
      await db.collection("approved_users").updateOne({ _id: "sasiabinesh292@gmail.com" }, { $set: { mustChangePassword: true } });
      assert.equal((await request("/api/me", passwordCookie)).status, 401, "Setup session cannot access workspace");
      assert.ok((await (await request("/change-password", passwordCookie)).text()).includes("Choose your password"));
      assert.equal((await fetch(origin + "/signin", { headers: { Cookie: passwordCookie }, redirect: "manual" })).status, 307);
      await db.collection("approved_users").updateOne({ _id: "sasiabinesh292@gmail.com" }, { $set: { mustChangePassword: false } });
      await db.collection("password_sessions").updateOne({ email: "sasiabinesh292@gmail.com" }, { $set: { setup: false } });
      assert.equal((await (await request("/api/me", passwordCookie)).json()).role, "learner");
      assert.equal((await request("/api/growth", passwordCookie)).status, 403);
      await db.collection("approved_users").updateOne({ _id: "sasiabinesh292@gmail.com" }, { $inc: { passwordVersion: 1 } });
      assert.equal((await request("/api/me", passwordCookie)).status, 401, "Password resets invalidate sessions");
    } finally { await client.close(); }
    console.log("Production: password login/change/logout, owner invitations, Google session checks, roles, disabled users, expiry, and setup isolation passed.");
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
  await replica.stop();
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
