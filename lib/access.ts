import "server-only";
import { getMongoDatabase } from "../db/mongodb.mjs";
import { crew, type Identity } from "./jaguar";
import { hashPassword, validatePassword } from "./passwords";
import { initializePasswordCredentials } from "./password-bootstrap.mjs";

export type ApprovedUser = Identity & { _id: string; active: boolean; createdAt: Date; updatedAt: Date;
  passwordHash: string; mustChangePassword: boolean; passwordVersion: number };
export async function approvedUsers() {
  const db = await getMongoDatabase();
  const users = db.collection<ApprovedUser>("approved_users");
  // Insert-only bootstrap preserves administrator changes and disabled accounts.
  await users.bulkWrite(crew.map(member => ({ updateOne: {
    filter: { _id: member.email }, update: { $setOnInsert: {
      _id: member.email, email: member.email, name: member.name, role: member.role,
      active: true, createdAt: new Date(), updatedAt: new Date(),
    } }, upsert: true,
  } })));
  // Existing approvals receive a temporary credential once. Never reset a changed password.
  await initializePasswordCredentials(users);
  return users;
}
export async function approvedIdentity(email?: string | null): Promise<Identity | null> {
  if (!email) return null;
  const user = await (await approvedUsers()).findOne({ _id: email.trim().toLowerCase(), active: true });
  return user ? { email: user.email, name: user.name, role: user.role } : null;
}
export async function googleSignInDecision(profile: { email?: string | null; email_verified?: unknown } | undefined): Promise<true | string> {
  if (profile?.email_verified !== true || !profile.email) return "/signin?error=InvalidGoogleAccount";
  const user = await (await approvedUsers()).findOne({ _id: profile.email.trim().toLowerCase(), active: true });
  if (!user) return "/signin?error=InvalidGoogleAccount";
  if (user.mustChangePassword !== false) return "/signin?error=PasswordSetupRequired";
  return true;
}
export async function googleAccess(profile: { email?: string | null; email_verified?: unknown } | undefined) {
  return await googleSignInDecision(profile) === true;
}
export async function activeRoster() {
  const users = await (await approvedUsers()).find({ active: true }).sort({ name: 1 }).toArray();
  return users.map(user => ({ name: user.name, email: user.email, role: user.role,
    area: crew.find(member => member.email === user.email)?.area || "Crew member" }));
}
export async function saveApprovedUser(actor: Identity, input: unknown) {
  if (actor.role !== "owner") throw new Error("Only the owner can manage access.");
  const value = input as Record<string, unknown>;
  if (!value || typeof value.email !== "string" || typeof value.name !== "string" ||
      !["owner", "cohort_leader", "learner"].includes(String(value.role)) || typeof value.active !== "boolean")
    throw new Error("Provide an email, name, role and active status.");
  const email = value.email.trim().toLowerCase(), name = value.name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 100)
    throw new Error("Enter a valid email and name (up to 100 characters).");
  if (email === actor.email && (value.active !== true || value.role !== "owner"))
    throw new Error("You cannot disable or demote your own owner account.");
  const users = await approvedUsers(), existing = await users.findOne({ _id: email });
  const temporaryPassword = value.temporaryPassword;
  const reset = typeof temporaryPassword === "string" && temporaryPassword.length > 0;
  if (!existing && !reset) throw new Error("Give the new user a temporary password.");
  if (reset) validatePassword(temporaryPassword);
  const passwordHash = reset ? await hashPassword(temporaryPassword as string) : undefined;
  await users.updateOne({ _id: email }, {
    $set: { email, name, role: value.role as Identity["role"], active: value.active, updatedAt: new Date(),
      ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}) },
    $setOnInsert: { createdAt: new Date() },
    ...(reset ? { $inc: { passwordVersion: 1 } } : {}),
  }, { upsert: true });
  if (reset) {
    await revokeUserSessions(email);
  }
  if (!value.active) await revokeUserSessions(email);
}
export async function revokeUserSessions(email: string) {
  const db = await getMongoDatabase();
  await db.collection("password_sessions").deleteMany({ email });
  const accounts = await db.collection("auth_users").find({ email }, { projection: { _id: 1 } }).toArray();
  if (accounts.length) await db.collection("auth_sessions").deleteMany({ userId: { $in: accounts.map(user => user._id) } });
}
