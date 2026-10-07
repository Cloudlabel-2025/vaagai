import type { CrewRecord } from "../lib/jaguar";
import type { GrowthState } from "../lib/growth";
import type { Assessment, Model } from "../lib/c310-model";

export type CrewDocument = {
  _id: string; id: string; kind: string; author: string; data: CrewRecord["data"];
  created_at: string; updated_at: string; revision: number;
};
export type GuideUsageDocument = { _id: string; id: string; author: string; day: string; used: number };
export type GrowthDocument = { _id: string; id: string; data: GrowthState; revision: number; updated_by: string; updated_at: string };
export type ModelDocument = { _id: string; id: string; data: Model; created_at: string };
export type AssessmentDocument = { _id: string; id: string; rider: string; data: Assessment; revision: number; created_at: string; updated_at: string };
export type LockDocument = { _id: string; revision: number };
