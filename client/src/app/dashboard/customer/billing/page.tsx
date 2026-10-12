import type { Metadata } from "next";
import { RoleAreaPage } from "@/components/dashboard/RoleAreaPage";

export const metadata: Metadata = { title: "Billing | Ricoz" };

export default function CustomerBillingPage() {
  return (
    <RoleAreaPage
      area="customer"
      title="Billing"
      description="Invoices and billing information."
      emptyTitle="No billing information yet"
      emptyDescription="Invoices and billing details will appear here once available."
    />
  );
}
