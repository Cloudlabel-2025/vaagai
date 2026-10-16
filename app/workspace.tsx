"use client";
import { tabFetch } from "../lib/tab-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { workspaceSections, workspacePath, type WorkspaceView as View } from "../lib/workspace-navigation";
import { Anchor, Bell, ChevronRight, CheckCircle2, LifeBuoy, LogOut, Menu, Plus, RefreshCw, Search, Settings2, Waves, X } from "lucide-react";
import { ExpeditionIcon } from "../components/expedition-icon";
import { RiverBrandMark } from "../components/river-brand-mark";
import { RiverAuthLoading } from "../components/river-auth";
import RiverExpedition, { ExpeditionStatus, RiderVitals } from "./river-expedition";
import DepartureCamp from "./departure-camp";
import MissionBriefing from "./mission-briefing";
import PaddlePlan from "./paddle-plan";
import CrewHuddles from "./crew-huddles";
import CrewCommunity from "./crew-community";
import JourneyEvidence from "./journey-evidence";
import CurrentsRocks from "./currents-rocks";
import CrewControl from "./crew-control";
import RiverGuide from "./river-guide";
import { crew, entities, phases, rules, fundamentals, energyState, canControl, istDate, type CrewRecord, type Identity } from "../lib/jaguar";
const nav = [
    ["overview", "River Map", "Project Dashboard"], ["onboarding", "Before you board", "Readiness"],
    ["project", "Our destination", "Client & Scope"], ["tasks", "Paddle plan", "Tasks & Workstreams"],
    ["meetings", "Crew huddles", "Meetings & Recordings"], ["community", "Crew Community", "Posts & Replies"],
    ["evidence", "Journey Evidence", "Submissions & Reviews"], ["raid", "Currents & Rocks", "RAID & Decisions"],
    ["control", "Crew control", "Rules & Scenario Control"], ["guide", "River Guide", "Project-aware AI Help"],
] as const;
const themeFor: Record<string, string> = { Risk: "Dangerous Current", "Issue / Blocker": "Rock", Dependency: "Connecting Stream", Decision: "Compass Decision", "Client Change Request": "Changing Current" };
type Field = {
    name: string;
    label: string;
    type?: string;
    options?: {
        value: string;
        label: string;
    }[];
    value?: string;
    required?: boolean;
    hint?: string;
};
type Dialog = {
    title: string;
    op: string;
    fields: Field[];
    fixed?: Record<string, any>;
    button?: string;
};
function date(value: string) { return new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) + " IST"; }
function localDate(value: string) { return new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0, 16); }
function fromLocal(value: string) { return new Date(value + ":00+05:30").toISOString(); }
function initials(name: string) { return name.split(/\s+/).map(s => s[0]).slice(0, 2).join(""); }
function Empty({ title, copy, action }: {
    title: string;
    copy: string;
    action?: React.ReactNode;
}) { return <div className="empty-state"><ExpeditionIcon destination="overview" size={34} /><h3>{title}</h3><p>{copy}</p>{action}</div>; }
function Badge({ children }: {
    children: string;
}) { return <span className={`badge ${/Accepted|Resolved|Completed|Approved|upheld/.test(children) ? "good" : /Blocked|Rework|declined/.test(children) ? "warn" : ""}`}>{children}</span>; }
function Panel({ title, subtitle, action, children, className = "" }: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) { return <section className={`card ${className}`}><div className="card-head"><div>{subtitle && <span className="overline">{subtitle}</span>}<h2>{title}</h2></div>{action}</div>{children}</section>; }
function External({ url, children }: {
    url?: string;
    children: React.ReactNode;
}) { return url ? <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">{children}</a> : null; }
function DialogForm({ dialog, close, submit, busy, saveError }: {
    dialog: Dialog;
    close: () => void;
    submit: (d: Record<string, any>) => Promise<boolean>;
    busy: boolean;
    saveError: string;
}) {
    const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(dialog.fields.map(f => [f.name, f.value ?? (f.type === "select" ? f.options?.[0]?.value || "" : "")]))), [file, setFile] = useState<File | null>(null), [error, setError] = useState(""), [sending,setSending]=useState(false);
    const modal = useRef<HTMLDivElement>(null);
    useEffect(() => { const previous = document.activeElement as HTMLElement; modal.current?.querySelector<HTMLElement>("input,textarea,select,button")?.focus(); const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy)
        close(); if (e.key === "Tab") {
        const elements = Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,textarea,select,a[href]') || []);
        const first = elements[0], last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        }
    } }; document.addEventListener("keydown", onKey); return () => { document.removeEventListener("keydown", onKey); previous?.focus(); }; }, [close, busy]);
    async function send(e: React.FormEvent) {
        e.preventDefault();
        if(sending||busy)return;
        setSending(true);
        setError("");
        const payload: Record<string, any> = { ...values, ...dialog.fixed, op: dialog.op };
        try {
            for (const f of dialog.fields) {
                if (f.type === "datetime-local" && payload[f.name])
                    payload[f.name] = fromLocal(payload[f.name]);
                if (f.type === "number")
                    payload[f.name] = Number(payload[f.name]);
                if (f.type === "boolean")
                    payload[f.name] = payload[f.name] === "true";
            }
            if (file) {
                const fd = new FormData();
                fd.append("file", file);
                const r = await tabFetch("/api/files", { method: "POST", body: fd });
                const b = await r.json() as any;
                if (!r.ok)
                    throw new Error(b.error);
                payload.attachmentId = b.id;
            }
            if (await submit(payload))
                close();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save. Your draft has been kept.");
        }finally{setSending(false);}
    }
    return <div className="dialog-backdrop"><div ref={modal} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><h2 id="dialog-title">{dialog.title}</h2><button type="button" aria-label="Close dialog" onClick={close} disabled={busy||sending}><X /></button></header><form onSubmit={send}>{dialog.fields.map(f => <label key={f.name}>{f.label}{f.type === "textarea" ? <textarea required={f.required !== false} maxLength={6000} value={values[f.name]} onChange={e => setValues({ ...values, [f.name]: e.target.value })}/> : f.type === "select" || f.type === "boolean" ? <select required={f.required !== false} value={values[f.name]} onChange={e => setValues({ ...values, [f.name]: e.target.value })}>{(f.options || (f.type === "boolean" ? [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] : [])).map(o => <option value={o.value} key={o.value}>{o.label}</option>)}</select> : f.type === "file" ? <input type="file" accept=".pdf,.docx,.xlsx,.pptx,.csv,.txt,.json,.png,.jpg,.jpeg,.webp,.zip" onChange={e => setFile(e.target.files?.[0] || null)}/> : <input type={f.type || "text"} required={f.required !== false} maxLength={f.type === "number" ? undefined : 2048} min={f.type === "number" ? 0 : undefined} max={f.type === "number" ? 5 : undefined} value={values[f.name]} onChange={e => setValues({ ...values, [f.name]: e.target.value })}/>} {f.hint && <small>{f.hint}</small>}</label>)}{(error||saveError) && <div role="alert" className="error-box">{error||saveError}</div>}<footer><button type="button" onClick={close} disabled={busy||sending}>Cancel</button><button className="primary" disabled={busy||sending}>{(busy||sending) ? "Saving…" : dialog.button || "Save to crew"}</button></footer></form></div></div>;
}
export default function Workspace() {
    const [crew, setCrew] = useState<{name: string; email: string; role: Identity["role"]; area: string}[]>([]);
    const riderOptions = crew.filter(p => p.role === "learner").map(p => ({ value: p.email, label: p.name }));
    function author(email: string) { return crew.find(p => p.email === email)?.name || email || "Crew system"; }
    const pathname = usePathname(), router = useRouter();
    const section = pathname.split("/")[1];
    const view: View = workspaceSections.includes(section as View) ? section as View : "overview";
    const [user, setUser] = useState<Identity | null>(null), [items, setItems] = useState<CrewRecord[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(""), [busy, setBusy] = useState(false), [dialog, setDialog] = useState<Dialog | null>(null), [menu, setMenu] = useState(false), [bell, setBell] = useState(false), [query, setQuery] = useState(""), [post, setPost] = useState(""), [question, setQuestion] = useState(""), [answer, setAnswer] = useState(""), [guideBusy, setGuideBusy] = useState(false), [guideTask, setGuideTask] = useState(""), [remaining, setRemaining] = useState<number | null>(null), [confirmed, setConfirmed] = useState(false), [toast, setToast] = useState(""), [phase, setPhase] = useState(0), [filter, setFilter] = useState("All");
    const load = useCallback(async () => { try {
        const r = await tabFetch("/api/crew", { cache: "no-store" });
        const data = await r.json() as any;
        if (!r.ok)
            { if (r.status === 401 || r.status === 403) { setUser(null); setItems([]); } throw new Error(data.error); }
        setItems(data.records);
        setUser(data.user);
        setCrew(data.crew || []);
        setError("");
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the workspace.");
    }
    finally {
        setLoading(false);
    } }, []);
    useEffect(() => { load(); const timer = setInterval(load, 60000); return () => clearInterval(timer); }, [load]);
    useEffect(() => {
        const migrateBookmark = () => {
            const target = window.location.hash.slice(1) as View;
            if (workspaceSections.includes(target)) router.replace(workspacePath(target));
            else if (target) router.replace("/overview");
        };
        migrateBookmark();
        window.addEventListener("hashchange", migrateBookmark);
        return () => window.removeEventListener("hashchange", migrateBookmark);
    }, [router]);
    useEffect(() => { if (toast) {
        const timer = setTimeout(() => setToast(""), 4500);
        return () => clearTimeout(timer);
    } }, [toast]);
    const move = useCallback((v: View) => { setMenu(false); setQuery(""); router.push(workspacePath(v)); }, [router]);
    const mutate = useCallback(async (payload: Record<string, any>) => { setBusy(true); setError(""); try {
        const r = await tabFetch("/api/crew", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }), data = await r.json() as any;
        if (!r.ok)
            throw new Error(data.error);
        await load();
        setToast("Saved to Jaguar Crew");
        return true;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Could not save. Your draft has been kept.");
        return false;
    }
    finally {
        setBusy(false);
    } }, [load]);
    const close = useCallback(() => setDialog(null), []);
    const byKind = (kind: string) => items.filter(r => r.kind === kind);
    const tasks = byKind("task"), evidence = byKind("evidence"), posts = byKind("post"), raids = byKind("raid"), meetings = byKind("meeting"), scenarios = byKind("scenario"), energy = byKind("energy"), mentors = byKind("mentor"), guideHistory = byKind("guide"), config = byKind("config")[0]?.data;
    const lead = !!user && canControl(user), privateControl = user?.role === "owner" || (user?.role === "cohort_leader" && istDate() >= "2026-10-20"), ready = items.some(r => r.kind === "readiness" && r.author === user?.email), accepted = tasks.filter(r => r.data.status === "Accepted").length;
    const receipts = byKind("receipt")[0]?.data.readAt || "", notifications = byKind("notification"), unread = notifications.filter(r => r.createdAt > receipts).length;
    const search = useMemo(() => query.trim() ? items.filter(r => ["task", "post", "raid", "evidence", "meeting"].includes(r.kind) && JSON.stringify(r.data).toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [], [query, items]);
    useEffect(() => { const context = (document as any).modelContext; if (!context?.registerTool)
        return; const abort = new AbortController(); Promise.resolve(context.registerTool({ name: "navigate_workspace", title: "Open Jaguar Crew area", description: "Navigate to a named area in Vaagai Jaguar Crew.", inputSchema: { type: "object", properties: { area: { type: "string", enum: nav.map(n => n[0]) } }, required: ["area"], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: ({ area }: {
            area: View;
        }) => { if (!nav.some(n => n[0] === area))
            throw new Error("Unknown area"); move(area); return { area }; } }, { signal: abort.signal })).catch(() => { }); return () => abort.abort(); }, [move]);
    const field = (name: string, label: string, type = "text", value = "", required = true): Field => ({ name, label, type, value, required });
    const ownerField: Field = { name: "owner", label: "Boat Rider / Task owner", type: "select", options: riderOptions };
    function createTask() { setDialog({ title: "Create a paddle action / Project task", op: "task", fields: [field("title", "Task title"), field("description", "Requirement and scope", "textarea"), ownerField, field("dueAt", "Due date & time · IST", "datetime-local"), field("criteria", "Acceptance criteria", "textarea"), { name: "dependency", label: "Dependency", type: "select", options: [{ value: "", label: "No dependency" }, ...tasks.map(r => ({ value: r.id, label: r.data.title }))], required: false }, field("jira", "Jira story / task URL", "url", "", false)] }); }
    function submitEvidence(taskId = "", previous?: CrewRecord) { setDialog({ title: previous ? "Resubmit evidence / New version" : "Submit Journey Evidence", op: "evidence", fixed: previous ? { groupId: previous.data.groupId, taskId: previous.data.taskId } : {}, fields: [{ name: "taskId", label: "Related project task", type: "select", value: taskId, options: tasks.filter(r => r.data.status !== "Accepted" && (lead || r.data.owner === user?.email) && (!previous || r.id === previous.data.taskId)).map(r => ({ value: r.id, label: r.data.title })) }, field("title", "Evidence title", "text", previous?.data.title || ""), field("summary", "What changed and how you checked it", "textarea"), field("handoff", "Hand-off to / Next action"), field("link", "Evidence URL · optional with a file", "url", "", false), { name: "file", label: "Attach evidence · up to 4 MB", type: "file", required: false, hint: "PDF, Office, CSV, text, JSON, ZIP or an image. Add synthetic training data only." }] }); }
    function reviewEvidence(r: CrewRecord) { setDialog({ title: `Review ${r.data.title} · v${r.data.version}`, op: "review", fixed: { id: r.id, revision: r.revision }, fields: [{ name: "decision", label: "Mentor decision", type: "select", options: [{ value: "Rework", label: "Rework required" }, { value: "Accepted", label: "Accept evidence" }] }, field("feedback", "Feedback visible to the Boat Rider", "textarea"), field("validation", "Expected state, actual state and verification performed", "textarea")] }); }
    function addRaid() { setDialog({ title: "Log a current or rock / RAID entry", op: "raid", fields: [{ name: "type", label: "Corporate record type", type: "select", options: Object.keys(themeFor).map(v => ({ value: v, label: `${v} · ${themeFor[v]}` })) }, field("title", "Title"), field("detail", "Impact, evidence and next action", "textarea"), ownerField, field("eta", "Revised ETA / Follow-up · IST", "datetime-local"), field("evidence", "Supporting evidence URL", "url", "", false), field("jira", "Jira issue URL", "url", "", false)] }); }
    function scenarioDialog() { setDialog({ title: "Prepare a private scenario", op: "scenario", fields: [{ name: "type", label: "Scenario type", type: "select", options: [{ value: "Issue / Blocker", label: "Rock · Issue / Blocker" }, { value: "Client Change Request", label: "Changing Current · Client Change Request" }] }, field("title", "Scenario title"), field("detail", "Released brief for Boat Riders", "textarea"), field("releaseAt", "Release date & time · IST (20 Oct or later)", "datetime-local", "2026-10-20T10:00"), { name: "published", label: "Schedule this scenario for release?", type: "boolean", value: "false", hint: "Drafts stay private. Scheduled scenarios become visible only at their release time." }] }); }
    async function ask() { if (!question.trim() || guideBusy)
        return; setGuideBusy(true); setError(""); try {
        const r = await tabFetch("/api/guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, taskId: guideTask }) }), data = await r.json() as any;
        if (!r.ok)
            throw new Error(data.error);
        setAnswer(data.answer);
        setRemaining(data.remaining);
        setQuestion("");
        await load();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "River Guide is unavailable.");
    }
    finally {
        setGuideBusy(false);
    } }
    if (loading)
        return <RiverAuthLoading title="Your crew is just ahead" detail="Opening your river map and loading the expedition." />;
    if (!user)
        return <div className="welcome"><ExpeditionIcon destination="overview" size={48} /><span className="overline">VAAGAI · JAGUAR CREW</span><h1>Your river journey starts here.</h1><p>{error || "Sign in with your approved email and password."}</p><a className="primary" href={`/signin?return_to=${encodeURIComponent(pathname)}`} target="_top">Sign in</a><button onClick={load}>Try again</button></div>;
    return <div className="app-shell" data-view={view}>
    {menu && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMenu(false)}/>}
    <aside className={`app-nav ${menu ? "open" : ""}`}><div className="brand"><RiverBrandMark /><div><strong>Vaagai</strong><small>The river simulation</small></div><button className="mobile-close" aria-label="Close navigation" onClick={() => setMenu(false)}><X /></button></div><div className="crew-label"><span>ACTIVE EXPEDITION</span><strong>Jaguar Crew</strong><small>Oracle Fusion HCM</small></div><nav>{nav.map(([id, label, corporate]) => <Link key={id} href={workspacePath(id)} className={view === id ? "active" : ""} onClick={() => { setMenu(false); setQuery(""); }} aria-current={view === id ? "page" : undefined}><ExpeditionIcon destination={id} size={26} /><span>{label}<small>{corporate}</small></span></Link>)}</nav>{user.role === "owner" && <Link href="/admin/users" className="manage-access-link"><Anchor size={18} /><span>Manage access</span><ChevronRight className="manage-access-arrow" size={16} /></Link>}<footer><div className="person-mark">{initials(user.name)}</div><div><strong>{user.name}</strong><small>{user.role === "owner" ? "Project Lead" : user.role === "cohort_leader" ? "Crew Lead / Team Lead" : "Boat Rider"}</small></div><Link href="/signout" aria-label="Sign out"><LogOut size={18}/></Link></footer></aside>
    <main className="workspace"><header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMenu(true)}><Menu /></button><span className="breadcrumb">Jaguar Crew <b> / </b><strong>{nav.find(n => n[0] === view)?.[1]}</strong></span><div className="workspace-search"><Search size={18}/><input aria-label="Search shared project records" placeholder="Search the crew workspace" value={query} onChange={e => setQuery(e.target.value)}/>{query && <div className="search-results">{search.length ? search.map(r => <button key={r.id} onClick={() => move(({ task: "tasks", post: "community", raid: "raid", evidence: "evidence", meeting: "meetings" } as Record<string, View>)[r.kind])}><small>{r.kind}</small>{r.data.title || r.data.text?.slice(0, 100)}</button>) : <p>No matching records yet.</p>}</div>}</div><button className="icon-button" aria-label="Refresh workspace" onClick={load}><RefreshCw size={18}/></button><div className="bell-wrap"><button className="icon-button" aria-label={`Notifications, ${unread} unread`} aria-expanded={bell} onClick={() => setBell(!bell)}><Bell size={21}/>{unread > 0 && <span className="notification-count">{unread}</span>}</button>{bell && <div className="notification-panel"><header><h2>Crew notifications</h2><button disabled={busy} onClick={() => mutate({ op: "receipt" })}>Mark read</button></header>{notifications.length ? notifications.slice(0, 30).map(r => <button key={r.id} className={r.createdAt > receipts ? "unread" : ""} onClick={() => { move(r.data.target as View); setBell(false); }}><strong>{r.data.title}</strong><small>{date(r.createdAt)}</small></button>) : <p>No notifications yet. Jira reminders appear here at 17:30 IST on working days from 5 October.</p>}</div>}</div></header>
    <div className="workspace-content">{error && <div className="error-box" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={18}/></button></div>}{toast && <div className="toast" role="status"><CheckCircle2 size={17}/>{toast}</div>}
    <ExpeditionStatus user={user} records={items}/>
    {view === "overview" && <><RiverExpedition user={user} crew={crew} records={items} tasks={tasks} evidence={evidence} raids={raids} phase={phase} onPhase={setPhase} onTasks={() => move("tasks")} onEvidence={submitEvidence} onReview={() => move("evidence")} onRaid={() => move("raid")} onGuide={taskId => { setGuideTask(taskId); move("guide"); }}/><div className="two-column"><Panel title="Your next paddle" subtitle="ASSIGNED PROJECT WORK" action={lead ? <button className="primary" onClick={createTask}><Plus size={16}/>Create task</button> : <button onClick={() => move("tasks")}>View tasks</button>}>{tasks.filter(r => r.data.status !== "Accepted" && (lead || r.data.owner === user.email)).slice(0, 4).map(r => <div className="compact-row" key={r.id}><div><strong>{r.data.title}</strong><small>{author(r.data.owner)} · {date(r.data.dueAt)}</small></div><Badge>{r.data.status}</Badge></div>)}{!tasks.some(r => r.data.status !== "Accepted" && (lead || r.data.owner === user.email)) && <Empty title="A clean start" copy={lead ? "Create the first task when the client requirement and acceptance criteria are ready." : "Your crew lead will assign the first project action. Complete readiness while you wait."} action={<button onClick={() => move("onboarding")}>Open readiness</button>}/>}</Panel><Panel title="Meet your crew" subtitle="CROSS THE RIVER TOGETHER">{crew.map(p => <div key={p.email} className="crew-person"><span className="person-mark">{initials(p.name)}</span><div><strong>{p.name}</strong><small>{p.area}</small>{p.role === "learner" && <div className="crew-vitals"><RiderVitals {...energyState(items, p.email)} /></div>}</div></div>)}</Panel></div><div className="tip-bar"><ExpeditionIcon destination="guide" size={28} /><div><strong>Stuck on a project step?</strong><span>River Guide already knows TMS Motors and your role. Ask for an explanation or a next-step check.</span></div><button onClick={() => move("guide")}>Ask River Guide</button></div></>}
    {view === "onboarding" && <DepartureCamp ready={ready} confirmed={confirmed} busy={busy} lead={lead} crew={crew} records={items} onChecked={setConfirmed} onConfirm={() => { void mutate({ op: "readiness", confirmed: true }); }} onNavigate={move}/>}
    {view === "project" && <MissionBriefing phase={phase} onPhase={setPhase} onNavigate={move}/>}
    {view === "tasks" && <PaddlePlan user={user} crew={crew} tasks={tasks} evidence={evidence} filter={filter} busy={busy} jira={config?.jira} onFilter={setFilter} onCreate={createTask} onEvidence={submitEvidence} onGuide={taskId => { setGuideTask(taskId); move("guide"); }} onStatus={(task, status) => { void mutate({ op: "task_status", id: task.id, revision: task.revision, status }); }} onNavigate={move}/>}
    {view === "community" && <CrewCommunity user={user} posts={posts} replies={byKind("reply")} memberCount={crew.length} draft={post} busy={busy} author={author} onDraft={setPost} onPublish={async () => { if (await mutate({ op: "post", text: post })) setPost(""); }} onReply={r => setDialog({ title: "Reply to the crew", op: "reply", fixed: { parentId: r.id }, fields: [field("text", "Your reply", "textarea")] })} onHuddles={() => move("meetings")} />}
    {view === "evidence" && <JourneyEvidence user={user} evidence={evidence} tasks={tasks} busy={busy} author={author} onSubmit={submitEvidence} onReview={reviewEvidence}/>}
    {view === "raid" && <CurrentsRocks user={user} records={raids} busy={busy} themes={themeFor} author={author} onCreate={addRaid} onUpdate={r => setDialog({ title: "Update RAID entry", op: "raid_status", fixed: { id: r.id, revision: r.revision }, fields: [{ name: "status", label: "Status", type: "select", value: r.data.status, options: ["Open", "In progress", "Resolved"].map(v => ({ value: v, label: v })) }, field("resolution", "Decision, resolution or next action", "textarea")] })}/>}
    {view === "meetings" && <CrewHuddles meetings={meetings} lead={lead} busy={busy} onCreate={() => setDialog({ title: "Add a crew meeting", op: "meeting", fields: [field("title", "Meeting title"), field("at", "Meeting date & time · IST", "datetime-local"), field("link", "Meeting join URL", "url", "", false), field("recording", "Recording URL", "url", "", false), field("actions", "Agenda / Actions and owners", "textarea")] })} onOutcomes={r => setDialog({ title: "Record meeting outcomes", op: "meeting_update", fixed: { id: r.id, revision: r.revision }, fields: [field("recording", "Recording URL", "url", r.data.recording || "", false), field("actions", "Meeting actions, owners and deadlines", "textarea", r.data.actions)] })} />}
    {view === "control" && <CrewControl user={user} crew={crew} records={items} busy={busy} onRecordLoss={() => setDialog({ title: "Record a verified energy loss", op: "energy", fields: [{ name: "rider", label: "Boat Rider", type: "select", options: riderOptions }, { name: "rule", label: "Verified rule breach", type: "select", options: rules.map(([v, l]) => ({ value: v, label: l })) }, field("detail", "What happened, timestamp and verification", "textarea"), field("evidence", "Accessible evidence URL", "url")] })}><Panel title="Energy & appeal history" className="space-top">{energy.length ? energy.map(r => <div className="audit-entry" key={r.id}><div><strong>{author(r.data.rider)} · {r.data.rule}</strong><Badge>{r.data.appealStatus}</Badge></div><p>{r.data.detail}</p><small>{r.data.reviewer} · {date(r.createdAt)} · Before: life {r.data.before.life}, energy {r.data.before.energy}/3 · After: life {r.data.after?.life}, energy {r.data.after?.energy}/3</small><External url={r.data.evidence}>Open breach evidence</External><p className="control-appeal-window">Appeal deadline: {date(r.data.appealDeadline)}</p>{r.data.appealReason && <p><b>Appeal:</b> {r.data.appealReason}</p>}{r.data.appealFeedback && <p className="callout">{r.data.appealFeedback}</p>}<div className="row-actions">{r.data.rider === user.email && r.data.appealStatus === "Not appealed" && Date.parse(r.data.appealDeadline) > Date.now() && <button onClick={() => setDialog({ title: "Appeal this energy loss", op: "appeal", fixed: { id: r.id, revision: r.revision }, fields: [field("reason", "Your appeal and supporting explanation", "textarea")] })}>Use one appeal</button>}{lead && r.data.appealStatus === "Pending" && <button onClick={() => setDialog({ title: "Review the appeal", op: "appeal_review", fixed: { id: r.id, revision: r.revision }, fields: [{ name: "decision", label: "Decision", type: "select", options: [{ value: "upheld", label: "Uphold appeal · restore energy" }, { value: "declined", label: "Decline appeal" }] }, field("feedback", "Reason visible to Boat Rider", "textarea")] })}>Review appeal</button>}</div></div>) : <Empty title="No energy losses recorded" copy="Losses are recorded by Lavanya or Premothan after checking evidence."/>}</Panel><Panel title="Mentor 1:1" subtitle="ONE-HOUR MENTOR DEEP-DIVE" className="space-top" action={<button onClick={() => setDialog({ title: "Request mentor 1:1", op: "mentor", fields: [field("reason", "What would you like to work through?", "textarea")] })}><LifeBuoy size={16}/>Request mentor help</button>}>{mentors.length ? mentors.map(r => <div className="compact-row" key={r.id}><div><strong>{author(r.author)}</strong><p>{r.data.reason}</p>{r.data.feedback && <small>{r.data.feedback}</small>}</div><Badge>{r.data.status}</Badge>{lead && <button onClick={() => setDialog({ title: "Review mentor request", op: "mentor_review", fixed: { id: r.id, revision: r.revision }, fields: [{ name: "status", label: "Status", type: "select", options: ["Approved", "Completed", "Rework"].map(v => ({ value: v, label: v })) }, field("feedback", "Mentor note / agreed next step", "textarea")] })}>Update</button>}</div>) : <p className="muted">Ask for a focused mentor session when peer help and your own checks have not cleared a blocker. The crew lead reviews requests.</p>}</Panel>{privateControl && <Panel title="Private scenario desk" subtitle="LAVANYA · PREMOTHAN FROM 20 OCTOBER" className="space-top" action={<button className="primary" onClick={scenarioDialog}>Prepare scenario</button>}><p>Draft upcoming rocks and changing currents here. Boat Riders receive only scheduled scenarios whose release time has arrived.</p>{scenarios.length ? scenarios.map(r => <div className="scenario-entry" key={r.id}><strong>{r.data.title}</strong><Badge>{!r.data.published ? "Private draft" : Date.parse(r.data.releaseAt) > Date.now() ? "Scheduled" : "Released"}</Badge><p>{r.data.detail}</p><small>{r.data.type} · Release {date(r.data.releaseAt)}</small><button disabled={busy} onClick={() => mutate({ op: "scenario_update", id: r.id, revision: r.revision, published: !r.data.published })}>{r.data.published ? "Return to private draft" : "Schedule release"}</button></div>) : <p className="muted">No upcoming scenarios prepared.</p>}</Panel>}{!privateControl && scenarios.length > 0 && <Panel title="Released river events" className="space-top">{scenarios.map(r => <div className="scenario-entry" key={r.id}><strong>{r.data.title}</strong><small>{themeFor[r.data.type]} · {r.data.type}</small><p>{r.data.detail}</p><button onClick={addRaid}>Record response in RAID</button></div>)}</Panel>}{lead && <Panel title="Weekly crew admin" className="space-top"><p>Premothan nominates a Boat Rider to maintain the weekly admin records.</p><div className="row-actions"><span>{config?.weeklyAdmin ? author(config.weeklyAdmin) : "No admin nominated yet"}</span><button onClick={() => setDialog({ title: "Nominate weekly admin", op: "admin", fields: [{ name: "weeklyAdmin", label: "Boat Rider", type: "select", options: riderOptions }] })}>Nominate admin</button></div></Panel>}{user.role === "owner" && <Panel title="Crew settings" className="space-top" action={<button onClick={() => setDialog({ title: "Jaguar Crew settings", op: "config", fields: [field("jira", "Crew Jira project URL", "url", config?.jira || "", false), { name: "aiEnabled", label: "River Guide enabled", type: "boolean", value: config?.aiEnabled === false ? "false" : "true" }] })}><Settings2 size={16}/>Edit settings</button>}><p>Jira: {config?.jira ? <External url={config.jira}>{config.jira}</External> : "Awaiting project URL"}</p><p>River Guide: {config?.aiEnabled === false ? "Paused" : "Enabled"} · 20 questions per member per IST day.</p></Panel>}</CrewControl>}
    {view === "guide" && <RiverGuide user={user} workstream={crew.find(member => member.email === user.email)?.area} tasks={tasks} history={guideHistory} question={question} answer={answer} taskId={guideTask} remaining={remaining} busy={guideBusy} enabled={config?.aiEnabled !== false} onQuestion={setQuestion} onTask={setGuideTask} onAsk={() => { void ask(); }} onTasks={() => move("tasks")} />}
    </div><footer className="workspace-footer"><span>Vaagai · Jaguar Crew</span><span>Evidence, delivery and teamwork</span></footer></main>{dialog && <DialogForm key={dialog.title + dialog.fixed?.id} dialog={dialog} close={close} submit={mutate} busy={busy} saveError={error}/>}</div>;
}
