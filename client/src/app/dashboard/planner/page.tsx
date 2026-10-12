import type { Metadata } from "next";
import { DailyPlannerView } from "@/components/dashboard/DailyPlannerView";

export const metadata: Metadata = { title: "Daily Planner | Ricoz" };

export default function DailyPlannerPage() {
  return <DailyPlannerView />;
}
