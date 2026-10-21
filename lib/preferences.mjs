export const defaultPreferences = Object.freeze({ language: "en", textSize: "standard", density: "comfortable", contrast: "standard", motion: "system", taskFilter: "All" });
const choices = { language: ["en", "ta", "hi"], textSize: ["standard", "large"], density: ["comfortable", "compact"], contrast: ["standard", "high"], motion: ["system", "reduced", "full"], taskFilter: ["All", "Mine"] };
export function validatePreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== Object.keys(choices).length || Object.keys(value).some(key => !Object.hasOwn(choices, key))) throw new Error("Invalid preferences.");
  for (const [key, allowed] of Object.entries(choices)) if (!allowed.includes(value[key])) throw new Error("Invalid preferences.");
  return Object.fromEntries(Object.keys(choices).map(key => [key, value[key]]));
}
export async function readPreferences(db, app, email) {
  const record = await db.collection("user_preferences").findOne({ _id: `${app}:${email}` });
  return { preferences: { ...defaultPreferences, ...record?.preferences }, revision: record?.revision ?? 0 };
}
export async function savePreferences(db, app, email, preferences, revision) {
  const validated = validatePreferences(preferences);
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Invalid revision.");
  const collection = db.collection("user_preferences"), id = `${app}:${email}`;
  if (revision === 0) {
    try { await collection.insertOne({ _id: id, preferences: validated, revision: 1, updatedAt: new Date() }); }
    catch (error) { if (error.code === 11000) return null; throw error; }
  } else {
    const result = await collection.updateOne({ _id: id, revision }, { $set: { preferences: validated, updatedAt: new Date() }, $inc: { revision: 1 } });
    if (!result.matchedCount) return null;
  }
  return { preferences: validated, revision: revision + 1 };
}
