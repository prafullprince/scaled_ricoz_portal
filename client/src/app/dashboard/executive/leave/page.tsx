import type { Metadata } from "next";
import { EmployeeWorkspaceView } from "@/components/dashboard/EmployeeWorkspaceView";

export const metadata: Metadata = { title: "My Leave & Time Off | Ricoz" };

export default function ExecutiveLeavePage() {
  return <EmployeeWorkspaceView area="leave" executive />;
}