import type { Metadata } from "next";
import { RoleAreaPage } from "@/components/dashboard/RoleAreaPage";

export const metadata: Metadata = { title: "Investments | Ricoz" };

export default function InvestorInvestmentsPage() {
  return (
    <RoleAreaPage
      area="investor"
      title="Investments"
      description="Your investment portfolio with Ricoz."
      emptyTitle="No investment information available yet"
      emptyDescription="Investment details will appear here once available."
    />
  );
}
