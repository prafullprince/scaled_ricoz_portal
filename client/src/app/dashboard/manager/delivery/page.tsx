import type { Metadata } from "next";
import { ManagerDashboard } from "@/components/dashboard/ManagerDashboard";
import { DeliveryTaskEntry } from "@/components/dashboard/delivery/DeliveryTaskEntry";

export const metadata: Metadata = { title: "Delivery pipeline | Ricoz" };

export default function ManagerDeliveryPage() {
  return <DeliveryTaskEntry existing={<ManagerDashboard initialView="delivery" />} />;
}