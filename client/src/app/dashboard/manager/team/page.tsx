import type { Metadata } from "next";
import { ManagerDashboard } from "@/components/dashboard/ManagerDashboard";

export const metadata: Metadata = { title: "Team workspace | Ricoz" };

export default function ManagerTeamPage() {
  return <ManagerDashboard initialView="team" />;
}