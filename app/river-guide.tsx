"use client";
import { useTranslation } from "../components/personal-preferences";

import { useRef } from "react";
import { ArrowUpRight, ChevronDown, Send } from "lucide-react";
import { ExpeditionIcon } from "../components/expedition-icon";
import type { CrewRecord, Identity } from "../lib/jaguar";
import "./river-guide.css";

type Props = {
  user: Identity;
  workstream?: string;
  tasks: CrewRecord[];
  history: CrewRecord[];
  question: string;
  answer: string;
  taskId: string;
  remaining: number | null;
  busy: boolean;
  enabled: boolean;
  onQuestion: (question: string) => void;
  onTask: (taskId: string) => void;
  onAsk: () => void;
  onTasks: () => void;
};

function date(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function RiverGuide({ user, workstream, tasks, history, question, answer, taskId, remaining, busy, enabled, onQuestion, onTask, onAsk, onTasks }: Props) {
    const t = useTranslation();
  const input = useRef<HTMLTextAreaElement>(null);
  const selected = tasks.find(task => task.id === taskId);
  const canAsk = enabled && !busy && remaining !== 0 && question.trim().length >= 3;
  const saved = [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestAnswer = answer ? saved.find(record => record.data.answer === answer) : undefined;
  const earlier = saved.filter(record => record.id !== latestAnswer?.id).slice(0, 10);
  const prompts = [
    { label: "Find my next step", detail: "Break the challenge into actions.", text: selected ? `Help me plan the next step for this task: ${selected.data.title}. What should I check before I start?` : "What should I check before I start my workstream? Give me one practical next step." },
    { label: "Read the current", detail: "Understand a project concept.", text: "Explain the difference between a legal employer and a business unit using our TMS Motors project." },
    { label: "Prepare my evidence", detail: "Know what proves the work.", text: selected ? `What checks and evidence should I prepare for this task: ${selected.data.title}?` : "What evidence should I keep to prove that my assigned task is complete?" },
  ];
  const choosePrompt = (text: string) => { onQuestion(text); input.current?.focus(); };

  return <div className="river-guide">
    <header className="lookout-intro"><span className="lookout-kicker"><ExpeditionIcon destination="guide" size={21} /> {t("RIVER GUIDE")}</span><h1>{t("Read the river.")}<br />{t("Find your next move.")}</h1><p>{t("A little perspective for the crossing.")}<br />{t("Ask, understand, then paddle with purpose.")}</p><span className="lookout-presence"><span aria-hidden="true" className={enabled ? "available" : "paused"} />{enabled ? t("Your project coach at the lookout") : t("The lookout is paused")}</span></header>

    <div className="lookout-layout">
      <section className="lookout-conversation" aria-labelledby="lookout-ask-title">
        <div className="lookout-console">
          <header className="lookout-console-heading"><span className="lookout-guide-emblem"><ExpeditionIcon destination="guide" size={27} /></span><div><h2 id="lookout-ask-title">{t("Ask River Guide")}</h2><p>{t("One question. A clearer next step.")}</p></div><span className="lookout-allowance">{remaining === null ? t("20 questions / IST day") : `${remaining} question${remaining === 1 ? "" : "s"} left today`}</span></header>
          <form onSubmit={event => { event.preventDefault(); if (canAsk) onAsk(); }}>
            <label className="lookout-focus" htmlFor="lookout-task">{t("Focus on a challenge")}<select id="lookout-task" value={taskId} disabled={busy} onChange={event => onTask(event.target.value)}><option value="">{t("Whole expedition / General learning")}</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.data.title} · {t(task.data.status)}</option>)}</select></label>
            <label className="lookout-question-label" htmlFor="lookout-question">{t("What is unclear on your stretch of river?")}</label>
            <textarea ref={input} id="lookout-question" value={question} minLength={3} maxLength={1800} disabled={busy || !enabled} onChange={event => onQuestion(event.target.value)} placeholder={t("Tell me what you are working on, what you tried, and where you got stuck…")} required aria-describedby="lookout-input-note" />
            <footer className="lookout-composer-footer"><span id="lookout-input-note">{question.length.toLocaleString()} {t("/ 1,800 characters")}</span><button type="submit" className="primary" disabled={!canAsk}><Send size={16} />{busy ? t("Reading the current…") : t("Ask River Guide")}</button></footer>
          </form>
          {!enabled && <p className="lookout-notice" role="status">{t("River Guide has been paused by the project lead. Your draft stays here; your crew lead can help.")}</p>}
          {remaining === 0 && <p className="lookout-notice" role="status">{t("Your daily allowance is used. Continue with your mentor; it resets tomorrow in IST.")}</p>}
          <p className="lookout-boundary">{t("Use synthetic training information. Files are not sent to the guide.")}</p>
        </div>

        {busy && <div className="lookout-thinking" role="status"><ExpeditionIcon destination="guide" size={24} /><div><strong>{t("Looking at your stretch of river…")}</strong><p>{t("Gathering the context for a useful next step.")}</p></div><span className="lookout-thinking-pulse" aria-hidden="true" /></div>}
        {answer && !busy && <section className="lookout-response" aria-labelledby="lookout-response-title"><header><ExpeditionIcon destination="guide" size={23} /><div><h3 id="lookout-response-title">{t("A view from River Guide")}</h3><span>{t("Use these notes to plan your next action.")}</span></div></header><div className="lookout-answer">{answer}</div><footer>{t("Your mentor reviews evidence and accepts the work.")}</footer></section>}

        <section className="lookout-starters" aria-labelledby="lookout-starters-title"><h3 id="lookout-starters-title">{t("Choose a starting point")}</h3><div>{prompts.map((prompt, index) => <button type="button" key={t(prompt.label)} disabled={busy || !enabled} onClick={() => choosePrompt(t(prompt.text))}><span className="lookout-prompt-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{t(prompt.label)}</strong><small>{t(prompt.detail)}</small></span><ArrowUpRight size={16} /></button>)}</div></section>

        <section className="lookout-history" aria-labelledby="lookout-history-title"><header><div><span className="lookout-kicker">{t("YOUR FIELD NOTES")}</span><h2 id="lookout-history-title">{t("Guidance to carry forward.")}</h2></div><span>{saved.length} {t("saved question")}{saved.length === 1 ? "" : t("s")}</span></header>{earlier.length ? earlier.map(record => <details key={record.id}><summary><span>{record.data.question}<time dateTime={record.createdAt}>{date(record.createdAt)} {t("IST")}</time></span><ChevronDown size={17} /></summary><div className="lookout-answer">{record.data.answer}</div><button type="button" disabled={busy || !enabled} onClick={() => { onTask(tasks.some(task => task.id === record.data.taskId) ? record.data.taskId : ""); choosePrompt(record.data.question); }}>{t("Revisit this question")} <ArrowUpRight size={14} /></button></details>) : <p className="lookout-history-empty">{latestAnswer ? t("Your latest guidance is above. Earlier questions will be kept here.") : t("Your first question starts the trail. Saved answers will be kept here for your next crossing.")}</p>}</section>
      </section>

      <aside className="lookout-context" aria-label={t("Context for River Guide")}>
        <section className="lookout-rider"><span className="lookout-kicker">{t("ON YOUR STRETCH")}</span><h2>{user.name}</h2><p>{t(workstream || "Your crew workstream")}</p><div><ExpeditionIcon destination={selected ? "tasks" : "overview"} size={22} /><span>{selected ? t("Selected challenge") : t("Whole expedition")}</span></div>{selected ? <><h3>{selected.data.title}</h3><span className="lookout-task-status">{t(selected.data.status)}</span>{selected.data.criteria && <div className="lookout-criteria"><strong>{t("What clears this challenge")}</strong><p>{selected.data.criteria}</p></div>}</> : <p className="lookout-context-note">{t("Choose a challenge to bring its requirements into the conversation, or ask about the project as a whole.")}</p>}<button type="button" onClick={onTasks}>{t("Open Paddle plan")} <ArrowUpRight size={14} /></button></section>
        <section className="lookout-project"><span className="lookout-kicker">{t("THE SHARED DESTINATION")}</span><h3>{t("TMS Motors Group")}</h3><strong>{t("6,000 synthetic workers")}</strong><p>{t("Oracle EBS to Fusion HCM.")}<br />{t("India, UK, Austria and Philippines.")}</p><dl><div><dt>{t("The guide can use")}</dt><dd>{t("Visible tasks, acceptance criteria, RAID entries and mentor feedback.")}</dd></div><div><dt>{t("Your lead still decides")}</dt><dd>{t("Evidence acceptance and project approvals.")}</dd></div></dl></section>
      </aside>
    </div>
  </div>;
}
