"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { sortSidebarNavItems, visibleNavGroups } from "@/lib/dashboard/navigation";
import {
  Blocks,
  CircleDashed,
  MessageCircle,
  Phone,
  Radio,
  Search,
  Users,
  X,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { departmentHref } from "@/lib/dashboard/departments";
import { ChatThemeToggle } from "./chat/ChatThemeToggle";
import {
  getChatTheme,
  setChatTheme,
  subscribeChatTheme,
  type ChatTheme,
} from "@/lib/chat/theme";
import chatStyles from "./chat/ChatWorkspace.module.css";
import { useAppSelector } from "@/redux/hooks";

export function DashboardSidebar({
  roles,
  systemRoles,
  department,
  designation,
  userName,
  onNavigate,
  unreadMessageCount,
  collapsed = false,
}: {
  collapsed?: boolean;
  roles: string[];
  systemRoles: string[];
  department?: string | null;
  designation?: string | null;
  userName?: string;
  onNavigate?: () => void;
  unreadMessageCount: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const chatTheme = useSyncExternalStore<ChatTheme>(
    subscribeChatTheme,
    getChatTheme,
    () => "dark",
  );
  const companyName = useAppSelector(
    (state) => state.auth.user?.company?.name ?? null,
  );
  const permissions = useAppSelector((state) => state.auth.user?.permissions);
  const canViewCompanyAdminPages = useAppSelector(
    (state) => state.auth.user?.can_view_company_admin_pages ?? false,
  );
  const executive = roles.includes("ADMIN") || roles.includes("CEO");
  const departmentLeader =
    !executive &&
    roles.some(
      (role) =>
        role === "HEAD" ||
        role === "MANAGER" ||
        role.endsWith("_HEAD") ||
        role.endsWith("_MANAGER"),
    );
  const workspaceRole = executive && department === "PERSONAL"
    ? "My workspace"
    : department
    ? `${department.charAt(0)}${department.slice(1).toLowerCase()} workspace`
    : "Personal workspace";
  const hrefFor = (href: string) =>
    executive
      ? departmentHref(href.split("?")[0], department ?? "PRODUCT")
      : href;
  const groups = visibleNavGroups(
    roles,
    department,
    designation,
    systemRoles,
    permissions,
    canViewCompanyAdminPages,
  )
    .map((group) => ({
      ...group,
      items: sortSidebarNavItems(group.items.filter((item) =>
        `${group.label} ${item.label}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )),
    }))
    .filter((group) => group.items.length);
  const initials = (userName ?? "Ricoz")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (collapsed) {
    const activeView = searchParams.get("view") ?? "chats";
    const views = [
      { id: "chats", label: "Chats", icon: MessageCircle },
      { id: "calls", label: "Calls", icon: Phone },
      { id: "status", label: "Status", icon: CircleDashed },
      { id: "channels", label: "Channels", icon: Radio },
      { id: "communities", label: "Communities", icon: Users },
    ];
    return (
      <nav
        aria-label="Dashboard navigation"
        data-theme={chatTheme}
        className={`${chatStyles.workspace} ${chatStyles.navigationRail}`}
      >
        {views.map(({ id, label, icon: Icon }) => {
          const params = new URLSearchParams(
            executive
              ? { department: department ?? "PRODUCT", view: id }
              : { view: id },
          );
          return (
            <Link
              key={id}
              href={`/dashboard/messages?${params}`}
              onClick={() => setWorkspaceMenuOpen(false)}
              aria-label={label}
              title={label}
              aria-current={activeView === id ? "page" : undefined}
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full"
            >
              <Icon size={21} strokeWidth={1.8} />
              {id === "chats" && unreadMessageCount > 0 ? (
                <span className="absolute right-0 top-0 size-2 rounded-full bg-[#21c063]" />
              ) : null}
            </Link>
          );
        })}
        <div className="flex-1" />
        <ChatThemeToggle
          compact
          theme={chatTheme}
          onChange={setChatTheme}
          className={chatStyles.mobileRailTheme}
        />
        <button
          type="button"
          aria-label="Workspace navigation"
          title="Workspace navigation"
          aria-expanded={workspaceMenuOpen}
          onClick={() => setWorkspaceMenuOpen((current) => !current)}
          className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-[#303331]"
        >
          {workspaceMenuOpen ? <X size={21} /> : <Blocks size={21} />}
        </button>
        {workspaceMenuOpen ? (
          <div
            onKeyDown={(event) => {
              if (event.key === "Escape") setWorkspaceMenuOpen(false);
            }}
            className={`${chatStyles.railMenu} absolute bottom-16 left-full z-50 max-h-[80dvh] w-60 overflow-y-auto rounded-lg border p-2 shadow-xl`}
          >
            {groups.map((group) => (
              <ul
                key={group.label}
                aria-label={group.label || "Workspace"}
                className="mb-2 space-y-1 border-b border-[#363a37] pb-2 last:border-0"
              >
                {group.items.map((item) => {
                  const active = pathname === item.href.split("?")[0];
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={hrefFor(item.href)}
                        onClick={() => {
                          setWorkspaceMenuOpen(false);
                          onNavigate?.();
                        }}
                        aria-current={active ? "page" : undefined}
                        className="flex min-h-10 items-center gap-3 rounded px-3 text-sm"
                      >
                        <Icon size={18} strokeWidth={1.75} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>
        ) : null}
        <Link
          href={hrefFor("/dashboard/settings")}
          onClick={onNavigate}
          aria-label="Account settings"
          title={`${userName ?? "My account"} - Account settings`}
          className="mt-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#39463f] text-xs font-semibold text-[#e9edef]"
        >
          {initials}
        </Link>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Dashboard navigation"
      className="flex h-full min-h-0 flex-col bg-[#fbfbfc]"
    >
      <Link
        href={executive ? "/" : "/"}
        onClick={onNavigate}
        className="flex min-h-20 shrink-0 items-center gap-3 px-5"
        aria-label="Ricoz dashboard"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--brand-red) text-white">
          <Blocks size={21} strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-bold text-(--brand-text)">
            Ricoz<span className="text-(--brand-red)">.</span>
          </span>
          <span className="block truncate text-[11px] text-(--brand-text-secondary)">
            {companyName ? `${companyName} · ` : ""}
            {departmentLeader ? `${workspaceRole} · personal` : workspaceRole}
          </span>
        </span>
      </Link>
      <div className="px-4 pb-5">
        <label className="flex min-h-10 items-center gap-2 rounded-md border border-(--brand-border) bg-white px-2.5 text-(--brand-text-muted)">
          <Search size={15} className="shrink-0" />
          <input
            aria-label="Find a page"
            placeholder="Find a page..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full min-w-0 bg-transparent text-xs outline-none"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear page search"
              title="Clear search"
              onClick={() => setSearch("")}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
            >
              <X size={14} />
            </button>
          ) : null}
        </label>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 pb-5">
        {groups.map((group) => (
          <div key={group.label}>
            {group.label ? (
              <p className="mb-1.5 px-3 text-[11px] font-medium text-(--brand-text-muted)">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href.split("?")[0];
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={hrefFor(item.href)}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${active ? "bg-(--brand-red-pale) font-semibold text-(--brand-red)" : "font-medium text-(--brand-text-secondary) hover:bg-(--brand-surface-hover) hover:text-(--brand-text)"}`}
                    >
                      <span className="relative shrink-0">
                        <Icon size={17} strokeWidth={1.75} />
                        {item.href === "/dashboard/messages" &&
                        unreadMessageCount > 0 ? (
                          <span className="absolute -right-2.5 -top-2.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#c91d20] px-1 text-[9px] font-extrabold leading-none text-white">
                            {unreadMessageCount > 99
                              ? "99+"
                              : unreadMessageCount}
                          </span>
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        {item.label}
                      </span>
                      {active ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--brand-red)" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {!groups.length ? (
          <p className="px-3 py-6 text-xs text-(--brand-text-muted)">
            No matching pages.
          </p>
        ) : null}
      </div>
      <Link
        href={hrefFor("/dashboard/settings")}
        onClick={onNavigate}
        className="flex shrink-0 items-center gap-3 border-t border-(--brand-border) px-5 py-4 hover:bg-(--brand-surface-hover)"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--brand-border) bg-white text-xs font-semibold">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold">
            {userName ?? "My account"}
          </span>
          <span className="mt-0.5 block text-[11px] text-(--brand-text-muted)">
            Account settings
          </span>
        </span>
      </Link>
    </nav>
  );
}
