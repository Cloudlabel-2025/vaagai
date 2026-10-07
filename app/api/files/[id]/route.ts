import { identity, bucket, record, records, failure, RequestError } from "../../../../lib/crew-server";
import { canControl } from "../../../../lib/jaguar";
export async function GET(_req: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        const u = await identity(), { id } = await context.params, r = await record(id);
        if (r.kind !== "upload")
            throw new RequestError("File not found.", 404);
        if (r.author !== u.email && !canControl(u)) {
            const all = await records();
            if (!all.some(x => x.kind === "evidence" && x.data.attachmentId === id))
                throw new RequestError("This file has not been submitted to the crew.", 403);
        }
        const file = await bucket().get(r.data.key);
        if (!file)
            throw new RequestError("File unavailable. Ask the author to resubmit it.", 404);
        return new Response(file.body, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(r.data.name)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
    }
    catch (e) {
        return failure(e);
    }
}
