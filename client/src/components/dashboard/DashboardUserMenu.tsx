"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAppDispatch } from "@/redux/hooks";
import { clearAuth } from "@/redux/slice/auth.slice";
import { AuthService } from "@/services/auth.service";
import type { IUser } from "@/redux/slice/auth.slice";
import { useSelectedWorkspace } from "./DepartmentRail";
import { departmentHref } from "@/lib/dashboard/departments";
import { CompanySwitcherDrawer } from "./CompanySwitcherDrawer";
import { CompanyService } from "@/services/company.service";

export function DashboardUserMenu({ user }: { user: IUser }) {
  const department = useSelectedWorkspace();
  const executive = user.roles.some((role) => role === "CEO" || role === "ADMIN");
  const hrefFor = (path: string) => executive ? departmentHref(path, department) : path;
  const [open, setOpen] = useState(false);
  const [serverCanSwitchCompany, setServerCanSwitchCompany] = useState<boolean | null>(null);
  const [serverCanCreateCompany, setServerCanCreateCompany] = useState<boolean | null>(null);
  const refreshSwitchAccess = useCallback(async () => {
    try {
      const access = await CompanyService.current();
      setServerCanSwitchCompany(access.can_switch_company);
      setServerCanCreateCompany(access.can_create_company);
    } catch {
      // Keep the auth payload value if the current-company check is unavailable.
    }
  }, []);
  const canSwitchCompany = serverCanSwitchCompany ?? Boolean(user.can_switch_company);
  const containerRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const router = useRouter();

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refreshSwitchAccess(), 0);
    window.addEventListener("focus", refreshSwitchAccess);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener("focus", refreshSwitchAccess);
    };
  }, [refreshSwitchAccess, user.user_id]);

  useEffect(() => {
    // The company drawer renders in a portal and handles its own dismissal.
    if (canSwitchCompany) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [canSwitchCompany]);

  async function handleLogout() {
    try {
      await AuthService.logout();
    } finally {
      dispatch(clearAuth());
      router.replace("/login");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open) void refreshSwitchAccess();
          setOpen((value) => !value);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex max-w-56 items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium text-(--brand-text) hover:bg-(--brand-surface-hover)"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--brand-navy) text-xs font-semibold text-white">
          {user.user_name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden min-w-0 flex-col text-left leading-tight md:flex">
          <span className="truncate">{user.user_name}</span>
          {user.company ? (
            <span className="truncate text-xs font-normal text-(--brand-text-muted)">{user.company.name}</span>
          ) : null}
        </span>
        <ChevronDown size={14} className="shrink-0 text-(--brand-text-muted)" />
      </button>
      {canSwitchCompany ? (
        <CompanySwitcherDrawer
          open={open}
          onClose={() => setOpen(false)}
          user={user}
          canCreateCompany={serverCanCreateCompany ?? user.can_create_company ?? false}
          hrefFor={hrefFor}
          onLogout={handleLogout}
        />
      ) : null}
      {open && !canSwitchCompany ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-(--radius-lg) border border-(--brand-border) bg-white py-2 shadow-(--shadow-lg)"
        >
          <div className="border-b border-(--brand-border) px-4 pb-2">
            <p className="truncate text-sm font-semibold text-(--brand-text)">
              {user.user_name}
            </p>
            <p className="truncate text-xs text-(--brand-text-muted)">
              {user.user_email}
            </p>
            {user.organization_title ? (
              <p className="truncate text-xs font-semibold text-[#008f69]">
                {user.organization_title}
              </p>
            ) : null}
          </div>
          <Link
            href={hrefFor("/dashboard/profile")}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-(--brand-text) hover:bg-(--brand-surface-hover)"
          >
            <UserRound size={16} /> Profile
          </Link>
          <Link
            href={hrefFor("/dashboard/settings")}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-(--brand-text) hover:bg-(--brand-surface-hover)"
          >
            <Settings size={16} /> Settings
          </Link>
          <Link
            href={hrefFor("/dashboard/security")}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-(--brand-text) hover:bg-(--brand-surface-hover)"
          >
            <ShieldCheck size={16} /> Security
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 border-t border-(--brand-border) px-4 py-2 text-left text-sm font-medium text-(--status-danger) hover:bg-(--status-danger-bg)"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
