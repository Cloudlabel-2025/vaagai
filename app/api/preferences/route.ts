import { identity, failure, sameOrigin, RequestError } from "../../../lib/crew-server";
import { getMongoDatabase } from "../../../db/mongodb.mjs";
import { readPreferences, savePreferences, validatePreferences } from "../../../lib/preferences.mjs";
const APP = "vaagai";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try { const user = await identity(); return Response.json(await readPreferences(await getMongoDatabase(), APP, user.email), { headers }); }
  catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    const body = await request.text();
    if (body.length > 2048) throw new RequestError("Invalid preferences.");
    let input;
    try {
      input = JSON.parse(body);
      if (!input || Object.keys(input).some(key => !["preferences", "revision"].includes(key))) throw new Error();
      validatePreferences(input.preferences);
      if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error();
    } catch { throw new RequestError("Invalid preferences."); }
    const saved = await savePreferences(await getMongoDatabase(), APP, user.email, input.preferences, input.revision);
    if (!saved) throw new RequestError("Settings changed in another tab. Reload settings and try again.", 409);
    return Response.json(saved, { headers });
  } catch (error) { return failure(error); }
}
