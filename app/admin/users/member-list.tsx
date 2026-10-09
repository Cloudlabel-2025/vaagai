"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import styles from "./users.module.css";
type Member = { email: string; name: string; role: string; active: boolean; mustChangePassword: boolean };
export function RoleOptions() { return <><option value="learner">Learner</option><option value="cohort_leader">Cohort leader</option><option value="owner">Owner</option></>; }
export function SaveButton({ children }: { children: React.ReactNode }) { const { pending } = useFormStatus(); return <button disabled={pending}>{pending ? "Saving…" : children}</button>; }
export default function MemberList({ users, actorEmail, save }: { users: Member[]; actorEmail: string; save: (form: FormData) => Promise<void> }) {
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const visible = users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase().trim()) && (filter === "all" || (filter === "active" ? user.active : filter === "disabled" ? !user.active : user.mustChangePassword)));
  return <>
    <div className={styles.toolbar}><label className={styles.search}><Search size={18} aria-hidden="true"/><input aria-label="Search members by name or email" placeholder="Search name or email" value={query} onChange={event => setQuery(event.target.value)}/></label><select aria-label="Filter members" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All members</option><option value="active">Active access</option><option value="disabled">Disabled access</option><option value="setup">Password setup required</option></select></div>
    <p className={styles.resultCount} role="status">{visible.length} of {users.length} members</p>
    <div className={styles.memberList}>{visible.map(user => <details className={styles.member} key={user.email}>
      <summary><span className={styles.avatar} aria-hidden="true">{user.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</span><span className={styles.identity}><strong>{user.name}{user.email === actorEmail && <small> · You</small>}</strong><span>{user.email}</span></span><span className={styles.role}>{user.role === "owner" ? "Owner" : user.role === "cohort_leader" ? "Cohort leader" : "Learner"}</span><span className={user.active ? styles.active : styles.disabled}>{user.active ? "Active" : "Disabled"}</span><ChevronDown className={styles.chevron} size={18} aria-hidden="true"/></summary>
      <form action={save} className={styles.form}>
        <input type="hidden" name="email" value={user.email}/>
        <label>Name<input name="name" defaultValue={user.name} required maxLength={100}/></label>
        <label>Role<select name="role" defaultValue={user.role}><RoleOptions/></select></label>
        <label>Access<select name="active" defaultValue={String(user.active)}><option value="true">Active</option><option value="false">Disabled</option></select></label>
        {user.email !== actorEmail && <label className={styles.fullWidth}>Reset temporary password <span className={styles.optional}>Optional · 8–128 characters</span><input name="temporaryPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128}/><small>Resets sign out this member and require a new password before signing in.</small></label>}
        <div className={styles.formFooter}><p className={styles.hint}>{user.mustChangePassword ? "Password setup required" : "Password set · Ready to sign in"}</p><SaveButton>Save changes</SaveButton></div>
      </form>
    </details>)}</div>
    {!visible.length && <p className={styles.empty}>No members match your search.</p>}
  </>;
}
