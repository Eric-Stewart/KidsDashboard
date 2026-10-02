import "server-only";
import { auth } from "@/auth";
import { demoEnabled, allowedParent } from "./auth-policy";
import { redirect } from "next/navigation";
export async function currentParent() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.id === "local-preview")
    return demoEnabled() ? session : null;
  return allowedParent(session.user.email || undefined, true) ? session : null;
}
export async function requireParent() {
  const session = await currentParent();
  if (!session) redirect("/login");
  return session;
}
