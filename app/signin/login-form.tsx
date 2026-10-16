"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTabId } from "../../components/tab-session";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { passwordLogin } from "./actions";
import styles from "./signin.module.css";
import { RiverLoadingCard } from "../../components/river-auth";

export default function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(passwordLogin, { error: "" });
  const tabId = useTabId(), router = useRouter();
  useEffect(() => { if (state.destination) router.replace(state.destination); }, [state.destination, router]);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  return <>
    {(pending || state.destination) && <div className={styles.pendingOverlay}><RiverLoadingCard title="Getting you on board" detail="Signing you in and opening your crew’s river map." /></div>}
    <form action={action} className={styles.form} aria-busy={pending}>
      <input type="hidden" name="tabId" value={tabId}/>
      <input type="hidden" name="return_to" value={returnTo}/>
      <label>Username / email<div className={styles.inputWrap}><Mail size={18} aria-hidden="true"/><input name="email" type="email" autoComplete="username" placeholder="Your approved email address" required maxLength={254} value={email}
        onChange={event => setEmail(event.target.value)}/></div></label>
      <label>Password<div className={styles.inputWrap}><LockKeyhole size={18} aria-hidden="true"/><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required maxLength={128}/><button type="button" className={styles.reveal} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
      {state.error && <p role="alert" className={styles.notice}>{state.error}</p>}
      <button className={styles.button} disabled={pending || !tabId}>{pending ? "Signing in…" : <>Sign in<ArrowRight size={18}/></>}</button>
    </form>
    <div className={styles.firstLogin}><LockKeyhole size={18} aria-hidden="true"/><p><strong>First time here?</strong> Use the temporary password provided by your Project Lead. You’ll choose a new password before entering the workspace.</p></div>
    <p className={styles.footer}>Forgot your password? Contact your Project Lead for a temporary password.</p>
    <details className={styles.sessionNote}><summary>About your tab session</summary><p>Sign in separately in each tab. Sessions end after 30 minutes of inactivity or 8 hours.</p></details>
  </>;
}
