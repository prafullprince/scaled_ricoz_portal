"use client";

import { type FormEvent, useEffect, useState } from "react";
import { BadgeCheck, Clock, LoaderCircle, ShieldAlert } from "lucide-react";
import { InvestorService, type InvestorVerification } from "@/services/investor.service";
import { DashboardCard } from "@/components/dashboard/DashboardPrimitives";

const inputClassName =
  "h-11 w-full rounded-(--radius-md) border border-(--brand-border-strong) bg-white px-3.5 text-sm text-(--brand-text) outline-none transition focus:border-(--brand-red) focus:ring-4 focus:ring-(--brand-red-pale)";

const STATUS_META = {
  PENDING: { label: "Pending review", tone: "text-(--status-warning)", icon: Clock },
  VERIFIED: { label: "Verified", tone: "text-(--status-success)", icon: BadgeCheck },
  REJECTED: { label: "Rejected", tone: "text-(--status-danger)", icon: ShieldAlert },
} as const;

export function InvestorVerificationView() {
  const [verification, setVerification] = useState<InvestorVerification | null>(null);
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    InvestorService.getMyVerification()
      .then((data) => {
        setVerification(data.verification);
        setLinkedInUrl(data.verification.linked_in_url ?? "");
      })
      .catch(() => setLoadError(true));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    try {
      const result = await InvestorService.submitVerification(linkedInUrl.trim());
      setVerification(result.verification);
      setMessage("Submitted for verification.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-(--brand-navy)">Investor verification</h1>
        <p className="mt-1 text-sm text-(--brand-text-secondary)">
          Submit your LinkedIn profile so Ricoz can review your investor account.
        </p>
      </div>

      {loadError ? (
        <DashboardCard>
          <p className="text-sm text-(--status-danger)">We couldn&apos;t load your verification status.</p>
        </DashboardCard>
      ) : !verification ? (
        <DashboardCard>
          <p className="text-sm text-(--brand-text-secondary)">Loading...</p>
        </DashboardCard>
      ) : (
        <>
          <DashboardCard title="Status">
            {(() => {
              const meta = STATUS_META[verification.status];
              const Icon = meta.icon;
              return (
                <div className={`flex items-center gap-2 text-sm font-semibold ${meta.tone}`}>
                  <Icon size={18} /> {meta.label}
                </div>
              );
            })()}
            {verification.status === "VERIFIED" && verification.verified_at ? (
              <p className="mt-2 text-sm text-(--brand-text-secondary)">
                Verified on {new Date(verification.verified_at).toLocaleDateString()}
              </p>
            ) : null}
            {verification.status === "PENDING" ? (
              <p className="mt-2 text-sm text-(--brand-text-secondary)">
                Your investor profile is currently being reviewed.
              </p>
            ) : null}
            {verification.status === "REJECTED" ? (
              <p className="mt-2 text-sm text-(--brand-text-secondary)">
                {verification.rejection_reason
                  ? `Reason: ${verification.rejection_reason}`
                  : "Please review your profile and resubmit."}
              </p>
            ) : null}
          </DashboardCard>

          <DashboardCard title="LinkedIn profile" description="Add or update your LinkedIn profile URL.">
            <form onSubmit={submit} className="max-w-md space-y-4" noValidate>
              {error ? <p className="text-sm text-(--status-danger)">{error}</p> : null}
              {message ? <p className="text-sm text-(--status-success)">{message}</p> : null}
              <div>
                <label htmlFor="linkedin-url" className="mb-1.5 block text-sm font-semibold text-(--brand-text)">
                  LinkedIn profile URL
                </label>
                <input
                  id="linkedin-url"
                  type="url"
                  placeholder="https://www.linkedin.com/in/example"
                  className={inputClassName}
                  value={linkedInUrl}
                  onChange={(event) => setLinkedInUrl(event.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="flex h-11 items-center gap-2 rounded-(--radius-md) bg-(--brand-red) px-5 text-sm font-semibold text-white hover:bg-(--brand-red-hover) disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  "Submit for verification"
                )}
              </button>
            </form>
          </DashboardCard>
        </>
      )}
    </div>
  );
}
