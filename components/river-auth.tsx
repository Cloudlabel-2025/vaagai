"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Anchor, Sailboat } from "lucide-react";
import { RiverBrandMark } from "./river-brand-mark";
import styles from "./river-auth.module.css";

/** One river environment for arrival, session checks and departure. */
export function RiverAuth({ children }: { children: ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { void video.current?.play().catch(() => undefined); }, []);
  return <div className={styles.scene}>
    <div className={styles.backdrop} aria-hidden="true">
      <video ref={video} className={styles.river} src="/auth-river.mp4?v=forest-rapids-5720083" poster="/auth-river-poster.jpg?v=forest-rapids-5720083" autoPlay muted loop playsInline preload="auto" tabIndex={-1} />
      <div className={styles.shade} />
    </div>
    <header className={styles.masthead}><div className={styles.brand}><RiverBrandMark /><span>Vaagai<small>THE RIVER SIMULATION</small></span></div><span className={styles.headerNote}><Anchor size={14} /> A shared crossing</span></header>
    <main className={styles.center}>{children}</main>
    <footer className={styles.footer}><span>One river. One crew.</span></footer>
  </div>;
}

export function RiverAuthLoading({ title = "Preparing your crossing", detail = "Checking your session and getting your crew ready.", error = false, children }: { title?: string; detail?: string; error?: boolean; children?: ReactNode }) {
  return <RiverAuth><RiverLoadingCard title={title} detail={detail} error={error}>{children}</RiverLoadingCard></RiverAuth>;
}

export function RiverLoadingCard({ title, detail, error = false, children }: { title: string; detail: string; error?: boolean; children?: ReactNode }) {
  return <section className={styles.statusCard} role={error ? "alert" : "status"} aria-live="polite"><span className={styles.kicker}>{error ? "AT THE RIVERBANK" : "WELCOME ABOARD"}</span><div className={`${styles.boat} ${error ? styles.still : ""}`} aria-hidden="true"><Sailboat size={48} strokeWidth={1.3} /><span /><span /></div><h1>{title}</h1><p>{detail}</p>{!error && <div className={styles.loadingTrack} aria-hidden="true"><span /></div>}{children}</section>;
}
