import { MongoClient } from "mongodb";
import { initializeCollections } from "./collections.mjs";

// One connection pool per running Node.js instance, reused by Next.js requests/HMR.
const cache = globalThis;
export async function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured. Add it to .env.local or Vercel's server environment.");
  if (!cache.jaguarMongoConnection) {
    const client = new MongoClient(uri, { maxPoolSize: 10, minPoolSize: 0, maxIdleTimeMS: 60000, serverSelectionTimeoutMS: 8000, appName: "vaagai-jaguar" });
    cache.jaguarMongoConnection = client.connect().catch(async error => {
      delete cache.jaguarMongoConnection;
      await client.close();
      throw error;
    });
  }
  return cache.jaguarMongoConnection;
}

/** @returns {Promise<import('mongodb').Db>} */
export async function getMongoDatabase() {
  const client = await getMongoClient();
  const db = client.db(process.env.MONGODB_DB || "vaagai_jaguar");
  if (!cache.jaguarMongoSchema) cache.jaguarMongoSchema = initializeCollections(db).catch(error => { delete cache.jaguarMongoSchema; throw error; });
  await cache.jaguarMongoSchema;
  return db;
}

export async function closeMongo() {
  const connection = cache.jaguarMongoConnection;
  delete cache.jaguarMongoConnection;
  delete cache.jaguarMongoSchema;
  if (connection) await (await connection).close();
}
