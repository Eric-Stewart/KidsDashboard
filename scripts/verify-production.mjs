import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const base = process.env.VERIFY_URL || "http://localhost:3001";
for (const route of ["/dashboard", "/calendar", "/grades", "/settings"]) {
  const response = await fetch(base + route, { redirect: "manual" });
  assert.ok(
    [303, 307].includes(response.status),
    `${route} must redirect when anonymous`,
  );
  assert.ok(response.headers.get("location")?.includes("/login"));
  const body = await response.text();
  assert.ok(!body.includes("Solving two-step equations"));
  assert.ok(response.headers.get("cache-control")?.includes("no-store"));
}
for (const route of [
  "/api/sync",
  "/api/sync/genesis",
  "/api/sync/google/e",
  "/api/sync/google/a",
  "/api/integrations/google/e/connect",
  "/api/integrations/google/a/connect",
]) {
  const response = await fetch(base + route, {
    method: "POST",
    headers: { Origin: base },
  });
  assert.ok(
    [401, 403].includes(response.status),
    `${route} must deny anonymous requests`,
  );
}
const login = await (await fetch(base + "/login")).text();
const callback = await fetch(
  base + "/api/integrations/google/callback?state=invalid",
  { redirect: "manual" },
);
assert.ok([303, 307].includes(callback.status));
assert.ok(callback.headers.get("location")?.includes("/login"));
assert.ok(
  !login.includes("Explore local sample dashboard"),
  "Production must not render preview access",
);
const providers = await (await fetch(base + "/api/auth/providers")).json();
assert.ok(
  !providers["local-preview"],
  "Production must not register the preview provider",
);

const localEnv = readFileSync(".env.local", "utf8");
const secret = localEnv.match(/^AUTH_SECRET=(.+)$/m)?.[1]?.trim();
const privateValues = [
  "AUTH_SECRET",
  "AUTH_GOOGLE_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "TOKEN_ENCRYPTION_KEY",
  "LOCAL_POSTGRES_PASSWORD",
  "KIDS_DASHBOARD_INGEST_KEY",
]
  .map((name) =>
    localEnv.match(new RegExp("^" + name + "=(.+)$", "m"))?.[1]?.trim(),
  )
  .filter(Boolean);
const schoolConfig = existsSync(".config") ? JSON.parse(readFileSync(".config", "utf8")) : {};
privateValues.push(...[schoolConfig.classroom?.E?.password, schoolConfig.classroom?.A?.password, schoolConfig.genesis?.password].filter(Boolean));
assert.ok(secret, "Local test secret required for bundle leak check");
function files(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(root, entry.name))
      : [join(root, entry.name)],
  );
}
for (const file of files(".next/static").filter((file) =>
  file.endsWith(".js"),
)) {
  const source = readFileSync(file, "utf8");
  assert.ok(!source.includes(secret), "Session secret found in client assets");
  for (const value of privateValues)
    assert.ok(
      !source.includes(value),
      "Private configuration found in client assets",
    );
  assert.ok(
    !source.includes("encryptedRefreshToken"),
    "Database credential fields found in client assets",
  );
}
console.log(
  "Production checks passed: protected pages, sync and connection routes, signed-out callback, no preview provider, private cache headers, and no private configuration in client assets.",
);
