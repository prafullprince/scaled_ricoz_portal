import type { Metadata } from "next";
import { IntegrationsWorkspace } from "@/components/dashboard/integrations/IntegrationsWorkspace";

export const metadata: Metadata = { title: "Integrations | Ricoz" };

export default function IntegrationsPage() {
  return <IntegrationsWorkspace />;
}
