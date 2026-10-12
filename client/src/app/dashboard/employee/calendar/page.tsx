import type { Metadata } from "next";
import { EmployeeWorkspaceView } from "@/components/dashboard/EmployeeWorkspaceView";
export const metadata: Metadata = { title: "Calendar | Ricoz" };
export default function CalendarPage() { return <EmployeeWorkspaceView area="calendar" />; }
