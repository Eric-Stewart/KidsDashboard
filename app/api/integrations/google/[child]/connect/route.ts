import { NextRequest, NextResponse } from "next/server";
import { currentParent } from "@/lib/require-auth";
import { appOrigin, sameOrigin } from "@/lib/integrations/google-config";
import { beginConnection, OAUTH_COOKIE } from "@/lib/integrations/google-oauth";
import { errorCode } from "@/lib/integrations/google-policy";
import { classroomSource } from "@/lib/classroom-source";
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ child: string }> },
) {
  const parent = await currentParent();
  if (!parent?.user?.email || parent.user.id === "local-preview")
    return NextResponse.json(
      { error: "Sign in with your approved parent Google account." },
      { status: 401 },
    );
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (classroomSource() !== "api")
    return NextResponse.json(
      {
        error:
          "Browser source is selected. Use the KidsDashboard Chrome extension.",
      },
      { status: 409 },
    );
  const child = (await context.params).child;
  if (child !== "e" && child !== "a")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const start = await beginConnection(
      child === "e" ? "E" : "A",
      parent.user.email,
    );
    const response = NextResponse.redirect(start.url, 303);
    response.cookies.set(OAUTH_COOKIE, start.browser, {
      httpOnly: true,
      secure: appOrigin().startsWith("https:"),
      sameSite: "lax",
      maxAge: 600,
      path: "/api/integrations/google",
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return new NextResponse(null, {
      status: 303,
      headers: {
        Location: `/settings?connection=${encodeURIComponent(errorCode(error))}`,
        "Cache-Control": "no-store",
      },
    });
  }
}
