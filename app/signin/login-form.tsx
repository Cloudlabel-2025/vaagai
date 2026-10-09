"use client";
import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { passwordLogin } from "./actions";
import styles from "./signin.module.css";

export default function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(passwordLogin, { error: "" });
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  return <>
    <form action={action} className={styles.form}>
      <input type="hidden" name="return_to" value={returnTo}/>
      <label>Username / email<div className={styles.inputWrap}><Mail size={18} aria-hidden="true"/><input name="email" type="email" autoComplete="username" placeholder="Your approved email address" required maxLength={254} value={email}
        onChange={event => setEmail(event.target.value)}/></div></label>
      <label>Password<div className={styles.inputWrap}><LockKeyhole size={18} aria-hidden="true"/><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required maxLength={128}/><button type="button" className={styles.reveal} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
      {state.error && <p role="alert" className={styles.notice}>{state.error}</p>}
      <button className={styles.button} disabled={pending}>{pending ? "Signing in…" : <>Sign in<ArrowRight size={18}/></>}</button>
    </form>
    <div className={styles.firstLogin}><LockKeyhole size={18} aria-hidden="true"/><p><strong>First time here?</strong> Use the temporary password provided by your Project Lead. You’ll choose a new password before entering the workspace.</p></div>
  </>;
}
