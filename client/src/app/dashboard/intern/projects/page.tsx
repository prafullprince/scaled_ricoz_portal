import type { Metadata } from "next";
import { RoleAreaPage } from "@/components/dashboard/RoleAreaPage";

export const metadata: Metadata = { title: "Projects | Ricoz" };

export default function InternProjectsPage() {
  return (
    <RoleAreaPage
      area="intern"
      title="Projects"
      description="Projects you're contributing to."
      emptyTitle="No projects yet"
      emptyDescription="Your assigned projects will appear here once available."
    />
  );
}
