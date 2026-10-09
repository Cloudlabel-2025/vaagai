import { mongoBucket } from "./storage";
import { getDb, transaction } from "../db";
import { MongoServerError } from "mongodb";
import type { CrewDocument } from "../db/schema";
import { requestOrigin } from "./request-origin";
import { getWorkspaceUser } from "../app/auth";
import type { CrewRecord } from "./jaguar";
export class RequestError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export async function identity() { const user = await getWorkspaceUser(); if (!user)
    throw new RequestError("Sign in with your approved Google account to open Jaguar Crew.", 401); return user; }
export const database = getDb;
export function bucket() { return mongoBucket; }
export function row(r: CrewDocument): CrewRecord { return { id: r.id, kind: r.kind, author: r.author, data: r.data, createdAt: r.created_at, updatedAt: r.updated_at, revision: r.revision }; }
export async function records() { return (await (await database()).records.find({}).sort({ created_at: -1 }).limit(3000).toArray()).map(row); }
export async function record(id: string) {
    const r = await (await database()).records.findOne({ _id: id });
    if (!r) throw new RequestError("Record not found.", 404);
    return row(r);
}
export function crewDocument(id: string, kind: string, author: string, data: CrewRecord["data"], now = new Date().toISOString()): CrewDocument {
    return { _id: id, id, kind, author, data, created_at: now, updated_at: now, revision: 1 };
}
export function insert(id: string, kind: string, author: string, data: CrewRecord["data"], now = new Date().toISOString()) {
    return { async run() {
        try { return await (await database()).records.insertOne(crewDocument(id, kind, author, data, now)); }
        catch (error) { if (error instanceof MongoServerError && error.code === 11000) throw new RequestError("This record already exists. Refresh before continuing.", 409); throw error; }
    } };
}
export async function upsertRecord(id: string, kind: string, author: string, data: CrewRecord["data"], now = new Date().toISOString()) {
    return (await database()).records.updateOne({ _id: id }, {
        $set: { data, updated_at: now }, $setOnInsert: { id, kind, author, created_at: now }, $inc: { revision: 1 },
    }, { upsert: true });
}
export async function insertOnce(id: string, kind: string, author: string, data: CrewRecord["data"], now = new Date().toISOString()) {
    return (await database()).records.updateOne({ _id: id }, { $setOnInsert: crewDocument(id, kind, author, data, now) }, { upsert: true });
}
export async function update(r: CrewRecord, data: CrewRecord["data"], revision: number) {
    const perform = async (db: Awaited<ReturnType<typeof database>>, session?: import("mongodb").ClientSession) => {
        if (r.kind === "energy") await db.locks.updateOne({ _id: String(r.data.rider) }, { $inc: { revision: 1 } }, { upsert: true, session });
        const result = await db.records.updateOne({ _id: r.id, revision }, { $set: { data, updated_at: new Date().toISOString() }, $inc: { revision: 1 } }, { session });
        if (result.modifiedCount !== 1) throw new RequestError("This record changed while you were editing. Refresh and try again.", 409);
    };
    if (r.kind === "energy") await transaction(perform); else await perform(await database());
}
export async function submitEvidence(document: CrewDocument, task: CrewRecord) {
    await transaction(async (db, session) => {
        const newest = await db.records.findOne({ kind: "evidence", "data.groupId": document.data.groupId }, { sort: { "data.version": -1 }, session });
        if (Number(document.data.version) !== Number(newest?.data.version || 0) + 1) throw new RequestError("A newer evidence version was submitted. Refresh before continuing.", 409);
        await db.records.updateMany({ kind: "evidence", "data.groupId": document.data.groupId, "data.status": "Pending review" }, { $set: { "data.status": "Superseded", updated_at: document.created_at }, $inc: { revision: 1 } }, { session });
        await db.records.insertOne(document, { session });
        const saved = await db.records.updateOne({ _id: task.id, revision: task.revision, "data.status": { $ne: "Accepted" } }, { $set: { "data.status": "Awaiting review", updated_at: document.created_at }, $inc: { revision: 1 } }, { session });
        if (saved.modifiedCount !== 1) throw new RequestError("The task changed during submission. Refresh before continuing.", 409);
    });
}
export async function reviewEvidence(r: CrewRecord, revision: number, decision: string, review: CrewRecord["data"], now: string) {
    await transaction(async (db, session) => {
        const newer = await db.records.findOne({ kind: "evidence", "data.groupId": r.data.groupId, "data.version": { $gt: r.data.version } }, { session });
        if (newer) throw new RequestError("Review the latest evidence version.", 409);
        const saved = await db.records.updateOne({ _id: r.id, revision, "data.status": "Pending review" }, { $set: { "data.status": decision, "data.review": review, updated_at: now }, $inc: { revision: 1 } }, { session });
        if (saved.modifiedCount !== 1) throw new RequestError("This evidence changed while you reviewed it. Refresh before continuing.", 409);
        const task = await db.records.updateOne({ _id: String(r.data.taskId) }, { $set: { "data.status": decision === "Accepted" ? "Accepted" : "In progress", updated_at: now }, $inc: { revision: 1 } }, { session });
        if (task.modifiedCount !== 1) throw new RequestError("The evidence task is unavailable. Refresh before continuing.", 409);
    });
}
export async function recordEnergy(document: CrewDocument, rider: string, expectedCount: number) {
    return transaction(async (db, session) => {
        await db.locks.updateOne({ _id: rider }, { $inc: { revision: 1 } }, { upsert: true, session });
        const count = await db.records.countDocuments({ kind: "energy", "data.rider": rider, "data.appealStatus": { $exists: true, $ne: "upheld" } }, { session });
        if (count !== expectedCount) throw new RequestError("The energy state changed. Refresh before recording this loss.", 409);
        await db.records.insertOne(document, { session });
    });
}
export function failure(e: unknown) { if (e instanceof RequestError)
    return Response.json({ error: e.message }, { status: e.status }); console.error("Jaguar workspace request failed", e instanceof Error ? e.name : "unknown"); return Response.json({ error: "The workspace could not save or load this request. Your draft has been kept. Please try again." }, { status: 503 }); }
export function safeUrl(v: string) { try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
}
catch {
    return false;
} }
export function sameOrigin(request: Request) { const origin = request.headers.get("origin"); if (origin && origin !== requestOrigin(request))
    throw new RequestError("Unrecognized request origin.", 403); }
