import { NextResponse, type NextRequest } from "next/server";
import { currentParent } from "@/lib/require-auth";
import { sameOrigin } from "@/lib/integrations/google-config";
import { syncGoogle, type SyncResult } from "@/lib/sync-google";
import { errorDescription } from "@/lib/integrations/google-policy";
import { classroomSource } from "@/lib/classroom-source";
import { validIngestKey } from "@/lib/classroom-ingest-auth";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ source?: string[] }> },
) {
  const parent = await currentParent();
  if ((!parent?.user || parent.user.id === "local-preview") && !validIngestKey(request.headers.get("authorization"), process.env.SCHOOL_SYNC_KEY || ""))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const source = (await context.params).source?.join("/") || "all";
  if (!["all", "genesis", "google/e", "google/a"].includes(source))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (process.env.SCHOOL_SYNC_MODE === "cloud" && (source === "genesis" || classroomSource() === "browser")) {
    if(source === "all") return NextResponse.json({error:"Refresh each connection separately."},{status:400});
    try {
      const {syncSchoolBrowser}=await import("@/lib/sync-school-browser");
      const result=await syncSchoolBrowser(source);
      return NextResponse.json({...result,results:[result]},{status:result.ok?200:503,headers:{"Cache-Control":"private, no-store"}});
    } catch {
      return NextResponse.json({error:"Refresh could not start. Check the server connection and try again."},{status:503});
    }
  }
  const jobs: Promise<SyncResult>[] = [];
  if (source === "all" || source === "google/e") jobs.push(syncGoogle("E"));
  if (source === "all" || source === "google/a") jobs.push(syncGoogle("A"));
  if (source === "all" || source === "genesis")
    jobs.push(
      Promise.resolve({
        source: "genesis",
        ok: false,
        code: "LOCAL_COLLECTOR_REQUIRED",
      }),
    );
  const settled = await Promise.allSettled(jobs);
  const results = settled.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : { source: "unknown", ok: false, code: "DATABASE_ERROR" },
  );
  const successes = results.filter((r) => r.ok).length;
  return NextResponse.json(
    {
      results: results.map((r) => ({
        ...r,
        message: r.ok ? "Refreshed successfully." : errorDescription(r.code),
      })),
      message:
        classroomSource() === "browser" && source !== "genesis"
          ? "Run the local collector to refresh both school systems, or use the Chrome extension for Classroom."
          : successes === results.length
            ? "Data refreshed."
            : successes
              ? "Some connections refreshed. Review the others in Settings."
              : "No connections refreshed. Review the details in Settings.",
    },
    {
      status: successes === results.length ? 200 : successes ? 207 : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
