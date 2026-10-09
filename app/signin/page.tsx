import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getWorkspaceUser } from "../auth";
import { passwordCookie, passwordSession } from "../../lib/password-auth";
import LoginForm from "./login-form";
import { safeWorkspaceReturn } from "../../lib/workspace-navigation";
import styles from "./signin.module.css";
import { Check, Waves } from "lucide-react";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string; return_to?: string }> }) {
  const params = await searchParams;
  const returnTo = safeWorkspaceReturn(params.return_to || null);
  const setup = await passwordSession((await cookies()).get(passwordCookie)?.value);
  if (setup?.setup) redirect(`/change-password?return_to=${encodeURIComponent(returnTo)}`);
  if (await getWorkspaceUser()) redirect(returnTo);
  return <main className={styles.shell}><section className={styles.loginCard}>
    <aside className={styles.brandPanel}>
      <div className={styles.brand}><span className={styles.brandIcon}><Waves size={25}/></span><span>VAAGAI<small>JAGUAR CREW</small></span></div>
      <div className={styles.brandContent}><span className={styles.kicker}>YOUR NEXT STEP STARTS HERE</span><h2>Learn together.<br/>Move forward.</h2><p>Your crew, project tasks and learning journey — in one shared workspace.</p>
        <div className={styles.journey} aria-hidden="true"><Waves size={38}/><span/><i/><span/><i/></div>
        <ul><li><Check size={17}/>Keep your project work on track</li><li><Check size={17}/>Share evidence and get mentor feedback</li><li><Check size={17}/>See your progress as you grow</li></ul>
      </div><p className={styles.brandFooter}>One crew. A shared journey.</p>
    </aside>
    <div className={styles.loginPanel}><p className={styles.eyebrow}>WELCOME ABOARD</p><h1>Sign in to your workspace</h1><p className={styles.intro}>Use the email approved by your Project Lead.</p>
    {params.error && <p role="alert" className={styles.notice}>{params.error === "AccessDenied" || params.error === "InvalidGoogleAccount"
      ? "Please use an email ID approved for this website. This account is not in the system or its access is disabled."
      : params.error === "PasswordSetupRequired" ? "Please complete your first login. Sign in with your email and temporary password, then choose a new password."
      : "Sign-in failed. Use your email and password, or contact your Project Lead."}</p>}
    <LoginForm returnTo={returnTo}/>
    <p className={styles.footer}>Vaagai · Jaguar Crew <span>Access by invitation</span></p></div>
  </section></main>;
}

