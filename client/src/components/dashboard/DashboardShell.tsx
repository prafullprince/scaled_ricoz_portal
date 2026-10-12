"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardMobileNav } from "./DashboardMobileNav";
import { DashboardSkeleton } from "./DashboardPrimitives";
import { ChatNotificationListener } from "./ChatNotificationListener";
import { ChatCallProvider } from "./ChatCallProvider";
import { GroupCallProvider } from "./GroupCallProvider";
import { canAccessDashboardPath } from "@/lib/auth/route.config";
import { DepartmentRail, useSelectedWorkspace } from "./DepartmentRail";
import { useHydrated } from "@/lib/useHydrated";
import { DashboardBottomBar } from "./DashboardBottomBar";

const EMPTY_ROLES: string[] = [];

const loadingFallback = (
  <div className="flex min-h-screen items-center justify-center bg-(--brand-surface) p-6">
    <div className="w-full max-w-3xl">
      <DashboardSkeleton />
    </div>
  </div>
);

export function DashboardShell({ children }: { children: ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  const authStatus = useAppSelector((state) => state.auth.status);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const messagesMode =
    pathname === "/dashboard/messages" ||
    pathname.startsWith("/dashboard/messages/");
  const selectedDepartment = useSelectedWorkspace();
  const hydrated = useHydrated();
  const executive = Boolean(
    user?.roles.some((role) => role === "CEO" || role === "ADMIN"),
  );
  const systemRoles = user?.system_roles ?? EMPTY_ROLES;
  const permissions = user?.permissions ?? EMPTY_ROLES;
  const routeAllowed =
    !user ||
    canAccessDashboardPath(
      pathname,
      user.roles,
      user.organization_department,
      user.system_roles,
      user.permissions,
      user.can_view_company_admin_pages ?? false,
    );

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [authStatus, pathname, router]);

  useEffect(() => {
    if (user && !routeAllowed) router.replace("/unauthorized");
  }, [user, routeAllowed, router]);

  // The session can be restored before hydration finishes; keep the server markup until then.
  if (!hydrated) return loadingFallback;

  if (!routeAllowed) return null;

  if (!user && authStatus === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--brand-surface)" />
    );
  }

  if (!user) {
    return loadingFallback;
  }

  return (
    <ChatCallProvider>
      <GroupCallProvider>
        <div
          className={
            messagesMode
              ? "flex h-dvh overflow-hidden bg-[#f0f2f5]"
              : "dashboard-shell flex min-h-screen bg-(--brand-surface)"
          }
        >
          <ChatNotificationListener
            onUnreadCountChange={setUnreadMessageCount}
          />
          {executive && !messagesMode ? (
            <aside className="fixed inset-y-0 left-0 z-20 hidden h-dvh lg:block">
              <DepartmentRail />
            </aside>
          ) : null}
          <aside
            className={
              messagesMode
                ? "chat-navigation-shell fixed bottom-[calc(21px+env(safe-area-inset-bottom))] left-0 right-0 z-20 h-[60px] border-t border-(--brand-border) sm:inset-y-0 sm:right-auto sm:h-dvh sm:w-16 sm:border-r sm:border-t-0"
                : `fixed inset-y-0 z-20 hidden h-dvh w-64 overflow-hidden border-r border-(--brand-border) bg-[#fbfbfc] lg:block ${executive ? "left-16" : "left-0"}`
            }
          >
            <DashboardSidebar
              collapsed={messagesMode}
              roles={user.roles}
              systemRoles={systemRoles}
              department={
                executive ? selectedDepartment : user.organization_department
              }
              designation={user.organization_designation}
              userName={user.user_name}
              unreadMessageCount={unreadMessageCount}
            />
          </aside>
          <DashboardMobileNav
            roles={user.roles}
            systemRoles={systemRoles}
            department={
              executive ? selectedDepartment : user.organization_department
            }
            designation={user.organization_designation}
            userName={user.user_name}
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            unreadMessageCount={unreadMessageCount}
          />
          <div
            className={
              messagesMode
                ? "flex h-[calc(100dvh-81px-env(safe-area-inset-bottom))] min-w-0 flex-1 flex-col sm:ml-16 sm:h-[calc(100dvh-21px)]"
                : `flex min-w-0 flex-1 flex-col ${executive ? "lg:ml-80" : "lg:ml-64"}`
            }
          >
            {!messagesMode ? (
              <DashboardHeader
                user={user}
                onOpenMobileNav={() => setMobileNavOpen(true)}
                unreadMessageCount={unreadMessageCount}
              />
            ) : null}
            <main
              key={pathname}
              className={
                messagesMode
                  ? "min-h-0 min-w-0 flex-1 overflow-hidden"
                  : "dashboard-content dashboard-page-transition min-w-0 flex-1 px-4 py-6 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-8"
              }
            >
              {children}
            </main>
          </div>
          <DashboardBottomBar
            key={user.user_id}
            userId={user.user_id}
            roles={user.roles}
            systemRoles={systemRoles}
            department={executive ? selectedDepartment : user.organization_department}
            designation={user.organization_designation}
            permissions={permissions}
            canViewCompanyAdminPages={user.can_view_company_admin_pages ?? false}
          />
        </div>
      </GroupCallProvider>
    </ChatCallProvider>
  );
}
