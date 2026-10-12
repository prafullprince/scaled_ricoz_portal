import type { Metadata } from "next";
import { InvestorAnalyticsOverview } from "@/components/dashboard/investor/analytics/InvestorAnalyticsOverview";

export const metadata: Metadata = { title: "Investor Dashboard | Ricoz" };

export default function InvestorOverviewPage() {
  return <InvestorAnalyticsOverview />;
}
