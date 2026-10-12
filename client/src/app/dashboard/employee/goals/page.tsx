import type { Metadata } from "next";
import { EmployeeWorkspaceView } from "@/components/dashboard/EmployeeWorkspaceView";
export const metadata: Metadata = { title: "Goals & OKRs | Ricoz" };
export default function GoalsPage() { return <EmployeeWorkspaceView area="goals" />; }
