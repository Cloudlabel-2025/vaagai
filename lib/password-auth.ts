import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getMongoDatabase } from "../db/mongodb.mjs";
import { approvedUsers, revokeUserSessions, type ApprovedUser } from "./access";
import { hashPassword, initialPasswordHash, verifyPassword } from "./passwords";
import type { Identity } from "./jaguar";

export const passwordCookie = "jaguar-password-session";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
type PasswordSession = { _id: string; email: string; passwordVersion: number; setup: boolean; expires: Date };
export async function passwordSession(token?: string): Promise<{ user: ApprovedUser; setup: boolean } | null> {
  if (!token || token.length !== 64) return null;
  const db = await getMongoDatabase();
  const session = await db.collection<PasswordSession>("password_sessions").findOne({ _id: tokenHash(token), expires: { $gt: new Date() } });
  if (!session) return null;
  const user = await (await approvedUsers()).findOne({ _id: session.email, active: true, passwordVersion: session.passwordVersion });
  return user ? { user, setup: session.setup } : null;
}
export async function newPasswordSession(user: ApprovedUser, setup = user.mustChangePassword) {
  const token = randomBytes(32).toString("hex"), lifetime = setup ? 15 * 60 : 8 * 60 * 60;
  await (await getMongoDatabase()).collection<PasswordSession>("password_sessions").insertOne({
    _id: tokenHash(token), email: user.email, passwordVersion: user.passwordVersion, setup,
    expires: new Date(Date.now() + lifetime * 1000),
  });
  return { token, lifetime, setup };
}
async function authenticatePasswordUser(email: string, password: unknown) {
  email = email.trim().toLowerCase();
  if (!email || email.length > 254) throw new Error("Invalid email or password.");
  const db = await getMongoDatabase();
  // Shared across instances; reserve attempts atomically before doing expensive password work.
  const window = Math.floor(Date.now() / (15 * 60 * 1000));
  const key = `${tokenHash(email)}:${window}`;
  const attempts = db.collection<{ _id: string; count: number; expires: Date }>("password_attempts");
  await attempts.updateOne({ _id: key }, { $setOnInsert: { count: 0, expires: new Date(Date.now() + 30 * 60 * 1000) } }, { upsert: true });
  const allowed = await attempts.updateOne({ _id: key, count: { $lt: 10 } }, { $inc: { count: 1 } });
  if (!allowed.modifiedCount) throw new Error("Too many attempts. Try again in 15 minutes.");
  const user = await (await approvedUsers()).findOne({ _id: email, active: true });
  const valid = await verifyPassword(password, user?.passwordHash || initialPasswordHash);
  if (!user || !valid) throw new Error("Invalid email or password.");
  return user;
}
export async function authenticatePassword(email: string, password: unknown) {
  return newPasswordSession(await authenticatePasswordUser(email, password));
}
export async function changeOwnerPassword(actor: Identity, currentPassword: string, password: string, confirmation: string) {
  if (actor.role !== "owner") throw new Error("Owner access required.");
  const user = await authenticatePasswordUser(actor.email, currentPassword);
  if (user.role !== "owner" || user.mustChangePassword) throw new Error("Your access changed. Sign in again.");
  if (password !== confirmation) throw new Error("The passwords do not match.");
  const passwordHash = await hashPassword(password);
  if (await verifyPassword(password, user.passwordHash)) throw new Error("Choose a password different from your current password.");
  const changed = await (await approvedUsers()).updateOne({ _id: user.email, active: true, role: "owner", mustChangePassword: false, passwordVersion: user.passwordVersion }, {
    $set: { passwordHash, updatedAt: new Date() }, $inc: { passwordVersion: 1 },
  });
  if (!changed.modifiedCount) throw new Error("Your access changed. Sign in again.");
  await revokeUserSessions(user.email);
  return newPasswordSession({ ...user, passwordHash, passwordVersion: user.passwordVersion + 1 }, false);
}
export async function completePasswordSetup(token: string, password: string, confirmation: string) {
  const session = await passwordSession(token);
  if (!session || !session.setup || !session.user.mustChangePassword) throw new Error("Sign in with your temporary password again.");
  if (password !== confirmation) throw new Error("The passwords do not match.");
  const passwordHash = await hashPassword(password);
  if (await verifyPassword(password, session.user.passwordHash)) throw new Error("Choose a password different from your temporary password.");
  const users = await approvedUsers();
  const changed = await users.updateOne({ _id: session.user.email, active: true, mustChangePassword: true, passwordVersion: session.user.passwordVersion }, {
    $set: { passwordHash, mustChangePassword: false, updatedAt: new Date() }, $inc: { passwordVersion: 1 },
  });
  if (!changed.modifiedCount) throw new Error("Your access changed. Sign in again.");
  await revokeUserSessions(session.user.email);
  return newPasswordSession({ ...session.user, passwordHash, mustChangePassword: false, passwordVersion: session.user.passwordVersion + 1 }, false);
}
export async function deletePasswordSession(token?: string) {
  if (token) await (await getMongoDatabase()).collection<PasswordSession>("password_sessions").deleteOne({ _id: tokenHash(token) });
}
