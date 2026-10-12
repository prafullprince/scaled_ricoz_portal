import { notFound } from "next/navigation";
import { SalesWorkspace, type SalesView } from "@/components/dashboard/sales/SalesWorkspace";

const views = new Set<SalesView>(["dashboard", "work", "calendar", "approvals", "crm", "lead-source", "follow-ups", "assistant", "customers", "reports", "integrations"]);

export default async function SalesPage({ params }: { params: Promise<{ view?: string[] }> }) {
  const segments = (await params).view;
  if (segments && segments.length > 1) notFound();
  const view = (segments?.[0] ?? "dashboard") as SalesView;
  if (!views.has(view)) notFound();
  return <SalesWorkspace view={view} />;
}