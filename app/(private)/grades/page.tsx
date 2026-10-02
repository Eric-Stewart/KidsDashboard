import { getDashboardData } from "@/lib/data";
import { Grades } from "@/components/grades";
export default async function Page() {
  return <Grades data={await getDashboardData()} />;
}
