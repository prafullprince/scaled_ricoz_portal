"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { CompanyService, type InvestorCompanyAccessOverview } from "@/services/company.service";
import { DashboardCard, DashboardEmptyState, DashboardError, DashboardSkeleton } from "./DashboardPrimitives";

export function InvestorCompanyAccessManager() {
  const [data, setData] = useState<InvestorCompanyAccessOverview | null>(null);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [draft, setDraft] = useState<{ investorId: string; companyIds: string[] } | null>(null);
  const [investorSearch, setInvestorSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await CompanyService.investorCompanyAccess();
      setData(result);
      setFailed(false);
      setSelectedInvestorId((current) =>
        result.investors.some((investor) => investor.id === current) ? current : result.investors[0]?.id ?? "",
      );
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleInvestors = useMemo(() => {
    const search = investorSearch.trim().toLowerCase();
    return (data?.investors ?? []).filter((investor) =>
      !search || `${investor.name} ${investor.email}`.toLowerCase().includes(search),
    );
  }, [data, investorSearch]);
  const visibleCompanies = useMemo(() => {
    const search = companySearch.trim().toLowerCase();
    return (data?.companies ?? []).filter((company) =>
      !search || `${company.name} ${company.category}`.toLowerCase().includes(search),
    );
  }, [data, companySearch]);
  const selectedInvestor = data?.investors.find((investor) => investor.id === selectedInvestorId);
  const selectedCompanyIds = selectedInvestorId && draft?.investorId === selectedInvestorId
    ? draft.companyIds
    : data?.grants.filter((grant) => grant.investorId === selectedInvestorId).map((grant) => grant.companyId) ?? [];

  function toggleCompany(companyId: string) {
    setDraft({
      investorId: selectedInvestorId,
      companyIds: selectedCompanyIds.includes(companyId)
        ? selectedCompanyIds.filter((id) => id !== companyId)
        : [...selectedCompanyIds, companyId],
    });
  }

  async function save() {
    if (!selectedInvestorId) return;
    setSaving(true);
    try {
      await CompanyService.updateInvestorCompanyAccess(selectedInvestorId, selectedCompanyIds);
      setData((current) => current ? {
        ...current,
        grants: [
          ...current.grants.filter((grant) => grant.investorId !== selectedInvestorId),
          ...selectedCompanyIds.map((companyId) => ({ investorId: selectedInvestorId, companyId })),
        ],
      } : current);
      setDraft(null);
      toast.success("Investor company access updated.");
    } catch {
      toast.error("Could not update investor company access.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--brand-text-muted)">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-(--brand-navy)">Investor company access</h1>
        <p className="mt-2 max-w-2xl text-sm text-(--brand-text-secondary)">
          Choose which companies each investor can view. Removing a company revokes access immediately, including financial dashboards and company switching.
        </p>
      </div>

      {failed ? <DashboardError message="Unable to load investor access settings." onRetry={() => void load()} /> : loading && !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
          <DashboardCard title="Investors" description="Select an investor to manage their company access.">
            <label className="mb-3 flex h-10 items-center gap-2 rounded-md border border-(--brand-border) px-3">
              <Search size={15} className="text-(--brand-text-muted)" />
              <input aria-label="Search investors" value={investorSearch} onChange={(event) => setInvestorSearch(event.target.value)} placeholder="Search name or email" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            {!visibleInvestors.length ? (
              <DashboardEmptyState icon={Users} title="No investors found" description="Investor accounts will appear here when they register." />
            ) : (
              <ul className="max-h-[32rem] space-y-1 overflow-y-auto">
                {visibleInvestors.map((investor) => {
                  const grantCount = data!.grants.filter((grant) => grant.investorId === investor.id).length;
                  return (
                    <li key={investor.id}>
                      <button type="button" onClick={() => setSelectedInvestorId(investor.id)} className={`w-full rounded-md border p-3 text-left transition ${selectedInvestorId === investor.id ? "border-(--brand-navy) bg-(--brand-surface-hover)" : "border-transparent hover:border-(--brand-border) hover:bg-(--brand-surface-hover)"}`}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-(--brand-text)">{investor.name}</span>
                          <span className="shrink-0 rounded-full bg-(--brand-surface-active) px-2 py-0.5 text-[10px] font-semibold text-(--brand-text-muted)">{grantCount} {grantCount === 1 ? "company" : "companies"}</span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-(--brand-text-secondary)">{investor.email}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard
            title={selectedInvestor ? `Companies for ${selectedInvestor.name}` : "Company access"}
            description="Only selected active companies are available to this investor."
            action={selectedInvestor ? (
              <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-10 items-center gap-2 rounded-md bg-(--brand-navy) px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                <Check size={15} /> {saving ? "Saving…" : "Save access"}
              </button>
            ) : null}
          >
            {!selectedInvestor ? (
              <DashboardEmptyState icon={ShieldCheck} title="Select an investor" description="Select an investor to grant or revoke company access." />
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-(--brand-surface-hover) px-3 py-2">
                  <span className="text-sm font-medium text-(--brand-text)">{selectedInvestor.email}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-(--brand-text-secondary)">{selectedCompanyIds.length} selected</span>
                </div>
                <label className="mb-3 flex h-10 items-center gap-2 rounded-md border border-(--brand-border) px-3">
                  <Search size={15} className="text-(--brand-text-muted)" />
                  <input aria-label="Search companies" value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Search company or category" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                </label>
                {!visibleCompanies.length ? (
                  <DashboardEmptyState icon={Building2} title="No active companies found" description="Create or activate a company before assigning access." />
                ) : (
                  <ul className="max-h-[32rem] divide-y divide-(--brand-border) overflow-y-auto rounded-md border border-(--brand-border)">
                    {visibleCompanies.map((company) => {
                      const checked = selectedCompanyIds.includes(company.id);
                      return (
                        <li key={company.id}>
                          <label className="flex cursor-pointer items-center gap-3 p-3 transition hover:bg-(--brand-surface-hover)">
                            <input type="checkbox" checked={checked} onChange={() => toggleCompany(company.id)} className="size-4 accent-(--brand-navy)" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-(--brand-text)">{company.name}</span>
                              <span className="mt-0.5 block truncate text-xs text-(--brand-text-muted)">{company.category || "Company"}</span>
                            </span>
                            {checked ? <Check size={16} className="text-emerald-600" /> : null}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </DashboardCard>
        </div>
      )}
    </div>
  );
}
