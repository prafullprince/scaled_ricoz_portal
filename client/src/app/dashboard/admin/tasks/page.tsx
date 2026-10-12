import type { Metadata } from "next";
import { TaskWorkflowWorkspace } from "@/components/dashboard/TaskWorkflowWorkspace";

export const metadata: Metadata = { title: "Task operations | Ricoz" };

export default function AdminTasksPage() {
  return <TaskWorkflowWorkspace />;
}
