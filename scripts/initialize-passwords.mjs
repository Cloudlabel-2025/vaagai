import nextEnv from "@next/env";
import { crew } from "../lib/jaguar.ts";
import { getMongoDatabase, closeMongo } from "../db/mongodb.mjs";
import { initializePasswordCredentials } from "../lib/password-bootstrap.mjs";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() { console.error("Environment loading failed."); } });
try {
  const users = (await getMongoDatabase()).collection("approved_users");
  await users.bulkWrite(crew.map(member => ({ updateOne: { filter: { _id: member.email },
    update: { $setOnInsert: { _id: member.email, email: member.email, name: member.name, role: member.role,
      active: true, createdAt: new Date(), updatedAt: new Date() } }, upsert: true } })));
  const result = await initializePasswordCredentials(users);
  console.log(JSON.stringify({ initialized: result.modifiedCount, approvedAccounts: await users.countDocuments(),
    requiresPasswordChange: await users.countDocuments({ mustChangePassword: true }), existingPasswordsPreserved: true }));
} catch (error) {
  console.error("Password initialization failed:", error.name);
  process.exitCode = 1;
} finally { await closeMongo(); }
