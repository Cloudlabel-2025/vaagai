import LoginForm from "./login-form";
import { safeWorkspaceReturn } from "../../lib/workspace-navigation";
import styles from "./signin.module.css";
import { RiverAuth } from "../../components/river-auth";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string; reason?: string; return_to?: string }> }) {
  const params = await searchParams;
  const returnTo = safeWorkspaceReturn(params.return_to || null);
  return <RiverAuth>
    <section className={styles.loginPanel}><p className={styles.eyebrow}>WELCOME ABOARD</p><h1>Join the crossing.</h1><p className={styles.intro}>Sign in with the email approved by your Project Lead.</p>
    {params.error && <p role="alert" className={styles.notice}>{params.error === "AccessDenied" || params.error === "InvalidGoogleAccount"
      ? "Please use an email ID approved for this website. This account is not in the system or its access is disabled."
      : params.error === "PasswordSetupRequired" ? "Please complete your first login. Sign in with your email and temporary password, then choose a new password."
      : "Sign-in failed. Use your email and password, or contact your Project Lead."}</p>}
    {params.reason === "expired" && <p role="status" className={styles.notice}>Please sign in to continue in this tab. Your previous session may have ended.</p>}
    {params.reason === "signedout" && <p role="status" className={styles.notice}>You have signed out of this tab.</p>}
    <LoginForm returnTo={returnTo}/>
    <p className={styles.footer}>JAGUAR CREW <span>Access by invitation</span></p></section>
  </RiverAuth>;
}

