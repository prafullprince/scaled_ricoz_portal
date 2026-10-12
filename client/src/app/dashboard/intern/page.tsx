import type { Metadata } from "next";
import { RoleDashboardView } from "@/components/dashboard/RoleDashboardView";

export const metadata: Metadata = { title: "Intern Overview | Ricoz" };

export default function InternOverviewPage() {
  return <RoleDashboardView area="intern" />;
}
