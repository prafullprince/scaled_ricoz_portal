"use client";

import { useEffect, useState } from "react";
import { Building2, Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/redux/hooks";
import { setUser } from "@/redux/slice/auth.slice";
import { toast } from "sonner";
import { CompanyService, type Company } from "@/services/company.service";
import { DashboardCard } from "@/components/dashboard/DashboardPrimitives";

export function ProfileCompanySwitcher({ activeCompanyId }: { activeCompanyId?: string }) {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const router = useRouter();
  const dispatch = useAppDispatch();

  useEffect(() => {
    let active = true;
    CompanyService.list()
      .then((items) => {
        if (active) setCompanies(items);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (failed || !companies || !companies.length) return null;

  async function switchTo(company: Company) {
    if (company.id === activeCompanyId || switchingId) return;
    setSwitchingId(company.id);
    try {
      const activeUser = await CompanyService.activate(company.id);
      dispatch(setUser(activeUser));
      router.replace("/dashboard");
      router.refresh();
    } catch {
      toast.error(`Could not switch companies. Your current company is unchanged.`);
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <DashboardCard title="Company access" description="Switch between your home company and assigned companies.">
      <div className="divide-y divide-(--brand-border)">
        {companies.map((company) => {
          const isActive = company.id === activeCompanyId;
          const isSwitching = switchingId === company.id;
          return (
            <div key={company.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-(--brand-surface) text-(--brand-text)">
                <Building2 size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-(--brand-navy)">{company.name}</span>
                <span className="block text-xs text-(--brand-text-secondary)">{company.is_home ? "Home company" : "Assigned company"}{company.assigned_hr ? " / Assigned HR" : ""}</span>
                {company.assignments?.map((assignment) => <span key={`${assignment.department}:${assignment.level}`} className="block break-words text-xs text-(--brand-text-secondary)">{assignment.department} / {assignment.level} / {assignment.roles?.join(", ")}</span>)}
              </span>
              {isActive ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#008f69]"><Check size={15} /> Current</span>
              ) : (
                <button
                  type="button"
                  onClick={() => switchTo(company)}
                  disabled={switchingId !== null}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-(--brand-border-strong) px-3 text-xs font-semibold text-(--brand-text) hover:border-(--brand-red) hover:text-(--brand-red) disabled:opacity-60"
                >
                  {isSwitching ? <LoaderCircle size={14} className="animate-spin" /> : null}
                  Switch
                </button>
              )}
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}