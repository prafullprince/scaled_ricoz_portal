"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Network,
  Search,
  Trash2,
  UserRound,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";
import {
  USER_CATEGORIES,
  UserDirectoryService,
  type PlatformUser,
  type UserCategory,
  type UserDirectory,
} from "@/services/userDirectory.service";
import { DashboardCard, DashboardEmptyState, DashboardError, DashboardSkeleton } from "./DashboardPrimitives";
import { ConfirmUserDeletionDialog } from "./ConfirmUserDeletionDialog";
import { useAppSelector } from "@/redux/hooks";

// CEO and Admin accounts are protected server-side so the platform cannot be locked out.
export const isProtectedAccount = (roles: string[]) => roles.includes("CEO") || roles.includes("ADMIN");

const TABS: Array<{ id: UserCategory; label: string; icon: typeof UserRound; hint: string }> = [
  { id: "department", label: "Department", icon: Network, hint: "Heads, managers and executives" },
  { id: "employee", label: "Employees", icon: BriefcaseBusiness, hint: "Employees without a leadership role" },
  { id: "intern", label: "Interns", icon: GraduationCap, hint: "Interns currently on the platform" },
  { id: "user", label: "Users", icon: UserRound, hint: "Accounts with no work role yet" },
];

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
const dateLabel = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

function StatusBadge({ status }: { status: PlatformUser["status"] }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {titleCase(status)}
    </span>
  );
}

export function UserDirectoryView() {
  const [tab, setTab] = useState<UserCategory>("department");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<UserDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PlatformUser | null>(null);
  const myId = useAppSelector((state) => state.auth.user?.user_id ?? null);

  const load = useCallback(async (category: UserCategory, term: string) => {
    setLoading(true);
    try {
      const directory = await UserDirectoryService.list({ category, search: term || undefined });
      setData(directory);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(tab, query), 0);
    return () => clearTimeout(timer);
  }, [load, tab, query]);

  async function toggleStatus(user: PlatformUser) {
    const next = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setBusyId(user.id);
    try {
      const updated = await UserDirectoryService.setStatus(user.id, next);
      setData((current) =>
        current
          ? { ...current, users: current.users.map((item) => (item.id === user.id ? { ...item, status: updated.status } : item)) }
          : current,
      );
      toast.success(`${user.name} is now ${next === "ACTIVE" ? "active" : "inactive"}.`);
    } catch {
      // The axios interceptor surfaces the exact server message.
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeletion() {
    if (!pendingDeletion) return;
    const user = pendingDeletion;
    setBusyId(user.id);
    try {
      await UserDirectoryService.remove(user.id);
      setPendingDeletion(null);
      setData((current) =>
        current
          ? {
              ...current,
              users: current.users.filter((item) => item.id !== user.id),
              counts: { ...current.counts, [user.category]: Math.max(0, current.counts[user.category] - 1) },
            }
          : current,
      );
      toast.success(`${user.name} was removed from the platform.`);
    } catch {
      // The axios interceptor surfaces the exact server message.
    } finally {
      setBusyId(null);
    }
  }

  const activeTab = useMemo(() => TABS.find((item) => item.id === tab)!, [tab]);
  const users = data?.users ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--brand-text-muted)">People administration</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-(--brand-navy)">Users Base</h1>
          <p className="mt-2 max-w-2xl text-sm text-(--brand-text-secondary)">
            Every account on the platform. Activate or deactivate access, open a full profile, or remove an account for good.
          </p>
        </div>
        <label className="relative block w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-(--brand-text-muted)" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            className="w-full rounded-(--radius-lg) border border-(--brand-border) bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-(--brand-navy)"
          />
        </label>
      </div>

      <div role="tablist" aria-label="User categories" className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = id === tab;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                selected
                  ? "border-(--brand-navy) bg-(--brand-navy) text-white"
                  : "border-(--brand-border) bg-white text-(--brand-text-secondary) hover:border-(--brand-navy)"
              }`}
            >
              <Icon size={15} /> {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  selected ? "bg-white/20" : "bg-(--brand-surface-hover) text-(--brand-text-muted)"
                }`}
              >
                {data?.counts[id] ?? "–"}
              </span>
            </button>
          );
        })}
      </div>

      <DashboardCard title={activeTab.label} description={activeTab.hint}>
        {loading && !data ? (
          <DashboardSkeleton />
        ) : failed ? (
          <DashboardError message="Unable to load the user directory." onRetry={() => void load(tab, query)} />
        ) : !users.length ? (
          <DashboardEmptyState
            icon={activeTab.icon}
            title={query ? "No matching accounts" : `No accounts in ${activeTab.label.toLowerCase()}`}
            description={query ? "Try another name or email address." : "Accounts appear here as soon as they join this category."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-(--brand-surface-hover) text-(--brand-text-muted)">
                <tr>
                  <th className="px-4 py-3 font-semibold">Person</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--brand-border)">
                {users.map((user) => {
                  const busy = busyId === user.id;
                  const active = user.status === "ACTIVE";
                  const locked = isProtectedAccount(user.roles) || user.id === myId;
                  return (
                    <tr key={user.id} className="align-middle">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/users/${user.id}`} className="group flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--brand-navy) text-[11px] font-semibold text-white">
                            {user.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-(--brand-text) group-hover:underline">{user.name}</span>
                            <span className="block truncate text-[11px] text-(--brand-text-muted)">{user.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-(--brand-text-secondary)">
                        {user.level ? titleCase(user.level) : user.roles.map(titleCase).join(", ")}
                      </td>
                      <td className="px-4 py-3 text-(--brand-text-secondary)">{user.department ? titleCase(user.department) : "—"}</td>
                      <td className="px-4 py-3 text-(--brand-text-secondary)">{dateLabel(user.created_at)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {locked ? (
                            <span className="text-[11px] font-semibold text-(--brand-text-muted)">
                              {user.id === myId ? "Your account" : "Protected"}
                            </span>
                          ) : (
                            <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void toggleStatus(user)}
                            title={active ? "Deactivate account" : "Activate account"}
                            className="inline-flex items-center gap-1.5 rounded-(--radius-md) border border-(--brand-border) px-2.5 py-1.5 text-[11px] font-semibold text-(--brand-text-secondary) transition hover:border-(--brand-navy) disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : active ? (
                              <UserRoundX size={13} />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                            {active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPendingDeletion(user)}
                            title="Delete account"
                            className="inline-flex items-center gap-1.5 rounded-(--radius-md) border border-(--status-danger-border) px-2.5 py-1.5 text-[11px] font-semibold text-(--status-danger) transition hover:bg-(--status-danger-bg) disabled:opacity-50"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      <ConfirmUserDeletionDialog
        user={pendingDeletion}
        busy={Boolean(pendingDeletion && busyId === pendingDeletion.id)}
        onCancel={() => setPendingDeletion(null)}
        onConfirm={() => void confirmDeletion()}
      />
    </div>
  );
}

export { USER_CATEGORIES };
