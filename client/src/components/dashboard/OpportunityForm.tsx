"use client";

import { useState, type FormEvent } from "react";
import { BriefcaseBusiness, LoaderCircle, Plus, X } from "lucide-react";
import api from "@/services/axios";
import type { OpportunityType } from "@/services/recruitment.service";

type FormState = {
  type: OpportunityType;
  title: string;
  minExperienceYears: "" | "0" | "1";
  skills: string;
  workMode: "" | "ONSITE" | "HYBRID" | "REMOTE";
  employmentType: "PART_TIME" | "FULL_TIME";
  location: string;
  openings: string;
  description: string;
  preferences: string;
  fixedPayMin: string;
  fixedPayMax: string;
  variablePayMin: string;
  variablePayMax: string;
  benefits: string[];
  screeningQuestions: string[];
  customQuestion: string;
  alternatePhone: string;
};

const availabilityQuestion =
  "Please confirm your availability for this job. If not available immediately, how early would you be able to join?";
const extraQuestions = [
  "Cover Letter",
  "Laptop & Internet",
  "Driving License",
  "2/4 Wheeler",
  "Weekend Availability",
  "Open for Fieldwork",
  "Night Shift",
  "Work Experience",
  "Skill Proficiency",
  "Portfolio Link",
  "Language Proficiency",
];
const perks = ["5 days a week", "Health Insurance", "Life Insurance"];
const control =
  "mt-1.5 h-11 w-full rounded-xl border border-[#dce3eb] bg-white px-3.5 text-sm text-[#24324b] outline-none transition placeholder:text-[#a2aab6] focus:border-[#1684d8] focus:ring-4 focus:ring-[#1684d8]/10";
const errorControl =
  "border-[#ed4b3d] focus:border-[#ed4b3d] focus:ring-[#ed4b3d]/15";
const label = "block text-sm font-semibold text-[#344054]";
const helper = "mt-1 text-xs leading-5 text-[#858585]";

