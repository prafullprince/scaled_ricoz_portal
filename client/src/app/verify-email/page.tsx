import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/AuthForms";
import { AuthOnlyGuard } from "@/components/auth/AuthOnlyGuard";

export const metadata: Metadata = {
  title: "Verify Email | Ricoz",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return <Suspense><AuthOnlyGuard><VerifyEmailForm /></AuthOnlyGuard></Suspense>;
}
