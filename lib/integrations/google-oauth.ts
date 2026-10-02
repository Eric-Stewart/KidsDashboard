import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "../db";
import {
  decryptToken,
  encryptToken,
  hash,
  tokenContext,
} from "../token-crypto";
import { googleConfig } from "./google-config";
import { GOOGLE_SCOPES, IntegrationError } from "./google-policy";
import {
  requestTokens,
  validateScopes,
  verifyGoogleIdentity,
} from "./google-tokens";
import type { Child } from "../types";
export const OAUTH_COOKIE = "classroom-connect";
export function parentHash(email: string) {
  return hash(email.trim().toLowerCase());
}
export async function beginConnection(child: Child, email: string) {
  const config = googleConfig();
  const state = randomBytes(32).toString("base64url");
  const browser = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const stateHash = hash(state);
  const db = getDb();
  await db.oAuthAttempt.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  await db.oAuthAttempt.create({
    data: {
      stateHash,
      childId: child,
      parentHash: parentHash(email),
      browserHash: hash(browser),
      encryptedVerifier: encryptToken(verifier, `pkce:${stateHash}`),
      nonce,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent select_account",
    scope: GOOGLE_SCOPES.join(" "),
    state,
    nonce,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  }).toString();
  return { url: url.toString(), browser };
}
export async function consumeAttempt(
  state: string | null,
  browser: string | undefined,
  email: string,
  db = getDb(),
) {
  if (
    !state ||
    !browser ||
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    !/^[A-Za-z0-9_-]{43}$/.test(browser)
  )
    throw new IntegrationError("INVALID_STATE");
  const where = {
    stateHash: hash(state),
    parentHash: parentHash(email),
    browserHash: hash(browser),
    expiresAt: { gt: new Date() },
  };
  const attempt = await db.oAuthAttempt.findFirst({ where });
  if (!attempt || (await db.oAuthAttempt.deleteMany({ where })).count !== 1)
    throw new IntegrationError("INVALID_STATE");
  return attempt;
}
export async function completeConnection(
  state: string | null,
  browser: string | undefined,
  email: string,
  code: string | null,
  googleError: string | null,
) {
  const attempt = await consumeAttempt(state, browser, email);
  if (googleError)
    throw new IntegrationError(
      [
        "admin_policy_enforced",
        "org_internal",
        "disallowed_useragent",
      ].includes(googleError)
        ? "ACCOUNT_RESTRICTED"
        : "ACCESS_DENIED",
      "oauth.authorize",
    );
  if (!code || code.length > 4096) throw new IntegrationError("INVALID_STATE");
  const config = googleConfig();
  const tokens = await requestTokens(
    {
      code,
      code_verifier: decryptToken(
        attempt.encryptedVerifier,
        `pkce:${attempt.stateHash}`,
      ),
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    },
    AbortSignal.timeout(25000),
  );
  const identity = await verifyGoogleIdentity(tokens.id_token, attempt.nonce);
  const scopes = validateScopes(tokens.scope);
  if (identity.email.toLowerCase() === email.toLowerCase())
    throw new IntegrationError("USE_STUDENT_ACCOUNT");
  const db = getDb();
  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.oAuthConnection.findUnique({
          where: {
            childId_provider: { childId: attempt.childId, provider: "google" },
          },
        });
        const other = await tx.oAuthConnection.findUnique({
          where: {
            provider_accountId: {
              provider: "google",
              accountId: identity.accountId,
            },
          },
        });
        if (other && other.childId !== attempt.childId)
          throw new IntegrationError("ACCOUNT_IN_USE");
        if (existing && existing.accountId !== identity.accountId)
          throw new IntegrationError("ACCOUNT_CHANGED");
        if (!tokens.refresh_token && !existing)
          throw new IntegrationError("RECONNECT_REQUIRED", "oauth.token");
        const encryptedRefreshToken = tokens.refresh_token
          ? encryptToken(
              tokens.refresh_token,
              tokenContext(attempt.childId, identity.accountId),
            )
          : existing!.encryptedRefreshToken;
        if (existing) {
          const updated = await tx.oAuthConnection.updateMany({
            where: { id: existing.id, accountId: identity.accountId },
            data: {
              encryptedRefreshToken,
              scopes,
              accountEmail: identity.email,
            },
          });
          if (updated.count !== 1)
            throw new IntegrationError("ACCOUNT_CHANGED");
        } else {
          await tx.oAuthConnection.create({
            data: {
              childId: attempt.childId,
              provider: "google",
              accountId: identity.accountId,
              accountEmail: identity.email,
              encryptedRefreshToken,
              scopes,
            },
          });
        }
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    // Concurrent connects fail closed; neither account identity nor history is overwritten.
    throw new IntegrationError("DATABASE_ERROR");
  }
  return attempt.childId;
}
