import { signOut } from "../../auth";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookie } from "../../lib/local-auth";
import { passwordCookie, deletePasswordSession } from "../../lib/password-auth";
import styles from "../signin/signin.module.css";
export default function SignOut() {
  return <main className={styles.shell}><section className={styles.card}><h1>Sign out of Vaagai?</h1>
    <form action={async () => { "use server"; const jar = await cookies(); await deletePasswordSession(jar.get(passwordCookie)?.value); jar.delete(passwordCookie); jar.delete(sessionCookie);
      if (process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) await signOut({ redirectTo: "/signin" });
      redirect("/signin"); }}>
      <button className={styles.button}>Sign out</button>
    </form><Link href="/">Return to workspace</Link></section></main>;
}
