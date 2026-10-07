import "server-only";
import { getMongoClient, getMongoDatabase } from "./mongodb.mjs";
import type { ClientSession } from "mongodb";
import type { CrewDocument, GuideUsageDocument, GrowthDocument, ModelDocument, AssessmentDocument, LockDocument } from "./schema";

export async function getDb() {
  const db = await getMongoDatabase();
  return {
    records: db.collection<CrewDocument>("crew_records"),
    usage: db.collection<GuideUsageDocument>("guide_usage"),
    growth: db.collection<GrowthDocument>("growth_workspace"),
    models: db.collection<ModelDocument>("c310_models"),
    assessments: db.collection<AssessmentDocument>("c310_assessments"),
    locks: db.collection<LockDocument>("workspace_locks"),
  };
}
export type Collections = Awaited<ReturnType<typeof getDb>>;
export async function transaction<T>(work: (db: Collections, session: ClientSession) => Promise<T>): Promise<T> {
  const db = await getDb(), client = await getMongoClient(), session = client.startSession();
  try {
    return (await session.withTransaction(() => work(db, session), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } })) as T;
  } finally { await session.endSession(); }
}
