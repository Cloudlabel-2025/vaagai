"use server";
import { revalidatePath } from "next/cache";
import { getWorkspaceUser } from "../../auth";
import { changeOwnerPassword } from "../../../lib/password-auth";
import { setPasswordSession } from "../../../lib/password-cookie";
import { approvedUsers, saveApprovedUser } from "../../../lib/access";

export async function updateOwnPassword(_previous: { error: string; success: boolean }, form: FormData) {
  const tabId = String(form.get("tabId") || "");
  const actor = await getWorkspaceUser(tabId);
  if (!actor || actor.role !== "owner") return { error: "Owner access required. Sign in again.", success: false };
  try {
    const session = await changeOwnerPassword(actor, String(form.get("currentPassword") || ""), String(form.get("password") || ""), String(form.get("confirmation") || ""));
    await setPasswordSession(session, tabId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { error: message === "Invalid email or password." ? "Your current password is incorrect." : /^(Use a password|The passwords|Choose a password|Your access|Too many|Owner access)/.test(message) ? message : "Could not change your password. Please try again.", success: false };
  }
  revalidatePath("/admin/users");
  return { error: "", success: true };
}

export async function loadAccess(tabId: string) {
  const actor = await getWorkspaceUser(tabId);
  if (!actor) throw new Error("Sign in again.");
  if (actor.role !== "owner") return { allowed: false as const };
  const users = await (await approvedUsers()).find().sort({ name: 1 }).toArray();
  return { allowed: true as const, actor, users: users.map(({ email, name, role, active, mustChangePassword }) => ({ email, name, role, active, mustChangePassword })) };
}

export async function saveAccess(form: FormData) {
  const actor = await getWorkspaceUser(String(form.get("tabId") || ""));
  if (!actor || actor.role !== "owner") return { error: "Owner access required. Sign in again." };
  try {
    await saveApprovedUser(actor, { email: form.get("email"), name: form.get("name"), role: form.get("role"), active: form.get("active") === "true", temporaryPassword: form.get("temporaryPassword") });
    revalidatePath("/admin/users");
    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error && /^(Only the owner|Provide|Enter a valid|You cannot|Give the new|Use a password)/.test(error.message) ? error.message : "Could not save access. Please try again." };
  }
}

