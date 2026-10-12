import type { Metadata } from "next";
import { RoleAreaPage } from "@/components/dashboard/RoleAreaPage";

export const metadata: Metadata = { title: "Customer Overview | Ricoz" };

export default function CustomerOverviewPage() {
  return (
    <RoleAreaPage
      area="customer"
      title="Customer overview"
      description="A summary of your Ricoz customer account."
      emptyTitle="No customer information yet"
      emptyDescription="Your customer overview will appear here once available."
    />
  );
}
