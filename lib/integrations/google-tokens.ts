import "server-only";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { googleConfig } from "./google-config";
import { GOOGLE_SCOPES, IntegrationError } from "./google-policy";
import type { Fetcher } from "./google-classroom";
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 15000 },
);
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});
export async function requestTokens(
  params: Record<string, string>,
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
) {
  const config = googleConfig();
  let response: Response;
  try {
    response = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        ...params,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    });
  } catch {
    throw new IntegrationError(
      signal.aborted ? "TIMEOUT" : "UNAVAILABLE",
      "oauth.token",
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new IntegrationError("INVALID_RESPONSE", "oauth.token");
  }
  if (!response.ok) {
    const code = z.object({ error: z.string() }).safeParse(body);
    throw new IntegrationError(
      code.success && code.data.error === "invalid_grant"
        ? "RECONNECT_REQUIRED"
        : code.success && code.data.error === "invalid_client"
          ? "NOT_CONFIGURED"
          : response.status === 429
            ? "RATE_LIMITED"
            : "ACCESS_DENIED",
      "oauth.token",
    );
  }
  const result = tokenSchema.safeParse(body);
  if (!result.success)
    throw new IntegrationError("INVALID_RESPONSE", "oauth.token");
  return result.data;
}
export function validateScopes(scope: string | undefined) {
  const granted = scope?.split(/\s+/) || [];
  if (
    !GOOGLE_SCOPES.filter((s) => s.startsWith("https:")).every((s) =>
      granted.includes(s),
    )
  )
    throw new IntegrationError("SCOPE_MISSING", "oauth.authorize");
  return granted;
}
export async function verifyGoogleIdentity(
  idToken: string | undefined,
  nonce: string,
) {
  if (!idToken) throw new IntegrationError("INVALID_IDENTITY", "openid.verify");
  try {
    const { payload } = await jwtVerify(idToken, keys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: googleConfig().clientId,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp", "iat", "nonce"],
    });
    if (
      payload.nonce !== nonce ||
      !payload.sub ||
      typeof payload.email !== "string" ||
      payload.email_verified !== true
    )
      throw new Error();
    return { accountId: payload.sub, email: payload.email };
  } catch {
    throw new IntegrationError("INVALID_IDENTITY", "openid.verify");
  }
}
