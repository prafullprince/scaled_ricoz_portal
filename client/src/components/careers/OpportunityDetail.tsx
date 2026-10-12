"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Clock3,
  Home,
  MapPin,
  Send,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import {
  RecruitmentService,
  type Opportunity,
} from "@/services/recruitment.service";

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function workModeLabel(opportunity: Opportunity) {
  if (opportunity.workMode === "REMOTE") return "Work from home";
  if (opportunity.workMode === "HYBRID") return "Hybrid";
  return opportunity.location ? `On-site · ${opportunity.location}` : "On-site";
}

function companyDetails(opportunity: Opportunity) {
  return typeof opportunity.companyId === "object" && opportunity.companyId
    ? opportunity.companyId
    : null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "R";
}

function compensation(opportunity: Opportunity) {
  if (opportunity.salary?.trim()) return opportunity.salary;
  if (opportunity.fixedPayMin == null) return "Not specified";
  const format = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
  const range = opportunity.fixedPayMax == null
    ? format(opportunity.fixedPayMin)
    : `${format(opportunity.fixedPayMin)} - ${format(opportunity.fixedPayMax)}`;
  return `${range} /${opportunity.type === "JOB" ? "year" : "month"}`;
}

function minimumExperience(opportunity: Opportunity) {
  if (typeof opportunity.minExperienceYears === "number") {
    const years = opportunity.minExperienceYears;
    return `${years} ${years === 1 ? "year" : "years"}`;
  }
  return opportunity.experience && /\byears?\b/i.test(opportunity.experience)
    ? opportunity.experience
    : null;
}

function DetailList({
  title,
  values,
  ordered = false,
}: {
  title: string;
  values: string[];
  ordered?: boolean;
}) {
  if (!values.length) return null;
  const List = ordered ? "ol" : "ul";

  return (
    <section>
      <h3 className="text-base font-bold text-(--brand-navy)">{title}</h3>
      <List className={`mt-3 space-y-2 pl-5 text-sm leading-6 text-(--brand-text-secondary) ${ordered ? "list-decimal marker:text-(--brand-red)" : "list-disc marker:text-(--brand-red)"}`}>
        {values.map((value, index) => (
          <li key={`${value}-${index}`}>{value}</li>
        ))}
      </List>
    </section>
  );
}

function RelatedCard({ opportunity }: { opportunity: Opportunity }) {
  const company = companyDetails(opportunity);
  return (
    <article className="group flex min-h-64 flex-col rounded-[24px] border border-(--brand-border) bg-white p-5 shadow-[0_8px_24px_rgba(16,26,44,0.04)] transition duration-300 hover:-translate-y-1 hover:border-(--brand-red)/25 hover:shadow-[0_18px_40px_rgba(16,26,44,0.1)]">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-(--brand-red)/15 bg-(--brand-red-pale) px-2.5 py-1.5 text-[11px] font-semibold text-(--brand-red)">
        <BadgeCheck size={13} />
        Actively hiring
      </span>
      <h3 className="mt-4 font-bold text-(--brand-navy)">{opportunity.title}</h3>
      <p className="mt-1 text-sm text-(--brand-text-secondary)">{company?.name || "Hiring company"}</p>
      <div className="mt-4 space-y-2 text-sm text-(--brand-text-secondary)">
        <p className="flex items-center gap-2">
          {opportunity.workMode === "REMOTE" ? <Home size={14} /> : <MapPin size={14} />}
          {workModeLabel(opportunity)}
        </p>
        <p className="flex items-center gap-2">
          <Banknote size={14} />
          {compensation(opportunity)}
        </p>
        <p className="flex items-center gap-2">
          <BriefcaseBusiness size={14} />
          {opportunity.employmentType === "PART_TIME" ? "Part time" : "Full time"}
        </p>
      </div>
      <Link
        href={`/careers/${opportunity.type === "JOB" ? "jobs" : "internships"}/${opportunity._id}`}
        className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-(--brand-red) px-4 text-sm font-bold text-white transition hover:bg-(--brand-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red) focus-visible:ring-offset-2"
      >
        View details
      </Link>
    </article>
  );
}

