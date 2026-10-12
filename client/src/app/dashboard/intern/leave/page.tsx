import type { Metadata } from "next";
import { EmployeeWorkspaceView } from "@/components/dashboard/EmployeeWorkspaceView";

export const metadata: Metadata = { title: "Leave & Time Off | Ricoz" };

export default function InternLeavePage() {
  return <EmployeeWorkspaceView area="leave" />;
}