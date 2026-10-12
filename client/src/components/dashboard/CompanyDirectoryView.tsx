"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Building2, ListChecks, Search, Users } from "lucide-react";
import { CompanyService, type Company, type CompanyCategory } from "@/services/company.service";
import { DashboardCard, DashboardEmptyState, DashboardError, DashboardSkeleton } from "./DashboardPrimitives";
import { useAppSelector } from "@/redux/hooks";

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function CompanyDirectoryView() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [categories, setCategories] = useState<CompanyCategory[]>([]);
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [failed, setFailed] = useState(false);
  const activeCompanyId = useAppSelector((state) => state.auth.user?.company?.id ?? null);

  const load = useCallback(async () => {
    try {
      setCompanies(await CompanyService.list({ search: search.trim() || undefined, category }));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [category, search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    const timer = setTimeout(() => void CompanyService.categories().then(setCategories).catch(() => setCategories([])), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--brand-text-muted)">Group administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-(--brand-navy)">Companies</h1>
        <p className="mt-2 max-w-2xl text-sm text-(--brand-text-secondary)">
          Every company in the group. Open one to see its people, departments and work, all counted inside that company only.
        </p>
      </div>

      <DashboardCard>
        {failed ? (
          <DashboardError message="Unable to load the company list." onRetry={() => void load()} />
        ) : !companies ? (
          <DashboardSkeleton />
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto border-b border-(--brand-border)" role="tablist" aria-label="Company categories">
                {[{ id: "ALL", name: "All" }, ...categories].map((item) => (
                  <button key={item.id ?? item.name} type="button" role="tab" aria-selected={category === item.name || (item.id === "ALL" && category === "ALL")} onClick={() => setCategory(item.id === "ALL" ? "ALL" : item.name)} className={`h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors ${(item.id === "ALL" ? category === "ALL" : category === item.name) ? "border-(--brand-navy) text-(--brand-navy)" : "border-transparent text-(--brand-text-muted) hover:text-(--brand-text)"}`}>
                    {item.name}
                  </button>
                ))}
              </div>
              <label className="flex h-11 max-w-md items-center gap-2 rounded-md border border-(--brand-border) bg-white px-3">
                <Search size={16} className="shrink-0 text-(--brand-text-muted)" />
                <input aria-label="Search companies by name or category" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company or category" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </label>
            </div>
            {!companies.length ? (
              <DashboardEmptyState icon={Building2} title="No matching companies" description="Try another category or search term." />
            ) : <ul className="grid gap-4 md:grid-cols-2">
            {companies.map((company) => (
              <li key={company.id}>
                <Link
                  href={`/dashboard/companies/${company.id}`}
                  className="group flex h-full flex-col rounded-(--radius-lg) border border-(--brand-border) p-4 transition hover:border-(--brand-navy) hover:bg-(--brand-surface-hover)"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-(--radius-lg) bg-(--brand-navy)/10 text-(--brand-navy)">
                      <Building2 size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-sm font-bold text-(--brand-text)">{company.name}</h2>
                        {company.is_default ? (
                          <span className="rounded-full bg-(--brand-surface-hover) px-2 py-0.5 text-[10px] font-semibold uppercase text-(--brand-text-muted)">
                            Group
                          </span>
                        ) : null}
                        {company.id === activeCompanyId ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                            You are here
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-(--brand-text-muted)">
                        {company.category || company.industry || "No category"} · created {dateLabel(company.created_at)}
                      </p>
                      {company.description ? (
                        <p className="mt-2 line-clamp-2 text-xs text-(--brand-text-secondary)">{company.description}</p>
                      ) : null}
                    </div>
                    <ArrowRight size={16} className="mt-1 shrink-0 text-(--brand-text-muted) group-hover:text-(--brand-navy)" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      { icon: Users, label: "People", value: company.stats.members },
                      { icon: Boxes, label: "Products", value: company.stats.products },
                      { icon: ListChecks, label: "Open tasks", value: company.stats.active_tasks },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-(--radius-md) bg-(--brand-surface-hover) py-2">
                        <Icon size={13} className="mx-auto text-(--brand-text-muted)" />
                        <p className="mt-1 text-base font-semibold text-(--brand-navy)">{value}</p>
                        <p className="text-[10px] text-(--brand-text-muted)">{label}</p>
                      </div>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>}
          </>
        )}
      </DashboardCard>
    </div>
  );
}
