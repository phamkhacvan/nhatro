import { dashboardData } from "@/app/actions";
import HomeTabs from "@/components/home-tabs";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { active, houses, totalCumRevenue, totalCumPaid } = await dashboardData();
  return <HomeTabs active={active} houses={houses} totalCumRevenue={totalCumRevenue} totalCumPaid={totalCumPaid} />;
}