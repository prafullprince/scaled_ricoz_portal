"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, LoaderCircle, UploadCloud, UserPlus } from "lucide-react";
import { RecruitmentService, type CandidateImportInput } from "@/services/recruitment.service";
import type { IntegrationCatalog } from "@/services/integration.service";

type CandidateImportFormProps = {
  opportunities: IntegrationCatalog["opportunities"];
  sources: Array<{ id: string; name: string }>;
  importedBy: string;
};

const control = "mt-2 min-h-11 w-full rounded-xl border border-(--brand-border) bg-(--input-background) px-3.5 py-2.5 text-sm text-(--brand-text) outline-none transition placeholder:text-(--brand-text-muted) focus:border-(--brand-red) focus:ring-4 focus:ring-(--brand-red-pale)";

export function CandidateImportForm({ opportunities, sources, importedBy }: CandidateImportFormProps) {
  const [form, setForm] = useState({ opportunityId: "", name: "", email: "", phoneNumber: "", sourcePlatform: "", otherSource: "" });
  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ appliedAt: string; accountCreated: boolean; activationEmailSent: boolean | null } | null>(null);
  const availableOpportunities = opportunities.filter((opportunity) => opportunity.type === "JOB" || opportunity.type === "INTERNSHIP");
  const sourcePlatform = form.sourcePlatform === "OTHER" ? form.otherSource.trim() : form.sourcePlatform;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(null);
    if (!sourcePlatform) {
      setError("Select or enter the candidate's source platform.");
      return;
    }
    setBusy(true);
    try {
      const input: CandidateImportInput = {
        opportunityId: form.opportunityId,
        name: form.name.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        sourcePlatform,
        resume,
      };
      const result = await RecruitmentService.importCandidate(input);
      setSuccess({
        appliedAt: result.application.appliedAt,
        accountCreated: result.accountCreated,
        activationEmailSent: result.activationEmailSent,
      });
      setForm({ opportunityId: "", name: "", email: "", phoneNumber: "", sourcePlatform: "", otherSource: "" });
      setResume(null);
      setResumeError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to import the candidate.");
    } finally {
      setBusy(false);
    }
  }

  function chooseResume(file?: File) {
    setResumeError("");
    if (!file) {
      setResume(null);
      return;
    }
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      setResume(null);
      setResumeError("Upload the candidate resume as a PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResume(null);
      setResumeError("Resume files must be 10 MB or smaller.");
      return;
    }
    setResume(file);
  }

  return (
    <section aria-labelledby="candidate-import-heading" className="overflow-hidden rounded-xl border border-(--brand-border) bg-white shadow-(--shadow-sm)">
      <header className="flex items-start gap-3 border-b border-(--brand-border) bg-(--brand-surface) px-5 py-4 sm:px-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--brand-red-pale) text-(--brand-red)"><UserPlus size={19} /></span>
        <div>
          <h2 id="candidate-import-heading" className="text-base font-bold text-(--brand-navy)">Import a candidate</h2>
          <p className="mt-1 text-xs leading-5 text-(--brand-text-secondary)">Enter applicant details and place them in Applied (New Application) for the selected role.</p>
        </div>
      </header>

      <form onSubmit={(event) => void submit(event)} className="space-y-5 p-5 sm:p-6">
        {success && (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-(--status-success-border) bg-(--status-success-bg) p-3 text-sm text-(--status-success)">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <p>
              Candidate added to Applied (New Application). Import recorded {new Date(success.appliedAt).toLocaleString("en-IN")} by {importedBy}.
              {success.accountCreated && success.activationEmailSent ? " An account activation email was sent." : ""}
              {success.accountCreated && success.activationEmailSent === false ? " The account was created, but activation email delivery failed; the candidate will need to sign up with this email." : ""}
            </p>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg border border-(--status-danger-border) bg-(--status-danger-bg) p-3 text-sm text-(--status-danger)">{error}</p>}

        {availableOpportunities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-(--brand-border-strong) p-5 text-center">
            <p className="text-sm font-semibold text-(--brand-navy)">Create a job or internship before importing applicants.</p>
            <div className="mt-3 flex justify-center gap-2">
              <Link href="/dashboard/admin/jobs/create" className="rounded-lg bg-(--brand-red) px-3 py-2 text-xs font-semibold text-white">Create job</Link>
              <Link href="/dashboard/admin/internships/create" className="rounded-lg border border-(--brand-border) px-3 py-2 text-xs font-semibold text-(--brand-text-secondary)">Create internship</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-(--brand-text-secondary) sm:col-span-2">
                Applied job / internship
                <select required value={form.opportunityId} onChange={(event) => setForm((current) => ({ ...current, opportunityId: event.target.value }))} className={control}>
                  <option value="">Choose a job or internship</option>
                  {availableOpportunities.map((opportunity) => <option key={opportunity._id} value={opportunity._id}>{opportunity.title} · {opportunity.type === "JOB" ? "Job" : "Internship"}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-(--brand-text-secondary)">
                Candidate name
                <input required minLength={3} maxLength={120} autoComplete="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" className={control} />
              </label>
              <label className="text-xs font-semibold text-(--brand-text-secondary)">
                Email
                <input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="candidate@example.com" className={control} />
              </label>
              <label className="text-xs font-semibold text-(--brand-text-secondary)">
                Phone
                <input required type="tel" minLength={7} maxLength={30} autoComplete="tel" value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} placeholder="+91 ..." className={control} />
              </label>
              <label className="text-xs font-semibold text-(--brand-text-secondary)">
                Source platform
                <select required value={form.sourcePlatform} onChange={(event) => setForm((current) => ({ ...current, sourcePlatform: event.target.value, otherSource: "" }))} className={control}>
                  <option value="">Choose a source</option>
                  {sources.map((source) => <option key={source.id} value={source.name}>{source.name}</option>)}
                  <option value="OTHER">Other / manually sourced</option>
                </select>
              </label>
              {form.sourcePlatform === "OTHER" && (
                <label className="text-xs font-semibold text-(--brand-text-secondary) sm:col-span-2">
                  Enter source platform
                  <input required maxLength={80} value={form.otherSource} onChange={(event) => setForm((current) => ({ ...current, otherSource: event.target.value }))} placeholder="Referral, campus event, walk-in..." className={control} />
                </label>
              )}
              <label className="text-xs font-semibold text-(--brand-text-secondary) sm:col-span-2">
                Resume <span className="font-normal text-(--brand-text-muted)">Optional · PDF up to 10 MB</span>
                <span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-(--brand-border-strong) bg-(--brand-surface) px-3.5 py-2.5 text-sm font-medium text-(--brand-text-secondary)">
                  {resume ? <FileText size={17} className="text-(--brand-red)" /> : <UploadCloud size={17} />}
                  <span className="truncate">{resume?.name ?? "Choose a PDF resume"}</span>
                  <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => chooseResume(event.target.files?.[0])} />
                </span>
              </label>
              {resumeError && <p role="alert" className="text-xs text-(--status-danger) sm:col-span-2">{resumeError}</p>}
            </div>

            <footer className="flex flex-col justify-between gap-3 border-t border-(--brand-border) pt-4 sm:flex-row sm:items-center">
              <p className="text-[11px] leading-5 text-(--brand-text-muted)">Import date and submitting HR user are recorded automatically. CSV/Excel bulk import can be added later; API connectors are available above.</p>
              <button type="submit" disabled={busy || Boolean(resumeError)} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-(--brand-red) px-4 text-sm font-semibold text-white transition hover:bg-(--brand-red-hover) disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? <LoaderCircle size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {busy ? "Importing..." : "Add to Applied"}
              </button>
            </footer>
          </>
        )}
      </form>
    </section>
  );
}
