import type { Metadata } from "next";
import { NotificationsView } from "@/components/dashboard/NotificationsView";

export const metadata: Metadata = { title: "Notifications | Ricoz" };

export default function NotificationsPage() {
  return <NotificationsView />;
}
