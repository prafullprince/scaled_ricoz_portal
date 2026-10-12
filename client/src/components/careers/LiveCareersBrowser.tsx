"use client";

import Link from "next/link";
import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Home,
  MapPin,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  RecruitmentService,
  type Opportunity,
  type OpportunityType,
} from "@/services/recruitment.service";

const pageSize = 8;

function companyName(opportunity: Opportunity) {
  return typeof opportunity.companyId === "object"
    ? opportunity.companyId?.name ?? ""
    : "";
}

function companyInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "R";
}

function formatAmount(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function applyByLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : `Apply by ${date.toLocaleDateString()}`;
}

function compensation(opportunity: Opportunity) {
  if (opportunity.salary?.trim()) return opportunity.salary;
  if (opportunity.fixedPayMin == null) return "Compensation not listed";
  const range = opportunity.fixedPayMax == null
    ? formatAmount(opportunity.fixedPayMin)
    : `${formatAmount(opportunity.fixedPayMin)} - ${formatAmount(opportunity.fixedPayMax)}`;
  return `${range} /${opportunity.type === "JOB" ? "year" : "month"}`;
}

function minimumExperience(opportunity: Opportunity) {
  if (typeof opportunity.minExperienceYears === "number") {
    const years = opportunity.minExperienceYears;
    return `Minimum experience: ${years} ${years === 1 ? "year" : "years"}`;
  }
  return opportunity.experience && /\byears?\b/i.test(opportunity.experience)
    ? `Minimum experience: ${opportunity.experience}`
    : null;
}

function postedLabel(opportunity: Opportunity) {
  const timestamp = opportunity.publishedAt ?? opportunity.createdAt;
  const postedAt = new Date(timestamp);
  if (Number.isNaN(postedAt.getTime())) return "Recently posted";

  const elapsedHours = Math.max(0, (Date.now() - postedAt.getTime()) / 3_600_000);
  if (elapsedHours < 1) return "Just now";
  if (elapsedHours < 24) return "Few hours ago";
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays === 1 ? "1 day ago" : `${elapsedDays} days ago`;
}

function isEarlyOpportunity(opportunity: Opportunity) {
  const timestamp = opportunity.publishedAt ?? opportunity.createdAt;
  const postedAt = new Date(timestamp).getTime();
  const elapsed = Date.now() - postedAt;
  return Number.isFinite(postedAt) && elapsed >= 0 && elapsed < 7 * 24 * 60 * 60 * 1000;
}

function opportunityPath(opportunity: Opportunity) {
  const kind = opportunity.type === "JOB" ? "jobs" : "internships";
  return `/careers/${kind}/${opportunity._id}`;
}

