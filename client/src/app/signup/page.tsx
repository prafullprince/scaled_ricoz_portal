import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/AuthForms";
import { AuthOnlyGuard } from "@/components/auth/AuthOnlyGuard";

export const metadata: Metadata = {
  title: "Create Account | Ricoz",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <Suspense>
      <AuthOnlyGuard>
        <SignupForm />
      </AuthOnlyGuard>
    </Suspense>
  );
}
