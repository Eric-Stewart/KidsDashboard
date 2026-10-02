import { requireParent } from "@/lib/require-auth";
import { Shell } from "@/components/shell";
import { demoEnabled } from "@/lib/auth-policy";
import { signOut } from "@/auth";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireParent();
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <Shell demo={demoEnabled()} logout={logout}>
      {children}
    </Shell>
  );
}
