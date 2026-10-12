"use client";

import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { InvestorService, type InvestorVerificationSubmission } from "@/services/investor.service";
import { DashboardCard, DashboardEmptyState, DashboardError } from "@/components/dashboard/DashboardPrimitives";

export function InvestorVerificationQueue() {
  const [submissions, setSubmissions] = useState<InvestorVerificationSubmission[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  function load() {
    InvestorService.listQueue()
      .then((data) => setSubmissions(data.submissions))
      .catch(() => setLoadError(true));
  }

  useEffect(load, []);

  async function approve(userId: string) {
    setBusyId(userId);
    try {
      await InvestorService.approve(userId);
      setSubmissions((current) => current?.filter((item) => item.user_id !== userId) ?? current);
    } catch {
      setLoadError(true);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(userId: string) {
    setBusyId(userId);
    try {
      await InvestorService.reject(userId, reasonById[userId]);
      setSubmissions((current) => current?.filter((item) => item.user_id !== userId) ?? current);
    } catch {
      setLoadError(true);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-(--brand-navy)">Investor verifications</h1>
        <p className="mt-1 text-sm text-(--brand-text-secondary)">Review pending investor account submissions.</p>
      </div>

      <DashboardCard>
        {loadError ? (
          <DashboardError message="We couldn't load pending submissions." onRetry={load} />
        ) : submissions === null ? (
          <p className="text-sm text-(--brand-text-secondary)">Loading...</p>
        ) : submissions.length === 0 ? (
          <DashboardEmptyState title="No pending submissions" description="Investor submissions awaiting review will appear here." />
        ) : (
          <ul className="divide-y divide-(--brand-border)">
            {submissions.map((submission) => (
              <li key={submission.user_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-(--brand-text)">{submission.name}</p>
                  <p className="text-sm text-(--brand-text-secondary)">{submission.email}</p>
                  {submission.linked_in_url ? (
                    <a
                      href={submission.linked_in_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-(--brand-red) hover:underline"
                    >
                      View LinkedIn <ExternalLink size={13} />
                    </a>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Rejection reason (optional)"
                    value={reasonById[submission.user_id] ?? ""}
                    onChange={(event) =>
                      setReasonById((current) => ({ ...current, [submission.user_id]: event.target.value }))
                    }
                    className="h-9 w-48 rounded-(--radius-md) border border-(--brand-border-strong) px-2.5 text-sm outline-none focus:border-(--brand-red)"
                  />
                  <button
                    type="button"
                    disabled={busyId === submission.user_id}
                    onClick={() => reject(submission.user_id)}
                    className="rounded-(--radius-md) border border-(--status-danger-border) px-3 py-2 text-sm font-semibold text-(--status-danger) hover:bg-(--status-danger-bg) disabled:opacity-50"
                  >
                    {busyId === submission.user_id ? <LoaderCircle size={14} className="animate-spin" /> : null}{busyId === submission.user_id ? "Rejecting..." : "Reject"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === submission.user_id}
                    onClick={() => approve(submission.user_id)}
                    className="rounded-(--radius-md) bg-(--brand-red) px-3 py-2 text-sm font-semibold text-white hover:bg-(--brand-red-hover) disabled:opacity-50"
                  >
                    {busyId === submission.user_id ? <LoaderCircle size={14} className="animate-spin" /> : null}{busyId === submission.user_id ? "Approving..." : "Approve"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}
