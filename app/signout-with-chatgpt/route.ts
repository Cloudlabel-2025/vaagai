import { NextResponse } from "next/server";
import { requestOrigin } from "../../lib/request-origin";
import { developmentAuthEnabled, sessionCookie } from "../../lib/local-auth";

export async function GET(request: Request) {
  if (!developmentAuthEnabled()) return new Response("Sign out through your production authentication gateway.", { status: 503 });
  const response = NextResponse.redirect(new URL("/", requestOrigin(request)), 303);
  response.cookies.set(sessionCookie, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
