"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Building2,
  CalendarCheck,
  Flag,
  GraduationCap,
  ListChecks,
  Network,
  Users,
} from "lucide-react";
import { CompanyService, type CompanyOverview, type CompanyPerson } from "@/services/company.service";
import { DashboardCard, DashboardEmptyState, DashboardError, DashboardSkeleton } from "./DashboardPrimitives";

type PeopleTab = "department" | "employees" | "interns";

const TABS: Array<{ id: PeopleTab; label: string; icon: typeof Users }> = [
  { id: "department", label: "Department", icon: Network },
  { id: "employees", label: "Employees", icon: Users },
  { id: "interns", label: "Interns", icon: GraduationCap },
];

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-(--radius-lg) border border-(--brand-border) p-4">
      <Icon size={16} className="text-(--brand-text-muted)" />
      <p className="mt-2 text-xs text-(--brand-text-secondary)">{label}</p>
      <p className="text-2xl font-semibold text-(--brand-navy)">{value}</p>
      {hint ? <p className="text-[11px] text-(--brand-text-muted)">{hint}</p> : null}
    </div>
  );
}

function PeopleTable({ people }: { people: CompanyPerson[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-xs">
        <thead className="bg-(--brand-surface-hover) text-(--brand-text-muted)">
          <tr>
            <th className="px-4 py-3 font-semibold">Person</th>
            <th className="px-4 py-3 font-semibold">Role in company</th>
            <th className="px-4 py-3 font-semibold">Department</th>
            <th className="px-4 py-3 font-semibold">Since</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--brand-border)">
          {people.map((person) => (
            <tr key={person.id}>
              <td className="px-4 py-3">
                <Link href={`/dashboard/users/${person.id}`} className="group flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--brand-navy) text-[11px] font-semibold text-white">
                    {person.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-(--brand-text) group-hover:underline">{person.name}</span>
                    <span className="block truncate text-[11px] text-(--brand-text-muted)">{person.email}</span>
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-(--brand-text-secondary)">
                {titleCase(person.level)}
                {person.designation ? ` · ${titleCase(person.designation)}` : ""}
              </td>
              <td className="px-4 py-3 text-(--brand-text-secondary)">{titleCase(person.department)}</td>
              <td className="px-4 py-3 text-(--brand-text-secondary)">{dateLabel(person.since)}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                    person.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {titleCase(person.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompanyOverviewView({ companyId }: { companyId: string }) {
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<PeopleTab>("department");

  const load = useCallback(async () => {
    try {
      setOverview(await CompanyService.overview(companyId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [companyId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const people = useMemo(() => {
    if (!overview) return [];
    return tab === "department" ? overview.people.department : tab === "employees" ? overview.people.employees : overview.people.interns;
  }, [overview, tab]);

  if (failed) return <DashboardError message="Unable to load this company." onRetry={() => void load()} />;
  if (!overview) return <DashboardSkeleton />;

  const { company, stats } = overview;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/companies"
        className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-text-secondary) hover:text-(--brand-navy)"
      >
        <ArrowLeft size={15} /> All companies
      </Link>

      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-(--radius-lg) bg-(--brand-navy)/10 text-(--brand-navy)">
          <Building2 size={24} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-(--brand-navy)">{company.name}</h1>
            {company.is_default ? (
              <span className="rounded-full bg-(--brand-surface-hover) px-2 py-0.5 text-[10px] font-semibold uppercase text-(--brand-text-muted)">
                Group company
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-(--brand-text-secondary)">
            {company.category || company.industry || "No category set"} · created {dateLabel(company.created_at)}
          </p>
          {company.description ? <p className="mt-2 max-w-2xl text-sm text-(--brand-text-secondary)">{company.description}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="People placed" value={stats.members} hint={`${stats.heads} heads · ${stats.managers} managers`} />
        <Stat icon={Boxes} label="Products" value={stats.products} hint={`${stats.products_by_status.production} in production`} />
        <Stat icon={ListChecks} label="Tasks" value={stats.tasks} hint={`${stats.pending_tasks} open · ${stats.completed_tasks} done`} />
        <Stat icon={CalendarCheck} label="Attendance this month" value={stats.attendance_this_month} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Employees" value={stats.employees} />
        <Stat icon={GraduationCap} label="Interns" value={stats.interns} />
        <Stat icon={Flag} label="Leave awaiting a decision" value={stats.pending_leave} />
        <Stat icon={Boxes} label="Products in development" value={stats.products_by_status.development} />
      </div>

      <DashboardCard title="Departments" description="Where this company's people sit">
        {!overview.departments.length ? (
          <DashboardEmptyState
            icon={Network}
            title="No departments yet"
            description="Place a department head from the organization chart to get started."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.departments.map(({ department, total }) => (
              <li key={department} className="flex items-center justify-between rounded-(--radius-lg) border border-(--brand-border) px-4 py-3">
                <span className="text-sm font-semibold text-(--brand-text)">{titleCase(department)}</span>
                <span className="text-sm font-semibold text-(--brand-navy)">{total}</span>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <div>
        <div role="tablist" aria-label="People in this company" className="flex flex-wrap gap-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const selected = id === tab;
            const count =
              id === "department"
                ? overview.people.department.length
                : id === "employees"
                  ? overview.people.employees.length
                  : overview.people.interns.length;
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
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <DashboardCard>
          {!people.length ? (
            <DashboardEmptyState
              icon={Users}
              title="Nobody here yet"
              description={`No one works in this company as ${tab === "department" ? "a department lead" : tab}. People keep their work in the company that assigned it.`}
            />
          ) : (
            <PeopleTable people={people} />
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