export function OpportunityDetail({ id }: { id: string }) {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [related, setRelated] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resume, setResume] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const applicationRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState({
    address: "",
    coverLetter: "",
    portfolioUrl: "",
    linkedInUrl: "",
    githubUrl: "",
    screeningAnswers: {} as Record<string, string>,
  });

  useEffect(() => {
    let active = true;
    RecruitmentService.get(id)
      .then((value) => {
        if (active) setOpportunity(value);
      })
      .catch(() => {
        if (active) setMessage("This opportunity is no longer available.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!opportunity) return;
    let active = true;
    RecruitmentService.list({ type: opportunity.type })
      .then((results) => {
        if (active) {
          setRelated(
            results
              .filter((item) => item._id !== opportunity._id)
              .slice(0, 3),
          );
        }
      })
      .catch(() => {
        if (active) setRelatedError(true);
      })
      .finally(() => {
        if (active) setRelatedLoading(false);
      });

    return () => {
      active = false;
    };
  }, [opportunity]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const refreshTimer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  function chooseResume(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Please upload your resume as a PDF file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Your resume must be smaller than 5 MB.");
      return;
    }
    setMessage("");
    setResume(file);
  }

  function openApplication() {
    if (!opportunity) return;
    if (!user) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/careers/${opportunity.type === "JOB" ? "jobs" : "internships"}/${id}`)}`,
      );
      return;
    }
    if (user.roles.some((role) => ["CUSTOMER", "INVESTOR", "ADMIN"].includes(role))) {
      setMessage("Your current account role is not eligible to apply for jobs or internships.");
      return;
    }
    setMessage("");
    setApplicationOpen(true);
    window.requestAnimationFrame(() => {
      applicationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!opportunity) return;
    if (form.address.trim().length < 5) {
      setMessage("Enter an address with at least 5 characters.");
      return;
    }

    const screeningQuestions = opportunity.screeningQuestions ?? [];
    if (screeningQuestions.some((question) => !form.screeningAnswers[question]?.trim())) {
      setMessage("Please answer each screening question before submitting.");
      return;
    }

    setPending(true);
    setMessage("");
    try {
      await RecruitmentService.apply(id, {
        ...form,
        screeningAnswers: screeningQuestions.map((question) => ({
          question,
          answer: form.screeningAnswers[question].trim(),
        })),
        resume,
      });
      setMessage("Application submitted successfully. Our team will review your application.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit application.");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-[70vh] bg-(--brand-surface) px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-[1120px] animate-pulse">
          <div className="h-4 w-48 rounded bg-(--brand-border)" />
          <div className="mt-8 h-12 w-3/4 rounded-xl bg-(--brand-border)" />
          <div className="mt-6 h-[560px] rounded-[30px] border border-(--brand-border) bg-white" />
        </div>
      </main>
    );
  }

  if (!opportunity) {
    return (
      <main className="min-h-[70vh] bg-(--brand-surface) px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-[860px] rounded-[28px] border border-red-200 bg-white p-7 shadow-[0_12px_36px_rgba(16,26,44,0.06)] sm:p-9">
          <p role="alert" className="text-sm text-red-800">
            {message || "This opportunity is no longer available."}
          </p>
          <Link href="/careers" className="mt-5 inline-flex items-center gap-2 rounded-full bg-(--brand-red-pale) px-4 py-2.5 text-sm font-semibold text-(--brand-red) transition hover:bg-(--brand-red) hover:text-white">
            <ArrowLeft size={16} />
            Browse opportunities
          </Link>
        </div>
      </main>
    );
  }

  const company = companyDetails(opportunity);
  const companyLabel = company?.name || "Hiring company";
  const internship = opportunity.type === "INTERNSHIP";
  const expired = Boolean(
    opportunity.applicationDeadline &&
      currentTime > 0 &&
      new Date(opportunity.applicationDeadline).getTime() < currentTime,
  );
  const published = opportunity.publishedAt ?? opportunity.createdAt;
  const postedDate = formatDate(published);
  const deadline = formatDate(opportunity.applicationDeadline);
  const recent = Number.isFinite(new Date(published).getTime()) &&
    currentTime > 0 &&
    currentTime - new Date(published).getTime() < 7 * 24 * 60 * 60 * 1000;
  const success = message.includes("submitted successfully");
  const employmentLabel = opportunity.employmentType === "PART_TIME" ? "Part time" : "Full time";
  const titleEmploymentLabel = opportunity.employmentType === "PART_TIME" ? "Part Time" : "Full Time";
  const experienceLabel = minimumExperience(opportunity);
  const titleSuffix = `${internship ? "Internship" : "Job"} (${opportunity.workMode === "REMOTE" ? "WFH" : opportunity.workMode === "HYBRID" ? "Hybrid" : "On-site"} & ${titleEmploymentLabel})`;
  const pageTitle = opportunity.title;
  const skills = [...new Set([...(opportunity.techStack ?? []), opportunity.category].filter(Boolean))];
  const perks = opportunity.benefits ?? [];
  const requirements = [...(opportunity.requirements ?? []), ...(opportunity.qualifications ?? [])];
  const applicationDisabled = expired || success || pending;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_85%_0%,rgba(201,29,32,0.06),transparent_38%),linear-gradient(180deg,var(--brand-surface),var(--brand-background)_360px)] pb-16 text-(--brand-text)">
      <div className="mx-auto max-w-[1120px] px-4 pt-6 sm:px-6 sm:pt-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-(--brand-text-secondary)">
          <Link href="/" className="transition-colors hover:text-(--brand-red)">Home</Link>
          <ChevronRight size={15} aria-hidden="true" />
          <Link href="/careers" className="transition-colors hover:text-(--brand-red)">
            {internship ? "Internships" : "Jobs"}
          </Link>
          <ChevronRight size={15} aria-hidden="true" />
          <span aria-current="page" className="font-medium text-(--brand-navy)">
            {opportunity.title}
          </span>
        </nav>

        <header className="relative isolate mt-6 overflow-hidden rounded-[30px] border border-(--brand-border) bg-[radial-gradient(ellipse_at_88%_0%,rgba(201,29,32,0.14),transparent_42%),linear-gradient(125deg,#ffffff,var(--brand-surface))] p-6 shadow-[0_14px_42px_rgba(16,26,44,0.06)] sm:mt-8 sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 hidden size-72 rounded-full border border-(--brand-red)/10 md:block" />
          <div className="relative max-w-4xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-(--brand-red)/15 bg-(--brand-red-pale) px-3 py-1.5 text-xs font-bold uppercase tracking-[0.13em] text-(--brand-red)">
              <BriefcaseBusiness size={14} aria-hidden="true" />
              {internship ? "Internship opportunity" : "Job opportunity"}
            </span>
            <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.055em] text-(--brand-navy) sm:text-4xl md:text-5xl">
              {pageTitle}
            </h1>
            <p className="mt-3 text-sm font-semibold text-(--brand-text-secondary) sm:text-base">
              {titleSuffix}
            </p>
          </div>
        </header>

        <article className="mt-5 rounded-[30px] border border-(--brand-border) bg-white p-5 shadow-[0_14px_42px_rgba(16,26,44,0.06)] sm:mt-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-(--brand-red)/15 bg-(--brand-red-pale) px-3 py-1.5 text-xs font-semibold text-(--brand-red)">
                <BadgeCheck size={14} aria-hidden="true" />
                Actively hiring
              </span>
              <h2 className="mt-4 text-lg font-bold tracking-tight text-(--brand-navy) sm:text-xl">
                Opportunity overview
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-(--brand-text-secondary)">
                <span>{companyLabel}</span>
                {company?.industry || company?.category ? (
                  <span className="rounded-full bg-(--brand-surface) px-2.5 py-1 text-[11px] font-semibold text-(--brand-text-secondary)">
                    {company.industry || company.category}
                  </span>
                ) : null}
              </div>
            </div>
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-(--brand-red-pale) to-(--brand-surface) text-sm font-bold text-(--brand-red) ring-1 ring-(--brand-red)/10" aria-label={`${companyLabel} logo`}>
              {initials(companyLabel)}
            </span>
          </div>

          <p className="mt-6 flex items-center gap-2 text-sm font-medium text-(--brand-text-secondary)">
            {opportunity.workMode === "REMOTE" ? <Home size={16} /> : <MapPin size={16} />}
            {workModeLabel(opportunity)}
          </p>

          <dl className="mt-7 grid gap-3 border-t border-(--brand-border) pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-(--brand-surface) p-4">
              <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-(--brand-text-muted)">
                <CalendarDays size={13} /> Posted
              </dt>
              <dd className="mt-2 text-sm font-semibold text-(--brand-navy)">{postedDate || "Recently"}</dd>
            </div>
            <div className="rounded-2xl bg-(--brand-surface) p-4">
              <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-(--brand-text-muted)">
                <Users size={13} /> Openings
              </dt>
              <dd className="mt-2 text-sm font-semibold text-(--brand-navy)">
                {opportunity.openings ?? 1}
              </dd>
            </div>
            <div className="rounded-2xl bg-(--brand-surface) p-4">
              <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-(--brand-text-muted)">
                <Banknote size={13} /> {internship ? "Stipend" : "Salary"}
              </dt>
              <dd className="mt-2 text-sm font-semibold text-(--brand-navy)">{compensation(opportunity)}</dd>
            </div>
            <div className="rounded-2xl bg-(--brand-surface) p-4">
              <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-(--brand-text-muted)">
                <Clock3 size={13} /> Apply by
              </dt>
              <dd className="mt-2 text-sm font-semibold text-(--brand-navy)">
                {deadline || "Applications open"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-(--brand-red-pale) px-3 py-1.5 text-xs font-semibold text-(--brand-red)">{internship ? "Internship" : "Job"}</span>
            <span className="rounded-full bg-(--brand-surface) px-3 py-1.5 text-xs font-semibold text-(--brand-text-secondary)">{employmentLabel}</span>
            {experienceLabel ? (
              <span className="rounded-full bg-(--brand-surface) px-3 py-1.5 text-xs font-semibold text-(--brand-text-secondary)">
                Minimum experience · {experienceLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-(--brand-red)/15 bg-[linear-gradient(120deg,var(--brand-red-pale),var(--brand-surface))] p-4 sm:p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-(--brand-text-secondary)">
              <span aria-hidden="true" className="text-[#ffab00]">✦</span>
              {recent ? "Be an early applicant" : "Applications are open"}
            </p>
            <button
              type="button"
              disabled={applicationDisabled}
              onClick={openApplication}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-(--brand-red) px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(201,29,32,0.2)] transition hover:-translate-y-0.5 hover:bg-(--brand-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {expired ? "Applications closed" : success ? "Applied" : "Apply now"}
              <Send size={15} />
            </button>
          </div>

          <div className="space-y-7 border-t border-(--brand-border) pt-7">
            <section>
              <h3 className="text-base font-bold text-(--brand-navy)">
                About the {opportunity.workMode === "REMOTE" ? "work from home " : ""}{internship ? "internship" : "job"}
              </h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-(--brand-text-secondary)">
                {opportunity.description}
              </p>
            </section>

            <DetailList title="Responsibilities" values={opportunity.responsibilities ?? []} ordered />

            {skills.length ? (
              <section>
                <h3 className="text-base font-bold text-(--brand-navy)">Skill(s) required</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span key={skill} className="rounded-full border border-(--brand-border) bg-(--brand-surface) px-3 py-1.5 text-sm font-medium text-(--brand-text-secondary)">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <DetailList title="Who can apply" values={requirements} ordered />
            <DetailList title="Perks" values={perks} />

            {(opportunity.fixedPayMin != null ||
              opportunity.variablePayMin != null ||
              opportunity.openings != null) ? (
              <section>
                <h3 className="text-base font-bold text-(--brand-navy)">Additional information</h3>
                <dl className="mt-3 grid gap-3 text-sm text-(--brand-text-secondary) sm:grid-cols-2">
                  {opportunity.fixedPayMin != null ? (
                    <div className="rounded-2xl bg-(--brand-surface) p-4">
                      <dt className="font-semibold">Fixed pay</dt>
                      <dd className="mt-0.5">{compensation(opportunity)}</dd>
                    </div>
                  ) : null}
                  {opportunity.variablePayMin != null ? (
                    <div className="rounded-2xl bg-(--brand-surface) p-4">
                      <dt className="font-semibold">Incentive pay</dt>
                      <dd className="mt-0.5">
                        ₹{opportunity.variablePayMin.toLocaleString("en-IN")}
                        {opportunity.variablePayMax == null ? "" : ` - ₹${opportunity.variablePayMax.toLocaleString("en-IN")}`}
                      </dd>
                    </div>
                  ) : null}
                  {opportunity.openings != null ? (
                    <div className="rounded-2xl bg-(--brand-surface) p-4">
                      <dt className="font-semibold">Number of openings</dt>
                      <dd className="mt-0.5">{opportunity.openings}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {company?.description ? (
              <section>
                <h3 className="text-base font-bold text-(--brand-navy)">About {companyLabel}</h3>
                {opportunity.location ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-(--brand-text-secondary)">
                    <MapPin size={14} />
                    {opportunity.location}
                  </p>
                ) : null}
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">
                  {company.description}
                </p>
              </section>
            ) : null}
          </div>

          <div className="mt-8 flex justify-center border-t border-(--brand-border) pt-6">
            <button
              type="button"
              disabled={applicationDisabled}
              onClick={openApplication}
              className="inline-flex min-h-11 min-w-36 items-center justify-center gap-2 rounded-xl bg-(--brand-red) px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(201,29,32,0.2)] transition hover:-translate-y-0.5 hover:bg-(--brand-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {expired ? "Applications closed" : success ? "Applied" : "Apply now"}
              <Send size={15} />
            </button>
          </div>
          {message && (!applicationOpen || success) ? (
            <p
              className={`mt-4 rounded-xl p-4 text-sm leading-5 ${success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
              role={success ? "status" : "alert"}
            >
              {message}
            </p>
          ) : null}
        </article>

        {applicationOpen && !success ? (
          <form
            ref={applicationRef}
            onSubmit={apply}
            className="mt-6 scroll-mt-24 rounded-[30px] border border-(--brand-border) bg-white p-5 shadow-[0_14px_42px_rgba(16,26,44,0.06)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-[-0.03em] text-(--brand-navy)">Apply for {opportunity.title}</h2>
                <p className="mt-1 text-sm text-(--brand-text-secondary)">Complete the required details to submit your application.</p>
              </div>
              <button
                type="button"
                aria-label="Close application form"
                onClick={() => setApplicationOpen(false)}
                className="rounded-xl p-2 text-(--brand-text-secondary) transition hover:bg-(--brand-surface) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red)"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-(--brand-navy) sm:col-span-2">
                Address <span className="text-(--brand-red)">*</span>
                <textarea
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                  rows={3}
                  maxLength={300}
                  required
                  className="mt-2 w-full resize-y rounded-xl border border-(--brand-border) bg-(--brand-surface) p-3.5 text-sm font-normal text-(--brand-text) outline-none transition focus:border-(--brand-red)/60 focus:ring-4 focus:ring-(--brand-red)/10"
                  placeholder="Enter your current address"
                />
              </label>

              {(opportunity.screeningQuestions ?? []).map((question) => (
                <label key={question} className="block text-sm font-semibold text-(--brand-navy) sm:col-span-2">
                  {question} <span className="text-(--brand-red)">*</span>
                  <textarea
                    value={form.screeningAnswers[question] ?? ""}
                    onChange={(event) => setForm({
                      ...form,
                      screeningAnswers: { ...form.screeningAnswers, [question]: event.target.value },
                    })}
                    rows={3}
                    maxLength={2000}
                    required
                    className="mt-2 w-full resize-y rounded-xl border border-(--brand-border) bg-(--brand-surface) p-3.5 text-sm font-normal text-(--brand-text) outline-none transition focus:border-(--brand-red)/60 focus:ring-4 focus:ring-(--brand-red)/10"
                  />
                </label>
              ))}

              <label className="block text-sm font-semibold text-(--brand-navy) sm:col-span-2">
                Resume PDF <span className="font-normal text-(--brand-text-muted)">(optional, max 5 MB)</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-dashed border-(--brand-border) bg-(--brand-surface) p-4 text-left transition hover:border-(--brand-red)/50 hover:bg-(--brand-red-pale) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red)"
                >
                  <Upload size={18} className="shrink-0 text-(--brand-red)" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-(--brand-navy)">
                      {resume ? resume.name : "Choose your resume"}
                    </span>
                    <span className="mt-1 block text-xs font-normal text-(--brand-text-muted)">
                      {resume ? `${(resume.size / 1024 / 1024).toFixed(2)} MB · PDF` : "PDF only"}
                    </span>
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(event) => chooseResume(event.target.files?.[0])}
                />
              </label>

              {resume ? (
                <button
                  type="button"
                  onClick={() => {
                    setResume(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="-mt-3 inline-flex items-center gap-1 text-xs font-semibold text-(--brand-text-secondary) hover:text-(--brand-red) sm:col-span-2"
                >
                  <X size={13} />
                  Remove resume
                </button>
              ) : null}

              <label className="block text-sm font-semibold text-(--brand-navy) sm:col-span-2">
                Cover letter <span className="font-normal text-(--brand-text-muted)">(optional)</span>
                <textarea
                  value={form.coverLetter}
                  onChange={(event) => setForm({ ...form, coverLetter: event.target.value })}
                  rows={4}
                  maxLength={4000}
                  className="mt-2 w-full resize-y rounded-xl border border-(--brand-border) bg-(--brand-surface) p-3.5 text-sm font-normal text-(--brand-text) outline-none transition focus:border-(--brand-red)/60 focus:ring-4 focus:ring-(--brand-red)/10"
                  placeholder="Tell us why this opportunity fits you"
                />
              </label>

              {(["portfolioUrl", "linkedInUrl", "githubUrl"] as const).map((field) => (
                <label key={field} className="block text-sm font-semibold text-(--brand-navy)">
                  {field === "portfolioUrl" ? "Portfolio URL" : field === "linkedInUrl" ? "LinkedIn URL" : "GitHub URL"}
                  <span className="font-normal text-(--brand-text-muted)"> (optional)</span>
                  <input
                    type="url"
                    value={form[field]}
                    onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                    placeholder="https://"
                    className="mt-2 h-11 w-full rounded-xl border border-(--brand-border) bg-(--brand-surface) px-3 text-sm font-normal text-(--brand-text) outline-none transition focus:border-(--brand-red)/60 focus:ring-4 focus:ring-(--brand-red)/10"
                  />
                </label>
              ))}
            </div>

            {message ? (
              <p
                className={`mt-5 rounded-xl p-4 text-sm leading-5 ${success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
                role={success ? "status" : "alert"}
              >
                {message}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={applicationDisabled}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-(--brand-red) px-6 text-sm font-bold text-white shadow-[0_8px_20px_rgba(201,29,32,0.2)] transition hover:-translate-y-0.5 hover:bg-(--brand-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {pending ? "Submitting..." : "Submit application"}
              <Send size={15} />
            </button>
          </form>
        ) : null}
      </div>

      {relatedLoading || related.length || relatedError ? (
        <section className="mt-8 border-y border-(--brand-border) bg-(--brand-surface) px-4 py-12 sm:mt-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-[940px]">
            <h2 className="text-center text-xl font-bold tracking-[-0.035em] text-(--brand-navy) sm:text-2xl">
              Similar {internship ? "internships" : "jobs"} you can apply to
            </h2>
            {relatedError ? (
              <p role="status" className="mt-6 text-center text-sm text-(--brand-text-secondary)">
                Similar opportunities are temporarily unavailable.
              </p>
            ) : relatedLoading ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-[24px] border border-(--brand-border) bg-white" />)}
              </div>
            ) : related.length ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => <RelatedCard key={item._id} opportunity={item} />)}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
