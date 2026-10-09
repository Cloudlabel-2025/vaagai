import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { passwordCookie, passwordSession } from "../../lib/password-auth";
import { safeWorkspaceReturn } from "../../lib/workspace-navigation";
import PasswordForm from "./password-form";
import styles from "../signin/signin.module.css";
export default async function ChangePassword({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeWorkspaceReturn((await searchParams).return_to || null);
  const session = await passwordSession((await cookies()).get(passwordCookie)?.value);
  if (!session) redirect("/signin");
  if (!session.setup || !session.user.mustChangePassword) redirect(returnTo);
  return <main className={styles.shell}><section className={styles.card}>
    <p className={styles.eyebrow}>WELCOME · {session.user.name}</p><h1>Choose your password</h1>
    <p>Replace your temporary password to enter the workspace. Use 8–128 characters. Use your new password for future sign-ins.</p>
    <PasswordForm returnTo={returnTo}/><Link href="/signout">Sign out</Link>
  </section></main>;
}