function FilterCheckbox({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex min-h-8 items-center gap-2.5 text-sm ${disabled ? "cursor-not-allowed text-(--brand-gray)/60" : "cursor-pointer text-(--brand-text-secondary)"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 shrink-0 accent-(--brand-red)"
      />
      <span>{label}</span>
    </label>
  );
}

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const employer = companyName(opportunity);
  const skills = [...new Set([opportunity.category, ...opportunity.techStack])]
    .filter(Boolean)
    .slice(0, 5);
  const remote = opportunity.workMode === "REMOTE";
  const typeName = opportunity.type === "JOB" ? "Job" : "Internship";
  const experience = minimumExperience(opportunity);
  const deadline = applyByLabel(opportunity.applicationDeadline);

  return (
    <article className="group relative overflow-hidden rounded-[26px] border border-(--brand-border) bg-white p-5 shadow-[0_8px_24px_rgba(16,26,44,0.04)] transition duration-300 hover:-translate-y-1 hover:border-(--brand-red)/25 hover:shadow-[0_18px_44px_rgba(16,26,44,0.1)] sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-(--brand-red) via-(--brand-red-soft) to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={opportunityPath(opportunity)}
            className="text-base font-bold leading-6 text-(--brand-navy) transition-colors group-hover:text-(--brand-red) focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red)"
          >
            {opportunity.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-(--brand-text-secondary)">
            <span className="font-medium">{employer || "Hiring company"}</span>
          </div>
        </div>
        <span
          aria-label={`${employer || "Company"} logo`}
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-(--brand-red-pale) to-(--brand-surface) text-xs font-bold tracking-wide text-(--brand-red) ring-1 ring-(--brand-red)/10"
        >
          {companyInitials(employer)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs leading-5 text-(--brand-text-secondary)">
        <span className="inline-flex items-center gap-1.5">
          {remote ? <Home size={14} /> : <MapPin size={14} />}
          {remote ? "Work from home" : opportunity.location || "On-site"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Banknote size={14} />
          {compensation(opportunity)}
        </span>
        {deadline ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={14} />
            {deadline}
          </span>
        ) : experience ? (
          <span className="inline-flex items-center gap-1.5">
            <BriefcaseBusiness size={14} />
            {experience}
          </span>
        ) : null}
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-(--brand-text-secondary)">
        {opportunity.description}
      </p>

      {skills.length ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs leading-5 text-(--brand-text-secondary)">
          {skills.map((skill) => (
            <span key={skill} className="rounded-full border border-(--brand-border) bg-(--brand-surface) px-2.5 py-1">
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-(--brand-border) pt-4 text-xs text-(--brand-text-secondary)">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#effbea] px-2.5 py-1.5 font-semibold text-[#39832d]">
          <Clock3 size={12} />
          {postedLabel(opportunity)}
        </span>
        {isEarlyOpportunity(opportunity) ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7e6] px-2.5 py-1.5 font-semibold text-[#a16b00]">
            <span aria-hidden="true" className="text-[#ffad00]">✦</span>
            Be an early applicant
          </span>
        ) : null}
        <span className="rounded-full border border-(--brand-border) px-2.5 py-1.5 font-medium">
          {opportunity.employmentType === "PART_TIME" ? "Part time" : "Full time"}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-(--brand-red-pale) px-2.5 py-1.5 font-semibold text-(--brand-red)">
          <BriefcaseBusiness size={12} />
          {typeName}
        </span>
      </div>
    </article>
  );
}

export function LiveCareersBrowser() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [profile, setProfile] = useState("");
  const [location, setLocation] = useState("");
  const [keyword, setKeyword] = useState("");
  const [internshipsInCity, setInternshipsInCity] = useState(false);
  const [workFromHome, setWorkFromHome] = useState(false);
  const [partTime, setPartTime] = useState(false);
  const [minimumStipend, setMinimumStipend] = useState(0);
  const [type, setType] = useState<"ALL" | OpportunityType>("ALL");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };
      if (profile.trim()) params.profile = profile.trim();
      if (location.trim()) params.location = location.trim();
      if (keyword.trim()) params.search = keyword.trim();
      if (type !== "ALL") params.type = type;
      if (internshipsInCity) params.internshipsInCity = "true";
      if (workFromHome) params.workFromHome = "true";
      if (partTime) params.partTime = "true";
      if (minimumStipend > 0) params.minStipend = String(minimumStipend);

      setLoading(true);
      setError(false);
      RecruitmentService.browse(params)
        .then((result) => {
          if (!active) return;
          setOpportunities(result.opportunities);
          setTotal(result.pagination.total);
          setTotalPages(Math.max(1, result.pagination.totalPages));
        })
        .catch(() => {
          if (!active) return;
          setOpportunities([]);
          setTotal(0);
          setTotalPages(1);
          setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [internshipsInCity, keyword, location, minimumStipend, page, partTime, profile, retryToken, type, workFromHome]);

  const currentPage = page;
  const visibleOpportunities = opportunities;

  function resetFilters() {
    setProfile("");
    setLocation("");
    setKeyword("");
    setInternshipsInCity(false);
    setWorkFromHome(false);
    setPartTime(false);
    setMinimumStipend(0);
    setType("ALL");
    setPage(1);
  }

  function update<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  return (
    <section id="open-roles" className="min-h-[calc(100vh-5rem)] bg-[radial-gradient(ellipse_at_85%_0%,rgba(201,29,32,0.07),transparent_38%),linear-gradient(180deg,var(--brand-surface),var(--brand-background)_360px)] pb-16 pt-8 sm:pt-12">
      <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6">
        <header className="relative isolate mb-8 overflow-hidden rounded-[30px] border border-(--brand-border) bg-[radial-gradient(ellipse_at_88%_0%,rgba(201,29,32,0.12),transparent_42%),linear-gradient(120deg,#ffffff,var(--brand-surface))] px-6 py-8 shadow-[0_14px_42px_rgba(16,26,44,0.06)] sm:px-9 sm:py-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 hidden size-80 rounded-full border border-(--brand-red)/10 md:block" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-(--brand-red)/15 bg-(--brand-red-pale) px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-(--brand-red)">
              <BriefcaseBusiness size={14} aria-hidden="true" />
              Careers at Ricoz
            </span>
            <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.055em] text-(--brand-navy) sm:text-4xl md:text-5xl">
              Find work that moves you forward.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-(--brand-text-secondary) sm:text-base sm:leading-7">
              Explore opportunities from teams building products, businesses, and careers for what comes next.
            </p>
          </div>
        </header>
      </div>
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-5 px-4 sm:px-6 lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-7">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-[24px] border border-(--brand-border) bg-white p-5 shadow-[0_8px_24px_rgba(16,26,44,0.04)] sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold text-(--brand-navy)">
              <Filter size={17} className="text-(--brand-red)" />
              Filters
            </h2>

            <div className="mt-5">
              <label className="block text-sm font-semibold text-(--brand-text-secondary)">
                Profile
                <input
                  value={profile}
                  onChange={(event) => update(setProfile, event.target.value)}
                  placeholder="e.g. Marketing"
                  className="mt-1.5 h-11 w-full rounded-xl border border-(--brand-border) bg-(--brand-surface) px-3 text-sm font-normal text-(--brand-text) outline-none transition focus:border-(--brand-red)/60 focus:ring-4 focus:ring-(--brand-red)/10"
                />
              </label>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-(--brand-text-secondary)">
                Location
                <input
                  value={location}
                  onChange={(event) => {
                    update(setLocation, event.target.value);
                    setInternshipsInCity(false);
                  }}
                  placeholder="e.g. Delhi"
                  className="mt-1.5 h-11 w-full rounded-xl border border-(--brand-border) bg-(--brand-surface) px-3 text-sm font-normal text-(--brand-text) outline-none transition focus:border-(--brand-red)/60 focus:ring-4 focus:ring-(--brand-red)/10"
                />
              </label>
            </div>

            <div className="mt-4 space-y-2">
              <FilterCheckbox
                checked={internshipsInCity}
                disabled={!location.trim()}
                label="Internships in my city"
                onChange={(checked) => update(setInternshipsInCity, checked)}
              />
              <FilterCheckbox
                checked={workFromHome}
                label="Work from home"
                onChange={(checked) => update(setWorkFromHome, checked)}
              />
              <FilterCheckbox
                checked={partTime}
                label="Part-time"
                onChange={(checked) => update(setPartTime, checked)}
              />
            </div>

            <div className="mt-5">
              <label htmlFor="minimum-stipend" className="block text-sm font-semibold text-(--brand-text-secondary)">
                Desired minimum monthly stipend (₹)
              </label>
              <input
                id="minimum-stipend"
                type="range"
                min={0}
                max={10000}
                step={2000}
                value={minimumStipend}
                onChange={(event) => update(setMinimumStipend, Number(event.target.value))}
                className="mt-3 h-2 w-full cursor-pointer accent-(--brand-red)"
              />
              <div className="flex justify-between px-1 text-xs text-(--brand-gray)" aria-hidden="true">
                {[0, 2000, 4000, 6000, 8000, 10000].map((value) => (
                  <span key={value}>{value === 0 ? "0" : `${value / 1000}K`}</span>
                ))}
              </div>
              <p className="sr-only" aria-live="polite">
                Minimum stipend: ₹{minimumStipend.toLocaleString("en-IN")} per month
              </p>
            </div>

            <button
              type="button"
              aria-expanded={showMoreFilters}
              onClick={() => setShowMoreFilters((value) => !value)}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-(--brand-red) transition hover:text-(--brand-navy) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red)"
            >
              View {showMoreFilters ? "fewer" : "more"} filters
              <ChevronDown size={15} className={`transition-transform ${showMoreFilters ? "rotate-180" : ""}`} />
            </button>

            {showMoreFilters ? (
              <div className="mt-4 space-y-3 border-t border-(--brand-border) pt-4">
                <label className="block text-sm font-semibold text-(--brand-text-secondary)">
                  Opportunity type
                  <select
                    value={type}
                    onChange={(event) => {
                      const value = event.target.value;
                      update(
                        setType,
                        value === "JOB" || value === "INTERNSHIP" ? value : "ALL",
                      );
                    }}
                    className="mt-1.5 h-11 w-full rounded-xl border border-(--brand-border) bg-(--brand-surface) px-3 text-sm font-normal text-(--brand-text) outline-none transition focus:border-(--brand-red)/60 focus:ring-4 focus:ring-(--brand-red)/10"
                  >
                    <option value="ALL">Jobs and internships</option>
                    <option value="JOB">Jobs</option>
                    <option value="INTERNSHIP">Internships</option>
                  </select>
                </label>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-(--brand-red) hover:text-(--brand-navy) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red)"
              >
                Clear all
              </button>
            </div>
          </section>

          <section className="rounded-[24px] border border-(--brand-border) bg-white p-5 shadow-[0_8px_24px_rgba(16,26,44,0.04)] sm:p-6">
            <h2 className="text-sm font-bold text-(--brand-navy)">
              Keyword Search
            </h2>
            <label className="sr-only" htmlFor="opportunity-keyword">
              Search opportunities by keyword
            </label>
            <div className="mt-4 flex">
              <input
                id="opportunity-keyword"
                value={keyword}
                onChange={(event) => update(setKeyword, event.target.value)}
                placeholder="e.g. Design, Mumbai, Infosys"
                className="h-11 min-w-0 flex-1 rounded-l-xl border border-(--brand-border) bg-(--brand-surface) px-3 text-sm text-(--brand-text) outline-none transition focus:border-(--brand-red)/60 focus:ring-4 focus:ring-(--brand-red)/10"
              />
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-r-xl bg-(--brand-red) text-white">
                <Search size={17} />
              </span>
            </div>
          </section>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-(--brand-border) bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <p aria-live="polite">
              <span className="text-lg font-bold tracking-[-0.03em] text-(--brand-navy)">
                {loading ? "Finding opportunities..." : `${total} opportunities`}
              </span>
              {!loading ? <span className="ml-2 text-sm text-(--brand-text-secondary)">to explore</span> : null}
            </p>
            <div className="inline-flex rounded-xl border border-(--brand-border) bg-(--brand-surface) p-1" role="tablist" aria-label="Filter by opportunity type">
              {(["ALL", "JOB", "INTERNSHIP"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={type === value}
                  onClick={() => update(setType, value)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    type === value
                      ? "bg-(--brand-red) text-white shadow-sm"
                      : "text-(--brand-text-secondary) hover:bg-white hover:text-(--brand-navy)"
                  }`}
                >
                  {value === "ALL" ? "All" : value === "JOB" ? "Jobs" : "Internships"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-4" aria-label="Loading opportunities">
              {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-[190px] animate-pulse rounded-[26px] border border-(--brand-border) bg-white" />
              ))}
            </div>
          ) : error ? (
            <div role="alert" className="rounded-[26px] border border-[#fecdca] bg-white p-8 shadow-[0_8px_24px_rgba(16,26,44,0.04)]">
              <h2 className="font-bold text-[#b42318]">We couldn&apos;t load opportunities</h2>
              <p className="mt-2 text-sm text-(--brand-text-secondary)">Your filters are still here. Please try again in a moment.</p>
              <button
                type="button"
                onClick={() => setRetryToken((value) => value + 1)}
                className="mt-4 rounded-xl bg-(--brand-navy) px-4 py-2.5 text-sm font-bold text-white transition hover:bg-(--brand-navy-dark)"
              >
                Try again
              </button>
            </div>
          ) : visibleOpportunities.length === 0 ? (
            <div className="rounded-[26px] border border-(--brand-border) bg-white p-8 shadow-[0_8px_24px_rgba(16,26,44,0.04)]">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-(--brand-red-pale) text-(--brand-red)">
                <Search size={19} />
              </span>
              <h2 className="mt-4 font-bold text-(--brand-navy)">No matching opportunities</h2>
              <p className="mt-2 text-sm text-(--brand-text-secondary)">Try changing or clearing your filters to see more roles.</p>
              <button type="button" onClick={resetFilters} className="mt-4 rounded-xl border border-(--brand-border) px-4 py-2.5 text-sm font-semibold text-(--brand-text) transition hover:bg-(--brand-surface)">
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {visibleOpportunities.map((opportunity) => (
                  <OpportunityCard key={opportunity._id} opportunity={opportunity} />
                ))}
              </div>

              {totalPages > 1 ? (
                <nav aria-label="Opportunity pages" className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-(--brand-border) bg-white px-4 py-2.5 text-sm font-semibold text-(--brand-text) shadow-sm transition hover:bg-(--brand-surface) disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span className="text-sm font-medium text-(--brand-text-secondary)">Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-(--brand-border) bg-white px-4 py-2.5 text-sm font-semibold text-(--brand-text) shadow-sm transition hover:bg-(--brand-surface) disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
