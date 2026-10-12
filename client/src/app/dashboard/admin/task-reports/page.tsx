import type { Metadata } from "next";
import { AdminDailyReportView } from "@/components/dashboard/AdminDailyReportView";

export const metadata: Metadata = { title: "Task reports | Ricoz" };

export default function AdminTaskReportsPage() {
  return <AdminDailyReportView />;
}
