import { NextResponse } from "next/server";
import { requestOrigin } from "../../lib/request-origin";
import { crew } from "../../lib/jaguar";
import { safeWorkspaceReturn } from "../../lib/workspace-navigation";
import { createDevelopmentSession, developmentAuthEnabled, sessionCookie } from "../../lib/local-auth";

export async function GET(request: Request) {
  const returnTo = safeWorkspaceReturn(new URL(request.url).searchParams.get("return_to"));
  if (!developmentAuthEnabled()) return new Response("Configure your production authentication gateway. Local sign-in is available only with npm run dev.", { status: 503 });
  const options = crew.map(member => `<option value="${member.email}">${member.name} · ${member.role}</option>`).join("");
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jaguar Crew · Development sign-in</title><style>body{font:16px system-ui;background:#eef5f4;color:#153d3b;margin:0;display:grid;min-height:100vh;place-items:center}main{background:white;padding:32px;border-radius:16px;max-width:440px;margin:20px}select,button{font:inherit;padding:12px;width:100%;margin-top:16px}button{background:#14675e;color:white;border:0;border-radius:8px}</style><main><h1>Jaguar Crew</h1><p>Local development sign-in. Choose a crew member to test their workspace permissions.</p><form method="post"><input type="hidden" name="return_to" value="${returnTo}"><label for="email">Crew member</label><select id="email" name="email">${options}</select><button>Open workspace</button></form></main></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" } });
}
export async function POST(request: Request) {
  if (!developmentAuthEnabled()) return new Response("Local sign-in is disabled.", { status: 404 });
  if (request.headers.get("origin") !== requestOrigin(request)) return new Response("Invalid origin.", { status: 403 });
  const form = await request.formData(), email = String(form.get("email") || "");
  if (!crew.some(member => member.email === email)) return new Response("Unknown crew member.", { status: 403 });
  const returnTo = safeWorkspaceReturn(String(form.get("return_to") || "/"));
  const response = NextResponse.redirect(new URL(returnTo, requestOrigin(request)), 303);
  response.cookies.set(sessionCookie, createDevelopmentSession(email), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 });
  return response;
}
