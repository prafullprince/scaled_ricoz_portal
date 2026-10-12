import type { Metadata } from "next";
import { CompanyOverviewView } from "@/components/dashboard/CompanyOverviewView";

export const metadata: Metadata = { title: "Company | Ricoz" };

export default async function CompanyOverviewPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return <CompanyOverviewView companyId={companyId} />;
}
