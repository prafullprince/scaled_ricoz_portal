import type { Metadata } from "next";
import { RoleAreaPage } from "@/components/dashboard/RoleAreaPage";

export const metadata: Metadata = { title: "Work | Ricoz" };

export default function EmployeeWorkPage() {
  return (
    <RoleAreaPage
      area="employee"
      title="Work"
      description="Your current work items."
      emptyTitle="No work items yet"
      emptyDescription="Your work items will appear here once assigned."
    />
  );
}
