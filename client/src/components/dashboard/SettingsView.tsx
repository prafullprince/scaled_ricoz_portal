"use client";

import Link from "next/link";
import { useAppSelector } from "@/redux/hooks";
import { DashboardCard, DashboardEmptyState } from "@/components/dashboard/DashboardPrimitives";

export function SettingsView() {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-(--brand-navy)">Settings</h1>
        <p className="mt-1 text-sm text-(--brand-text-secondary)">Manage your account preferences.</p>
      </div>

      <DashboardCard title="Account" description="Basic account information.">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-(--brand-text-muted)">Name</dt>
            <dd className="font-medium text-(--brand-text)">{user.user_name}</dd>
          </div>
          <div>
            <dt className="text-(--brand-text-muted)">Email</dt>
            <dd className="font-medium text-(--brand-text)">{user.user_email}</dd>
          </div>
        </dl>
        <Link href="/dashboard/profile" className="mt-4 inline-block text-sm font-semibold text-(--brand-red) hover:underline">
          Edit profile
        </Link>
      </DashboardCard>

      <DashboardCard title="Preferences">
        <DashboardEmptyState
          title="No additional preferences yet"
          description="Notification and account preferences will appear here once available."
        />
      </DashboardCard>
    </div>
  );
}
