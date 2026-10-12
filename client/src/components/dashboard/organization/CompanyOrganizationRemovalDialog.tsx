"use client";

import { useState } from "react";
import {
  Building2,
  KeyRound,
  LoaderCircle,
  MailCheck,
  X,
} from "lucide-react";
import { CompanyService, type Company } from "@/services/company.service";

export function CompanyOrganizationRemovalDialog({
  company,
  onClose,
  onRemoved,
}: {
  company: Company;
  onClose: () => void;
  onRemoved: (removedAssignments: number) => void;
}) {
  const [step, setStep] = useState<"confirm" | "verify">("confirm");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function close() {
    if (pending) return;
    onClose();
  }

  async function requestCode() {
    setPending(true);
    setError("");
    try {
      setMessage(await CompanyService.requestOrganizationRemoval(company.id));
      setStep("verify");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send a verification code.",
      );
    } finally {
      setPending(false);
    }
  }

  async function removeCompany() {
    if (otp.length !== 6) {
      setError("Enter the 6-digit code sent to your email.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await CompanyService.confirmOrganizationRemoval(
        company.id,
        otp,
      );
      onRemoved(result.removedAssignments);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove this company from the organization chart.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close company removal dialog"
        onClick={close}
        className="absolute inset-0 cursor-default"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-company-title"
        className="relative w-full max-w-md overflow-hidden rounded-lg border border-white/30 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
      >
        <header className="flex items-start justify-between border-b border-[#e8edf3] px-5 py-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600">
              {step === "confirm" ? (
                <Building2 size={19} />
              ) : (
                <MailCheck size={19} />
              )}
            </span>
            <div>
              <h2
                id="remove-company-title"
                className="text-base font-extrabold text-[#172033]"
              >
                {step === "confirm"
                  ? "Remove company and members?"
                  : "Verify company removal"}
              </h2>
              <p className="mt-1 text-xs text-[#71829e]">{company.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#71829e] hover:bg-[#f1f5f9]"
          >
            <X size={17} />
          </button>
        </header>
        <div className="p-5">
          {step === "confirm" ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              Removing this company from the organization chart also removes
              all active organization assignments in this company. User
              accounts and their assignments in other companies are not
              deleted.
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
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="min-w-0 flex-1 bg-transparent text-lg font-bold tracking-[0.28em] text-[#172033] outline-none"
                  />
                </span>
              </label>
            </>
          )}
          {error ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </p>
          ) : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#e8edf3] bg-[#f8fafc] px-5 py-4">
          <button
            type="button"
            onClick={close}
            className="h-10 rounded-md px-4 text-xs font-bold text-[#64748b] hover:bg-[#eef2f7]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void (step === "confirm" ? requestCode() : removeCompany())
            }
            className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : null}
            {step === "confirm" ? "Send verification code" : "Verify and remove"}
          </button>
        </footer>
      </section>
    </div>
  );
}
