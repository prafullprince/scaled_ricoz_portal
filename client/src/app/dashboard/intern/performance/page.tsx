import type { Metadata } from "next";
import { EmployeeWorkspaceView } from "@/components/dashboard/EmployeeWorkspaceView";

export const metadata: Metadata = { title: "Performance | Ricoz" };

export default function InternPerformancePage() {
  return <EmployeeWorkspaceView area="performance" />;
}