"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { updateOwnPassword } from "./actions";
import styles from "./users.module.css";

export default function OwnerPasswordForm() {
  const [state, action, pending] = useActionState(updateOwnPassword, { error: "", success: false });
  const [show, setShow] = useState(false);
  return <form action={action} className={styles.form}>
    <label>Current password<input name="currentPassword" type={show ? "text" : "password"} autoComplete="current-password" required maxLength={128}/></label>
    <label>New password<input name="password" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128}/></label>
    <label>Confirm new password<input name="confirmation" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128}/></label>
    <div className={styles.formFooter}><button type="button" className={styles.secondary} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={16}/> : <Eye size={16}/>} {show ? "Hide passwords" : "Show passwords"}</button><button disabled={pending}>{pending ? "Updating…" : "Change password"}</button></div>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    {state.success && <p className={styles.success} role="status">Password changed. You remain signed in; your other sessions have been signed out.</p>}
  </form>;
}
