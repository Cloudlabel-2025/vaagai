import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { MongoClient } from "mongodb";

// A disposable preview: explicit environment overrides prevent Atlas/provider use.
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const origin = "http://127.0.0.1:3100";
const client = await new MongoClient(replica.getUri()).connect();
const db = client.db("jaguar_local_preview");
const now = new Date().toISOString();
const document = (id, kind, author, data) => ({ _id: id, id, kind, author, data, revision: 1, created_at: now, updated_at: now });
await db.collection("crew_records").insertMany([
  document("preview-task", "task", "lavanyabalaji123@gmail.com", { title: "Verify synthetic HDL counts", description: "Local preview data: reconcile the department load and attach the error report.", owner: "sasiabinesh292@gmail.com", dueAt: "2026-11-01T10:00:00Z", criteria: "44 departments match; verify rejected rows.", status: "Awaiting review" }),
  document("preview-evidence:v1", "evidence", "sasiabinesh292@gmail.com", { taskId: "preview-task", groupId: "preview-evidence", version: 1, status: "Pending review", title: "Department reconciliation", summary: "44 department rows reconciled in the synthetic training instance.", link: "https://example.com/evidence", handoff: "Ready for lead verification" }),
  document("preview-history", "evidence", "sasiabinesh292@gmail.com", { title: "Earlier technical verification", taskId: "preview-task", groupId: "preview-history", version: 1, status: "Rework", summary: "Inspect the error report.", handoff: "Follow-up ready", review: { by: "Premothan", at: now, feedback: "Check rejected rows. Reconcile department counts.", validation: "Verified the load log." } }),
]);
await client.close();
const child = spawn(process.execPath, ["--use-system-ca", "node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  cwd: process.cwd(), windowsHide: true, stdio: "inherit",
  env: { ...process.env, MONGODB_URI: replica.getUri(), MONGODB_DB: "jaguar_local_preview", OPENAI_API_KEY: "", AUTH_GOOGLE_ID: "", AUTH_GOOGLE_SECRET: "", AUTH_SECRET: "local-preview-only-secret-with-thirty-two-bytes", AUTH_URL: origin, JAGUAR_APP_ORIGIN: origin, JAGUAR_BUILD_DIR: ".next-local-preview", NEXT_TELEMETRY_DISABLED: "1" },
});
console.log(`Isolated preview: ${origin}/signin-with-chatgpt`);
let stopping = false;
async function stop() { if (stopping) return; stopping = true; child.kill(); await replica.stop(); }
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", async () => { await stop(); process.exit(); });
