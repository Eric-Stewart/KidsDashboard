import { NextRequest, NextResponse } from "next/server";
import { currentParent } from "@/lib/require-auth";
import {
  completeConnection,
  OAUTH_COOKIE,
} from "@/lib/integrations/google-oauth";
import { errorCode } from "@/lib/integrations/google-policy";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const parent = await currentParent();
  if (!parent?.user?.email || parent.user.id === "local-preview")
    return new NextResponse(null, {
      status: 303,
      headers: { Location: "/login", "Cache-Control": "no-store" },
    });
  let destination: string;
  try {
    const p = request.nextUrl.searchParams;
    const child = await completeConnection(
      p.get("state"),
      request.cookies.get(OAUTH_COOKIE)?.value,
      parent.user.email,
      p.get("code"),
      p.get("error"),
    );
    destination = `/settings?connected=${child.toLowerCase()}`;
  } catch (error) {
    destination = `/settings?connection=${encodeURIComponent(errorCode(error))}`;
  }
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: destination,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
  response.cookies.set(OAUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/api/integrations/google",
  });
  return response;
}
