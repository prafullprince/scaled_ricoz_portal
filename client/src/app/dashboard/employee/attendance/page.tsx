import type { Metadata } from "next";
import { EmployeeWorkspaceView } from "@/components/dashboard/EmployeeWorkspaceView";
export const metadata: Metadata = { title: "Attendance | Ricoz" };
export default function AttendancePage() { return <EmployeeWorkspaceView area="attendance" />; }
