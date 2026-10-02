import { getDashboardData } from "@/lib/data";
import { Dashboard } from "@/components/dashboard";
export default async function Page() {
  return <Dashboard data={await getDashboardData()} />;
}
