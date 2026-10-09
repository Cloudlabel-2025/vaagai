export const applicationCollections = ["crew_records", "guide_usage", "growth_workspace", "c310_models", "c310_assessments"];
const text = { bsonType: "string" };
const revision = { bsonType: ["int", "long", "double"], minimum: 1 };
const data = { bsonType: "object" };
const schemas = {
  crew_records: { required: ["_id", "id", "kind", "author", "data", "created_at", "updated_at", "revision"], properties: { kind: text, author: text, data, created_at: text, updated_at: text, revision } },
  guide_usage: { required: ["_id", "id", "author", "day", "used"], properties: { author: text, day: text, used: { bsonType: ["int", "long", "double"], minimum: 0 } } },
  growth_workspace: { required: ["_id", "id", "data", "revision", "updated_by", "updated_at"], properties: { data, revision, updated_by: text, updated_at: text } },
  c310_models: { required: ["_id", "id", "data", "created_at"], properties: { data, created_at: text } },
  c310_assessments: { required: ["_id", "id", "rider", "data", "revision", "created_at", "updated_at"], properties: { rider: text, data, revision, created_at: text, updated_at: text } },
};

/** @param {import('mongodb').Db} db */
export async function initializeCollections(db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
  for (const name of applicationCollections) {
    if (!existing.has(name)) {
      try {
        const schema = schemas[name];
        await db.createCollection(name, { validator: { $jsonSchema: { bsonType: "object", required: schema.required, properties: { _id: text, id: text, ...schema.properties } } }, validationLevel: "strict" });
      } catch (error) { if (error.code !== 48) throw error; }
    }
    await db.collection(name).createIndex({ id: 1 }, { unique: true, name: "id_unique" });
  }
  await db.collection("crew_records").createIndexes([
    { key: { kind: 1, created_at: -1 }, name: "kind_created" },
    { key: { author: 1, kind: 1 }, name: "author_kind" },
    { key: { kind: 1, "data.groupId": 1, "data.version": -1 }, name: "evidence_versions" },
    { key: { kind: 1, "data.rider": 1 }, name: "rider_records" },
  ]);
  await db.collection("c310_assessments").createIndex({ rider: 1, created_at: -1 }, { name: "rider_created" });
  await db.collection("c310_models").createIndex({ created_at: -1, id: -1 }, { name: "model_created" });
  if (!existing.has("workspace_locks")) {
    try { await db.createCollection("workspace_locks"); } catch (error) { if (error.code !== 48) throw error; }
  }
  await db.collection("uploads.files").createIndex({ filename: 1 }, { unique: true, name: "private_key_unique" });
  await db.collection("approved_users").createIndex({ email: 1 }, { unique: true });
  await db.collection("auth_users").createIndex({ email: 1 }, { unique: true });
  await db.collection("auth_accounts").createIndex({ provider: 1, providerAccountId: 1 }, { unique: true });
  await db.collection("auth_sessions").createIndex({ sessionToken: 1 }, { unique: true });
  await db.collection("auth_sessions").createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
  await db.collection("password_sessions").createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
  await db.collection("password_sessions").createIndex({ email: 1 });
  await db.collection("password_attempts").createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
}
