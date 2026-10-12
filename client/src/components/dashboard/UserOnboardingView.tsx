"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, BriefcaseBusiness, Check, GraduationCap, LoaderCircle, Search, UserRound, UserRoundX, X } from "lucide-react";
import api from "@/services/axios";
import { DashboardCard, DashboardEmptyState } from "./DashboardPrimitives";

type ReviewAccount = {
  _id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  about?: string;
  profile_pic?: string;
  roles: string[];
  status: "PENDING" | "ACTIVE";
  emailVerifiedAt?: string | null;
  createdAt?: string;
};

const roleOptions = ["EMPLOYEE", "INTERN", "HR", "CUSTOMER", "INVESTOR", "CFO"];
const prettyRole = (role: string) => role.charAt(0) + role.slice(1).toLowerCase();

export function UserOnboardingView() {
  const [accounts, setAccounts] = useState<ReviewAccount[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("EMPLOYEE");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ users: ReviewAccount[] }>("/admin/onboarding");
      setAccounts(response.data.users);
      setError("");
    } catch {
      setError("The onboarding review queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  async function decide(account: ReviewAccount, decision: "ACCEPTED" | "DECLINED") {
    setBusyId(account._id);
    setError("");
    try {
      await api.patch(`/admin/onboarding/${account._id}/review`, { decision });
      const nextStatus: ReviewAccount["status"] = decision === "ACCEPTED" ? "ACTIVE" : "PENDING";
      setAccounts((current) => current.map((item) => item._id === account._id ? { ...item, status: nextStatus } : item).filter((item) => decision !== "DECLINED" || item._id !== account._id));
    } catch {
      setError(`${account.name} could not be ${decision.toLowerCase()}. Refresh and try again.`);
    } finally {
      setBusyId(null);
    }
  }

  async function assignRole(account: ReviewAccount) {
    setBusyId(account._id);
    setError("");
    try {
      await api.patch(`/admin/onboarding/${account._id}/role`, { role: selectedRole });
      setAccounts((current) => current.filter((item) => item._id !== account._id));
      setEditingRole(null);
    } catch {
      setError(`${account.name}'s role could not be saved.`);
    } finally {
      setBusyId(null);
    }
  }

  const query = search.trim().toLowerCase();
  const visible = accounts.filter((account) => `${account.name} ${account.email}`.toLowerCase().includes(query));
  const pending = visible.filter((account) => account.status === "PENDING");
  const accepted = visible.filter((account) => account.status === "ACTIVE");
  const AccountCard = ({ account }: { account: ReviewAccount }) => {
    const busy = busyId === account._id;
    return (
      <article key={account._id} className="border-b border-(--brand-border) py-5 last:border-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--brand-surface-hover) text-(--brand-text-secondary)">{account.profile_pic ? <span className="text-sm font-semibold">{account.name.slice(0, 1).toUpperCase()}</span> : <UserRound size={19}/>}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-(--brand-navy)">{account.name}</h3>{account.emailVerifiedAt ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><BadgeCheck size={13}/>Verified email</span> : <span className="text-[11px] font-semibold text-amber-700">Email not verified</span>}</div>
              <p className="mt-0.5 break-all text-sm text-(--brand-text-secondary)">{account.email}</p>
              <p className="mt-1 text-xs text-(--brand-text-muted)">{account.phoneNumber || "No phone provided"}{account.createdAt ? ` · Created ${new Date(account.createdAt).toLocaleDateString()}` : ""}</p>
              {account.about ? <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm text-(--brand-text-secondary)">{account.about}</p> : null}
            </div>
          </div>
          {account.status === "PENDING" ? (
            <div className="flex shrink-0 flex-wrap gap-2 lg:pt-1">
              <button type="button" disabled={busy} onClick={() => void decide(account, "ACCEPTED")} className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50"><Check size={15}/>Accept</button>
              <button type="button" disabled={busy} onClick={() => void decide(account, "DECLINED")} className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50"><X size={15}/>Decline</button>
            </div>
          ) : editingRole === account._id ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`role-${account._id}`}>Assign role to {account.name}</label>
              <select id={`role-${account._id}`} value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} className="h-9 rounded-md border border-(--brand-border) bg-white px-2 text-sm">
                {roleOptions.map((role) => <option key={role} value={role}>{prettyRole(role)}</option>)}
              </select>
              <button type="button" disabled={busy} onClick={() => void assignRole(account)} className="inline-flex h-9 items-center gap-2 rounded-md bg-(--brand-red) px-3 text-sm font-semibold text-white disabled:opacity-50"><Check size={15}/>Save role</button>
              <button type="button" onClick={() => setEditingRole(null)} className="h-9 rounded-md border border-(--brand-border) px-3 text-sm">Cancel</button>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => { setSelectedRole("EMPLOYEE"); setEditingRole(account._id); }} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-(--brand-border) px-3 text-sm font-semibold text-(--brand-navy) disabled:opacity-50">{account.roles.some((role) => role !== "USER") ? <BriefcaseBusiness size={15}/> : <GraduationCap size={15}/>}Change role</button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-(--brand-border) pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase text-(--brand-red)">Organization-wide</p><h1 className="mt-1 text-xl font-semibold text-(--brand-navy)">User onboarding</h1><p className="mt-1 text-sm text-(--brand-text-secondary)">Review each profile before accepting or declining the account. Assign a work role after acceptance.</p></div>
        <label className="relative block w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-(--brand-text-muted)"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className="h-10 w-full rounded-md border border-(--brand-border) bg-white pl-9 pr-3 text-sm outline-none focus:border-(--brand-navy)"/></label>
      </header>
      {error ? <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-(--brand-text-secondary)"><LoaderCircle className="size-4 animate-spin"/>Loading onboarding profiles</div> : <>
        <section><div className="mb-2 flex items-center justify-between"><h2 className="text-base font-semibold text-(--brand-navy)">Awaiting review</h2><span className="text-xs font-semibold text-(--brand-text-muted)">{pending.length}</span></div><DashboardCard>{pending.length ? pending.map((account) => <AccountCard key={account._id} account={account}/>) : <DashboardEmptyState icon={UserRoundX} title={query ? "No matching profiles" : "No profiles awaiting review"} description={query ? "Try another name or email." : "New verified accounts will appear here for review."}/>}</DashboardCard></section>
        {accepted.length ? <section><div className="mb-2 flex items-center justify-between"><h2 className="text-base font-semibold text-(--brand-navy)">Accepted · role not assigned</h2><span className="text-xs font-semibold text-(--brand-text-muted)">{accepted.length}</span></div><DashboardCard>{accepted.map((account) => <AccountCard key={account._id} account={account}/>)}</DashboardCard></section> : null}
      </>}
    </div>
  );
}