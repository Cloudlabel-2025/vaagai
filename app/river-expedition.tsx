"use client";

import { useState } from "react";
import { ArrowUpRight, Check, ChevronRight, Compass, Flag, Heart, Mountain, Sailboat, ShieldCheck, Waves, Zap } from "lucide-react";
import { energyState, phases, type CrewRecord, type Identity } from "../lib/jaguar";

type CrewMember = { name: string; email: string; role: Identity["role"]; area: string };
type Props = {
  user: Identity;
  crew: CrewMember[];
  records: CrewRecord[];
  tasks: CrewRecord[];
  evidence: CrewRecord[];
  raids: CrewRecord[];
  phase: number;
  onPhase: (phase: number) => void;
  onTasks: () => void;
  onEvidence: (taskId: string) => void;
  onReview: () => void;
  onRaid: () => void;
  onGuide: (taskId: string) => void;
};

export function ExpeditionStatus({ user, records }: Pick<Props, "user" | "records">) {
  const state = energyState(records, user.email);
  return <div className="expedition-status" aria-label="Your expedition status">
    <span><Sailboat size={17} /><b>{user.role === "learner" ? "Boat Rider" : "Expedition lead"}</b></span>
    {user.role === "learner" && <><span><Heart size={16} /><b>Life {state.life}/3</b></span><span><Zap size={16} /><b>Energy {state.energy}/3</b></span></>}
    <span className="expedition-status-note">Every accepted task takes the crew forward.</span>
  </div>;
}

