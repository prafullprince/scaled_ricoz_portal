import type { Metadata } from "next";
import { RoleAreaPage } from "@/components/dashboard/RoleAreaPage";

export const metadata: Metadata = { title: "Updates | Ricoz" };

export default function InvestorUpdatesPage() {
  return (
    <RoleAreaPage
      area="investor"
      title="Updates"
      description="Company updates and communications for investors."
      emptyTitle="No updates yet"
      emptyDescription="Company updates will appear here once shared."
    />
  );
}
