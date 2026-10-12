import type { Metadata } from "next";
import { RoleAreaPage } from "@/components/dashboard/RoleAreaPage";

export const metadata: Metadata = { title: "Learning | Ricoz" };

export default function InternLearningPage() {
  return (
    <RoleAreaPage
      area="intern"
      title="Learning"
      description="Learning resources for your internship."
      emptyTitle="No learning resources yet"
      emptyDescription="Learning resources will appear here once available."
    />
  );
}
