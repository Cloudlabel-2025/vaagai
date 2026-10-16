"use client";
import { useState } from "react";
import Link from "next/link";
import { useTabId } from "../../components/tab-session";
import { tabFetch, TAB_STORAGE } from "../../lib/tab-client";
import styles from "../signin/signin.module.css";
import { RiverAuth, RiverLoadingCard } from "../../components/river-auth";
import { Anchor, ArrowLeft, LogOut } from "lucide-react";
export default function SignOut() {
  const tabId = useTabId();
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  async function logout(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const response = await tabFetch("/api/session", { method: "DELETE" });
      if (!response.ok) throw new Error();
      sessionStorage.removeItem(TAB_STORAGE);
      window.location.replace("/signin?reason=signedout");
    } catch { setError("Could not sign out. Check your connection and try again."); setPending(false); }
  }
  return <RiverAuth>{pending ? <RiverLoadingCard title="Returning to the riverbank" detail="Signing out of this tab. Your other sessions will stay open." /> : <section className={`${styles.card} ${styles.departure}`}><span className={styles.departureIcon}><Anchor size={29} strokeWidth={1.5} /></span><p className={styles.eyebrow}>BACK TO THE RIVERBANK</p><h1>Step ashore?</h1><p>Sign out of this tab when you’re ready.<br />Your crew’s journey will be here when you return.</p><div className={styles.tabNotice}><LogOut size={16} /><span>Your other signed-in tabs will stay open.</span></div>
    <form onSubmit={logout}><button className={styles.button} disabled={!tabId}>Sign out of this tab<LogOut size={17} /></button></form>
    {error && <p role="alert" className={styles.notice}>{error}</p>}<Link className={styles.returnLink} href="/overview"><ArrowLeft size={15} /> Stay with the crew</Link>
  </section>}</RiverAuth>;
}
