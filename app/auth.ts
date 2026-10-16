import "server-only";
import { cookies, headers } from "next/headers";
import { approvedIdentity } from "../lib/access";
import { developmentMember, sessionCookie } from "../lib/local-auth";
import { passwordSession } from "../lib/password-auth";
import { TAB_HEADER, tabCookieName, validTabId } from "../lib/session-policy";

export async function getWorkspaceUser(tabId?: string) {
  const jar = await cookies();
  const tab = tabId ?? (await headers()).get(TAB_HEADER);
  if (validTabId(tab)) {
    const session = await passwordSession(jar.get(tabCookieName(tab))?.value);
    if (session && !session.setup && !session.user.mustChangePassword) {
      const { email, name, role } = session.user;
      return { email, name, role };
    }
    return null;
  }
  // Explicit local testing only. Shared password and OAuth cookies never grant access.
  const local = developmentMember(jar.get(sessionCookie)?.value);
  return local ? approvedIdentity(local.email) : null;
}
