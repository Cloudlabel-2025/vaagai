import { localDatabase, localBucket } from "./storage";
import { requestOrigin } from "./request-origin";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { workspaceIdentity } from "../app/authorization";
import type { CrewRecord } from "./jaguar";
export class RequestError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export async function identity() { const user = await getChatGPTUser(); if (!user)
    throw new RequestError("Sign in with ChatGPT to open Jaguar Crew.", 401); const member = workspaceIdentity(user); if (!member)
    throw new RequestError("This account is not an active Jaguar Crew member.", 403); return member; }
export function database() { return localDatabase; }
export function bucket() { return localBucket; }
export function row(r: any): CrewRecord { return { id: r.id, kind: r.kind, author: r.author, data: JSON.parse(r.data), createdAt: r.created_at, updatedAt: r.updated_at, revision: r.revision }; }
export async function records() { const result = await database().prepare("SELECT * FROM crew_records ORDER BY created_at DESC LIMIT 3000").all(); return result.results.map(row); }
export async function record(id: string) { const r = await database().prepare("SELECT * FROM crew_records WHERE id=?").bind(id).first(); if (!r)
    throw new RequestError("Record not found.", 404); return row(r); }
export function insert(id: string, kind: string, author: string, data: Record<string, any>, now = new Date().toISOString()) { return database().prepare("INSERT INTO crew_records(id,kind,author,data,created_at,updated_at,revision) VALUES(?,?,?,?,?,?,1)").bind(id, kind, author, JSON.stringify(data), now, now); }
export async function update(r: CrewRecord, data: Record<string, any>, revision: number) { const result = await database().prepare("UPDATE crew_records SET data=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?").bind(JSON.stringify(data), new Date().toISOString(), r.id, revision).run(); if (result.meta.changes !== 1)
    throw new RequestError("This record changed while you were editing. Refresh and try again.", 409); }
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
