"use client";

import { useState } from "react";
import { KeyRound, LoaderCircle, MailCheck, Trash2, X } from "lucide-react";
import {
  OrganizationService,
  type OrganizationAssignment,
} from "@/services/organization.service";

export function OrganizationRemovalDialog({
  assignment,
  companyId,
  onRemoved,
  compact = false,
  open: controlledOpen,
  onClose,
}: {
  assignment: OrganizationAssignment;
  companyId?: string;
  onRemoved: (userId: string) => void;
  compact?: boolean;
  open?: boolean;
  onClose?: () => void;
}) {
  const [internalOpen, setOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const [step, setStep] = useState<"confirm" | "verify">("confirm");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function close() {
    if (pending) return;
    setOpen(false);
    onClose?.();
    setStep("confirm");
    setOtp("");
    setMessage("");
    setError("");
  }

  async function requestCode() {
    setPending(true);
    setError("");
    try {
      setMessage(await OrganizationService.requestRemoval(assignment.userId._id, companyId));
      setStep("verify");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send a verification code.");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (otp.length !== 6) {
      setError("Enter the 6-digit code sent to your email.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const removedUserId = await OrganizationService.confirmRemoval(
        assignment.userId._id,
        otp,
        companyId,
      );
      onRemoved(removedUserId);
      setOpen(false);
      onClose?.();
      setStep("confirm");
      setOtp("");
      setMessage("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to remove this person.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {controlled ? null : <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Remove ${assignment.userId.name} from team`}
        className={
          compact
            ? "inline-flex h-8 w-8 items-center justify-center rounded-md text-[#94a3b8] transition hover:bg-red-50 hover:text-red-600"
            : "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-xs font-bold text-red-600 transition hover:bg-red-50"
        }
      >
        <Trash2 size={compact ? 15 : 16} />
        {compact ? null : "Remove from team"}
      </button>}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 p-4 backdrop-blur-sm">
          <button type="button" aria-label="Close removal dialog" onClick={close} className="absolute inset-0 cursor-default" />
          <section role="dialog" aria-modal="true" aria-labelledby="remove-title" className="relative w-full max-w-md overflow-hidden rounded-lg border border-white/30 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
            <header className="flex items-start justify-between border-b border-[#e8edf3] px-5 py-4">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600">
                  {step === "confirm" ? <Trash2 size={19} /> : <MailCheck size={19} />}
                </span>
                <div>
                  <h2 id="remove-title" className="text-base font-extrabold text-[#172033]">
                    {step === "confirm" ? "Remove from reporting line" : "Verify this change"}
                  </h2>
                  <p className="mt-1 text-xs text-[#71829e]">
                    {assignment.userId.name} · {assignment.level.toLowerCase()}
                  </p>
                </div>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-[#71829e] hover:bg-[#f1f5f9]">
                <X size={17} />
              </button>
            </header>
            <div className="p-5">
              {step === "confirm" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                  This removes the organization role and reporting assignment. Their account remains active. People with active direct reports must be cleared first.
                </div>
              ) : (
                <>
                  <p className="text-sm leading-6 text-[#52637d]">{message}</p>
                  <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#71829e]">
                    Verification code
                    <span className="mt-2 flex h-12 items-center gap-3 rounded-md border border-[#d8e0ea] bg-[#fbfcfe] px-3 focus-within:border-[#2563eb] focus-within:ring-3 focus-within:ring-blue-100">
                      <KeyRound size={17} className="text-[#71829e]" />
                      <input
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        className="min-w-0 flex-1 bg-transparent text-lg font-bold tracking-[0.28em] text-[#172033] outline-none"
                      />
                    </span>
                  </label>
                </>
              )}
              {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p> : null}
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#e8edf3] bg-[#f8fafc] px-5 py-4">
              <button type="button" onClick={close} className="h-10 rounded-md px-4 text-xs font-bold text-[#64748b] hover:bg-[#eef2f7]">Cancel</button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void (step === "confirm" ? requestCode() : remove())}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? <LoaderCircle size={15} className="animate-spin" /> : null}
                {step === "confirm" ? "Send verification code" : "Verify and remove"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
