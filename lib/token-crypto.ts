import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { IntegrationError } from "./integrations/google-policy";
function key(value = process.env.TOKEN_ENCRYPTION_KEY) {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new IntegrationError("NOT_CONFIGURED");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new IntegrationError("NOT_CONFIGURED");
  return decoded;
}
export function validateEncryptionKey() {
  key();
}
export function encryptToken(
  value: string,
  context: string,
  encryptionKey?: string,
) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(encryptionKey), nonce);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decryptToken(
  envelope: string,
  context: string,
  encryptionKey?: string,
) {
  const secret = key(encryptionKey);
  try {
    const [version, iv, tag, ciphertext, extra] = envelope.split(".");
    if (version !== "v1" || extra !== undefined || !iv || !tag || !ciphertext)
      throw new Error();
    const nonce = Buffer.from(iv, "base64url");
    const authTag = Buffer.from(tag, "base64url");
    if (nonce.length !== 12 || authTag.length !== 16) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", secret, nonce);
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new IntegrationError("RECONNECT_REQUIRED");
  }
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const tokenContext = (child: string, account: string) =>
  `google-refresh:v1:${child}:${account}`;
