"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, GraduationCap, LoaderCircle, Search, UserRoundPlus } from "lucide-react";
import api from "@/services/axios";
import { DashboardCard, DashboardEmptyState } from "./DashboardPrimitives";

type PromotableUser = {
  _id: string;
  name: string;
  email: string;
  createdAt?: string;
};

export function AdminUserPromotionView() {
  const [users, setUsers] = useState<PromotableUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get<{ users: PromotableUser[] }>("/admin/users")
      .then((response) => { if (active) setUsers(response.data.users); })
      .catch(() => { if (active) setError("Unable to load accounts that are ready for onboarding."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function promote(user: PromotableUser, role: "EMPLOYEE" | "INTERN") {
    setBusyUser(user._id);
    setError("");
    try {
      await api.post("/admin/users/promote", { userId: user._id, role });
      setUsers((current) => current.filter((item) => item._id !== user._id));
    } catch {
      setError(`${user.name} could not be promoted. Refresh the list and try again.`);
    } finally {
      setBusyUser(null);
    }
  }

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(query),
    );
  }, [search, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin onboarding</p>
          <h1 className="mt-2 text-xl font-semibold text-(--brand-text)">People & onboarding</h1>
          <Link href="/dashboard/users" className="mt-2 inline-block text-sm font-semibold text-(--brand-red)">All users & access settings</Link>
        </div>
        <label className="relative block w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400" />
        </label>
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <DashboardCard>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading accounts</div>
        ) : !visibleUsers.length ? (
          <DashboardEmptyState title={search ? "No matching accounts" : "No USER accounts pending onboarding"} description={search ? "Try another name or email." : "Every active USER account has already been assigned a work role."} />
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleUsers.map((user) => {
              const busy = busyUser === user._id;
              return (
                <div key={user._id} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700"><UserRoundPlus className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate font-medium text-slate-900">{user.name}</p><p className="truncate text-sm text-slate-500">{user.email}</p></div></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dashboard/users/${user._id}`} className="inline-flex items-center gap-2 rounded-md border border-(--brand-border) bg-(--brand-surface) px-3 py-2 text-sm font-semibold text-(--brand-text)"><UserRoundPlus size={16}/>Profile & roles</Link>
                    <button type="button" disabled={busy} onClick={() => void promote(user, "EMPLOYEE")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"><BriefcaseBusiness className="h-4 w-4" /> Employee</button>
                    <button type="button" disabled={busy} onClick={() => void promote(user, "INTERN")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><GraduationCap className="h-4 w-4" /> Intern</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}