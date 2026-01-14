import { getServerSession, authOptions } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userName = session?.user?.name?.split(" ")[0] || "Agent";

  return <DashboardClient userName={userName} />;
}
