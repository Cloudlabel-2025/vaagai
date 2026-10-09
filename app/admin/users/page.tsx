import { redirect } from "next/navigation";
import Link from "next/link";
import { getWorkspaceUser } from "../../auth";
import { approvedUsers, saveApprovedUser } from "../../../lib/access";
import { revalidatePath } from "next/cache";
import { ArrowLeft, LockKeyhole, UserPlus, Users as UsersIcon, Waves } from "lucide-react";
import MemberList, { RoleOptions, SaveButton } from "./member-list";
import OwnerPasswordForm from "./owner-password-form";
import styles from "./users.module.css";
async function save(form: FormData) {
  "use server";
  const actor = await getWorkspaceUser();
  if (!actor || actor.role !== "owner") throw new Error("Owner access required.");
  try {
    await saveApprovedUser(actor, { email: form.get("email"), name: form.get("name"), role: form.get("role"), active: form.get("active") === "true", temporaryPassword: form.get("temporaryPassword") });
  } catch { redirect("/admin/users?error=1"); }
  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}
export default async function Users({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const actor = await getWorkspaceUser();
  if (!actor) redirect("/signin");
  if (actor.role !== "owner") return <main className={styles.page}><h1>Owner access required</h1><Link href="/">Back to workspace</Link></main>;
  const params = await searchParams, users = await (await approvedUsers()).find().sort({ name: 1 }).toArray();
  return <main className={styles.page}><Link className={styles.back} href="/control"><ArrowLeft size={16}/> Back to workspace</Link>
    <header className={styles.header}><div><span className={styles.eyebrow}><Waves size={18}/> VAAGAI · OWNER SETTINGS</span><h1>Manage access</h1><p>Invite your crew, manage permissions and keep your account secure.</p></div><span className={styles.ownerBadge}>Owner workspace</span></header>
    {params.error && <p className={styles.error} role="alert">Could not save. Check the name, email and temporary password (8–128 characters). You cannot disable or demote your own owner account.</p>}
    {params.saved && <p className={styles.success} role="status">Access updated.</p>}
    <div className={styles.stats}><div><strong>{users.length}</strong><span>Total members</span></div><div><strong>{users.filter(user => user.active).length}</strong><span>Active access</span></div><div><strong>{users.filter(user => user.active && user.mustChangePassword).length}</strong><span>Awaiting password setup</span></div></div>
    <div className={styles.layout}><section className={styles.panel}><div className={styles.panelHeading}><UsersIcon size={21}/><div><h2>Crew access</h2><p>Select a member to edit their permissions.</p></div></div><MemberList actorEmail={actor.email} save={save} users={users.map(({ email, name, role, active, mustChangePassword }) => ({ email, name, role, active, mustChangePassword }))}/></section>
    <aside className={styles.sidePanels}><section className={styles.panel}><div className={styles.panelHeading}><UserPlus size={21}/><div><h2>Invite a member</h2><p>Give someone access to the workspace.</p></div></div><form action={save} className={styles.form}>
      <label>Name<input name="name" placeholder="Full name" required maxLength={100}/></label><label>Email<input name="email" type="email" placeholder="name@gmail.com" required maxLength={254}/></label>
      <label>Role<select name="role"><RoleOptions/></select></label><input type="hidden" name="active" value="true"/>
      <label>Temporary password<input name="temporaryPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/><small>Use 8–128 characters.</small></label>
      <p className={styles.hint}>Share their email, temporary password and website link directly. They’ll set a new password on first login, then use it for future sign-ins.</p><SaveButton>Approve access</SaveButton>
    </form></section><section className={styles.panel}><div className={styles.panelHeading}><LockKeyhole size={21}/><div><h2>Your password</h2><p>Update the password for {actor.email}.</p></div></div><OwnerPasswordForm/></section></aside></div>
  </main>;
}