function readLines(value: string) {
  return value
    .split(/\n/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function formatRupees(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function OpportunityForm({ type }: { type: OpportunityType }) {
  const [form, setForm] = useState<FormState>({
    type,
    title: "",
    minExperienceYears: "",
    skills: "",
    workMode: "",
    employmentType: "FULL_TIME",
    location: "",
    openings: "",
    description: "",
    preferences: "",
    fixedPayMin: "",
    fixedPayMax: "",
    variablePayMin: "",
    variablePayMax: "",
    benefits: [],
    screeningQuestions: [availabilityQuestion],
    customQuestion: "",
    alternatePhone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<"DRAFT" | "PUBLISHED" | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleValue(key: "benefits" | "screeningQuestions", value: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  }

  function addCustomQuestion() {
    const question = form.customQuestion.trim();
    if (!question) return;
    if (form.screeningQuestions.includes(question)) {
      setErrors((current) => ({
        ...current,
        customQuestion: "This question has already been added.",
      }));
      return;
    }
    setForm((current) => ({
      ...current,
      screeningQuestions: [...current.screeningQuestions, question],
      customQuestion: "",
    }));
    setErrors((current) => ({ ...current, customQuestion: "" }));
  }

  function validate() {
    const next: Record<string, string> = {};
    const minimum = form.fixedPayMin ? Number(form.fixedPayMin) : null;
    const maximum = form.fixedPayMax ? Number(form.fixedPayMax) : null;
    const variableMinimum = form.variablePayMin
      ? Number(form.variablePayMin)
      : null;
    const variableMaximum = form.variablePayMax
      ? Number(form.variablePayMax)
      : null;

    if (form.title.trim().length < 2) next.title = "Please enter a job title.";
    if (!form.minExperienceYears)
      next.minExperienceYears = "Select the minimum experience required.";
    if (!form.workMode) next.workMode = "Select a job type.";
    if (!form.skills.trim()) next.skills = "Please add at least one skill.";
    if (!/^[1-9]\d*$/.test(form.openings))
      next.openings = "Enter the number of openings.";
    if (form.description.trim().length < 100)
      next.description = "Please enter at least 100 characters.";
    if (minimum !== null && !Number.isFinite(minimum))
      next.fixedPayMin = "Enter a valid amount.";
    else if (form.type === "JOB" && minimum !== null && minimum < 100000)
      next.fixedPayMin = "We only post jobs with a minimum fixed CTC of ₹1,00,000.";
    if (maximum !== null && !Number.isFinite(maximum))
      next.fixedPayMax = "Enter a valid amount.";
    else if (maximum !== null && minimum === null)
      next.fixedPayMin = "Enter a minimum amount when providing a maximum.";
    else if (maximum !== null && minimum !== null && maximum < minimum)
      next.fixedPayMax = "Maximum fixed pay must be at least the minimum.";
    if (Boolean(form.variablePayMin) !== Boolean(form.variablePayMax)) {
      next.variablePayMin = "Enter both minimum and maximum incentives.";
    } else if (
      variableMinimum !== null &&
      variableMaximum !== null &&
      variableMaximum < variableMinimum
    ) {
      next.variablePayMax = "Maximum incentives must be at least the minimum.";
    }
    if (form.workMode && form.workMode !== "REMOTE" && !form.location.trim())
      next.location = "Enter the work location.";
    if (form.alternatePhone && !/^[+()\d\s-]{7,30}$/.test(form.alternatePhone))
      next.alternatePhone = "Enter a valid phone number.";
    if (!form.screeningQuestions.length)
      next.screeningQuestions = "Keep the availability question or add another.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!validate()) return;

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const status = submitter?.value === "draft" ? "DRAFT" : "PUBLISHED";
    if (!form.workMode || !form.minExperienceYears) return;
    const fixedPayMin = form.fixedPayMin ? Number(form.fixedPayMin) : null;
    const fixedPayMax = form.fixedPayMax
      ? Number(form.fixedPayMax)
      : null;
    const variablePayMin = form.variablePayMin
      ? Number(form.variablePayMin)
      : undefined;
    const variablePayMax = form.variablePayMax
      ? Number(form.variablePayMax)
      : undefined;
    const payPeriod = form.type === "JOB" ? "year" : "month";
    const salary = fixedPayMin === null
      ? ""
      : `${formatRupees(fixedPayMin)}${fixedPayMax !== null ? ` - ${formatRupees(fixedPayMax)}` : ""} per ${payPeriod}`;
    const skills = form.skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);
    const preferences = readLines(form.preferences);

    setSaving(status);
    try {
      const response = await api.post<{ opportunity: { _id: string } }>(
        "/recruitment/admin/opportunities",
        {
          type: form.type,
          title: form.title.trim(),
          role: form.title.trim(),
          category: skills[0] ?? (form.type === "JOB" ? "Job" : "Internship"),
          description: form.description.trim(),
          workMode: form.workMode,
          employmentType: form.employmentType,
          openings: Number(form.openings),
          minExperienceYears: Number(form.minExperienceYears),
          location: form.location.trim(),
          experience: `${form.minExperienceYears} ${Number(form.minExperienceYears) === 1 ? "year" : "years"}`,
          salary,
          fixedPayMin,
          fixedPayMax,
          variablePayMin,
          variablePayMax,
          techStack: skills,
          requirements: preferences,
          responsibilities: [],
          qualifications: [],
          benefits: form.benefits,
          screeningQuestions: form.screeningQuestions,
          alternatePhone: form.alternatePhone.trim(),
        },
      );
      if (status === "PUBLISHED")
        await api.post(
          `/recruitment/admin/opportunities/${response.data.opportunity._id}/status`,
          { status },
        );
      setMessage(
        status === "PUBLISHED"
          ? `${form.type === "JOB" ? "Job" : "Internship"} posted successfully.`
          : "Draft saved successfully.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save this opportunity. Please try again.",
      );
    } finally {
      setSaving(null);
    }
  }

  const job = form.type === "JOB";
  const payName = job ? "CTC Breakup" : "Stipend Breakup";
  const fixedPayName = job ? "Fixed pay" : "Fixed stipend";
  const payPeriod = job ? "per year" : "per month";

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,#f2f7fc_0%,#f8fafc_420px,#f8fafc_100%)] px-4 py-7 text-[#24324b] sm:py-10">
      <div className="mx-auto w-full max-w-[760px]">
        <header className="mb-8 rounded-3xl border border-white/80 bg-[radial-gradient(ellipse_at_top_right,_rgba(7,152,229,0.12),_transparent_48%),linear-gradient(120deg,#ffffff_0%,#f4f8ff_100%)] px-6 py-7 shadow-[0_10px_35px_rgba(24,36,58,0.06)] sm:px-8 sm:py-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dceafa] bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#167eb3]">
            <BriefcaseBusiness size={14} />
            Recruitment workspace
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-[-0.035em] text-[#18243a] sm:text-3xl">
            Post Job/Internship
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#667085]">
            Create a clear, compelling listing and help the right candidates understand the opportunity.
          </p>
        </header>

        {message ? (
          <p
            role="status"
            className="mb-6 rounded-2xl border border-[#abefc6] bg-[#ecfdf3] px-4 py-3.5 text-sm text-[#16803c] shadow-sm"
          >
            {message}
          </p>
        ) : null}

        <form onSubmit={save} className="space-y-6">
          <section>
            <h2 className="mb-2.5 text-sm font-bold text-[#26364f]">Opportunity type</h2>
            <div className="flex min-h-[66px] flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-[#e4eaf1] bg-white px-5 py-4 shadow-sm">
              {(["JOB", "INTERNSHIP"] as const).map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 text-[13px] font-medium"
                >
                  <input
                    type="radio"
                    name="opportunity-type"
                    value={value}
                    checked={form.type === value}
                    onChange={() => set("type", value)}
                    className="size-4 accent-[#1684d8]"
                  />
                  {value === "JOB" ? "Job" : "Internship"}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2.5 text-sm font-bold text-[#26364f]">
              {job ? "Job details" : "Internship details"}
            </h2>
            <div className="space-y-5 rounded-2xl border border-[#e4eaf1] bg-white p-5 shadow-sm sm:p-6">
              <label className={label}>
                {job ? "Job title" : "Internship title"}
                <input
                  value={form.title}
                  onChange={(event) => set("title", event.target.value)}
                  placeholder={
                    job ? "e.g. Software Engineer Trainee" : "e.g. Product Design Intern"
                  }
                  aria-invalid={Boolean(errors.title)}
                  className={`${control} ${errors.title ? errorControl : ""}`}
                />
                {errors.title ? (
                  <span className="mt-1 block text-xs text-[#ed4b3d]">
                    {errors.title}
                  </span>
                ) : null}
              </label>

              <fieldset>
                <legend className={label}>Minimum experience required</legend>
                <div className="mt-2 flex gap-6">
                  {(["0", "1"] as const).map((years) => (
                    <label
                      key={years}
                      className="flex cursor-pointer items-center gap-2 text-[13px] font-medium"
                    >
                      <input
                        type="radio"
                        name="minimum-experience"
                        value={years}
                        checked={form.minExperienceYears === years}
                        onChange={() => set("minExperienceYears", years)}
                        className="size-4 accent-[#1684d8]"
                      />
                      {years} {years === "1" ? "year" : "year"}
                    </label>
                  ))}
                </div>
                {errors.minExperienceYears ? (
                  <p className="mt-1 text-xs text-[#ed4b3d]">
                    {errors.minExperienceYears}
                  </p>
                ) : null}
              </fieldset>

              <label className={label}>
                Skills required
                <input
                  value={form.skills}
                  onChange={(event) => set("skills", event.target.value)}
                  placeholder="e.g. Java"
                  aria-invalid={Boolean(errors.skills)}
                  className={`${control} ${errors.skills ? errorControl : ""}`}
                />
                {errors.skills ? (
                  <span className="mt-1 block text-xs text-[#ed4b3d]">
                    {errors.skills}
                  </span>
                ) : (
                  <span className={helper}>Separate multiple skills with commas.</span>
                )}
              </label>

              <fieldset>
                <legend className={label}>Job type</legend>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
                  {([
                    ["ONSITE", "In office"],
                    ["HYBRID", "Hybrid"],
                    ["REMOTE", "Remote"],
                  ] as const).map(([value, title]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 text-[13px] font-medium"
                    >
                      <input
                        type="radio"
                        name="work-mode"
                        value={value}
                        checked={form.workMode === value}
                        onChange={() => set("workMode", value)}
                        className="size-4 accent-[#1684d8]"
                      />
                      {title}
                    </label>
                  ))}
                </div>
                {errors.workMode ? (
                  <p className="mt-1 text-xs text-[#ed4b3d]">
                    {errors.workMode}
                  </p>
                ) : null}
              </fieldset>

              {form.workMode && form.workMode !== "REMOTE" ? (
                <label className={label}>
                  Work location
                  <input
                    value={form.location}
                    onChange={(event) => set("location", event.target.value)}
                    placeholder="e.g. Bengaluru"
                    aria-invalid={Boolean(errors.location)}
                    className={`${control} ${errors.location ? errorControl : ""}`}
                  />
                  {errors.location ? (
                    <span className="mt-1 block text-xs text-[#ed4b3d]">
                      {errors.location}
                    </span>
                  ) : null}
                </label>
              ) : null}

              <fieldset>
                <legend className={label}>Part-time/Full-time</legend>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
                  {([
                    ["PART_TIME", "Part-time"],
                    ["FULL_TIME", "Full-time"],
                  ] as const).map(([value, title]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 text-[13px] font-medium"
                    >
                      <input
                        type="radio"
                        name="employment-type"
                        value={value}
                        checked={form.employmentType === value}
                        onChange={() => set("employmentType", value)}
                        className="size-4 accent-[#1684d8]"
                      />
                      {title}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={label}>
                Number of openings
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={form.openings}
                  onChange={(event) => set("openings", event.target.value)}
                  placeholder="e.g. 4"
                  aria-invalid={Boolean(errors.openings)}
                  className={`${control} ${errors.openings ? errorControl : ""}`}
                />
                {errors.openings ? (
                  <span className="mt-1 block text-xs text-[#ed4b3d]">
                    {errors.openings}
                  </span>
                ) : null}
              </label>

              <label className={label}>
                {job ? "Job description" : "Internship description"}
                <textarea
                  value={form.description}
                  onChange={(event) => set("description", event.target.value)}
                  rows={5}
                  placeholder={"Key responsibilities:\n\n1.\n2.\n3."}
                  aria-invalid={Boolean(errors.description)}
                  className={`mt-1.5 w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-sm font-normal leading-6 text-[#24324b] outline-none transition focus:border-[#1684d8] focus:ring-4 focus:ring-[#1684d8]/10 ${errors.description ? errorControl : "border-[#dce3eb]"}`}
                />
                {errors.description ? (
                  <span className="mt-1 block text-xs text-[#ed4b3d]">
                    {errors.description}
                  </span>
                ) : null}
              </label>

              <label className={label}>
                Additional candidate preferences:
                <textarea
                  value={form.preferences}
                  onChange={(event) => set("preferences", event.target.value)}
                  rows={4}
                  placeholder={"1. e.g. Computer Science Graduate Preferred\n2.\n3."}
                  className="mt-1.5 w-full resize-y rounded-xl border border-[#dce3eb] bg-white px-3.5 py-3 text-sm font-normal leading-6 text-[#24324b] outline-none transition focus:border-[#1684d8] focus:ring-4 focus:ring-[#1684d8]/10"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="mb-2.5 text-sm font-bold text-[#26364f]">Salary &amp; perks</h2>
            <div className="space-y-6 rounded-2xl border border-[#e4eaf1] bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-[13px] font-semibold">{payName}</h3>
              <div>
                <p className="text-[13px] font-medium">
                  {fixedPayName} <span className="font-normal text-[#858585]">(optional)</span>
                </p>
                <p className="mt-1 text-xs leading-5 text-[#858585]">
                  {job
                    ? "Fixed pay is the fixed component of the CTC. Leave blank if it is not finalized."
                    : "Enter the fixed stipend offered for this internship, or leave it blank if it is not finalized."}
                </p>
                <div className="mt-2 grid grid-cols-[80px_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[80px_minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-center">
                  <select
                    aria-label="Salary currency"
                    value="INR"
                    disabled
                    className="h-11 rounded-xl border border-[#dce3eb] bg-[#f8fafc] px-3 text-sm"
                  >
                    <option value="INR">₹</option>
                  </select>
                  <label className="sr-only" htmlFor="fixed-pay-min">
                    Minimum {fixedPayName}
                  </label>
                  <input
                    id="fixed-pay-min"
                    type="number"
                    min={job ? 100000 : 0}
                    value={form.fixedPayMin}
                    onChange={(event) => set("fixedPayMin", event.target.value)}
                    placeholder="Min"
                    aria-invalid={Boolean(errors.fixedPayMin)}
                    className={`${control} mt-0 ${errors.fixedPayMin ? errorControl : ""}`}
                  />
                  <span className="hidden text-sm text-[#777] sm:block">to</span>
                  <label className="sr-only" htmlFor="fixed-pay-max">
                    Maximum {fixedPayName}
                  </label>
                  <input
                    id="fixed-pay-max"
                    type="number"
                    min={0}
                    value={form.fixedPayMax}
                    onChange={(event) => set("fixedPayMax", event.target.value)}
                    placeholder="Max"
                    aria-invalid={Boolean(errors.fixedPayMax)}
                    className={`${control} mt-0 ${errors.fixedPayMax ? errorControl : ""}`}
                  />
                  <span className="col-span-2 text-xs text-[#777] sm:col-span-1">
                    {payPeriod}
                  </span>
                </div>
                {errors.fixedPayMin ? (
                  <p className="mt-1 text-xs leading-4 text-[#ed4b3d]">
                    {errors.fixedPayMin}
                  </p>
                ) : null}
                {errors.fixedPayMax ? (
                  <p className="mt-1 text-xs leading-4 text-[#ed4b3d]">
                    {errors.fixedPayMax}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-[13px] font-medium">Variables/Incentives</p>
                <p className="mt-1 text-xs leading-5 text-[#858585]">
                  If the role includes incentives/variable pay, we recommend mentioning it to attract better talent.
                </p>
                <div className="mt-2 grid grid-cols-[80px_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[80px_minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-center">
                  <select
                    aria-label="Incentive currency"
                    value="INR"
                    disabled
                    className="h-11 rounded-xl border border-[#dce3eb] bg-[#f8fafc] px-3 text-sm"
                  >
                    <option value="INR">₹</option>
                  </select>
                  <label className="sr-only" htmlFor="variable-pay-min">
                    Minimum incentives
                  </label>
                  <input
                    id="variable-pay-min"
                    type="number"
                    min={0}
                    value={form.variablePayMin}
                    onChange={(event) => set("variablePayMin", event.target.value)}
                    placeholder="Min"
                    aria-invalid={Boolean(errors.variablePayMin)}
                    className={`${control} mt-0 ${errors.variablePayMin ? errorControl : ""}`}
                  />
                  <span className="hidden text-sm text-[#777] sm:block">to</span>
                  <label className="sr-only" htmlFor="variable-pay-max">
                    Maximum incentives
                  </label>
                  <input
                    id="variable-pay-max"
                    type="number"
                    min={0}
                    value={form.variablePayMax}
                    onChange={(event) => set("variablePayMax", event.target.value)}
                    placeholder="Max"
                    aria-invalid={Boolean(errors.variablePayMax)}
                    className={`${control} mt-0 ${errors.variablePayMax ? errorControl : ""}`}
                  />
                  <span className="col-span-2 text-xs text-[#777] sm:col-span-1">
                    {payPeriod}
                  </span>
                </div>
                {errors.variablePayMin ? (
                  <p className="mt-1 text-xs leading-4 text-[#ed4b3d]">
                    {errors.variablePayMin}
                  </p>
                ) : null}
                {errors.variablePayMax ? (
                  <p className="mt-1 text-xs leading-4 text-[#ed4b3d]">
                    {errors.variablePayMax}
                  </p>
                ) : null}
              </div>

              <fieldset>
                <legend className={label}>
                  Perks <span className="font-normal text-[#858585]">(Select all that apply)</span>
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {perks.map((perk) => (
                    <label
                      key={perk}
                      className="flex cursor-pointer items-center gap-2 text-[13px] font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={form.benefits.includes(perk)}
                        onChange={() => toggleValue("benefits", perk)}
                        className="size-4 accent-[#1684d8]"
                      />
                      {perk}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-[#26364f]">Screening Questions</h2>
            <p className="mt-1 text-xs text-[#858585]">
              You can use these questions to filter relevant applications
            </p>
            <div className="mt-2.5 rounded-2xl border border-[#e4eaf1] bg-white p-5 shadow-sm sm:p-6">
              <p className="text-[13px] font-semibold">
                Availability <span className="font-normal text-[#858585]">(Default)</span>
              </p>
              <div className="mt-2 rounded-xl border border-[#e5eaf0] bg-[#f7f9fb] px-4 py-3 text-sm leading-6 text-[#59677c]">
                {availabilityQuestion}
              </div>
              <p className="mt-4 text-[13px] font-semibold">
                Additional questions <span className="font-normal text-[#858585]">(Optional)</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-[#858585]">
                Please note this may result in a decrease in the number of applications.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {extraQuestions.map((question) => {
                  const selected = form.screeningQuestions.includes(question);
                  return (
                    <button
                      key={question}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleValue("screeningQuestions", question)}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        selected
                          ? "border-[#1684d8] bg-[#eef8ff] text-[#0875bf]"
                          : "border-[#dedede] bg-white text-[#555] hover:border-[#1684d8] hover:text-[#0875bf]"
                      }`}
                    >
                      {selected ? <X size={13} /> : <Plus size={13} />}
                      {question}
                    </button>
                  );
                })}
              </div>
              {form.screeningQuestions
                .filter(
                  (question) =>
                    question !== availabilityQuestion &&
                    !extraQuestions.includes(question),
                )
                .map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() =>
                      set(
                        "screeningQuestions",
                        form.screeningQuestions.filter(
                          (item) => item !== question,
                        ),
                      )
                    }
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#1684d8] bg-[#eef8ff] px-3 py-2 text-xs font-semibold text-[#0875bf]"
                  >
                    {question} <X size={13} />
                  </button>
                ))}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={form.customQuestion}
                  onChange={(event) => set("customQuestion", event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomQuestion();
                    }
                  }}
                  placeholder="Add a custom question"
                  className="h-11 flex-1 rounded-xl border border-[#dce3eb] px-3.5 text-sm outline-none transition focus:border-[#1684d8] focus:ring-4 focus:ring-[#1684d8]/10"
                  aria-invalid={Boolean(errors.customQuestion)}
                />
                <button
                  type="button"
                  onClick={addCustomQuestion}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#1684d8] transition hover:bg-[#eef8ff]"
                >
                  <Plus size={15} /> Add Custom Question
                </button>
              </div>
              {errors.customQuestion || errors.screeningQuestions ? (
                <p className="mt-1 text-xs text-[#ed4b3d]">
                  {errors.customQuestion || errors.screeningQuestions}
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-[#e4eaf1] bg-white p-5 shadow-sm sm:p-6">
            <label className={label}>
              Alternate mobile number for this listing (optional)
              <span className="mt-1 block font-normal leading-5 text-[#858585]">
                Our team will call you on this number in case of any query regarding this listing only. Primary account number will not be updated.
              </span>
              <input
                type="tel"
                value={form.alternatePhone}
                onChange={(event) => set("alternatePhone", event.target.value)}
                placeholder="+91"
                aria-invalid={Boolean(errors.alternatePhone)}
                className={`${control} ${errors.alternatePhone ? errorControl : ""}`}
              />
              {errors.alternatePhone ? (
                <span className="mt-1 block text-xs text-[#ed4b3d]">
                  {errors.alternatePhone}
                </span>
              ) : null}
            </label>
          </section>

          <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap justify-end gap-3 border-t border-[#e4eaf1] bg-white/95 px-4 py-4 shadow-[0_-5px_18px_rgba(24,36,58,0.06)] backdrop-blur sm:-mx-6 sm:px-6">
            <button
              type="submit"
              name="action"
              value="draft"
              disabled={saving !== null}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#c8d5e5] bg-white px-5 text-sm font-semibold text-[#344054] transition hover:border-[#1684d8] hover:bg-[#f5faff] hover:text-[#0875bf] disabled:opacity-50"
            >
              {saving === "DRAFT" ? (
                <LoaderCircle size={16} className="mr-2 animate-spin" />
              ) : null}
              Save draft
            </button>
            <button
              type="submit"
              name="action"
              value="publish"
              disabled={saving !== null}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#078bd1] px-5 text-sm font-bold text-white shadow-[0_5px_14px_rgba(7,139,209,0.2)] transition hover:-translate-y-0.5 hover:bg-[#087ab6] disabled:opacity-50"
            >
              {saving === "PUBLISHED" ? (
                <LoaderCircle size={16} className="mr-2 animate-spin" />
              ) : null}
              Post {job ? "job" : "internship"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
