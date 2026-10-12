import type { Metadata } from "next";
import { OrganizationView } from "@/components/dashboard/organization/OrganizationStructure";
export const metadata: Metadata = { title: "Organization | Ricoz Inno" };
export default function OrganizationPage() {
  return <OrganizationView />;
}
