import { notFound } from "next/navigation";
import { CostPlanningWorkspace } from "@/components/dashboard/finance/CostPlanningWorkspace";
import { FinancialSummaryWorkspace } from "@/components/dashboard/finance/FinancialSummaryWorkspace";
import { AiForecastWorkspace } from "@/components/dashboard/finance/AiForecastWorkspace";
import { ResourcePlanningWorkspace } from "@/components/dashboard/finance/ResourcePlanningWorkspace";
import { RevenueProjectionsWorkspace } from "@/components/dashboard/finance/RevenueProjectionsWorkspace";
import styles from "@/components/dashboard/finance/FinanceForecastWorkspace.module.css";

export default async function FinancePage({ params }: { params: Promise<{ view?: string[] }> }) {
  const segments = (await params).view;
  if (segments && (segments.length > 1 || !["revenue-projections", "resource-planning", "cost-planning", "financial-summary", "ai-forecast"].includes(segments[0] ?? ""))) notFound();
  const Workspace = segments?.[0] === "ai-forecast"
    ? AiForecastWorkspace
    : segments?.[0] === "financial-summary"
      ? FinancialSummaryWorkspace
      : segments?.[0] === "cost-planning"
        ? CostPlanningWorkspace
        : segments?.[0] === "resource-planning"
          ? ResourcePlanningWorkspace
          : RevenueProjectionsWorkspace;
  return <div className={styles.financeForecast}><Workspace /></div>;
}
