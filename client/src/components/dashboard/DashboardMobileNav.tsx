"use client";

import { X } from "lucide-react";
import { useEffect, useEffectEvent, useRef } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DepartmentRail } from "./DepartmentRail";

export function DashboardMobileNav({
  roles,
  systemRoles,
  department,
  designation,
  userName,
  open,
  onClose,
  unreadMessageCount,
}: {
  roles: string[];
  systemRoles: string[];
  department?: string | null;
  designation?: string | null;
  userName?: string;
  open: boolean;
  onClose: () => void;
  unreadMessageCount: number;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeNavigation = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])') ?? []).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNavigation();
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 lg:hidden">
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Navigation" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#fbfbfc] shadow-(--shadow-xl)">
        <div className="flex shrink-0 items-center justify-between border-b border-(--brand-border) px-4 py-2">
          <span className="text-xs font-medium text-(--brand-text-secondary)">Workspace navigation</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-(--radius-md) p-2 text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          {roles.some((role) => role === "CEO" || role === "ADMIN") ? <DepartmentRail onNavigate={onClose} /> : null}
          <div className="min-w-0 flex-1"><DashboardSidebar roles={roles} systemRoles={systemRoles} department={department} designation={designation} userName={userName} onNavigate={onClose} unreadMessageCount={unreadMessageCount} /></div>
        </div>
      </div>
    </div>
  );
}
