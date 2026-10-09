"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "../../auth";
import { authenticatePassword, completePasswordSetup, deletePasswordSession, passwordCookie } from "../../lib/password-auth";
import { sessionCookie } from "../../lib/local-auth";
import { setPasswordSession } from "../../lib/password-cookie";
import { safeWorkspaceReturn } from "../../lib/workspace-navigation";

export type LoginState = { error: string };
export async function passwordLogin(_previous: LoginState, form: FormData): Promise<LoginState> {
  const returnTo = safeWorkspaceReturn(String(form.get("return_to") || ""));
  let session;
  try {
    session = await authenticatePassword(String(form.get("email") || ""), form.get("password"));
    await setPasswordSession(session);
  } catch (error) {
    console.error("Password sign-in failed", { type: error instanceof Error ? error.name : "unknown" });
    return { error: error instanceof Error && /Invalid email|Too many/.test(error.message) ? error.message : "Sign-in is unavailable. Please try again." };
  }
  redirect(session.setup ? `/change-password?return_to=${encodeURIComponent(returnTo)}` : returnTo);
}
export async function changePassword(_previous: LoginState, form: FormData): Promise<LoginState> {
  try {
    const token = (await cookies()).get(passwordCookie)?.value;
    if (!token) return { error: "Sign in with your temporary password again." };
    const session = await completePasswordSetup(token, String(form.get("password") || ""), String(form.get("confirmation") || ""));
    await setPasswordSession(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { error: /^(Use a password|The passwords|Choose a password|Sign in with|Your access)/.test(message) ? message : "Could not change your password. Please try again." };
  }
  redirect(safeWorkspaceReturn(String(form.get("return_to") || "")));
}
export async function googleLogin(_previous: LoginState, form: FormData): Promise<LoginState> {
  if (!process.env.AUTH_SECRET || !process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return { error: "Google sign-in is currently unavailable. Please use your email and password, or contact your Project Lead." };
  }
  const jar = await cookies();
  await deletePasswordSession(jar.get(passwordCookie)?.value);
  jar.delete(passwordCookie);
  jar.delete(sessionCookie);
  try {
    await signIn("google", { redirectTo: safeWorkspaceReturn(String(form.get("return_to") || "")) }, { prompt: "select_account" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/signin?error=SigninFailed");
    throw error;
  }
  return { error: "Could not open Google sign-in. Please try again." };
}

