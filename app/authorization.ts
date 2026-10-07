import type { ChatGPTUser } from "./chatgpt-auth";
import { crew } from "../lib/jaguar";
export type WorkspaceRole = "owner" | "cohort_leader" | "learner";
export function workspaceIdentity(user: ChatGPTUser) { const email = user.email.trim().toLowerCase(), member = crew.find(p => p.email === email); return member ? { role: member.role, name: member.name, email } : null; }
