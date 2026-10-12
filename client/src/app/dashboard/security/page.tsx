import type { Metadata } from "next";
import { SecurityView } from "@/components/dashboard/SecurityView";

export const metadata: Metadata = { title: "Security | Ricoz" };

export default function SecurityPage() {
  return <SecurityView />;
}
