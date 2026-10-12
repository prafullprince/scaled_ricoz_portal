"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import api from "@/services/axios";
import { DashboardCard, DashboardEmptyState, DashboardError, DashboardSkeleton } from "./DashboardPrimitives";

/** Gates a role-specific dashboard page on the server, then renders an honest empty state. */
export function RoleAreaPage({
  area,
  title,
  description,
  emptyTitle,
  emptyDescription,
  icon,
}: {
  area: "customer" | "investor" | "intern" | "employee";
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon?: LucideIcon;
}) {
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");

  useEffect(() => {
    let active = true;
    api
      .get(`/protected/${area}`)
      .then(() => active && setState("ready"))
      .catch((error) => active && setState(error.response?.status === 403 ? "forbidden" : "error"));
    return () => {
      active = false;
    };
  }, [area]);

  if (state === "loading") return <DashboardSkeleton />;

  if (state === "forbidden")
    return (
      <DashboardCard>
        <p className="text-sm text-(--brand-text-secondary)">
          Your account does not have access to this area yet.{" "}
          <Link
            href="/unauthorized"
            className="font-semibold text-(--brand-red) hover:underline"
          >
            Learn more
          </Link>
        </p>
      </DashboardCard>
    );

  if (state === "error") return <DashboardError message="We couldn't load this page." />;

  return (
    <DashboardCard title={title} description={description}>
      <DashboardEmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
    </DashboardCard>
  );
}
