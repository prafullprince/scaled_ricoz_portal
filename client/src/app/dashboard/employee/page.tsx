import type { Metadata } from "next";
import { RoleDashboardView } from "@/components/dashboard/RoleDashboardView";

export const metadata: Metadata = { title: "Employee Overview | Ricoz" };

export default function EmployeeOverviewPage() {
  return <RoleDashboardView area="employee" />;
}
