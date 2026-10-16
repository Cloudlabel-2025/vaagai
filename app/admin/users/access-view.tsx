import Link from "next/link";
import { Anchor, ArrowLeft, ChevronDown, KeyRound, ShipWheel } from "lucide-react";
import { RiverBrandMark } from "../../../components/river-brand-mark";
import type { Identity } from "../../../lib/jaguar";
import MemberList, { RoleOptions, SaveButton, type Member } from "./member-list";
import OwnerPasswordForm from "./owner-password-form";
import styles from "./users.module.css";

type Props = { actor: Identity; users: Member[]; save: (form: FormData) => Promise<void>; error?: boolean; saved?: boolean };

export default function AccessView({ actor, users, save, error, saved }: Props) {
  return <div className={styles.shell}><main className={styles.page}>
    <div className={styles.masthead}><Link href="/overview" className={styles.brand} aria-label="Vaagai River Map"><RiverBrandMark /><span><strong>Vaagai</strong><small>The river simulation</small></span></Link><Link className={styles.back} href="/control"><ArrowLeft size={16} /> Back to crew control</Link></div>
    <header className={styles.header}><div><span className={styles.eyebrow}><Anchor size={18} /> THE BOARDING DESK</span><h1>Manage access</h1><p>Every crossing starts with the right crew.<br />Approve who boards and keep their access clear.</p></div><span className={styles.ownerBadge}><ShipWheel size={18} /><span>Project Lead<small>Owner controls</small></span></span></header>
    {error && <p className={styles.error} role="alert">Could not save. Check the name, email and temporary password (8–128 characters). You cannot disable or demote your own owner account.</p>}
    {saved && <p className={styles.success} role="status">Crew access updated.</p>}
    <section className={styles.stats} aria-label="Current crew access"><div><strong>{users.length}</strong><span>On the manifest</span><small>Total approved members</small></div><div><strong>{users.filter(user => user.active).length}</strong><span>Active access</span><small>Members allowed to sign in</small></div><div><strong>{users.filter(user => user.active && user.mustChangePassword).length}</strong><span>Setup to finish</span><small>First password change required</small></div></section>
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="access-manifest-title"><div className={styles.panelHeading}><span className={styles.sectionMark}><Anchor size={24} /></span><div><span className={styles.sectionLabel}>THE CREW MANIFEST</span><h2 id="access-manifest-title">Who is on board?</h2><p>Search the crew, then open a member to manage their role and access.</p></div></div><MemberList actorEmail={actor.email} save={save} users={users} /></section>
      <aside className={styles.sidePanels}>
        <section className={`${styles.panel} ${styles.invitePanel}`} aria-labelledby="access-invite-title"><div className={styles.panelHeading}><span className={styles.sectionMark}><ShipWheel size={24} /></span><div><span className={styles.sectionLabel}>WELCOME ABOARD</span><h2 id="access-invite-title">Approve a crew member</h2><p>Choose their role before they join the crossing.</p></div></div><form action={save} className={styles.form}>
          <label>Name<input name="name" placeholder="Full name" required maxLength={100} autoComplete="name" /></label>
          <label>Email<input name="email" type="email" placeholder="name@example.com" required maxLength={254} autoComplete="email" /></label>
          <label>Role<select name="role"><RoleOptions /></select></label><input type="hidden" name="active" value="true" />
          <label>Temporary password<input name="temporaryPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /><small>Use 8–128 characters.</small></label>
          <p className={styles.hint}>Share their email, temporary password and website link directly. They will set a new password on first login.</p><SaveButton>Approve access</SaveButton>
        </form></section>
        <details className={`${styles.panel} ${styles.passwordPanel}`}><summary><KeyRound size={22} /><span><strong>Your password</strong><small>Keep your owner account secure</small></span><ChevronDown size={18} /></summary><div className={styles.passwordContent}><p>Update the password for <strong>{actor.email}</strong>.</p><OwnerPasswordForm /></div></details>
      </aside>
    </div>
    <footer className={styles.pageFooter}><span>Vaagai · Crew boarding desk</span><span>Roles, access and first sign-in</span></footer>
  </main></div>;
}
