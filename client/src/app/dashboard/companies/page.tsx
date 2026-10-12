import type { Metadata } from "next";
import { CompanyDirectoryView } from "@/components/dashboard/CompanyDirectoryView";

export const metadata: Metadata = { title: "Companies | Ricoz" };

export default function CompaniesPage() {
  return <CompanyDirectoryView />;
}
