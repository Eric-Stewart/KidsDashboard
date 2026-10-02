import { getDashboardData } from "@/lib/data";
import { Settings } from "@/components/settings";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; connection?: string }>;
}) {
  const params = await searchParams;
  return (
    <Settings
      data={await getDashboardData()}
      connectedChild={
        params.connected === "e"
          ? "Eric"
          : params.connected === "a"
            ? "Ada"
            : undefined
      }
      connectionError={params.connection}
    />
  );
}
