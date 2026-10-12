import type { Metadata } from "next";
import { ExecutiveDashboardView } from "@/components/dashboard/ExecutiveDashboardView";

export const metadata: Metadata = { title: "Executive Dashboard | Ricoz" };

export default function ExecutiveDashboardPage() {
  return <ExecutiveDashboardView />;
}