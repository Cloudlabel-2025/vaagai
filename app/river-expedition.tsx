"use client";

import { useState } from "react";
import { ArrowUpRight, Check, ChevronRight, Heart, Zap } from "lucide-react";
import { energyState, phases, type CrewRecord, type Identity } from "../lib/jaguar";
import { orderRiverChallenges } from "../lib/river-route";
import RiverChallengeMap from "./river-challenge-map";

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

export function RiderVitals({ life, energy }: { life: number; energy: number }) {
  return <><span className="rider-vital"><span className="rider-vital-symbols" aria-hidden="true">{[1, 2, 3].map(attempt => <Heart key={attempt} className={attempt === life ? "life-current" : attempt < life ? "life-used" : "life-ahead"} />)}</span><b>Life {life}/3</b></span><span className="rider-vital"><span className="rider-vital-symbols" aria-hidden="true">{[1, 2, 3].map(charge => <Zap key={charge} className={charge <= energy ? "energy-filled" : "energy-empty"} />)}</span><b>Energy {energy}/3</b></span></>;
}

export function ExpeditionStatus({ user, records }: Pick<Props, "user" | "records">) {
  const state = energyState(records, user.email);
  return <div className="expedition-status" aria-label="Your expedition status">
    <span><b>{user.role === "learner" ? "Boat Rider" : "Expedition lead"}</b></span>
    {user.role === "learner" && <RiderVitals life={state.life} energy={state.energy} />}
    <span className="expedition-status-note">Every accepted task takes the crew forward.</span>
  </div>;
}

export default function RiverExpedition({ user, crew, tasks, evidence, raids, phase, onPhase, onTasks, onEvidence, onReview, onRaid, onGuide }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapView, setMapView] = useState<"map" | "list">("map");
  const accepted = tasks.filter(task => task.data.status === "Accepted").length;
  const progress = tasks.length ? Math.round(accepted / tasks.length * 100) : 0;
  const outstanding = tasks.filter(task => task.data.status !== "Accepted");
  const ordered = orderRiverChallenges(tasks);
  const selected = tasks.find(task => task.id === selectedId) ?? ordered.find(task => task.data.status !== "Accepted") ?? ordered[ordered.length - 1];
  const pending = evidence.filter(record => record.data.status === "Pending review").length;
  const blockers = raids.filter(record => record.data.status !== "Resolved").length;
  const canSubmit = selected && selected.data.status !== "Accepted" && (user.role !== "learner" || selected.data.owner === user.email);
  const name = (email: string) => crew.find(member => member.email === email)?.name || email;
  const deadline = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "No deadline";

  return <div className="expedition-overview">
    <div className="expedition-heading">
      <div><h1 id="expedition-map-title">The river crossing</h1><p>Clear each challenge. Reach the far bank together.</p></div>
      <button className="primary" onClick={onTasks}>View tasks <ArrowUpRight size={15} /></button>
    </div>

    <section className="expedition-map-card" aria-labelledby="expedition-map-title">
      <header className="expedition-map-header"><p>TMS Motors Group · Oracle Fusion HCM</p><div className="expedition-view-switch" role="group" aria-label="Journey display"><button aria-pressed={mapView === "map"} onClick={() => setMapView("map")}>Map</button><button aria-pressed={mapView === "list"} onClick={() => setMapView("list")}>Challenges</button></div></header>
      {mapView === "map" ? <RiverChallengeMap tasks={ordered} selectedId={selected?.id} onSelect={setSelectedId} /> : <div className="expedition-challenge-list">{ordered.length ? ordered.map((task, index) => <button key={task.id} className={selected?.id === task.id ? "selected" : ""} aria-pressed={selected?.id === task.id} onClick={() => setSelectedId(task.id)}><span className="challenge-number">{task.data.status === "Accepted" ? <Check size={17} /> : index + 1}</span><span><strong>{task.data.title}</strong><small>{name(task.data.owner)} · {task.data.status}</small></span><ChevronRight size={16} /></button>) : <p>No challenges assigned yet. Complete your readiness while your lead prepares the route.</p>}</div>}
      <div className="crossing-progress"><div><span><strong>{progress}%</strong> crossing progress</span><small>{accepted} of {tasks.length} assigned tasks accepted</small></div><progress value={progress} max={100} aria-label={`${progress}% of assigned tasks accepted`} /><p>The crew waits above the first uncleared challenge. Acceptance moves the boat forward; crossing progress does not certify go-live.</p></div>
    </section>

    <div className="expedition-metrics" aria-label="Live expedition totals">{[
      { count: outstanding.length, label: "Challenges ahead", action: onTasks },
      { count: accepted, label: "Challenges cleared", action: onTasks },
      { count: pending, label: "Evidence in review", action: onReview },
      { count: blockers, label: "Currents & rocks", action: onRaid },
    ].map(({ count, label, action }) => <button key={label} onClick={action}><span><strong>{count}</strong><small>{label}</small></span><ChevronRight size={16} /></button>)}</div>

    <div className="expedition-detail-grid">
      <section className="challenge-detail" aria-labelledby="challenge-detail-title"><div className="challenge-detail-heading"><div><span>{selected ? "SELECTED RIVER CHALLENGE" : "YOUR NEXT CHALLENGE"}</span><h2 id="challenge-detail-title">{selected?.data.title || "The river is waiting"}</h2></div>{selected && <span className={`challenge-status ${selected.data.status === "Blocked" ? "blocked" : ""}`}>{selected.data.status}</span>}</div>
        {selected ? <><p className="challenge-description">{selected.data.description}</p><div className="challenge-facts"><span><small>Boat rider</small><strong>{name(selected.data.owner)}</strong></span><span><small>Deadline · IST</small><strong>{deadline(selected.data.dueAt)}</strong></span></div><div className="challenge-objective"><div><strong>How to clear this challenge</strong><p>{selected.data.criteria || "Read the task and agree acceptance criteria with your crew lead."}</p></div></div><div className="challenge-actions">{canSubmit && <button className="primary" onClick={() => onEvidence(selected.id)}>Submit evidence <ArrowUpRight size={16} /></button>}<button onClick={() => onGuide(selected.id)}>Ask River Guide</button><button className="challenge-all" onClick={onTasks}>All tasks <ChevronRight size={15} /></button></div></> : <><p>Every task becomes a challenge on this river. Work through it, share your evidence and let mentor acceptance mark the way forward.</p><button onClick={onTasks}>Open Paddle plan <ChevronRight size={16} /></button></>}
      </section>
      <section className="expedition-phase-panel" aria-labelledby="expedition-phase-title"><div className="phase-panel-heading"><h2 id="expedition-phase-title">The expedition route</h2><span>12 weeks</span></div><div className="expedition-phase-list">{phases.map((item, index) => <button key={item[0]} onClick={() => onPhase(index)} aria-pressed={phase === index} className={phase === index ? "selected" : ""}><span className="phase-step">{index + 1}</span><span><strong>{item[0]}</strong><small>{item[1]}</small></span><ChevronRight size={15} /></button>)}</div><p className="expedition-phase-detail"><strong>{phases[phase][0]}</strong>{phases[phase][2]}.</p><small className="phase-plan-note">Explore the plan. These markers are not completion scores.</small></section>
    </div>
  </div>;
}
