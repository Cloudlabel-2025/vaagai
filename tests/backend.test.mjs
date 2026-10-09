import test, { before, after } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { getMongoDatabase, closeMongo } from "../db/mongodb.mjs";
import { normalizeTables, importTables, inspectFiles, canonical } from "../scripts/migration-core.mjs";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
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
  const require = id => id === "server-only" ? {} : /\.(mjs|json)$/.test(id) ? nativeRequire(id) : id.startsWith(".") ? load(existsSync(path.resolve(path.dirname(filename), id+".ts")) ? path.resolve(path.dirname(filename),id+".ts") : path.resolve(path.dirname(filename),id,"index.ts")) : nativeRequire(id);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(require, module, module.exports);
  return module.exports;
}

let replica;
const previousURI=process.env.MONGODB_URI,previousDB=process.env.MONGODB_DB;
before(async()=>{replica=await MongoMemoryReplSet.create({replSet:{count:1}});process.env.MONGODB_URI=replica.getUri();process.env.MONGODB_DB="jaguar_test";await getMongoDatabase();});
after(async()=>{await closeMongo();if(replica)await replica.stop();if(previousURI===undefined)delete process.env.MONGODB_URI;else process.env.MONGODB_URI=previousURI;if(previousDB===undefined)delete process.env.MONGODB_DB;else process.env.MONGODB_DB=previousDB;});
test("Mongo revisions, transactional evidence, concurrent energy and private uploads",async()=>{
 const {insert,record,update,crewDocument,submitEvidence,reviewEvidence,recordEnergy}=load("lib/crew-server.ts"),{mongoBucket:bucket}=load("lib/storage.ts");
 await insert("post","post","test",{text:"initial"}).run();
 const post=await record("post");await update(post,{text:"saved"},1);
 await assert.rejects(update(post,{text:"stale"},1),e=>e.status===409);
 await insert("task","task","test",{status:"Planned",owner:"rider"}).run();
 const task=await record("task");
 const evidence=crewDocument("evidence:v1","evidence","rider",{taskId:"task",groupId:"evidence",version:1,status:"Pending review"});
 await submitEvidence(evidence,task);
 await assert.rejects(submitEvidence(crewDocument("evidence:v2","evidence","rider",{...evidence.data,version:2}),task),e=>e.status===409);
 assert.equal((await record("evidence:v1")).data.status,"Pending review");
 await assert.rejects(record("evidence:v2"),e=>e.status===404);
 await reviewEvidence(await record("evidence:v1"),1,"Accepted",{by:"mentor"},new Date().toISOString());
 assert.equal((await record("task")).data.status,"Accepted");
 await assert.rejects(reviewEvidence(await record("evidence:v1"),1,"Rework",{},new Date().toISOString()),e=>e.status===409);
 const energy=await Promise.allSettled([1,2].map(n=>recordEnergy(crewDocument("energy"+n,"energy","lead",{rider:"rider",appealStatus:"Not appealed"}),"rider",0)));
 assert.equal(energy.filter(r=>r.status==="fulfilled").length,1);
 const db=await getMongoDatabase();assert.equal(await db.collection("crew_records").countDocuments({kind:"energy"}),1);
 await db.collection("guide_usage").insertOne({_id:"quota",id:"quota",author:"test",day:"2026-10-07",used:0});
 const reservations=await Promise.all(Array.from({length:30},()=>db.collection("guide_usage").updateOne({_id:"quota",used:{$lt:20}},{$inc:{used:1}})));
 assert.equal(reservations.reduce((n,r)=>n+r.modifiedCount,0),20);
 const key="jaguar/00000000-0000-4000-8000-000000000001";
 await bucket.put(key,new TextEncoder().encode("private evidence").buffer);
 assert.equal(await new Response((await bucket.get(key)).body).text(),"private evidence");
 await assert.rejects(bucket.get("../../outside"));await bucket.delete(key);assert.equal(await bucket.get(key),null);
});
test("Complete migration preserves all five tables, nested data, files and revisions; reruns are safe",async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),"jaguar-migration-"));
 const key="jaguar/00000000-0000-4000-8000-000000000002",now="2026-01-01T00:00:00Z";
 try{
  mkdirSync(path.join(directory,"jaguar"));writeFileSync(path.join(directory,key),"old evidence");
  const source={
   crew_records:[{id:"old-upload",kind:"upload",author:"rider",data:JSON.stringify({key,size:12,type:"text/plain",name:"evidence.txt"}),revision:4,created_at:now,updated_at:now}],
   guide_usage:[{id:"old-quota",author:"rider",day:"2026-01-01",used:7}],
   growth_workspace:[{id:"old-growth",data:JSON.stringify({reviewHistory:[{grades:[1,2,3]}]}),revision:9,updated_by:"lead",updated_at:now}],
   c310_models:[{id:"old-model",data:JSON.stringify({version:"old",factors:[{weight:10}]}),created_at:now}],
   c310_assessments:[{id:"old-assessment",rider:"rider",data:JSON.stringify({reports:[{id:"report",ratings:[1,null,5]}]}),revision:5,created_at:now,updated_at:now}]
  };
  assert.throws(()=>normalizeTables({crew_records:[]}),/Missing complete table/);
  const tables=normalizeTables(source),files=await inspectFiles(tables,directory),db=await getMongoDatabase();
  const first=await importTables(db,tables,files);assert.equal(first.verified,true);
  for(const name of Object.keys(tables))assert.equal(canonical(await db.collection(name).findOne({_id:tables[name][0]._id})),canonical(tables[name][0]));
  const rerun=await importTables(db,tables,files);for(const table of Object.values(rerun.tables)){assert.equal(table.inserted,0);assert.equal(table.skipped,1);}
  const conflict=structuredClone(tables);conflict.growth_workspace[0].revision=10;
  await assert.rejects(importTables(db,conflict,files),/Destination record conflict/);
  writeFileSync(path.join(directory,key),"bad");await assert.rejects(inspectFiles(tables,directory),/incorrect upload size/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test("REST handlers use MongoDB for growth, assessments, uploads and role restrictions",async()=>{
 const server=load("lib/crew-server.ts"),original=server.identity;
 const owner={id:"owner",email:"lavanyabalaji123@gmail.com",name:"Lavanya",role:"owner"};
 const rider={id:"rider",email:"sasiabinesh292@gmail.com",name:"Abinesh",role:"learner"};
 const post=(url,data)=>new Request("http://localhost"+url,{method:"POST",headers:{"content-type":"application/json",origin:"http://localhost"},body:JSON.stringify(data)});
 try{
  server.identity=async()=>owner;
  const growth=load("app/api/growth/route.ts"),crew=load("app/api/crew/route.ts"),c310=load("app/api/c310/route.ts");
  const initial=await (await growth.GET()).json();assert.equal(initial.revision,0);
  const save=await growth.POST(post("/api/growth",{op:"settings",revision:0,data:initial.state.settings}));
  assert.equal(save.status,200,await save.clone().text());
  assert.equal((await growth.POST(post("/api/growth",{op:"settings",revision:0,data:initial.state.settings}))).status,409);
  assert.equal((await crew.POST(post("/api/crew",{op:"readiness",confirmed:true}))).status,200);
  assert.equal((await crew.POST(post("/api/crew",{op:"receipt"}))).status,200);
  server.identity=async()=>rider;assert.equal((await growth.GET()).status,403);
  const created=await c310.POST(post("/api/c310",{op:"new"}));assert.equal(created.status,200,await created.clone().text());
  const assessment=(await created.json()).record;
  const draft=await c310.POST(post("/api/c310",{op:"draft",id:assessment.assessment.id,revision:1,answers:assessment.assessment.answers}));
  assert.equal(draft.status,200,await draft.clone().text());
  assert.equal((await c310.POST(post("/api/c310",{op:"draft",id:assessment.assessment.id,revision:1,answers:assessment.assessment.answers}))).status,409);
  const files=load("app/api/files/route.ts"),form=new FormData();form.set("file",new File(["REST evidence"],"evidence.txt",{type:"text/plain"}));
  const uploaded=await files.POST(new Request("http://localhost/api/files",{method:"POST",headers:{origin:"http://localhost"},body:form}));
  assert.equal(uploaded.status,200,await uploaded.clone().text());
  const upload=await uploaded.json(),download=load("app/api/files/[id]/route.ts");
  const response=await download.GET(new Request("http://localhost/api/files/"+upload.id),{params:Promise.resolve({id:upload.id})});
  assert.equal(response.status,200);assert.equal(await response.text(),"REST evidence");
  server.identity=async()=>({email:"suryasurjith1997@gmail.com",name:"Surya",role:"learner"});
  assert.equal((await download.GET(new Request("http://localhost/api/files/"+upload.id),{params:Promise.resolve({id:upload.id})})).status,403);
 }finally{server.identity=original;}
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

test("Google admission and owner administration preserve disabled access and current roles", async () => {
  const { approvedUsers, approvedIdentity, googleAccess, saveApprovedUser } = load("lib/access.ts");
  const owner = await approvedIdentity("lavanyabalaji123@gmail.com");
  assert.equal(owner.role, "owner");
  assert.equal(await googleAccess({ email: owner.email, email_verified: false }), false);
  assert.equal(await googleAccess({ email: "outsider@example.com", email_verified: true }), false);
  assert.equal(await googleAccess({ email: owner.email, email_verified: true }), false, "Google cannot bypass first password change");
  await assert.rejects(saveApprovedUser({ ...owner, role: "learner" }, {}), /Only the owner/);
  await assert.rejects(saveApprovedUser(owner, { ...owner, active: false }), /own owner/);
  await assert.rejects(saveApprovedUser(owner, { ...owner, role: "learner", active: true }), /own owner/);
  const invite = { email: "NEW@example.com", name: "New Learner", role: "learner", active: true, temporaryPassword: "Invite@2026" };
  await saveApprovedUser(owner, invite);
  assert.equal((await approvedIdentity("new@example.com")).role, "learner");
  await saveApprovedUser(owner, { ...invite, role: "cohort_leader" });
  assert.equal((await approvedIdentity("new@example.com")).role, "cohort_leader");
  const { canReview } = load("lib/c310-model.ts"), { activeRoster } = load("lib/access.ts");
  const leader = await approvedIdentity("mechpremothan@gmail.com");
  assert.equal(canReview(leader, "new@example.com", await activeRoster()), false);
  await saveApprovedUser(owner, invite);
  assert.equal(canReview(leader, "new@example.com", await activeRoster()), true);
  await saveApprovedUser(owner, { email: "sasiabinesh292@gmail.com", name: "Abinesh", role: "learner", active: false });
  await approvedUsers();
  assert.equal(await approvedIdentity("sasiabinesh292@gmail.com"), null, "Bootstrap must never re-enable a disabled crew member");
  assert.equal(await googleAccess({ email: "sasiabinesh292@gmail.com", email_verified: true }), false);
});

test("Temporary credentials, mandatory setup, Google admission, resets and session revocation", async () => {
  const { approvedUsers, approvedIdentity, saveApprovedUser, googleAccess } = load("lib/access.ts");
  const { authenticatePassword, passwordSession, completePasswordSetup, deletePasswordSession } = load("lib/password-auth.ts");
  const { verifyPassword } = load("lib/passwords.ts");
  const users = await approvedUsers(), email = "lavanyabalaji123@gmail.com";
  const owner = await approvedIdentity(email);
  const seeded = await users.findOne({ _id: email });
  assert.equal(seeded.mustChangePassword, true);
  assert.equal(await verifyPassword("Chc@2025", seeded.passwordHash), true);
  assert.notEqual(seeded.passwordHash, "Chc@2025");
  await assert.rejects(authenticatePassword(email, "wrong"), /Invalid email/);
  await assert.rejects(authenticatePassword("unknown@example.com", "Chc@2025"), /Invalid email/);
  const setup = await authenticatePassword(email.toUpperCase(), "Chc@2025");
  assert.equal(setup.setup, true);
  assert.equal((await passwordSession(setup.token)).setup, true);
  assert.equal(await googleAccess({ email, email_verified: true }), false);
  await assert.rejects(completePasswordSetup(setup.token, "NewPassword@2026", "mismatch"), /do not match/);
  await assert.rejects(completePasswordSetup(setup.token, "short", "short"), /8 and 128/);
  await assert.rejects(completePasswordSetup(setup.token, "Chc@2025", "Chc@2025"), /different/);
  const full = await completePasswordSetup(setup.token, "NewPassword@2026", "NewPassword@2026");
  assert.equal(await passwordSession(setup.token), null);
  assert.equal((await passwordSession(full.token)).setup, false);
  assert.equal(await googleAccess({ email, email_verified: true }), true);
  await assert.rejects(authenticatePassword(email, "Chc@2025"), /Invalid email/);
  await approvedUsers();
  assert.equal(await verifyPassword("NewPassword@2026", (await users.findOne({ _id: email })).passwordHash), true, "Bootstrap preserves changed credentials");
  await assert.rejects(saveApprovedUser(owner, { email: "no-password@example.com", name: "Missing", role: "learner", active: true }), /temporary password/);
  await saveApprovedUser(owner, { email: "password-test@example.com", name: "Password Test", role: "learner", active: true, temporaryPassword: "TempUser@2026" });
  const invited = await authenticatePassword("password-test@example.com", "TempUser@2026");
  const db = await getMongoDatabase();
  await db.collection("password_sessions").updateOne({ email: "password-test@example.com" }, { $set: { expires: new Date(0) } });
  assert.equal(await passwordSession(invited.token), null);
  await db.collection("auth_users").insertOne({ email, name: owner.name });
  const authUser = await db.collection("auth_users").findOne({ email });
  await db.collection("auth_sessions").insertOne({ userId: authUser._id, sessionToken: "revoke-test", expires: new Date(Date.now() + 60000) });
  await saveApprovedUser(owner, { ...owner, active: true, temporaryPassword: "ResetOwner@2026" });
  assert.equal(await passwordSession(full.token), null);
  assert.equal(await db.collection("auth_sessions").findOne({ sessionToken: "revoke-test" }), null);
  assert.equal(await googleAccess({ email, email_verified: true }), false);
  await assert.rejects(authenticatePassword(email, "NewPassword@2026"), /Invalid email/);
  const reset = await authenticatePassword(email, "ResetOwner@2026");
  assert.equal(reset.setup, true);
  await deletePasswordSession(reset.token);
  assert.equal(await passwordSession(reset.token), null);
  const active = await authenticatePassword("password-test@example.com", "TempUser@2026");
  await saveApprovedUser(owner, { email: "password-test@example.com", name: "Password Test", role: "learner", active: false });
  assert.equal(await passwordSession(active.token), null);
  await assert.rejects(authenticatePassword("password-test@example.com", "TempUser@2026"), /Invalid email/);
  for (let n = 0; n < 10; n++) await assert.rejects(authenticatePassword("limited@example.com", "wrong"), /Invalid email/);
  await assert.rejects(authenticatePassword("limited@example.com", "wrong"), /Too many attempts/);
});

test("Owners change their own password with verification and revoke other sessions without losing Google eligibility", async () => {
  const { approvedIdentity, approvedUsers, saveApprovedUser, googleAccess } = load("lib/access.ts");
  const { authenticatePassword, completePasswordSetup, changeOwnerPassword, passwordSession } = load("lib/password-auth.ts");
  const inviter = await approvedIdentity("lavanyabalaji123@gmail.com");
  const email = "owner-change@example.com";
  await saveApprovedUser(inviter, { email, name: "Another Owner", role: "owner", active: true, temporaryPassword: "Temporary@2026" });
  const setup = await authenticatePassword(email, "Temporary@2026");
  const full = await completePasswordSetup(setup.token, "CurrentOwner@2026", "CurrentOwner@2026");
  const owner = await approvedIdentity(email);
  await assert.rejects(changeOwnerPassword({ ...owner, role: "learner" }, "CurrentOwner@2026", "NextOwner@2026", "NextOwner@2026"), /Owner access/);
  await assert.rejects(changeOwnerPassword(owner, "wrong", "NextOwner@2026", "NextOwner@2026"), /Invalid email/);
  await assert.rejects(changeOwnerPassword(owner, "CurrentOwner@2026", "NextOwner@2026", "mismatch"), /do not match/);
  await assert.rejects(changeOwnerPassword(owner, "CurrentOwner@2026", "short", "short"), /8 and 128/);
  await assert.rejects(changeOwnerPassword(owner, "CurrentOwner@2026", "CurrentOwner@2026", "CurrentOwner@2026"), /different/);
  assert.ok(await passwordSession(full.token), "Failed changes preserve the existing session");
  const db = await getMongoDatabase();
  const account = await db.collection("auth_users").insertOne({ email });
  await db.collection("auth_sessions").insertOne({ userId: account.insertedId, sessionToken: "owner-change-google", expires: new Date(Date.now() + 60000) });
  const fresh = await changeOwnerPassword(owner, "CurrentOwner@2026", "NextOwner@2026", "NextOwner@2026");
  assert.equal(await passwordSession(full.token), null);
  assert.equal((await passwordSession(fresh.token)).user.email, email);
  assert.equal(fresh.setup, false);
  assert.equal(await db.collection("auth_sessions").findOne({ sessionToken: "owner-change-google" }), null);
  assert.equal(await googleAccess({ email, email_verified: true }), true);
  await assert.rejects(authenticatePassword(email, "CurrentOwner@2026"), /Invalid email/);
  assert.equal((await authenticatePassword(email, "NextOwner@2026")).setup, false);
  await (await approvedUsers()).updateOne({ _id: email }, { $set: { role: "learner" } });
  await assert.rejects(changeOwnerPassword(owner, "NextOwner@2026", "OtherOwner@2026", "OtherOwner@2026"), /Your access changed/);
});

test("Google account selection distinguishes invalid accounts, required first login and ready accounts", async () => {
  const { googleSignInDecision, approvedUsers, approvedIdentity, saveApprovedUser } = load("lib/access.ts");
  assert.equal(await googleSignInDecision(undefined), "/signin?error=InvalidGoogleAccount");
  assert.equal(await googleSignInDecision({ email: "not-in-system@example.com", email_verified: true }), "/signin?error=InvalidGoogleAccount");
  const owner = await approvedIdentity("lavanyabalaji123@gmail.com"), email = "google-selection@example.com";
  await saveApprovedUser(owner, { email, name: "Google Selection", role: "learner", active: true, temporaryPassword: "GoogleTemp@2026" });
  assert.equal(await googleSignInDecision({ email, email_verified: true }), "/signin?error=PasswordSetupRequired");
  const { authenticatePassword, completePasswordSetup } = load("lib/password-auth.ts");
  const firstLogin = await authenticatePassword(email, "GoogleTemp@2026");
  await completePasswordSetup(firstLogin.token, "GoogleReady@2026", "GoogleReady@2026");
  assert.equal(await googleSignInDecision({ email: ` ${email.toUpperCase()} `, email_verified: true }), true);
  assert.equal(await googleSignInDecision({ email, email_verified: false }), "/signin?error=InvalidGoogleAccount");
  await (await approvedUsers()).updateOne({ _id: email }, { $set: { active: false } });
  assert.equal(await googleSignInDecision({ email, email_verified: true }), "/signin?error=InvalidGoogleAccount");
});
