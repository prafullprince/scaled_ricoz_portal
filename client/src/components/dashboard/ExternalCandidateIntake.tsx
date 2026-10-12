"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, LoaderCircle, UploadCloud } from "lucide-react";
import api from "@/services/axios";
import {
  RecruitmentService,
  type DirectCandidateInput,
  type Opportunity,
  type OpportunityType,
} from "@/services/recruitment.service";

const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-[#dce3eb] bg-white px-3.5 py-2.5 text-sm text-(--brand-navy) outline-none transition placeholder:text-(--brand-text-muted) focus:border-[#078bd1] focus:ring-4 focus:ring-[#078bd1]/10";

const initialForm = {
  opportunityId: "",
  name: "",
  email: "",
  phoneNumber: "",
  sourceDetail: "",
  address: "",
  currentCompany: "",
  experienceYears: "",
  skills: "",
  education: "",
  experienceSummary: "",
  portfolioUrl: "",
  linkedInUrl: "",
  githubUrl: "",
  coverLetter: "",
};

export function ExternalCandidateIntake() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState("");
  const [opportunityType, setOpportunityType] = useState<OpportunityType>("INTERNSHIP");
  const [form, setForm] = useState(initialForm);
  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    accountCreated: boolean;
    activationEmailSent: boolean | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void api.get<{ opportunities: Opportunity[] }>("/recruitment/admin/opportunities")
      .then(({ data }) => {
        if (active) setOpportunities(data.opportunities);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        const message = (caught as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        setOpportunitiesError(message ?? "Opportunities could not be loaded. Try again.");
      })
      .finally(() => {
        if (active) setOpportunitiesLoading(false);
      });
    return () => { active = false; };
  }, []);

  const selectableOpportunities = useMemo(
    () => opportunities.filter((item) => item.type === opportunityType),
    [opportunities, opportunityType],
  );
  const selectedOpportunityId = selectableOpportunities.some((item) => item._id === form.opportunityId)
    ? form.opportunityId
    : selectableOpportunities[0]?._id ?? "";

  function update(key: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectResume(file: File | undefined) {
    setResumeError("");
    if (!file) {
      setResume(null);
      return;
    }
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      setResume(null);
      setResumeError("Choose a PDF resume.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResume(null);
      setResumeError("Resume files must be 10 MB or smaller.");
      return;
    }
    setResume(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!selectedOpportunityId) {
      setError("Create or select an opportunity before adding an external candidate.");
      return;
    }
    if (resumeError) return;
    setSubmitting(true);
    try {
      const input: DirectCandidateInput = { ...form, opportunityId: selectedOpportunityId, resume };
      const response = await RecruitmentService.createDirectApplication(input);
      setResult({
        accountCreated: response.accountCreated,
        activationEmailSent: response.activationEmailSent,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add the candidate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/admin/applications"
        className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-text-secondary) transition hover:text-(--brand-red)"
      >
        <ArrowLeft size={16} /> Back to applications
      </Link>

      <header className="rounded-3xl border border-[#e4eaf1] bg-[radial-gradient(ellipse_at_top_right,_rgba(7,139,209,0.1),_transparent_42%),linear-gradient(120deg,#ffffff_0%,#fbfbfc_100%)] px-5 py-7 shadow-sm sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
          Recruitment workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-(--brand-navy)">
          Add an external candidate
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-(--brand-text-secondary)">
          Record candidates interviewed or sourced outside Ricoz. Their application will enter the company recruitment pipeline, where HR can review, assign, interview, and prepare an offer.
        </p>
      </header>

      {result ? (
        <section role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Candidate added to the recruitment inbox.</p>
              {result.accountCreated ? (
                <p className="mt-1 leading-6">
                  A candidate account was created. {result.activationEmailSent
                    ? "An activation email was sent; the candidate must activate their account before using candidate self-service or accepting an offer."
                    : "The activation email could not be delivered. Ask the candidate to use Sign up with this email to request a verification code."}
                </p>
              ) : (
                <p className="mt-1 leading-6">The existing Ricoz account was linked to this application.</p>
              )}
              <button
                type="button"
              onClick={() => router.push("/dashboard/admin/recruitment-pipeline")}
                className="mt-3 rounded-lg bg-emerald-800 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-900"
              >
              Open recruitment pipeline
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>
      ) : null}

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-2xl border border-[#e4eaf1] bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-(--brand-navy)">Role and candidate</h2>
            <p className="mt-1 text-sm text-(--brand-text-secondary)">The opportunity type sets the matching recruitment path: internships are eligible for the Intern role; jobs for the Employee role.</p>
          </div>
          <div className="mb-5 inline-flex gap-1 rounded-xl border border-[#e4eaf1] bg-[#f7f9fc] p-1.5" role="group" aria-label="Candidate role type">
            {(["INTERNSHIP", "JOB"] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={opportunityType === type}
                onClick={() => setOpportunityType(type)}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${opportunityType === type ? "bg-[#18243a] text-white shadow-sm" : "text-(--brand-text-secondary) hover:bg-white"}`}
              >
                {type === "INTERNSHIP" ? "Intern" : "Employee"}
              </button>
            ))}
          </div>
          <label className="block text-sm font-semibold text-(--brand-navy)">
            Opportunity
            <select
              required
              value={selectedOpportunityId}
              onChange={(event) => update("opportunityId", event.target.value)}
              disabled={opportunitiesLoading || Boolean(opportunitiesError) || selectableOpportunities.length === 0}
              className={inputClass}
            >
              <option value="">{opportunitiesLoading ? "Loading opportunities..." : "Select an opportunity"}</option>
              {selectableOpportunities.map((item) => (
                <option key={item._id} value={item._id}>{item.title} · {item.status}</option>
              ))}
            </select>
          </label>
          {opportunitiesError ? <p role="alert" className="mt-2 text-sm text-red-700">{opportunitiesError}</p> : null}
          {!opportunitiesLoading && !opportunitiesError && selectableOpportunities.length === 0 ? (
            <p className="mt-2 text-sm text-(--brand-text-secondary)">
              There are no {opportunityType === "INTERNSHIP" ? "internship" : "job"} opportunities in this company yet.{" "}
              <Link href={opportunityType === "INTERNSHIP" ? "/dashboard/admin/internships/create" : "/dashboard/admin/jobs/create"} className="font-semibold text-[#078bd1] hover:underline">Create one first</Link>.
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-(--brand-navy)">Full name<input required maxLength={120} autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy)">Email address<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy)">Phone number<input required type="tel" minLength={7} maxLength={30} autoComplete="tel" value={form.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy)">Candidate source <span className="font-normal text-(--brand-text-muted)">Optional</span><input maxLength={80} value={form.sourceDetail} onChange={(event) => update("sourceDetail", event.target.value)} placeholder="Referral, LinkedIn, campus drive…" className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy)">Current / recent company <span className="font-normal text-(--brand-text-muted)">Optional</span><input maxLength={160} value={form.currentCompany} onChange={(event) => update("currentCompany", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy)">Years of experience <span className="font-normal text-(--brand-text-muted)">Optional</span><input type="number" min="0" max="60" step="0.5" value={form.experienceYears} onChange={(event) => update("experienceYears", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy)">Skills <span className="font-normal text-(--brand-text-muted)">Comma separated</span><input maxLength={1000} value={form.skills} onChange={(event) => update("skills", event.target.value)} placeholder="React, Figma, communication" className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy) sm:col-span-2">Address<textarea required minLength={5} maxLength={300} rows={2} autoComplete="street-address" value={form.address} onChange={(event) => update("address", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy) sm:col-span-2">Education <span className="font-normal text-(--brand-text-muted)">Optional</span><textarea maxLength={3000} rows={2} value={form.education} onChange={(event) => update("education", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy) sm:col-span-2">Experience summary <span className="font-normal text-(--brand-text-muted)">Optional</span><textarea maxLength={5000} rows={4} value={form.experienceSummary} onChange={(event) => update("experienceSummary", event.target.value)} className={inputClass} /></label>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e4eaf1] bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold text-(--brand-navy)">Resume and links</h2>
          <p className="mt-1 text-sm text-(--brand-text-secondary)">Candidate details and the uploaded resume are stored with this application, separate from the core user account.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-(--brand-navy)">Portfolio URL <span className="font-normal text-(--brand-text-muted)">Optional · HTTPS</span><input type="url" maxLength={500} value={form.portfolioUrl} onChange={(event) => update("portfolioUrl", event.target.value)} placeholder="https://" className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy)">LinkedIn URL <span className="font-normal text-(--brand-text-muted)">Optional · HTTPS</span><input type="url" maxLength={500} value={form.linkedInUrl} onChange={(event) => update("linkedInUrl", event.target.value)} placeholder="https://" className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy)">GitHub URL <span className="font-normal text-(--brand-text-muted)">Optional · HTTPS</span><input type="url" maxLength={500} value={form.githubUrl} onChange={(event) => update("githubUrl", event.target.value)} placeholder="https://" className={inputClass} /></label>
            <label className="text-sm font-semibold text-(--brand-navy)">Resume PDF <span className="font-normal text-(--brand-text-muted)">Optional · up to 10 MB</span>
              <span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-[#cbd5e1] bg-[#fafcff] px-3.5 py-2.5 text-sm font-medium text-(--brand-text-secondary)">
                {resume ? <FileText size={17} className="text-[#078bd1]" /> : <UploadCloud size={17} />}
                <span className="truncate">{resume?.name ?? "Choose a PDF resume"}</span>
                <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => selectResume(event.target.files?.[0])} />
              </span>
            </label>
            {resumeError ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{resumeError}</p> : null}
            <label className="text-sm font-semibold text-(--brand-navy) sm:col-span-2">Cover letter / recruiter notes <span className="font-normal text-(--brand-text-muted)">Optional</span><textarea maxLength={4000} rows={4} value={form.coverLetter} onChange={(event) => update("coverLetter", event.target.value)} className={inputClass} /></label>
          </div>
        </section>

        <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <Link href="/dashboard/admin/applications" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#dce3eb] bg-white px-5 text-sm font-semibold text-(--brand-navy) transition hover:bg-[#f7f9fc)">Cancel</Link>
          <button type="submit" disabled={submitting || opportunitiesLoading || !selectableOpportunities.length || Boolean(resumeError)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-(--brand-red) px-5 text-sm font-bold text-white shadow-sm transition hover:bg-(--brand-red-hover) disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? <LoaderCircle size={17} className="animate-spin" /> : null}
            {submitting ? "Adding candidate..." : "Add to recruitment"}
          </button>
        </div>
      </form>
    </main>
  );
}
