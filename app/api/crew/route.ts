import { z } from "zod";
import { identity, database, records, record, insert, update, failure, RequestError, safeUrl, sameOrigin } from "../../../lib/crew-server";
import { crew, visibleRecords, canControl, canSeeScenario, istDate, energyState, appealDeadline, rules } from "../../../lib/jaguar";
const text = z.string().trim().min(1).max(6000);
const short = z.string().trim().min(1).max(240);
const member = z.enum(crew.filter(p => p.role === "learner").map(p => p.email) as [
    string,
    ...string[]
]);
const url = z.string().max(2048).refine(v => !v || safeUrl(v), "Use a complete HTTPS link.");
const iso = z.string().refine(v => Number.isFinite(Date.parse(v)), "Enter a valid date and time.");
function lead(u: any) { if (!canControl(u))
    throw new RequestError("Only Lavanya or Premothan can perform this action.", 403); }
function own(r: any, u: any) { if (r.author !== u.email && !canControl(u))
    throw new RequestError("You can change only your own records.", 403); }
function check(input: unknown, schema: z.ZodTypeAny) { const r = schema.safeParse(input); if (!r.success)
    throw new RequestError(r.error.issues[0].message); return r.data; }
async function notify(u: any, title: string, target: string, recipient = "all") { await insert(crypto.randomUUID(), "notification", u.email, { title, target, recipient }).run(); }
export async function GET() {
    try {
        const u = await identity();
        const now = new Date(), local = new Date(now.getTime() + 330 * 60000), day = istDate(now);
        if (day >= "2026-10-05" && local.getUTCDay() !== 0 && local.getUTCDay() !== 6 && (local.getUTCHours() * 60 + local.getUTCMinutes()) >= 1050) {
            const id = `jira-reminder:${day}`;
            await database().prepare("INSERT OR IGNORE INTO crew_records(id,kind,author,data,created_at,updated_at,revision) VALUES(?,?,?,?,?,?,1)").bind(id, "notification", "system", JSON.stringify({ title: "17:30 IST: update Jira stories/tasks, blockers, evidence links and next action.", target: "tasks", recipient: "all" }), now.toISOString(), now.toISOString()).run();
        }
        const all = await records();
        for (const r of all.filter(r => r.kind === "scenario" && r.data.published === true && Date.parse(r.data.releaseAt) <= now.getTime() && istDate(now) >= "2026-10-20")) {
            await database().prepare("INSERT OR IGNORE INTO crew_records(id,kind,author,data,created_at,updated_at,revision) VALUES(?,?,?,?,?,?,1)").bind(`scenario-release:${r.id}`, "notification", "system", JSON.stringify({ title: `Released ${r.data.type}: ${r.data.title}`, target: "control", recipient: "all" }), r.data.releaseAt, r.data.releaseAt).run();
        }
        const visible = visibleRecords(all, u, now).filter(r => r.kind !== "upload" && (r.kind !== "notification" || (r.data.recipient === u.email || r.data.recipient === "all" && r.author !== u.email)));
        return Response.json({ user: u, records: visible, serverTime: now.toISOString(), aiConfigured: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    catch (e) {
        return failure(e);
    }
}
export async function POST(req: Request) {
    try {
        sameOrigin(req);
        const u = await identity();
        if (Number(req.headers.get("content-length")) > 32000)
            throw new RequestError("This entry is too large.", 413);
        const b = await req.json() as Record<string, any>, op = b.op;
        let id = crypto.randomUUID();
        if (op === "post" || op === "reply") {
            const d = check(b, z.object({ text, parentId: z.string().optional() }));
            if (op === "reply") {
                const parent = await record(d.parentId || "");
                if (parent.kind !== "post")
                    throw new RequestError("Select a community post to reply to.");
            }
            await insert(id, op, u.email, { text: d.text, ...(d.parentId ? { parentId: d.parentId } : {}) }).run();
            await notify(u, `${u.name} ${op === "reply" ? "replied in" : "posted to"} Crew Community`, "community");
        }
        else if (op === "readiness") {
            const d = check(b, z.object({ confirmed: z.literal(true) }));
            id = `readiness:${u.email}`;
            await database().prepare("INSERT INTO crew_records(id,kind,author,data,created_at,updated_at,revision) VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,revision=crew_records.revision+1").bind(id, "readiness", u.email, JSON.stringify(d), new Date().toISOString(), new Date().toISOString()).run();
        }
        else if (op === "task") {
            lead(u);
            const d = check(b, z.object({ title: short, description: text, owner: member, dueAt: iso, criteria: text, dependency: z.string().optional(), jira: url.optional() }));
            if (d.dependency) {
                const dep = await record(d.dependency);
                if (dep.kind !== "task")
                    throw new RequestError("Invalid task dependency.");
            }
            await insert(id, "task", u.email, { ...d, status: "Planned" }).run();
            await notify(u, `New action assigned: ${d.title}`, "tasks", d.owner);
        }
        else if (op === "task_status") {
            const d = check(b, z.object({ id: short, revision: z.number().int(), status: z.enum(["Planned", "In progress", "Blocked"]) })), r = await record(d.id);
            if (r.kind !== "task" || (!canControl(u) && r.data.owner !== u.email))
                throw new RequestError("This task belongs to another rider.", 403);
            if (r.data.status === "Accepted")
                throw new RequestError("This task was accepted. Ask the lead to create a follow-up action.");
            if (r.data.dependency) {
                const dep = await record(r.data.dependency);
                if (dep.data.status !== "Accepted" && d.status === "In progress")
                    throw new RequestError("The dependency needs accepted evidence first.");
            }
            await update(r, { ...r.data, status: d.status }, d.revision);
            id = r.id;
        }
        else if (op === "evidence") {
            const d = check(b, z.object({ taskId: short, title: short, summary: text, link: url.optional(), attachmentId: z.string().optional(), groupId: z.string().optional(), handoff: short }));
            const task = await record(d.taskId);
            if (task.kind !== "task" || task.data.owner !== u.email && !canControl(u))
                throw new RequestError("Submit evidence for your own assigned task.", 403);
            if (task.data.status === "Accepted")
                throw new RequestError("This task is already accepted. Ask the lead for a follow-up task.");
            if (!d.link && !d.attachmentId)
                throw new RequestError("Attach a file or an HTTPS evidence link.");
            if (d.attachmentId) {
                const file = await record(d.attachmentId);
                if (file.kind !== "upload" || file.author !== u.email)
                    throw new RequestError("This upload does not belong to you.", 403);
            }
            const all = await records(), groupId = d.groupId || crypto.randomUUID();
            const versions = all.filter(r => r.kind === "evidence" && r.data.groupId === groupId);
            if (versions.some(r => r.author !== u.email || r.data.taskId !== d.taskId))
                throw new RequestError("Invalid evidence version group.", 403);
            const version = Math.max(0, ...versions.map(r => Number(r.data.version))) + 1;
            id = `${groupId}:v${version}`;
            const attachment = d.attachmentId ? (await record(d.attachmentId)).data : null;
            await database().batch([...versions.filter(r => r.data.status === "Pending review").map(r => database().prepare("UPDATE crew_records SET data=?,updated_at=?,revision=revision+1 WHERE id=?").bind(JSON.stringify({ ...r.data, status: "Superseded" }), new Date().toISOString(), r.id)), insert(id, "evidence", u.email, { ...d, groupId, version, status: "Pending review", attachment }), database().prepare("UPDATE crew_records SET data=?,updated_at=?,revision=revision+1 WHERE id=?").bind(JSON.stringify({ ...task.data, status: "Awaiting review" }), new Date().toISOString(), task.id)]);
            await notify(u, `${u.name} submitted ${d.title} · v${version}`, "evidence");
        }
        else if (op === "review") {
            lead(u);
            const d = check(b, z.object({ id: short, revision: z.number().int(), decision: z.enum(["Accepted", "Rework"]), feedback: text, validation: text, c1: z.number().int().min(0).max(5), c2: z.number().int().min(0).max(5), c3: z.number().int().min(0).max(5) }));
            const r = await record(d.id);
            if (r.kind !== "evidence" || r.data.status !== "Pending review")
                throw new RequestError("This submission has already been reviewed.", 409);
            const all = await records();
            if (all.some(x => x.kind === "evidence" && x.data.groupId === r.data.groupId && x.data.version > r.data.version))
                throw new RequestError("Review the latest evidence version.");
            if (r.revision !== d.revision)
                throw new RequestError("The evidence changed. Refresh and review again.", 409);
            const operationId=crypto.randomUUID(),now=new Date().toISOString();
            const review = { by: u.name, at: now, operationId, feedback: d.feedback, validation: d.validation, c1: d.c1, c2: d.c2, c3: d.c3 };
            const results=await database().batch([
                database().prepare("UPDATE crew_records SET data=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? AND NOT EXISTS (SELECT 1 FROM crew_records newer WHERE newer.kind='evidence' AND json_extract(newer.data,'$.groupId')=? AND json_extract(newer.data,'$.version')>?)").bind(JSON.stringify({...r.data,status:d.decision,review}),now,r.id,d.revision,r.data.groupId,r.data.version),
                database().prepare("UPDATE crew_records SET data=json_set(data,'$.status',?),updated_at=?,revision=revision+1 WHERE id=? AND EXISTS(SELECT 1 FROM crew_records WHERE id=? AND json_extract(data,'$.review.operationId')=?)").bind(d.decision==="Accepted"?"Accepted":"In progress",now,r.data.taskId,r.id,operationId)
            ]);
            if(results[0].meta.changes!==1)throw new RequestError("This evidence changed while you reviewed it. Refresh before continuing.",409);
            await notify(u, `${r.data.title}: ${d.decision} — ${d.feedback.slice(0, 160)}`, "evidence", r.author);
            id = r.id;
        }
        else if (op === "raid") {
            const d = check(b, z.object({ type: z.enum(["Risk", "Issue / Blocker", "Dependency", "Decision", "Client Change Request"]), title: short, detail: text, owner: member, eta: iso, jira: url.optional(), evidence: url.optional() }));
            await insert(id, "raid", u.email, { ...d, status: "Open" }).run();
            await notify(u, `${d.type}: ${d.title}`, "raid");
        }
        else if (op === "raid_status") {
            const d = check(b, z.object({ id: short, revision: z.number().int(), status: z.enum(["Open", "In progress", "Resolved"]), resolution: text })), r = await record(d.id);
            if (r.kind !== "raid")
                throw new RequestError("Invalid RAID record.");
            own(r, u);
            await update(r, { ...r.data, status: d.status, resolution: d.resolution }, d.revision);
            id = r.id;
        }
        else if (op === "meeting") {
            lead(u);
            const d = check(b, z.object({ title: short, at: iso, link: url, recording: url.optional(), actions: text }));
            await insert(id, "meeting", u.email, d).run();
            await notify(u, `Meeting: ${d.title}`, "meetings");
        }
        else if (op === "meeting_update") {
            lead(u);
            const d = check(b, z.object({ id: short, revision: z.number().int(), recording: url, actions: text })), r = await record(d.id);
            if (r.kind !== "meeting")
                throw new RequestError("Invalid meeting.");
            await update(r, { ...r.data, recording: d.recording, actions: d.actions }, d.revision);
            id = r.id;
        }
        else if (op === "admin") {
            lead(u);
            const d = check(b, z.object({ weeklyAdmin: member }));
            id = "crew-config";
            const cfg = (await records()).find(r => r.kind === "config");
            const data = { ...(cfg?.data || { jira: "", aiEnabled: true }), weeklyAdmin: d.weeklyAdmin };
            if (cfg)
                await update(cfg, data, cfg.revision);
            else
                await insert(id, "config", u.email, data).run();
        }
        else if (op === "config") {
            if (u.role !== "owner")
                throw new RequestError("Only Lavanya can update crew settings.", 403);
            const d = check(b, z.object({ jira: url, aiEnabled: z.boolean(), weeklyAdmin: member.optional() }));
            id = "crew-config";
            await database().prepare("INSERT INTO crew_records(id,kind,author,data,created_at,updated_at,revision) VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,revision=crew_records.revision+1").bind(id, "config", u.email, JSON.stringify({ ...((await records()).find(r => r.kind === "config")?.data || {}), ...d }), new Date().toISOString(), new Date().toISOString()).run();
        }
        else if (op === "scenario") {
            if (u.role !== "owner" && (u.role !== "cohort_leader" || istDate() < "2026-10-20"))
                throw new RequestError("Scenario preparation is private to Lavanya until 20 October.", 403);
            const d = check(b, z.object({ type: z.enum(["Issue / Blocker", "Client Change Request"]), title: short, detail: text, releaseAt: iso, published: z.boolean() }));
            if (istDate(new Date(d.releaseAt)) < "2026-10-20")
                throw new RequestError("Release dates must be on or after 20 October 2026.");
            await insert(id, "scenario", u.email, d).run();
        }
        else if (op === "scenario_update") {
            if (u.role !== "owner" && (u.role !== "cohort_leader" || istDate() < "2026-10-20"))
                throw new RequestError("Scenario controls are private.", 403);
            const d = check(b, z.object({ id: short, revision: z.number().int(), published: z.boolean() })), r = await record(d.id);
            if (r.kind !== "scenario" || !canSeeScenario(r, u))
                throw new RequestError("Scenario unavailable.", 403);
            await update(r, { ...r.data, published: d.published }, d.revision);
            id = r.id;
        }
        else if (op === "energy") {
            lead(u);
            const d = check(b, z.object({ rider: member, rule: z.enum(rules.map(r => r[0]) as [
                    string,
                    ...string[]
                ]), detail: text, evidence: url }));
            if (!d.evidence)
                throw new RequestError("An evidence link is required for a verified rule breach.");
            const all = await records(), before = energyState(all, d.rider);
            if (before.reviewRequired)
                throw new RequestError("This rider needs a PM/TL review before further penalties.");
            const after = energyState([...all, { id, kind: "energy", author: u.email, data: { rider: d.rider }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 1 }], d.rider);
            const data = { ...d, before, after, appealDeadline: appealDeadline(), appealStatus: "Not appealed", reviewer: u.name };
            const count = all.filter(r => r.kind === "energy" && r.data.rider === d.rider && r.data.appealStatus !== "upheld").length, now = new Date().toISOString();
            const saved = await database().prepare("INSERT INTO crew_records(id,kind,author,data,created_at,updated_at,revision) SELECT ?,?,?,?,?,?,1 WHERE (SELECT COUNT(*) FROM crew_records WHERE kind='energy' AND json_extract(data,'$.rider')=? AND json_extract(data,'$.appealStatus')!='upheld')=?").bind(id, "energy", u.email, JSON.stringify(data), now, now, d.rider, count).run();
            if (saved.meta.changes !== 1)
                throw new RequestError("The energy state changed. Refresh before recording this loss.", 409);
            await notify(u, `Energy review: ${d.rule}. One appeal is available within two working hours.`, "control", d.rider);
        }
        else if (op === "appeal") {
            const d = check(b, z.object({ id: short, revision: z.number().int(), reason: text })), r = await record(d.id);
            if (r.kind !== "energy" || r.data.rider !== u.email)
                throw new RequestError("Only the affected Boat Rider can appeal.", 403);
            if (r.data.appealStatus !== "Not appealed" || Date.parse(r.data.appealDeadline) < Date.now())
                throw new RequestError("The single appeal window is closed.");
            await update(r, { ...r.data, appealStatus: "Pending", appealReason: d.reason }, d.revision);
            await notify(u, `${u.name} appealed an energy loss`, "control");
            id = r.id;
        }
        else if (op === "appeal_review") {
            lead(u);
            const d = check(b, z.object({ id: short, revision: z.number().int(), decision: z.enum(["upheld", "declined"]), feedback: text })), r = await record(d.id);
            if (r.kind !== "energy" || r.data.appealStatus !== "Pending")
                throw new RequestError("No pending appeal.");
            await update(r, { ...r.data, appealStatus: d.decision, appealFeedback: d.feedback, appealReviewer: u.name }, d.revision);
            await notify(u, `Appeal ${d.decision}: ${d.feedback}`, "control", r.data.rider);
            id = r.id;
        }
        else if (op === "mentor") {
            const d = check(b, z.object({ reason: text }));
            await insert(id, "mentor", u.email, { ...d, status: "Requested", duration: "One-hour mentor deep-dive" }).run();
            await notify(u, `${u.name} requested a mentor 1:1`, "control");
        }
        else if (op === "mentor_review") {
            lead(u);
            const d = check(b, z.object({ id: short, revision: z.number().int(), status: z.enum(["Approved", "Completed", "Rework"]), feedback: text })), r = await record(d.id);
            if (r.kind !== "mentor")
                throw new RequestError("Invalid mentor request.");
            await update(r, { ...r.data, status: d.status, feedback: d.feedback }, d.revision);
            id = r.id;
        }
        else if (op === "receipt") {
            id = `receipt:${u.email}`;
            const now = new Date().toISOString();
            await database().prepare("INSERT INTO crew_records(id,kind,author,data,created_at,updated_at,revision) VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,revision=crew_records.revision+1").bind(id, "receipt", u.email, JSON.stringify({ readAt: now }), now, now).run();
        }
        else
            throw new RequestError("Unknown action.");
        return Response.json({ ok: true, id });
    }
    catch (e) {
        return failure(e);
    }
}
