import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { sameOrigin } from "../lib/integrations/google-config";
import config from "../next.config";

test("form and refresh requests trust the configured origin, not the listening host", () => {
  const before = process.env.AUTH_URL;
  process.env.AUTH_URL = "http://localhost:3000";
  try {
    for (const path of ["/api/integrations/google/e/connect", "/api/sync/google/e"]) {
      const request = (origin?: string) => new NextRequest(`http://127.0.0.1:3000${path}`, {
        method: "POST", headers: origin === undefined ? {} : { Origin: origin },
      });
      assert.equal(sameOrigin(request("http://localhost:3000")), true);
      assert.equal(proxy(request("http://localhost:3000")).status, 200);
      for (const origin of [undefined, "null", "https://untrusted.example", "http://localhost:3001", "http://127.0.0.1:3000"]) {
        assert.equal(sameOrigin(request(origin)), false);
        assert.equal(proxy(request(origin)).status, 403);
      }
    }
  } finally {
    if (before === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = before;
  }
});

test("page referrer policy preserves same-origin form origins without cross-site referrers", async () => {
  const rules = await config.headers!();
  const policy = rules.find(rule => rule.source === "/:path*")?.headers.find(header => header.key === "Referrer-Policy");
  assert.equal(policy?.value, "same-origin");
});
