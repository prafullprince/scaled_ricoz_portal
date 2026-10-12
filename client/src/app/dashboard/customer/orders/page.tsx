import type { Metadata } from "next";
import { RoleAreaPage } from "@/components/dashboard/RoleAreaPage";

export const metadata: Metadata = { title: "Orders | Ricoz" };

export default function CustomerOrdersPage() {
  return (
    <RoleAreaPage
      area="customer"
      title="Orders"
      description="Your order history with Ricoz."
      emptyTitle="No orders yet"
      emptyDescription="Your orders will appear here once placed."
    />
  );
}
