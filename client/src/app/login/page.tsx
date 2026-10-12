import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/AuthForms";
import { AuthOnlyGuard } from "@/components/auth/AuthOnlyGuard";

export const metadata: Metadata = {
  title: "Sign In | Ricoz",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense>
      <AuthOnlyGuard><LoginForm /></AuthOnlyGuard>
    </Suspense>
  );
}
