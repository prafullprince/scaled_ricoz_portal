import type { Metadata } from "next";
import { MyTaskWorkspace } from "@/components/dashboard/TaskWorkspace";

export const metadata: Metadata = { title: "Task report | Ricoz" };

export default function InternTaskReportPage() {
  return <MyTaskWorkspace role="intern" initialTab="report" />;
}
