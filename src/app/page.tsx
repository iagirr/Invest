import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardData } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export default function Home() {
  const dashboard = getDashboardData();

  return <DashboardShell initialData={dashboard} />;
}
