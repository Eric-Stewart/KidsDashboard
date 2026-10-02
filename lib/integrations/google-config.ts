import "server-only";
import { validateEncryptionKey } from "../token-crypto";
import { IntegrationError } from "./google-policy";
export function appOrigin() {
  try {
    const url = new URL(process.env.AUTH_URL || "");
    if (
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(
          process.env.NODE_ENV !== "production" &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        ))
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new IntegrationError("NOT_CONFIGURED");
  }
}
export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (
    !clientId ||
    !clientSecret ||
    redirectUri !== `${appOrigin()}/api/integrations/google/callback`
  )
    throw new IntegrationError("NOT_CONFIGURED");
  validateEncryptionKey();
  return { clientId, clientSecret, redirectUri };
}
export function googleReady() {
  try {
    googleConfig();
    return true;
  } catch {
    return false;
  }
}
export function sameOrigin(request: Request) {
  try {
    return request.headers.get("origin") === appOrigin();
  } catch {
    return false;
  }
}
