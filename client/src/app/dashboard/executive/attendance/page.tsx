import type { Metadata } from "next";
import { EmployeeWorkspaceView } from "@/components/dashboard/EmployeeWorkspaceView";

export const metadata: Metadata = { title: "My Attendance | Ricoz" };

export default function ExecutiveAttendancePage() {
  return <EmployeeWorkspaceView area="attendance" executive />;
}