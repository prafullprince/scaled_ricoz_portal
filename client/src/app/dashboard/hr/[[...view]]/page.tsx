import { notFound } from "next/navigation";
import { HrWorkspace, type HrView } from "@/components/dashboard/hr/HrWorkspace";

const views = new Set<HrView>(["dashboard", "work", "calendar", "approvals", "requests", "people", "finance", "documents", "training", "employee-os", "reports", "assistant", "candidate-source"]);

export default async function HrPage({ params }: { params: Promise<{ view?: string[] }> }) {
  const segments = (await params).view;
  if (segments && segments.length > 1) notFound();
  const view = (segments?.[0] ?? "dashboard") as HrView;
  if (!views.has(view)) notFound();
  return <HrWorkspace view={view} />;
}