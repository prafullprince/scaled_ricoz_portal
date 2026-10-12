"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { useHydrated } from "@/lib/useHydrated";

function safeRedirect(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

const loadingFallback = (
  <div className="flex min-h-screen items-center justify-center bg-(--brand-surface)" />
);

export function AuthOnlyGuard({ children }: { children: ReactNode }) {
  const authStatus = useAppSelector((state) => state.auth.status);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();

  useEffect(() => {
    if (authStatus === "authenticated") {
      router.replace(safeRedirect(searchParams.get("redirect")));
    }
  }, [authStatus, pathname, router, searchParams]);

  if (!hydrated || authStatus === "authenticated" || authStatus === "checking") {
    return loadingFallback;
  }

  return children;
}
