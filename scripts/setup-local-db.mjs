import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parse } from "dotenv";

const path = ".env.local";
let content = existsSync(path) ? readFileSync(path, "utf8") : "";
const env = parse(content);
const password = env.LOCAL_POSTGRES_PASSWORD || randomBytes(32).toString("hex");
function setIfMissing(key, value) {
  if (env[key]) return;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${JSON.stringify(value)}`;
  content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
}
setIfMissing("LOCAL_POSTGRES_PASSWORD", password);
setIfMissing("DATABASE_URL", `postgresql://family_school:${encodeURIComponent(password)}@127.0.0.1:5433/family_school`);
writeFileSync(path, content);
console.log("Local PostgreSQL configuration prepared. Existing database settings were preserved; no credentials were printed.");
