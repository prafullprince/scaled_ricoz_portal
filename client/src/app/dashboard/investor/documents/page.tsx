import type { Metadata } from "next";
import { RoleAreaPage } from "@/components/dashboard/RoleAreaPage";

export const metadata: Metadata = { title: "Documents | Ricoz" };

export default function InvestorDocumentsPage() {
  return (
    <RoleAreaPage
      area="investor"
      title="Documents"
      description="Investment-related documents shared with you."
      emptyTitle="No investment documents"
      emptyDescription="Investment documents will appear here when available."
    />
  );
}
