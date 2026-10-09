import "server-only";
import { cookies } from "next/headers";
import { deletePasswordSession, passwordCookie } from "./password-auth";
import { sessionCookie } from "./local-auth";
import { getMongoDatabase } from "../db/mongodb.mjs";

export async function setPasswordSession(session: { token: string; lifetime: number }) {
  const jar = await cookies();
  await deletePasswordSession(jar.get(passwordCookie)?.value);
  jar.delete(sessionCookie);
  const googleCookies = jar.getAll().filter(cookie => /^(?:__Secure-)?authjs\.session-token(?:\.|$)/.test(cookie.name));
  if (googleCookies.length) {
    await (await getMongoDatabase()).collection("auth_sessions").deleteMany({ sessionToken: { $in: googleCookies.map(cookie => cookie.value) } });
    for (const cookie of googleCookies) jar.delete(cookie.name);
  }
  jar.set(passwordCookie, session.token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: session.lifetime,
  });
}
