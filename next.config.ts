import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: { "/api/sync/**": ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/playwright-core/**", "./generated/classroom-extractor.js"] },
  poweredByHeader: false,
  // OAuth callbacks carry one-time codes in their URLs; don't print request URLs.
  logging: { incomingRequests: false },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Keep same-origin form POSTs identifiable while hiding referrers from other sites.
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};
export default config;
