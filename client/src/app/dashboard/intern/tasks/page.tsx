import type { Metadata } from "next";
import { DailyTaskWorkspace } from "@/components/dashboard/DailyTaskWorkspace";
import { DeliveryTaskEntry } from "@/components/dashboard/delivery/DeliveryTaskEntry";

export const metadata: Metadata = { title: "Tasks | Ricoz" };

export default function InternTasksPage() {
  return <DeliveryTaskEntry existing={<DailyTaskWorkspace role="intern" />} />;
}
