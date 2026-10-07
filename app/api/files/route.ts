import { identity, bucket, insert, failure, RequestError, sameOrigin } from "../../../lib/crew-server";
const allowed = /\.(pdf|docx|xlsx|pptx|csv|txt|json|png|jpe?g|webp|zip)$/i;
export async function POST(req: Request) {
    try {
        sameOrigin(req);
        const u = await identity();
        if (Number(req.headers.get("content-length")) > 11 * 1024 * 1024)
            throw new RequestError("Use a file smaller than 10 MB.", 413);
        const data = await req.formData(), file = data.get("file");
        if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024)
            throw new RequestError("Choose a non-empty file up to 10 MB.");
        if (!allowed.test(file.name))
            throw new RequestError("Use PDF, Office, CSV, text, JSON, ZIP or an image file.");
        const id = crypto.randomUUID(), key = `jaguar/${id}`, name = file.name.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 180);
        await bucket().put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
        try {
            await insert(id, "upload", u.email, { name, size: file.size, key, type: file.type || "application/octet-stream" }).run();
        }
        catch (e) {
            await bucket().delete(key);
            throw e;
        }
        return Response.json({ id, name, size: file.size });
    }
    catch (e) {
        return failure(e);
    }
}
