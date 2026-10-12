import type { Metadata } from "next";
import { MyPayoutWorkspace } from "@/components/dashboard/MyPayoutWorkspace";

export const metadata: Metadata = { title: "My Payments | Ricoz" };

export default function MyPaymentsPage() {
  return <MyPayoutWorkspace />;
}
