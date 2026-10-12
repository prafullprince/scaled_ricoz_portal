import type { Metadata } from "next";
import { EmployeeWorkspaceView } from "@/components/dashboard/EmployeeWorkspaceView";

export const metadata: Metadata = { title: "My Calendar | Ricoz" };

export default function ExecutiveCalendarPage() {
  return <EmployeeWorkspaceView area="calendar" executive />;
}