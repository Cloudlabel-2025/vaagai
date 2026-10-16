"use server";
import { cookies } from "next/headers";
import { authenticatePassword, completePasswordSetup } from "../../lib/password-auth";
import { setPasswordSession } from "../../lib/password-cookie";
import { tabCookieName } from "../../lib/session-policy";
import { safeWorkspaceReturn } from "../../lib/workspace-navigation";

export type LoginState = { error: string; destination?: string };
export async function passwordLogin(_previous: LoginState, form: FormData): Promise<LoginState> {
  const tabId = String(form.get("tabId") || "");
  const returnTo = safeWorkspaceReturn(String(form.get("return_to") || ""));
  try {
    tabCookieName(tabId);
    const session = await authenticatePassword(String(form.get("email") || ""), form.get("password"));
    await setPasswordSession(session, tabId);
    return { error: "", destination: session.setup ? `/change-password?return_to=${encodeURIComponent(returnTo)}` : returnTo };
  } catch (error) {
    return { error: error instanceof Error && /^(Invalid email|Too many|Open the sign-in)/.test(error.message) ? error.message : "Sign-in is unavailable. Please try again." };
  }
}
export async function changePassword(_previous: LoginState, form: FormData): Promise<LoginState> {
  try {
    const tabId = String(form.get("tabId") || "");
    const token = (await cookies()).get(tabCookieName(tabId))?.value;
    if (!token) return { error: "Sign in with your temporary password again." };
    const session = await completePasswordSetup(token, String(form.get("password") || ""), String(form.get("confirmation") || ""));
    await setPasswordSession(session, tabId);
    return { error: "", destination: safeWorkspaceReturn(String(form.get("return_to") || "")) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { error: /^(Use a password|The passwords|Choose a password|Sign in with|Your access|Open the sign-in)/.test(message) ? message : "Could not change your password. Please try again." };
  }
}

