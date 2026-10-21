"use client";
import { useTranslation } from "../components/personal-preferences";
import { ExpeditionIcon } from "../components/expedition-icon";

import { ArrowUpRight, Check, CheckCircle2, ChevronDown, Compass, Flag, Sailboat, Users } from "lucide-react";
import { fundamentals, type CrewRecord, type Identity } from "../lib/jaguar";
import type { WorkspaceView } from "../lib/workspace-navigation";

type Props = {
  ready: boolean;
  confirmed: boolean;
  busy: boolean;
  lead: boolean;
  crew: { name: string; email: string; role: Identity["role"]; area: string }[];
  records: CrewRecord[];
  onChecked: (checked: boolean) => void;
  onConfirm: () => void;
  onNavigate: (view: WorkspaceView) => void;
};

const preparation = [
  "Explain how an employee moves through the lifecycle and how ERP connects the work across teams.",
  "Discuss what changes when moving from Oracle EBS to Fusion Cloud and what needs to be checked.",
  "Explain what belongs in development, test and production, and why the environments stay separate.",
  "Describe how a training copy is prepared and why employee data must be masked.",
  "Walk through the implementation phases and explain the checks before moving to the next stage.",
  "Explain the connections between legal employers, business units, departments, jobs and positions.",
  "Discuss who can see or change information, how approvals work and why access matters.",
  "Explain how you prepare an HDL load, investigate rejected records and reconcile the results.",
  "Describe the evidence and tests needed to demonstrate that acceptance criteria have been met.",
  "Explain how you identify dependencies, raise blockers and communicate decisions with the crew.",
];
const workflow = [
  { title: "Read the current", text: "Open your task and read its acceptance criteria.", destination: "tasks" },
  { title: "Keep the crew connected", text: "Use Crew Community for discussion. Record risks, blockers and decisions in Currents & Rocks.", destination: "community" },
  { title: "Leave a trail of evidence", text: "Submit an accessible file or link, explain your checks and state the next hand-off.", destination: "evidence" },
  { title: "Learn, adjust, paddle again", text: "Read mentor feedback. Resubmit as a new version if rework is requested.", destination: "evidence" },
  { title: "Close the day's log", text: "Update your Jira task at 17:30 IST on working days. The bell carries your reminders.", destination: "tasks" },
] as const;

