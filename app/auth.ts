import "server-only";
import { cookies } from "next/headers";
import { approvedIdentity } from "../lib/access";
import { developmentMember, sessionCookie } from "../lib/local-auth";
import { passwordCookie, passwordSession } from "../lib/password-auth";

export async function getWorkspaceUser() {
  const local = developmentMember((await cookies()).get(sessionCookie)?.value);
  if (local) return approvedIdentity(local.email);
  const password = await passwordSession((await cookies()).get(passwordCookie)?.value);
  if (password && !password.setup && !password.user.mustChangePassword) {
    const { email, name, role } = password.user;
    return { email, name, role };
  }
  if (!process.env.AUTH_SECRET || !process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) return null;
  const { auth } = await import("../auth");
  const session = await auth();
  if (!session?.user?.email) return null;
  const { approvedUsers } = await import("../lib/access");
  const user = await (await approvedUsers()).findOne({ _id: session.user.email.trim().toLowerCase(), active: true, mustChangePassword: false });
  return user ? { email: user.email, name: user.name, role: user.role } : null;
}