export default function RiverExpedition({ user, crew, records, tasks, evidence, raids, phase, onPhase, onTasks, onEvidence, onReview, onRaid, onGuide }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapView, setMapView] = useState<"map" | "list">("map");
  const accepted = tasks.filter(task => task.data.status === "Accepted").length;
  const progress = tasks.length ? Math.round(accepted / tasks.length * 100) : 0;
  const outstanding = tasks.filter(task => task.data.status !== "Accepted");
  const ordered = [...outstanding.filter(task => task.data.owner === user.email), ...outstanding.filter(task => task.data.owner !== user.email), ...tasks.filter(task => task.data.status === "Accepted")];
  const cleared = tasks.filter(task => task.data.status === "Accepted");
  const markers = outstanding.length > 4 && cleared.length ? [...ordered.slice(0, 4), cleared[0]] : ordered.slice(0, 5);
  const selected = tasks.find(task => task.id === selectedId) ?? ordered[0];
  const pending = evidence.filter(record => record.data.status === "Pending review").length;
  const blockers = raids.filter(record => record.data.status !== "Resolved").length;
  const canSubmit = selected && selected.data.status !== "Accepted" && (user.role !== "learner" || selected.data.owner === user.email);
  const name = (email: string) => crew.find(member => member.email === email)?.name || email;
  const deadline = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "No deadline";

  return <div className="expedition-overview">
    <div className="expedition-heading">
      <div><span className="expedition-kicker"><Compass size={15} /> JAGUAR CREW EXPEDITION</span><h1>The far bank is earned.</h1><p>Face the current. Solve the challenge. Move forward together.</p></div>
      <button className="primary" onClick={onTasks}>Find your next challenge <ArrowUpRight size={17} /></button>
    </div>

    <section className="expedition-map-card" aria-labelledby="expedition-map-title">
      <header className="expedition-map-header"><div><h2 id="expedition-map-title"><Waves size={21} /> The river crossing</h2><p>TMS Motors Group · Oracle Fusion HCM</p></div><div className="expedition-view-switch" role="group" aria-label="Journey display"><button aria-pressed={mapView === "map"} onClick={() => setMapView("map")}><Compass size={15} /> Map</button><button aria-pressed={mapView === "list"} onClick={() => setMapView("list")}><Mountain size={15} /> Challenges</button></div></header>
      {mapView === "map" ? <div className="expedition-map" role="group" aria-label="River crossing map. Boat position reflects the percentage of assigned tasks accepted.">
        <div className="river-current" aria-hidden="true" />
        <div className="map-bank departure"><span><Flag size={14} /> DEPARTURE BANK</span><strong>A new beginning</strong></div>
        <div className="map-bank destination"><span>DESTINATION BANK <Flag size={14} /></span><strong>Implementation go-live</strong></div>
        <div className="map-crossing-line" aria-hidden="true" />
        <div className="map-boat" style={{ left: `${12 + progress * .76}%` }}><span className="map-boat-label">{progress === 100 ? "All assigned tasks accepted" : "Your crew"}</span><div className="boat-vessel"><Sailboat size={35} strokeWidth={1.7} /></div><span className="boat-wake" aria-hidden="true" /></div>
        {markers.map((task, index) => <button key={task.id} className={`map-challenge ${task.data.status === "Accepted" ? "cleared" : task.data.status === "Blocked" ? "blocked" : ""} ${selected?.id === task.id ? "selected" : ""}`} style={{ left: `${24 + index * 13}%`, top: `${index % 2 === 0 ? 37 : 49}%` }} aria-label={`Challenge ${index + 1}: ${task.data.title}, ${task.data.status}`} aria-pressed={selected?.id === task.id} onClick={() => setSelectedId(task.id)}><span className="map-marker">{task.data.status === "Accepted" ? <Check size={18} /> : task.data.status === "Blocked" ? <Mountain size={18} /> : index + 1}</span><span className="map-marker-caption">{task.data.status === "Accepted" ? "Cleared" : task.data.status === "Blocked" ? "Blocked" : "Challenge"} {index + 1}</span></button>)}
        {!tasks.length && <div className="map-empty"><Compass size={24} /><strong>Your journey is taking shape.</strong><span>Real task markers appear when your lead assigns work.</span></div>}
        <div className="map-legend"><span><Mountain size={14} /> Tasks are challenges</span><span><Check size={14} /> Acceptance clears them</span>{tasks.length > markers.length && <button onClick={() => setMapView("list")}>View all {tasks.length} tasks <ChevronRight size={13} /></button>}</div>
      </div> : <div className="expedition-challenge-list">{ordered.length ? ordered.map((task, index) => <button key={task.id} className={selected?.id === task.id ? "selected" : ""} aria-pressed={selected?.id === task.id} onClick={() => setSelectedId(task.id)}><span className="challenge-number">{task.data.status === "Accepted" ? <Check size={17} /> : index + 1}</span><span><strong>{task.data.title}</strong><small>{name(task.data.owner)} · {task.data.status}</small></span><ChevronRight size={16} /></button>) : <p>No challenges assigned yet. Complete your readiness while your lead prepares the route.</p>}</div>}
      <div className="crossing-progress"><div><span><Sailboat size={17} /><strong>{progress}%</strong> crossing progress</span><small>{accepted} of {tasks.length} assigned tasks accepted</small></div><progress value={progress} max={100} aria-label={`${progress}% of assigned tasks accepted`} /><p>Boat position reflects task acceptance. It does not certify phase completion or go-live.</p></div>
    </section>

    <div className="expedition-metrics" aria-label="Live expedition totals">{[
      { count: outstanding.length, label: "Challenges ahead", icon: Mountain, action: onTasks },
      { count: accepted, label: "Challenges cleared", icon: Check, action: onTasks },
      { count: pending, label: "Evidence in review", icon: ShieldCheck, action: onReview },
      { count: blockers, label: "Currents & rocks", icon: Waves, action: onRaid },
    ].map(({ count, label, icon: Icon, action }) => <button key={label} onClick={action}><span className="metric-icon"><Icon size={19} /></span><span><strong>{count}</strong><small>{label}</small></span><ChevronRight size={16} /></button>)}</div>

    <div className="expedition-detail-grid">
      <section className="challenge-detail" aria-labelledby="challenge-detail-title"><div className="challenge-detail-heading"><span className="challenge-emblem"><Mountain size={21} /></span><div><span>{selected ? "SELECTED RIVER CHALLENGE" : "YOUR NEXT CHALLENGE"}</span><h2 id="challenge-detail-title">{selected?.data.title || "The river is waiting"}</h2></div>{selected && <span className={`challenge-status ${selected.data.status === "Blocked" ? "blocked" : ""}`}>{selected.data.status}</span>}</div>
        {selected ? <><p className="challenge-description">{selected.data.description}</p><div className="challenge-facts"><span><small>Boat rider</small><strong>{name(selected.data.owner)}</strong></span><span><small>Deadline · IST</small><strong>{deadline(selected.data.dueAt)}</strong></span></div><div className="challenge-objective"><ShieldCheck size={17} /><div><strong>How to clear this challenge</strong><p>{selected.data.criteria || "Read the task and agree acceptance criteria with your crew lead."}</p></div></div><div className="challenge-actions">{canSubmit && <button className="primary" onClick={() => onEvidence(selected.id)}>Submit evidence <ArrowUpRight size={16} /></button>}<button onClick={() => onGuide(selected.id)}><Compass size={16} /> Ask River Guide</button><button className="challenge-all" onClick={onTasks}>All tasks <ChevronRight size={15} /></button></div></> : <><p>Every task becomes a challenge on this river. Work through it, share your evidence and let mentor acceptance mark the way forward.</p><button onClick={onTasks}>Open Paddle plan <ChevronRight size={16} /></button></>}
      </section>
      <section className="expedition-phase-panel" aria-labelledby="expedition-phase-title"><div className="phase-panel-heading"><Compass size={20} /><h2 id="expedition-phase-title">The expedition route</h2><span>12 weeks</span></div><div className="expedition-phase-list">{phases.map((item, index) => <button key={item[0]} onClick={() => onPhase(index)} aria-pressed={phase === index} className={phase === index ? "selected" : ""}><span className="phase-step">{index + 1}</span><span><strong>{item[0]}</strong><small>{item[1]}</small></span><ChevronRight size={15} /></button>)}</div><p className="expedition-phase-detail"><strong>{phases[phase][0]}</strong>{phases[phase][2]}.</p><small className="phase-plan-note">Explore the plan. These markers are not completion scores.</small></section>
    </div>
  </div>;
}
