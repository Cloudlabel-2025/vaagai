"use client";
import { useActionState } from "react";
import { changePassword } from "../signin/actions";
import styles from "../signin/signin.module.css";
export default function PasswordForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(changePassword, { error: "" });
  return <form action={action} className={styles.form}>
    <input type="hidden" name="return_to" value={returnTo}/>
    <label>New password<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></label>
    <label>Confirm new password<input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></label>
    {state.error && <p role="alert" className={styles.notice}>{state.error}</p>}
    <button className={styles.button} disabled={pending}>{pending ? "Saving…" : "Save password and continue"}</button>
  </form>;
}
