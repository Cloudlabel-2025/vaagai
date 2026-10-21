"use client";
import { useTranslation } from "../components/personal-preferences";
import { ExpeditionIcon } from "../components/expedition-icon";
import { useState } from "react";
import { ArrowUpRight, CalendarDays, NotebookPen, Plus, Radio, Video } from "lucide-react";
import type { CrewRecord } from "../lib/jaguar";

type Props = { meetings: CrewRecord[]; lead: boolean; busy: boolean; onCreate: () => void; onOutcomes: (meeting: CrewRecord) => void };
function meetingDate(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST" : "Time not recorded";
}
function MeetingLink({ url, recording = false }: { url?: string; recording?: boolean }) {
    const t = useTranslation();
  if (!url) return null;
  return <a className={recording ? "huddle-recording" : "huddle-join"} href={url} target="_blank" rel="noopener noreferrer">{recording ? <Video size={16} /> : <Radio size={16} />}{recording ? t("Open recording") : t("Join meeting")}<ArrowUpRight size={14} /></a>;
}
export default function CrewHuddles({ meetings, lead, busy, onCreate, onOutcomes }: Props) {
    const t = useTranslation();
  const [filter, setFilter] = useState("All huddles");
  const now = Date.now();
  const upcoming = meetings.filter(meeting => Date.parse(meeting.data.at) >= now);
  const recorded = meetings.filter(meeting => meeting.data.recording);
  const visible = (filter === "Upcoming" ? upcoming : filter === "With recordings" ? recorded : meetings).slice().sort((a, b) => filter === "Upcoming" ? Date.parse(a.data.at) - Date.parse(b.data.at) : Date.parse(b.data.at) - Date.parse(a.data.at));
  return <div className="crew-huddles">
    <header className="huddle-intro"><span className="huddle-kicker"><ExpeditionIcon destination="meetings" size={20} /> {t("CREW HUDDLES")}</span><h1>{t("Regroup by the river.")}<br />{t("Leave with a clear plan.")}</h1><p>{t("Discuss the crossing. Agree who does what.")}<br />{t("Keep the decisions and recordings with the crew.")}</p>{lead && <button className="primary" disabled={busy} onClick={onCreate}><Plus size={16} /> {t("Add meeting")}</button>}</header>
    <div className="huddle-log-heading"><div><span className="huddle-kicker">{t("THE BRIEFING LOG")}</span><h2>{t("Every conversation carries us forward.")}</h2></div><span>{meetings.length} {t("huddle")}{meetings.length === 1 ? "" : t("s")} · {recorded.length} {t("recording")}{recorded.length === 1 ? "" : t("s")}</span></div>
    <div className="huddle-layout"><section className="huddle-journal" aria-label={t("Crew meeting log")}><div className="huddle-filters" role="group" aria-label={t("Filter meetings")}>{["All huddles", "Upcoming", "With recordings"].map(value => <button key={value} className={filter === value ? "selected" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(value)}</button>)}</div>
      {visible.length ? <div className="huddle-entries">{visible.map(meeting => <article key={meeting.id} className="huddle-entry"><header><span className="huddle-entry-icon"><ExpeditionIcon destination="meetings" size={25} /></span><div><span className="huddle-time"><CalendarDays size={14} /><time dateTime={meeting.data.at}>{meetingDate(meeting.data.at)}</time></span><h3>{meeting.data.title}</h3></div></header><details open><summary><NotebookPen size={16} /> {t("Agenda, actions & owners")}</summary><p>{meeting.data.actions || t("No actions recorded yet.")}</p></details><footer><MeetingLink url={meeting.data.link} /><MeetingLink url={meeting.data.recording} recording />{!meeting.data.recording && <span className="huddle-missing">{t("Recording not linked yet")}</span>}{lead && <button disabled={busy} onClick={() => onOutcomes(meeting)}>{t("Add outcomes")} <ArrowUpRight size={14} /></button>}</footer></article>)}</div> : <div className="huddle-empty"><ExpeditionIcon destination="meetings" size={34} /><h3>{meetings.length ? t("No huddles in this view.") : t("The next crossing starts with a conversation.")}</h3><p>{meetings.length ? filter === "Upcoming" ? t("No future meeting times are recorded. Past briefings are in All huddles.") : t("Recordings will appear here when a lead adds their links.") : t("Your lead can schedule the first crew huddle, then save the recording and agreed actions here.")}</p>{meetings.length ? <button onClick={() => setFilter("All huddles")}>{t("View all huddles")}</button> : lead && <button className="primary" disabled={busy} onClick={onCreate}><Plus size={16} /> {t("Add first meeting")}</button>}</div>}
    </section><aside className="huddle-field-notes"><span className="huddle-kicker">{t("BEFORE PADDLING AGAIN")}</span><h2>{t("A shared plan.")}<br />{t("A stronger crew.")}</h2><ol><li><strong>{t("Bring the obstacle")}</strong><p>{t("Discuss progress, blockers and decisions needed for the crossing.")}</p></li><li><strong>{t("Name the next action")}</strong><p>{t("Record the agreed actions, owners and deadlines.")}</p></li><li><strong>{t("Keep the trail")}</strong><p>{t("Circulate actions within 30 minutes and link the meeting recording.")}</p></li></ol><div className="huddle-upcoming"><CalendarDays size={18} /><span><strong>{upcoming.length}</strong> {t("upcoming meeting")}{upcoming.length === 1 ? "" : t("s")}<small>{t("Based on recorded meeting times.")}</small></span></div></aside></div>
    <p className="huddle-link-note"><Video size={15} /> {t("Meeting and recording links open directly. Microsoft Teams integration is outside this beta.")}</p>
  </div>;
}
