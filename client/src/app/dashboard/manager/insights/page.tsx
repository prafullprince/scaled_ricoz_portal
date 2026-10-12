import type { Metadata } from "next";
import { ManagerDashboard } from "@/components/dashboard/ManagerDashboard";

export const metadata: Metadata = { title: "Team insights | Ricoz" };

export default function ManagerInsightsPage() {
  return <ManagerDashboard initialView="insights" />;
}