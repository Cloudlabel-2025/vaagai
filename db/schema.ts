import type { CrewRecord } from "../lib/jaguar";

export type CrewDocument = {
  _id: string; id: string; kind: string; author: string; data: CrewRecord["data"];
  created_at: string; updated_at: string; revision: number;
};
export type GuideUsageDocument = { _id: string; id: string; author: string; day: string; used: number };
export type LockDocument = { _id: string; revision: number };
