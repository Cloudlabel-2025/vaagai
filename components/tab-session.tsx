"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TAB_STORAGE, tabFetch } from "../lib/tab-client";
import { validTabId } from "../lib/session-policy";
import { RiverAuthLoading } from "./river-auth";

const TabContext = createContext("");
export function useTabId() { return useContext(TabContext); }
export function TabProvider({ children }: { children: React.ReactNode }) {
  const [tabId, setTabId] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let release: (() => void) | undefined;
    async function claim() {
      let id = sessionStorage.getItem(TAB_STORAGE);
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      // Reuse only on refresh. New navigations and restored tabs start a fresh login.
      if (navigation?.type !== "reload") id = null;
      if (!validTabId(id)) id = crypto.randomUUID().replaceAll("-", "");
      // Duplicated tabs can copy sessionStorage. A held lock gives only one tab ownership.
      if (navigator.locks) {
        const acquire = (candidate: string) => navigator.locks.request(`jaguar-tab-${candidate}`, { ifAvailable: true }, async lock => {
          if (!lock) return false;
          if (cancelled) return true;
          sessionStorage.setItem(TAB_STORAGE, candidate);
          setTabId(candidate);
          await new Promise<void>(resolve => { release = resolve; });
          return true;
        });
        if (!await acquire(id) && !cancelled) await acquire(crypto.randomUUID().replaceAll("-", ""));
      } else if (!cancelled) {
        // Fail closed on older browsers: full reloads require another login.
        const fresh = crypto.randomUUID().replaceAll("-", "");
        sessionStorage.setItem(TAB_STORAGE, fresh);
        setTabId(fresh);
      }
    }
    claim().catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; release?.(); };
  }, []);
  if (error) return <main role="alert">Enable browser session storage, then reload to sign in.</main>;
  return <TabContext.Provider value={tabId}>{children}</TabContext.Provider>;
}

export function SessionGate({ children, setup = false }: { children: React.ReactNode; setup?: boolean }) {
  const tabId = useTabId(), pathname = usePathname();
  const [ready, setReady] = useState(false), [error, setError] = useState(false);
  const expiry = useRef(0), activity = useRef(0);
  useEffect(() => {
    if (!tabId) return;
    let cancelled = false, busy = false;
    const returnTo = pathname.startsWith("/admin") ? "/control" : pathname;
    function login() {
      if (cancelled) return;
      setReady(false);
      window.location.replace(`/signin?reason=expired&return_to=${encodeURIComponent(returnTo)}`);
    }
    async function check(touch = false) {
      if (busy || cancelled) return;
      busy = true;
      try {
        const response = await tabFetch("/api/session", { method: touch ? "POST" : "GET" });
        if (cancelled) return;
        if (response.status === 401) { login(); return; }
        if (!response.ok) throw new Error("Session check failed");
        const session = await response.json();
        if (cancelled) return;
        if (session.setup !== setup) {
          window.location.replace(session.setup ? `/change-password?return_to=${encodeURIComponent(returnTo)}` : "/overview");
          return;
        }
        expiry.current = Math.min(session.expires, session.idleExpires);
        setReady(true); setError(false);
      } catch { if (!cancelled) { setReady(false); setError(true); } }
      finally { busy = false; }
    }
    function interacted() { if (document.visibilityState === "visible") activity.current = Date.now(); }
    function visible() { if (document.visibilityState === "visible") void check(); }
    void check();
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const event of events) window.addEventListener(event, interacted, { passive: true });
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("jaguar-session-ended", login);
    let lastTouch = Date.now();
    const timer = setInterval(() => {
      if (expiry.current && Date.now() >= expiry.current) { login(); return; }
      const touch = activity.current > lastTouch;
      if (touch) lastTouch = Date.now();
      void check(touch);
    }, 15000);
    return () => {
      cancelled = true; clearInterval(timer);
      for (const event of events) window.removeEventListener(event, interacted);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("jaguar-session-ended", login);
    };
  }, [tabId, pathname, setup]);
  if (error) return <RiverAuthLoading error title="A pause at the riverbank" detail="We couldn’t verify your session. Check your connection."><button onClick={() => window.location.reload()}>Try again</button></RiverAuthLoading>;
  return ready ? children : <RiverAuthLoading />;
}

