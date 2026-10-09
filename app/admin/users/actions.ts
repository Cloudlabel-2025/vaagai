"use server";
import { revalidatePath } from "next/cache";
import { getWorkspaceUser } from "../../auth";
import { changeOwnerPassword } from "../../../lib/password-auth";
import { setPasswordSession } from "../../../lib/password-cookie";

export async function updateOwnPassword(_previous: { error: string; success: boolean }, form: FormData) {
  const actor = await getWorkspaceUser();
  if (!actor || actor.role !== "owner") return { error: "Owner access required. Sign in again.", success: false };
  try {
    const session = await changeOwnerPassword(actor, String(form.get("currentPassword") || ""), String(form.get("password") || ""), String(form.get("confirmation") || ""));
    await setPasswordSession(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { error: message === "Invalid email or password." ? "Your current password is incorrect." : /^(Use a password|The passwords|Choose a password|Your access|Too many|Owner access)/.test(message) ? message : "Could not change your password. Please try again.", success: false };
  }
  revalidatePath("/admin/users");
  return { error: "", success: true };
}

