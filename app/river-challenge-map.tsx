"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Sailboat } from "lucide-react";
import type { CrewRecord } from "../lib/jaguar";
import { riverRoute } from "../lib/river-route";
import "./river-challenge-map.css";

type Props = { tasks: CrewRecord[]; selectedId?: string; onSelect: (id: string) => void };
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function RiverChallengeMap({ tasks, selectedId, onSelect }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const previousStop = useRef<string | null>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const route = riverRoute(tasks);
  const current = tasks[route.currentIndex];
  const stop = current?.id ?? (route.arrived ? "destination" : "departure");
  const boatX = route.boatPoint.x;

  const centerAt = useCallback((x: number, animate = true) => {
    const element = viewport.current;
    if (element) element.scrollTo({ left: x - element.clientWidth / 2, behavior: animate && !reducedMotion() ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const updateEdges = () => setEdges({ start: element.scrollLeft < 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", updateEdges, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", updateEdges); };
  }, []);

  useEffect(() => {
    centerAt(boatX, previousStop.current !== null);
    previousStop.current = stop;
  }, [boatX, stop, centerAt]);

  const pan = (direction: number) => {
    const element = viewport.current;
    if (element) element.scrollBy({ left: direction * Math.max(240, element.clientWidth * .65), behavior: reducedMotion() ? "instant" : "smooth" });
  };

  return <div className="river-route-map">
    <div className="river-route-frame">
      <div className="river-route-toolbar">
        <div><strong>{route.arrived ? "The far bank is yours" : "Bank to bank"}</strong><span>{tasks.length ? route.arrived ? "Every challenge cleared" : `Challenge ${route.currentIndex + 1} of ${tasks.length} · Current stop` : "Waiting for your first challenge"}</span></div>
        <button type="button" disabled={!tasks.length} onClick={() => centerAt(boatX)}>Find crew</button>
      </div>
      <div ref={viewport} id="river-route-viewport" className="river-route-viewport" role="region" aria-label="River challenge route. Scroll sideways to explore all challenges." tabIndex={0} onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); pan(event.key === "ArrowLeft" ? -1 : 1); }
        if (event.key === "Home" || event.key === "End") { event.preventDefault(); centerAt(event.key === "Home" ? 0 : route.width); }
      }}>
        <div className="river-route-world" style={{ width: route.width }}>
          <div className="river-route-bank river-route-departure" style={{ left: route.points[0].x, top: route.points[0].y }}><span className="river-bank-reference" aria-hidden="true" /><strong>Departure</strong><small>Near bank</small></div>
          <div className={`river-route-bank river-route-destination ${route.arrived ? "arrived" : ""}`} style={{ left: route.points.at(-1)?.x, top: route.points.at(-1)?.y }}><span className="river-bank-reference" aria-hidden="true" /><strong>Destination</strong><small>{route.arrived ? "Crossing complete" : "Far bank"}</small></div>
          {tasks.map((task, index) => {
            const cleared = task.data.status === "Accepted", active = index === route.currentIndex, blocked = task.data.status === "Blocked";
            return <button type="button" key={task.id} className={`river-route-stop ${cleared ? "cleared" : ""} ${active ? "current" : ""} ${blocked ? "blocked" : ""} ${selectedId === task.id ? "selected" : ""}`} style={{ left: route.challenges[index].x, top: route.challenges[index].y }} aria-label={`Challenge ${index + 1}: ${task.data.title}. ${cleared ? "Cleared" : active ? `Current challenge, ${task.data.status}` : task.data.status}`} aria-current={active ? "step" : undefined} aria-pressed={selectedId === task.id} onFocus={event => { if (event.currentTarget.matches(":focus-visible")) centerAt(route.challenges[index].x); }} onClick={() => { onSelect(task.id); centerAt(route.challenges[index].x); }}>
              <span className="river-route-landmark" aria-hidden="true"><span className="river-route-marker">{cleared ? <Check size={25} strokeWidth={2.5} /> : <b>{String(index + 1).padStart(2, "0")}</b>}</span></span>
              <span className="river-route-stop-label"><strong>Challenge {index + 1}</strong><span className="river-route-task-title">{task.data.title}</span><small>{cleared ? "Cleared" : blocked ? "Blocked" : active ? "Current challenge" : "Upcoming"}</small></span>
            </button>;
          })}
          {tasks.length > 0 && <div className="river-route-boat-anchor" style={{ offsetPath: `path('${route.path}')`, offsetDistance: `${route.boatDistance}%` }} aria-hidden="true"><div className="river-route-boat"><span className="river-route-crew-label">{route.arrived ? "Crossing complete" : "Your crew"}</span><div className="river-route-vessel"><Sailboat size={35} strokeWidth={1.7} /></div><span className="river-route-wake" /></div></div>}
        </div>
      </div>
      {!tasks.length && <div className="river-route-empty"><strong>Your journey is taking shape.</strong><span>Assigned tasks will become challenges across this river.</span></div>}
      <button type="button" className="river-route-arrow previous" aria-label="Scroll to earlier challenges" aria-controls="river-route-viewport" disabled={edges.start} onClick={() => pan(-1)}><ChevronLeft size={24} /></button>
      <button type="button" className="river-route-arrow next" aria-label="Scroll to later challenges" aria-controls="river-route-viewport" disabled={edges.end} onClick={() => pan(1)}><ChevronRight size={24} /></button>
    </div>
    <div className="river-route-footer"><span>Select a landmark to explore its challenge</span><span>Use the arrows or swipe to explore</span></div>
    <p className="sr-only" role="status">{tasks.length ? route.arrived ? "All challenges accepted. Your crew has reached the destination bank." : `Your crew is above Challenge ${route.currentIndex + 1}: ${current?.data.title}.` : "No challenges assigned yet."}</p>
  </div>;
}
