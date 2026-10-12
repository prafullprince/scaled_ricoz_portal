import type { Metadata } from "next";
import { InvestorVerificationView } from "@/components/dashboard/investor/InvestorVerificationView";

export const metadata: Metadata = { title: "Investor Verification | Ricoz" };

export default function InvestorVerificationPage() {
  return <InvestorVerificationView />;
}
