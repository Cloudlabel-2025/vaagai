"use client";
import { ExpeditionIcon } from "../components/expedition-icon";
import { useState } from "react";
import { ArrowUpRight, Check, ChevronRight, FileCheck2, Flag, Link2, Mountain, Plus, ShieldCheck, Timer, Waves } from "lucide-react";
import { canControl, type CrewRecord, type Identity } from "../lib/jaguar";
import type { WorkspaceView } from "../lib/workspace-navigation";

type Props = {
  user: Identity;
  crew: { name: string; email: string; role: Identity["role"]; area: string }[];
  tasks: CrewRecord[];
  evidence: CrewRecord[];
  filter: string;
  busy: boolean;
  jira?: string;
  onFilter: (value: string) => void;
  onCreate: () => void;
  onEvidence: (taskId: string) => void;
  onGuide: (taskId: string) => void;
  onStatus: (task: CrewRecord, status: string) => void;
  onNavigate: (view: WorkspaceView) => void;
};
function date(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) + " IST" : "No deadline recorded";
}
function tone(task: CrewRecord) { return task.data.status === "Accepted" ? "accepted" : task.data.status === "Blocked" ? "blocked" : task.data.status === "Awaiting review" ? "review" : "open"; }

export default function PaddlePlan({ user, crew, tasks, evidence, filter, busy, jira, onFilter, onCreate, onEvidence, onGuide, onStatus, onNavigate }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lead = canControl(user);
  const matching = tasks.filter(task => filter === "All" || filter === "Mine" && task.data.owner === user.email || task.data.status === filter);
  const selected = matching.find(task => task.id === selectedId) || matching.find(task => task.data.owner === user.email && task.data.status !== "Accepted") || matching[0];
  const accepted = tasks.filter(task => task.data.status === "Accepted").length;
  const reviews = tasks.filter(task => task.data.status === "Awaiting review").length;
  const blocked = tasks.filter(task => task.data.status === "Blocked").length;
  const owner = selected && crew.find(member => member.email === selected.data.owner);
  const dependency = selected && tasks.find(task => task.id === selected.data.dependency);
  const canEdit = selected && selected.data.status !== "Accepted" && (lead || selected.data.owner === user.email);
  const overdue = selected && selected.data.status !== "Accepted" && Date.parse(selected.data.dueAt) < Date.now();
  const submissions = selected ? evidence.filter(record => record.data.taskId === selected.id) : [];
  return <div className="paddle-plan">
    <header className="paddle-intro"><span className="paddle-kicker"><ExpeditionIcon destination="tasks" size={20} /> PADDLE PLAN</span><h1>Plan your paddle.<br />Clear the path.</h1><p>Study the route. Own your challenge.<br />Prove the work before the crew moves forward.</p>{lead && <button className="primary" disabled={busy} onClick={onCreate}><Plus size={16} /> Create task</button>}</header>
    <section className="paddle-live-summary" aria-label="Actual task progress"><div><Mountain size={21} /><span><strong>{tasks.length - accepted}</strong><small>Challenges ahead</small></span></div><div><Waves size={21} /><span><strong>{blocked}</strong><small>Blocked tasks</small></span></div><div><ShieldCheck size={21} /><span><strong>{reviews}</strong><small>Awaiting review</small></span></div><div><Check size={21} /><span><strong>{accepted}</strong><small>Accepted tasks</small></span></div></section>
    <div className="paddle-learning-loop"><span><Flag size={15} /> Assigned challenge</span><ChevronRight size={14} /><span><FileCheck2 size={15} /> Submit evidence</span><ChevronRight size={14} /><span><ShieldCheck size={15} /> Mentor acceptance</span><p>Only accepted evidence clears a task.</p></div>
    <div className="paddle-board">
      <section className="paddle-route" aria-labelledby="paddle-route-title"><header><h2 id="paddle-route-title">Choose your next challenge</h2><span>{matching.length} shown</span></header><div className="paddle-filters" role="group" aria-label="Filter project tasks">{["All", "Mine", "Awaiting review", "Accepted"].map(value => <button key={value} aria-pressed={filter === value} className={filter === value ? "selected" : ""} onClick={() => onFilter(value)}>{value}</button>)}</div>{matching.length ? <div className="paddle-task-list">{matching.map((task, index) => <button key={task.id} className={`paddle-task ${tone(task)} ${selected?.id === task.id ? "selected" : ""}`} aria-pressed={selected?.id === task.id} aria-label={`Inspect ${task.data.title}, ${task.data.status}`} onClick={() => setSelectedId(task.id)}><span className="paddle-task-mark">{task.data.status === "Accepted" ? <Check size={17} /> : task.data.status === "Blocked" ? <Mountain size={17} /> : String(index + 1).padStart(2, "0")}</span><span className="paddle-task-copy"><strong>{task.data.title}</strong><small>{crew.find(member => member.email === task.data.owner)?.name || task.data.owner}</small><span className="paddle-task-status">{task.data.status}</span></span><ChevronRight size={16} /></button>)}</div> : <div className="paddle-empty"><ExpeditionIcon destination="tasks" size={32} /><h3>{tasks.length ? "No challenges match this view." : "Your route is taking shape."}</h3><p>{tasks.length ? "Choose another filter to explore the crew's assigned work." : "Challenges appear when your lead assigns real project tasks."}</p>{tasks.length ? <button onClick={() => onFilter("All")}>Show all tasks</button> : lead ? <button className="primary" onClick={onCreate}>Create first task</button> : <button onClick={() => onNavigate("onboarding")}>Prepare at departure camp</button>}</div>}</section>
      {selected && <section className={`paddle-task-detail ${tone(selected)}`} aria-labelledby="paddle-detail-title"><header><span className="paddle-detail-emblem">{selected.data.status === "Accepted" ? <Check size={24} /> : <ExpeditionIcon destination="tasks" size={25} />}</span><div><span className="paddle-workstream">{owner?.area || "Assigned project work"}</span><h2 id="paddle-detail-title">{selected.data.title}</h2></div><span className="paddle-detail-status">{selected.data.status}</span></header><p className="paddle-description">{selected.data.description}</p><dl className="paddle-task-facts"><div><dt>Boat rider / Owner</dt><dd>{owner?.name || selected.data.owner}</dd></div><div><dt>Deadline</dt><dd className={overdue ? "paddle-overdue" : ""}>{date(selected.data.dueAt)}{overdue && <small>Deadline passed</small>}</dd></div></dl>{selected.data.dependency && <div className="paddle-dependency"><Link2 size={17} /><div><strong>Connecting task</strong><p>{dependency?.data.title || "Dependency not available in the current workspace"}</p><small>{dependency?.data.status === "Accepted" ? "Accepted evidence recorded for this dependency." : "This dependency needs accepted evidence before you can start this task."}</small></div></div>}<div className="paddle-acceptance"><ShieldCheck size={19} /><div><h3>What clears this challenge</h3><p>{selected.data.criteria}</p></div></div><div className="paddle-evidence-state"><FileCheck2 size={17} /><span>{selected.data.status === "Accepted" ? "Mentor acceptance recorded. This task is cleared." : selected.data.status === "Awaiting review" ? "Evidence submitted. Await mentor review before this task clears." : `${submissions.length} evidence submission${submissions.length === 1 ? "" : "s"} recorded for this task.`}</span>{submissions.length > 0 && <button onClick={() => onNavigate("evidence")}>View evidence <ArrowUpRight size={14} /></button>}</div><div className="paddle-task-actions">{canEdit && <><label>Task status<select aria-label={`Status for ${selected.data.title}`} disabled={busy} value={["Planned", "In progress", "Blocked"].includes(selected.data.status) ? selected.data.status : ""} onChange={event => onStatus(selected, event.target.value)}><option disabled value="">Awaiting review</option>{["Planned", "In progress", "Blocked"].map(status => <option key={status}>{status}</option>)}</select></label><button className="primary" disabled={busy} onClick={() => onEvidence(selected.id)}>Submit evidence <ArrowUpRight size={16} /></button></>}<button onClick={() => onGuide(selected.id)}><ExpeditionIcon destination="guide" size={19} /> Ask River Guide</button>{selected.data.jira && <a href={selected.data.jira} target="_blank" rel="noopener noreferrer">Open Jira task <ArrowUpRight size={14} /></a>}</div>{selected.data.status === "Blocked" && <div className="paddle-blocker-note"><Mountain size={17} /><p>Explain the blocker, supporting evidence and revised ETA in Currents & Rocks.</p><button onClick={() => onNavigate("raid")}>Open Currents & Rocks <ArrowUpRight size={14} /></button></div>}</section>}
    </div>
    <footer className="paddle-operations"><Timer size={21} /><div><strong>Working-day Jira reminder · 17:30 IST</strong><p>Update stories/tasks, blockers, evidence links and your next action. Jira entries are updated in Jira; this workspace keeps the links.</p></div>{jira ? <a href={jira} target="_blank" rel="noopener noreferrer">Open crew Jira <ArrowUpRight size={15} /></a> : <span>Jira link awaiting Project Lead setup</span>}</footer>
  </div>;
}
