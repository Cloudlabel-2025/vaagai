import "server-only";
import { cookies } from "next/headers";
import { deletePasswordSession, passwordCookie } from "./password-auth";
import { sessionCookie } from "./local-auth";
import { tabCookieName } from "./session-policy";

export async function setPasswordSession(session: { token: string; lifetime: number }, tabId: string) {
  const jar = await cookies();
  const name = tabCookieName(tabId);
  await deletePasswordSession(jar.get(name)?.value);
  await deletePasswordSession(jar.get(passwordCookie)?.value);
  jar.delete(passwordCookie);
  jar.delete(sessionCookie);
  jar.set(name, session.token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: session.lifetime,
  });
}
