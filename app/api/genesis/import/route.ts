import { validIngestKey } from "@/lib/classroom-ingest-auth";
import { genesisImportSchema } from "@/lib/genesis-browser-schema";
import { importGenesisBrowser } from "@/lib/import-genesis-browser";
import { getDb } from "@/lib/db";
export const runtime = "nodejs";
export const maxDuration = 90;
const reply = (body: object, status: number) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request: Request) {
  // Dedicated bearer authentication. Parent session cookies do not authorize imports.
  if (!validIngestKey(request.headers.get("authorization")))
    return reply({ error: "Invalid ingestion key." }, 401);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "JSON required." }, 415);
  const limit = 2 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit)
    return reply({ error: "Import too large." }, 413);
  let data: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "JSON required." }, 400);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        return reply({ error: "Import too large." }, 413);
      }
      chunks.push(part.value);
    }
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply({ error: "Invalid JSON." }, 400);
  }
  const parsed = genesisImportSchema.safeParse(data);
  if (!parsed.success)
    return reply(
      {
        error:
          "Invalid Genesis data. Check IDs, links, dates, and field limits.",
      },
      400,
    );
  try {
    return reply(
      { ok: true, ...(await importGenesisBrowser(getDb(), parsed.data)) },
      200,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      ["INVALID_EXTRACTION_TIME", "STALE_EXTRACTION"].includes(
        error.message,
      )
    )
      return reply({ error: error.message }, 400);
    // Never serialize errors containing input, database URLs, or keys.
    return reply(
      {
        error:
          "Import could not be saved. Previously saved data was preserved. Try again.",
      },
      503,
    );
  }
}
