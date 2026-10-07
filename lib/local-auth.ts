import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { crew } from "./jaguar";

export const sessionCookie = "jaguar-development-session";
const state = globalThis as typeof globalThis & { jaguarSessionSecret?: string };
function secret() {
  return state.jaguarSessionSecret ??= randomBytes(32).toString("hex");
}
export function developmentAuthEnabled() { return process.env.NODE_ENV === "development"; }
export function createDevelopmentSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, expires: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function developmentMember(token?: string) {
  if (!developmentAuthEnabled() || !token) return null;
  try {
    const [payload, signature] = token.split(".");
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof session.expires !== "number" || session.expires <= Date.now()) return null;
    return crew.find(member => member.email === session.email) ?? null;
  } catch { return null; }
}
