"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserRound } from "lucide-react";
import { DEPARTMENTS, departmentDashboard, selectedDepartment, selectedWorkspace } from "@/lib/dashboard/departments";

export function useSelectedDepartment() {
  const pathname = usePathname();
  const params = useSearchParams();
  return selectedDepartment(pathname, params.get("department"));
}

export function useSelectedWorkspace() {
  const pathname = usePathname();
  const params = useSearchParams();
  return selectedWorkspace(pathname, params.get("department"));
}

export function DepartmentRail({ onNavigate }: { onNavigate?: () => void }) {
  const selected = useSelectedWorkspace();
  const workspaces = [{ id: "PERSONAL", label: "My workspace", icon: UserRound }, ...DEPARTMENTS] as const;
  return (
    <nav aria-label="Workspaces" className="flex h-full w-16 shrink-0 flex-col items-center border-r border-(--brand-border) bg-white py-4">
      <Link href={departmentDashboard("PRODUCT")} onClick={onNavigate} aria-label="Product workspace home" className="mb-5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--brand-red) text-lg font-bold text-white">R</Link>
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-1">
        {workspaces.map(({ id, label, icon: Icon }) => (
          <Link key={id} href={departmentDashboard(id)} onClick={onNavigate} aria-label={id === "PERSONAL" ? label : `${label} department`} title={label} aria-current={selected === id ? "page" : undefined} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${selected === id ? "bg-(--brand-red-pale) text-(--brand-red) ring-1 ring-inset ring-(--brand-red-soft)" : "text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)"}`}>
            <Icon size={21} strokeWidth={1.7} />
          </Link>
        ))}
      </div>
    </nav>
  );
}