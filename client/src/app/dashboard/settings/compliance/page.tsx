import { Suspense } from "react";
import type { Metadata } from "next";
import { ComplianceWorkspaceView } from "@/components/dashboard/compliance/ComplianceWorkspaceView";

export const metadata: Metadata = {
  title: "Compliance Settings | Ricoz",
  robots: { index: false, follow: false },
};

export default function ComplianceSettingsPage() {
  return <Suspense fallback={<p className="p-6 text-sm text-(--brand-text-muted)">Loading compliance settings...</p>}><ComplianceWorkspaceView settingsOnly /></Suspense>;
}