export default function DepartureCamp({ ready, confirmed, busy, lead, crew, records, onChecked, onConfirm, onNavigate }: Props) {
    const t = useTranslation();
  const riders = crew.filter(member => member.role === "learner");
  const isReady = (email: string) => records.some(record => record.kind === "readiness" && record.author === email);
  return <div className="departure-camp">
    <header className="camp-intro"><span className="camp-kicker"><ExpeditionIcon destination="onboarding" size={20} /> {t("BEFORE YOU BOARD")}</span><h1>{t("A strong crossing")}<br />{t("starts on the bank.")}</h1><p>{t("Gather your fundamentals. Learn the rhythm.")}<br />{t("Get ready to paddle with your crew.")}</p><span className={`camp-readiness-tag ${ready ? "complete" : ""}`}>{ready ? <CheckCircle2 size={16} /> : <ExpeditionIcon destination="onboarding" size={18} />}{ready ? t("Readiness confirmed") : t("Preparation in progress")}</span></header>
    <div className="camp-location"><Sailboat size={17} /><span>{t("Departure camp")} <small>{t("Jaguar Crew · The starting bank")}</small></span></div>
    <div className="camp-layout">
      <section className="camp-foundations" aria-labelledby="camp-foundations-title"><header className="camp-section-head"><span className="camp-emblem"><ExpeditionIcon destination="onboarding" size={24} /></span><div><h2 id="camp-foundations-title">{t("Pack your foundations")}</h2><p>{t("Ten fundamentals to discuss, practise and explain.")}</p></div><span className="camp-count">{t("10 topics")}</span></header><div className="camp-topic-list">{fundamentals.map((topic, index) => <details className="camp-topic" key={t(topic)}><summary><span className={`camp-topic-number ${ready ? "confirmed" : ""}`}>{ready ? <Check size={16} /> : String(index + 1).padStart(2, "0")}</span><strong>{t(topic)}</strong><ChevronDown size={17} /></summary><div className="camp-topic-content"><span>{t("DISCUSS AT CAMP")}</span><p>{t(preparation[index])}</p><small>{t("Use this prompt during your checking days. Opening a topic does not record completion.")}</small></div></details>)}</div><div className="camp-foundation-note"><Users size={16} /><p>{t("Complete the ten checking days with the team. Your single confirmation below records readiness; individual dates and uploads are not required.")}</p></div></section>
      <aside className="camp-side">
        <section className="camp-confirmation" aria-labelledby="camp-confirmation-title"><span className="camp-emblem"><Flag size={23} /></span><h2 id="camp-confirmation-title">{ready ? t("You're ready to board.") : t("Ready to board?")}</h2>{ready ? <><div className="camp-confirmed"><CheckCircle2 size={22} /><div><strong>{t("Your ten checking days are confirmed.")}</strong><p>{t("This confirmation is saved for your crew lead.")}</p></div></div><button className="primary" onClick={() => onNavigate("overview")}>{t("Open River Map")} <ArrowUpRight size={17} /></button></> : <><p>{t("Confirm once you have completed all ten checking days and can explain the fundamentals.")}</p><label className="camp-checkbox"><input type="checkbox" checked={confirmed} onChange={event => onChecked(event.target.checked)} disabled={busy} /><span>{t("I have completed the ten checking days and can explain these fundamentals.")}</span></label><button className="primary" disabled={!confirmed || busy} onClick={onConfirm}>{busy ? t("Saving confirmation…") : t("Confirm completion")}<ArrowUpRight size={17} /></button><small className="camp-save-note">{t("Your readiness confirmation is saved for your crew lead.")}</small></>}</section>
        <section className="camp-departure-note"><ExpeditionIcon destination="tasks" size={24} /><h3>{t("Preparation is your first paddle.")}</h3><p>{t("Read the brief, ask questions and make sure you can explain your checks before tackling a river challenge.")}</p><button onClick={() => onNavigate("project")}>{t("Explore our destination")} <ArrowUpRight size={15} /></button></section>
        {lead && <section className="camp-crew" aria-labelledby="camp-crew-title"><header><Users size={18} /><h2 id="camp-crew-title">{t("Crew readiness")}</h2><span>{riders.filter(member => isReady(member.email)).length}/{riders.length}</span></header>{riders.length ? riders.map(member => <div className="camp-crew-member" key={member.email}><span className="camp-avatar">{member.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</span><strong>{member.name}</strong><span className={isReady(member.email) ? "confirmed" : ""}>{isReady(member.email) ? t("Completed") : t("Not confirmed")}</span></div>) : <p>{t("No boat riders are listed yet.")}</p>}</section>}
      </aside>
    </div>
    <section className="camp-field-guide" aria-labelledby="camp-guide-title"><header><Compass size={23} /><div><h2 id="camp-guide-title">{t("The crew's field guide")}</h2><p>{t("Five habits to carry onto the river.")}</p></div></header><ol>{workflow.map(({ title, text, destination }, index) => <li key={title}><span className="camp-guide-step">{index + 1}</span><ExpeditionIcon destination={destination} size={23} /><div><h3>{t(title)}</h3><p>{text}</p></div><button aria-label={`Open ${destination} to ${title.toLowerCase()}`} onClick={() => onNavigate(destination)}><ArrowUpRight size={17} /></button></li>)}</ol><p className="camp-guide-note" lang="en">{t("First, read your assigned task and its acceptance criteria. If you encounter a blocker, record it before the deadline. Submit evidence for completed work, then review the feedback from your mentor and make any needed revisions.")}</p></section>
  </div>;
}
