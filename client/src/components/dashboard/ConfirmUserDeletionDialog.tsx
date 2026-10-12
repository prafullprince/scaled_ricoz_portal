"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { PlatformUser } from "@/services/userDirectory.service";

export function ConfirmUserDeletionDialog({
  user,
  busy,
  onCancel,
  onConfirm,
}: {
  user: PlatformUser | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!user) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [user, onCancel]);

  if (!user || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0 bg-black/40" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        className="relative w-full max-w-md rounded-(--radius-lg) border border-(--brand-border) bg-white p-5 shadow-(--shadow-lg)"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--status-danger-bg) text-(--status-danger)">
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0">
            <h2 id="delete-user-title" className="text-base font-semibold text-(--brand-text)">
              Delete {user.name}?
            </h2>
            <p className="mt-1 text-sm text-(--brand-text-secondary)">
              This removes the account, its profile and every active session from the platform. Completed work and messages stay in
              history. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-(--radius-md) border border-(--brand-border) px-3.5 py-2 text-sm font-semibold text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-(--radius-md) bg-(--status-danger) px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Delete account
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
