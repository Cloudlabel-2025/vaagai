import { cookies } from "next/headers";
import { deletePasswordSession, passwordSession } from "../../../lib/password-auth";
import { TAB_HEADER, tabCookieName, validTabId } from "../../../lib/session-policy";
import { sameOrigin, failure } from "../../../lib/crew-server";

async function inspect(request: Request, touch = false) {
  const tabId = request.headers.get(TAB_HEADER);
  const token = validTabId(tabId) ? (await cookies()).get(tabCookieName(tabId))?.value : undefined;
  const session = await passwordSession(token, touch);
  if (!session) return Response.json({ error: "Your session ended. Please sign in again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json({ setup: session.setup || session.user.mustChangePassword,
    expires: session.expires.getTime(), idleExpires: Math.min(session.idleExpires.getTime(), session.expires.getTime()),
  }, { headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: Request) {
  try { return await inspect(request); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try { sameOrigin(request); return await inspect(request, true); } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const tabId = request.headers.get(TAB_HEADER);
    if (validTabId(tabId)) {
      const jar = await cookies(), name = tabCookieName(tabId);
      await deletePasswordSession(jar.get(name)?.value);
      jar.delete(name);
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

