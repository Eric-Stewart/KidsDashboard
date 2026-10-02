import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/integrations/google-config";
export function proxy(request: NextRequest) {
  // Defense in depth only; every protected page and data handler verifies the session.
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  // This exact endpoint authenticates its own ingestion bearer key, not browser cookies.
  if (
    ["/api/classroom/import", "/api/genesis/import"].includes(request.nextUrl.pathname) &&
    request.method === "POST"
  )
    return response;
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    request.method !== "GET" &&
    !request.nextUrl.pathname.startsWith("/api/auth/")
  ) {
    // Next may use the listening address (127.0.0.1) in nextUrl even when
    // the browser uses the configured public origin (localhost).
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return response;
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/calendar/:path*",
    "/grades/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
};
