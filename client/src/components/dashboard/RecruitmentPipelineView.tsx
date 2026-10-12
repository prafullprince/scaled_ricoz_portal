"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Check,
  CircleUserRound,
  ClipboardCheck,
  ExternalLink,
  FileSpreadsheet,
  GripVertical,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Download,
  UserRoundCog,
  X,
} from "lucide-react";
import boardStyles from "./PipelineStageBoard.module.css";
import { SearchableDropdown } from "./SearchableDropdown";
import { useAppSelector } from "@/redux/hooks";
import {
  RECRUITMENT_PIPELINE_STAGES,
  RecruitmentService,
  type ApplicationAssessment,
  type PipelineCheckStatus,
  type PipelineInterviewStatus,
  type PipelinePerson,
  type PipelineReviewStatus,
  type RecruitmentPipelineEntry,
  type RecruitmentPipelinePage,
  type RecruitmentPipelineStage,
  type RecruitmentPipelineStaff,
  type Opportunity,
} from "@/services/recruitment.service";

const stageLabels: Record<RecruitmentPipelineStage, string> = {
  NEW_APPLICATION: "New Application",
  SCREENING: "Screening",
  SHORTLISTED: "Shortlisted",
  ASSESSMENT: "Assessment",
  INTERVIEW: "Interview",
  FINAL_SELECTION: "Final Selection",
  OFFER: "Offer",
  PRE_JOINING: "Pre-Joining",
  ONBOARDING: "Onboarding",
  ACTIVE: "Active Employee / Intern",
  REJECTED: "Rejected",
};
const activeStages = RECRUITMENT_PIPELINE_STAGES.filter((stage) => stage !== "REJECTED");
const stageHints: Record<RecruitmentPipelineStage, string> = {
  NEW_APPLICATION: "Newly received applications",
  SCREENING: "Initial profile review",
  SHORTLISTED: "Candidates selected to continue",
  ASSESSMENT: "Skills and role assessments",
  INTERVIEW: "Interview scheduling and feedback",
  FINAL_SELECTION: "Final hiring decision",
  OFFER: "Offer preparation and response",
  PRE_JOINING: "Pre-employment checks and preparation",
  ONBOARDING: "Onboarding in progress",
  ACTIVE: "Successfully hired",
  REJECTED: "Candidates no longer progressing",
};
function recruitmentStageAccent(stage: RecruitmentPipelineStage) {
  if (stage === "ACTIVE") return "success";
  if (stage === "REJECTED") return "danger";
  if (stage === "NEW_APPLICATION") return "neutral";
  if (stage === "ASSESSMENT" || stage === "INTERVIEW") return "warning";
  if (stage === "FINAL_SELECTION" || stage === "OFFER") return "purple";
  return "info";
}
const reviewOptions: PipelineReviewStatus[] = ["PENDING", "PASS", "FAIL"];
const checkOptions: PipelineCheckStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETE", "WAIVED"];
const departmentOptions = ["PRODUCT", "MARKETING", "FINANCE", "SALES", "PROJECTS", "SUPPORT", "HR", "DESIGN", "ENGINEERING", "IT"];
const control = "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-50";
const labelClass = "mb-1.5 block text-xs font-semibold tracking-wide text-slate-600";
const offerCandidateCsvHeaders = [
  "name", "email", "phoneNumber", "address", "department", "compensationAmount",
  "compensationFrequency", "currency", "joiningDate", "employmentEndDate",
  "probationPeriod", "workingHours", "acceptanceDeadline", "annualCtc",
  "monthlyGrossSalary", "salaryStructureReference", "benefits",
];

function spreadsheetCellText(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return value == null ? "" : String(value).trim();
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

async function readOfferCandidateImportFile(file: File) {
  if (!file.size) throw new Error("The selected file is empty.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    if (file.size > 2_000_000) throw new Error("CSV files must be 2 MB or smaller.");
    return file.text();
  }
  if (extension !== "xlsx") throw new Error("Choose a .csv or .xlsx file. Save legacy .xls workbooks as .xlsx first.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Excel workbooks must be 10 MB or smaller.");

  let sheets: Array<{ sheet: string; data: unknown[][] }>;
  try {
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    sheets = await readXlsxFile(file);
  } catch {
    throw new Error("Could not read this workbook. Check that it is a valid .xlsx file and try again.");
  }

  const candidateRows: string[][] = [];
  for (const worksheet of sheets) {
    const rows = worksheet.data.filter((row) => row.some((cell) => spreadsheetCellText(cell) !== ""));
    if (!rows.length) continue;
    const headers = rows[0]!.map(spreadsheetCellText);
    if (headers.length !== offerCandidateCsvHeaders.length
      || headers.some((header, index) => header !== offerCandidateCsvHeaders[index])) {
      throw new Error(`Worksheet "${worksheet.sheet}" must use the downloaded candidate template as its first row.`);
    }
    for (const [index, sourceRow] of rows.slice(1).entries()) {
      if (sourceRow.slice(offerCandidateCsvHeaders.length).some((cell) => spreadsheetCellText(cell))) {
        throw new Error(`Worksheet "${worksheet.sheet}", row ${index + 2} has extra columns beyond the candidate template.`);
      }
      const row = offerCandidateCsvHeaders.map((_, column) => spreadsheetCellText(sourceRow[column]));
      if (row.some(Boolean)) candidateRows.push(row);
      if (candidateRows.length > 100) throw new Error("Import up to 100 candidates at a time.");
    }
  }
  if (!candidateRows.length) throw new Error("The workbook has no candidate rows beneath the template headers.");
  const csv = [
    offerCandidateCsvHeaders.map(csvCell).join(","),
    ...candidateRows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");
  if (new TextEncoder().encode(csv).byteLength > 2_000_000) {
    throw new Error("The workbook data exceeds the 2 MB import limit after conversion.");
  }
  return csv;
}

function dropdownOptions(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value.toLowerCase().replaceAll("_", " ").split(" ").map((word) =>
      word === "hr" ? "HR" : word.replace(/\b\w/g, (character) => character.toUpperCase()),
    ).join(" "),
  }));
}

function idOf(value: PipelinePerson | string | null | undefined) {
  return typeof value === "string" ? value : value?._id ?? "";
}

function personName(value: PipelinePerson | string | null | undefined) {
  return value && typeof value !== "string" ? value.name : "Unassigned";
}

function candidateName(entry: RecruitmentPipelineEntry) {
  return entry.applicationId.userId?.name || "Candidate";
}

function candidateEmail(entry: RecruitmentPipelineEntry) {
  return entry.applicationId.userId?.email || "";
}

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not set";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "This update could not be saved.";
}

export function RecruitmentPipelineView() {
  const user = useAppSelector((state) => state.auth.user);
  const roles = user?.roles ?? [];
  const canLead = roles.some((role) => ["ADMIN", "CEO", "HR_HEAD", "HR_MANAGER"].includes(role))
    || user?.system_roles?.includes("HR") === true
    || (user?.organization_department === "HR" && ["HR", "HEAD", "MANAGER"].includes(user.organization_level ?? ""));
  const [stageData, setStageData] = useState<Partial<Record<RecruitmentPipelineStage, RecruitmentPipelinePage>>>({});
  const stageDataRef = useRef<Partial<Record<RecruitmentPipelineStage, RecruitmentPipelinePage>>>({});
  const offerRefreshMinimum = useRef(0);
  const [staff, setStaff] = useState<RecruitmentPipelineStaff>({ hrStaff: [], hiringManagers: [] });
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragged, setDragged] = useState<RecruitmentPipelineEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [overStage, setOverStage] = useState<RecruitmentPipelineStage | null>(null);
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importOpportunityId, setImportOpportunityId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{
    message: string;
    errors: Array<{ row: number; email: string; message: string }>;
    warnings: string[];
  } | null>(null);
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [deletionChallenge, setDeletionChallenge] = useState<{
    pipelineIds: string[];
    deleteAll: boolean;
    count: number;
    email: string;
  } | null>(null);
  const [deletionOtp, setDeletionOtp] = useState("");
  const [deletionBusy, setDeletionBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pages, team] = await Promise.all([
        Promise.all(RECRUITMENT_PIPELINE_STAGES.map(async (stage) => {
          const firstPage = await RecruitmentService.pipeline(stage);
          const previouslyLoaded = stageDataRef.current[stage]?.entries.length ?? 0;
          const minimumEntries = Math.max(
            previouslyLoaded,
            stage === "OFFER" ? offerRefreshMinimum.current : 0,
          );
          const pagesToLoad = Math.min(
            Math.max(1, firstPage.pagination.totalPages),
            Math.max(1, Math.ceil(minimumEntries / firstPage.pagination.limit)),
          );
          const additionalPages = await Promise.all(
            Array.from({ length: pagesToLoad - 1 }, (_, index) =>
              RecruitmentService.pipeline(stage, index + 2, firstPage.pagination.limit),
            ),
          );
          return [stage, {
            ...firstPage,
            entries: [firstPage, ...additionalPages].flatMap((page) => page.entries),
            pagination: { ...firstPage.pagination, page: pagesToLoad },
          }] as const;
        })),
        RecruitmentService.pipelineStaff(),
      ]);
      const nextStageData = Object.fromEntries(pages) as Partial<Record<RecruitmentPipelineStage, RecruitmentPipelinePage>>;
      stageDataRef.current = nextStageData;
      setStageData(nextStageData);
      offerRefreshMinimum.current = 0;
      setStaff(team);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(reload); }, [revision, reload]);
  useEffect(() => { stageDataRef.current = stageData; }, [stageData]);

  useEffect(() => {
    if (!canLead) return;
    void RecruitmentService.adminOpportunities()
      .then(setOpportunities)
      .catch((caught) => setError(errorMessage(caught)));
  }, [canLead]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const candidateId = url.searchParams.get("candidate");
    if (candidateId) {
      const selectCandidate = window.setTimeout(() => setSelectedId(candidateId), 0);
      return () => window.clearTimeout(selectCandidate);
    }
    const applicationId = url.searchParams.get("application");
    if (!applicationId) return;
    const entry = Object.values(stageData)
      .flatMap((page) => page?.entries ?? [])
      .find((candidate) => candidate.applicationId._id === applicationId);
    if (!entry) return;

    const selectCandidate = window.setTimeout(() => {
      setSelectedId(entry._id);
      url.searchParams.delete("application");
      url.searchParams.set("candidate", entry._id);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, 0);
    return () => window.clearTimeout(selectCandidate);
  }, [stageData]);

  useEffect(() => {
    const handlePopState = () => {
      setSelectedId(new URL(window.location.href).searchParams.get("candidate"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function openCandidate(candidateId: string) {
    setSelectedId(candidateId);
    const url = new URL(window.location.href);
    url.searchParams.delete("application");
    url.searchParams.set("candidate", candidateId);
    window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function closeCandidate() {
    setSelectedId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("candidate");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const selected = useMemo(
    () => Object.values(stageData).flatMap((page) => page?.entries ?? []).find((entry) => entry._id === selectedId) ?? null,
    [selectedId, stageData],
  );
  const summary = {
    total: RECRUITMENT_PIPELINE_STAGES.reduce((sum, stage) => sum + (stageData[stage]?.pagination.total ?? 0), 0),
    active: activeStages.filter((stage) => stage !== "ACTIVE").reduce((sum, stage) => sum + (stageData[stage]?.pagination.total ?? 0), 0),
    interviews: (stageData.ASSESSMENT?.pagination.total ?? 0) + (stageData.INTERVIEW?.pagination.total ?? 0),
    hired: stageData.ACTIVE?.pagination.total ?? 0,
    rejected: stageData.REJECTED?.pagination.total ?? 0,
  };
  const matchesSearch = (entry: RecruitmentPipelineEntry) => !search.trim()
    || `${candidateName(entry)} ${candidateEmail(entry)} ${entry.applicationId.opportunityId?.title ?? ""} ${personName(entry.recruiterId)}`
      .toLowerCase().includes(search.trim().toLowerCase());
  if (selected) {
    return <CandidateDetails
      key={`${selected._id}-${selected.updatedAt ?? ""}`}
      entry={selected}
      staff={staff}
      userId={user?.user_id ?? ""}
      canLead={canLead}
      onClose={closeCandidate}
      onDeleteCandidate={() => void requestCandidateDeletion([selected._id])}
      onError={setError}
      onUpdated={() => setRevision((value) => value + 1)}
    />;
  }

  async function updateStage(entry: RecruitmentPipelineEntry, destination: RecruitmentPipelineStage) {
    if (destination === entry.stage || busy) return;
    let note: string | undefined;
    if (destination === "REJECTED") {
      note = window.prompt(`Why was ${candidateName(entry)} rejected?`)?.trim();
      if (!note) return;
    }
    setBusy(true);
    setError("");
    try {
      await RecruitmentService.pipelineAction(entry._id, "/stage", { stage: destination, note });
      setSelectedId(null);
      setRevision((value) => value + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function loadMore(stage: RecruitmentPipelineStage) {
    const current = stageData[stage];
    if (!current || current.pagination.page >= current.pagination.totalPages) return;
    try {
      const next = await RecruitmentService.pipeline(stage, current.pagination.page + 1);
      setStageData((previous) => {
        const first = previous[stage];
        if (!first) return { ...previous, [stage]: next };
        return {
          ...previous,
          [stage]: {
            ...next,
            entries: [...first.entries, ...next.entries.filter((entry) => !first.entries.some((item) => item._id === entry._id))],
          },
        };
      });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function downloadOfferCsvTemplate() {
    const blob = new Blob([`${offerCandidateCsvHeaders.join(",")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "offer-stage-candidates-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importOfferCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!importFile || !importOpportunityId) {
      setError("Choose an opportunity and CSV file before importing.");
      return;
    }
    setImportBusy(true);
    setError("");
    setImportResult(null);
    try {
      const result = await RecruitmentService.importOfferCandidates({
        opportunityId: importOpportunityId,
        csv: await readOfferCandidateImportFile(importFile),
      });
      setImportResult({
        message: result.message,
        errors: result.errors,
        warnings: result.imported
          .filter((item) => item.inviteSent === false)
          .map((item) => `Row ${item.row} (${item.email}): account created, but the activation email could not be delivered.`),
      });
      offerRefreshMinimum.current = (stageDataRef.current.OFFER?.entries.length ?? 0) + result.imported.length;
      setRevision((value) => value + 1);
      setSelectedOfferIds([]);
      setImportFile(null);
      form.reset();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setImportBusy(false);
    }
  }

  async function requestCandidateDeletion(pipelineIds: string[], deleteAll = false) {
    if ((!pipelineIds.length && !deleteAll) || deletionBusy) return;
    const count = deleteAll ? summary.total : pipelineIds.length;
    const confirmation = deleteAll
      ? `Permanently delete all ${count} candidates across every recruitment stage? Candidate accounts and their other applications will remain. Email OTP verification is required.`
      : `Delete ${count} selected candidate${count === 1 ? "" : "s"} from recruitment? Their linked offer and application records will be removed; accounts and other applications will remain.`;
    if (!window.confirm(confirmation)) return;
    setDeletionBusy(true);
    setError("");
    try {
      const target = deleteAll ? { deleteAll: true } : { pipelineIds };
      if (deleteAll || pipelineIds.length > 5) {
        const response = await RecruitmentService.requestCandidateDeletionOtp(target);
        setDeletionChallenge({
          pipelineIds,
          deleteAll,
          count: response.candidateCount,
          email: response.email,
        });
        setDeletionOtp("");
      } else {
        const response = await RecruitmentService.deleteRecruitmentCandidates(target);
        setError("");
        setNotice(response.message);
        setSelectedOfferIds((current) => current.filter((id) => !pipelineIds.includes(id)));
        if (selectedId && pipelineIds.includes(selectedId)) closeCandidate();
        setRevision((value) => value + 1);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDeletionBusy(false);
    }
  }

  async function confirmCandidateDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deletionChallenge) return;
    setDeletionBusy(true);
    setError("");
    try {
      const target = deletionChallenge.deleteAll
        ? { deleteAll: true }
        : { pipelineIds: deletionChallenge.pipelineIds };
      const response = await RecruitmentService.deleteRecruitmentCandidates(target, deletionOtp);
      setSelectedOfferIds((current) => current.filter((id) => !deletionChallenge.pipelineIds.includes(id)));
      if (selectedId && (deletionChallenge.deleteAll || deletionChallenge.pipelineIds.includes(selectedId))) closeCandidate();
      setDeletionChallenge(null);
      setDeletionOtp("");
      setNotice(response.message);
      setRevision((value) => value + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDeletionBusy(false);
    }
  }

  function toggleOfferCandidate(pipelineId: string) {
    setSelectedOfferIds((current) => current.includes(pipelineId)
      ? current.filter((id) => id !== pipelineId)
      : [...current, pipelineId]);
  }

  return (
    <main className="mx-auto w-full max-w-[1680px] space-y-5 pb-8 text-(--brand-text)">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-(--brand-text-muted)">
            <span>Workspaces</span><span aria-hidden="true">/</span><span className="font-semibold text-(--brand-text-secondary)">Human Resources</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-(--brand-red-pale) text-(--brand-red)"><BriefcaseBusiness size={21} /></span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-(--brand-navy) sm:text-3xl">Recruitment Pipeline</h1>
              <p className="mt-1 text-sm text-(--brand-text-secondary)">Move candidates through the hiring journey, review stage work, and confirm onboarding before activation.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canLead && <button type="button" onClick={() => { setShowImport((value) => !value); setImportResult(null); }} className="inline-flex h-10 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 text-sm font-semibold text-(--brand-navy) shadow-(--shadow-xs) transition hover:bg-(--brand-surface-hover)">
            <Upload size={15} /> Import to Offer
          </button>}
          <Link href="/dashboard/admin/recruitment-pipeline/offer-profile" className="inline-flex h-10 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 text-sm font-semibold text-(--brand-navy) shadow-(--shadow-xs) transition hover:bg-(--brand-surface-hover)">
            <Building2 size={15}/> Offer letter profile
          </Link>
          <button type="button" onClick={() => setRevision((value) => value + 1)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-(--brand-border) bg-(--brand-surface) px-3 text-sm font-semibold transition hover:bg-(--brand-surface-hover)">
            <RefreshCw size={15} /> Refresh
          </button>
          <Link href="/dashboard/admin/applications/add-candidate" className="inline-flex h-10 items-center gap-2 rounded-lg bg-(--brand-red) px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-(--brand-red-hover)">
            <Plus size={16} /> Add candidate
          </Link>
        </div>
      </header>

      {showImport && canLead && <section className="rounded-xl border border-(--brand-border) bg-white p-4 shadow-(--shadow-sm)">
        <div className="rounded-xl bg-gradient-to-br from-slate-50 via-white to-rose-50/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><FileSpreadsheet size={21} /></span>
              <div>
                <h2 className="text-base font-bold text-(--brand-navy)">Bulk import candidates into Offer</h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-(--brand-text-secondary)">Choose the opportunity, complete one candidate per row, then upload a CSV or Excel workbook. Imported candidates go directly to Offer without regular pipeline progression or hiring-manager approval.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/templates/offer-stage-candidates-template.xlsx" download className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 text-xs font-semibold text-(--brand-navy) shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                <Download size={14} /> Excel template
              </a>
              <button type="button" onClick={downloadOfferCsvTemplate} className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 text-xs font-semibold text-(--brand-navy) shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                <Download size={14} /> CSV template
              </button>
            </div>
          </div>
          <div className="mt-5 flex max-w-2xl items-center">
            {["Choose opportunity", "Add spreadsheet", "Import candidates"].map((step, index) => (
              <div key={step} className={`flex min-w-0 items-center ${index < 2 ? "flex-1" : ""}`}>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "bg-rose-700 text-white" : "border border-slate-300 bg-white text-slate-500"}`}>{index + 1}</span>
                  <span className={`hidden text-[11px] font-semibold sm:block ${index === 0 ? "text-rose-800" : "text-slate-500"}`}>{step}</span>
                </div>
                {index < 2 && <span className="mx-2 h-px min-w-4 flex-1 bg-slate-200 sm:mx-4" />}
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={(event) => void importOfferCsv(event)} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <label className={labelClass}>1. Job or internship opportunity</label>
            <SearchableDropdown
              name="opportunityId"
              defaultValue={importOpportunityId}
              onValueChange={setImportOpportunityId}
              ariaLabel="Job or internship opportunity"
              required
              placeholder="Search opportunities by title or role"
              options={opportunities
                .filter((opportunity) => !["CLOSED", "ARCHIVED"].includes(opportunity.status))
                .map((opportunity) => ({
                  value: opportunity._id,
                  label: `${opportunity.type === "JOB" ? "Job" : "Internship"} · ${opportunity.title}${opportunity.role && opportunity.role !== opportunity.title ? ` · ${opportunity.role}` : ""}`,
                }))}
            />
            <p className="mt-1.5 text-[11px] text-(--brand-text-muted)">Imports add candidates to the existing pipeline; they do not replace earlier records. Duplicate applications are reported instead of overwriting candidates.</p>
          </div>
          <div>
            <span className={labelClass}>2. Candidate spreadsheet</span>
            <label className="group flex min-h-[76px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-3 transition hover:border-rose-300 hover:bg-rose-50/40">
              <input required type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setImportFile(event.target.files?.[0] ?? null); setImportResult(null); }} className="sr-only" />
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm group-hover:text-rose-700"><Upload size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-800">{importFile?.name ?? "Choose a CSV or .xlsx workbook"}</span>
                <span className="mt-1 block text-[10px] leading-4 text-slate-500">{importFile ? `${(importFile.size / 1024).toFixed(1)} KB · Ready to import` : "Click to browse · multiple Excel sheets are supported"}</span>
              </span>
              <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm">Browse</span>
            </label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[11px] leading-5 text-slate-600 lg:col-span-2">
            <p className="font-bold text-slate-800">Before importing</p>
            <p className="mt-1">Use the template headers exactly as provided and dates in YYYY-MM-DD format. Required fields include name, email, phone, address, department, compensation, currency, joining/end dates, and acceptance deadline. For job candidates, annual CTC, monthly gross salary, and salary-structure reference are also required. Up to 100 candidates; CSV data max 2 MB, Excel workbook max 10 MB.</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
            <p className="text-[10px] leading-4 text-slate-500">Each worksheet must have the template header row. Empty rows are ignored.</p>
            <button type="submit" disabled={importBusy || !importFile || !importOpportunityId} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">
              {importBusy ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />} {importBusy ? "Importing…" : "Import candidates"}
            </button>
          </div>
        </form>
        {importResult && <div role="status" className={`mt-4 rounded-lg border p-3 text-sm ${importResult.errors.length || importResult.warnings.length ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          <p className="font-semibold">{importResult.message}</p>
          {importResult.errors.length > 0 && <ul className="mt-2 space-y-1 text-xs">{importResult.errors.map((item) => <li key={`${item.row}-${item.email}`}>Row {item.row}{item.email ? ` (${item.email})` : ""}: {item.message}</li>)}</ul>}
          {importResult.warnings.length > 0 && <ul className="mt-2 space-y-1 text-xs">{importResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
        </div>}
      </section>}

      {deletionChallenge && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <form onSubmit={(event) => void confirmCandidateDeletion(event)} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <h2 className="text-sm font-bold text-amber-950">Verify bulk candidate deletion</h2>
            <p className="mt-1 text-xs text-amber-900">Enter the 6-digit code sent to {deletionChallenge.email} to delete {deletionChallenge.deleteAll ? "all" : "these"} {deletionChallenge.count} candidates across the recruitment pipeline.</p>
          </div>
          <label className="text-xs font-semibold text-amber-950">Verification code
            <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={deletionOtp} onChange={(event) => setDeletionOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className={`${control} mt-1 w-40`} />
          </label>
          <button type="submit" disabled={deletionBusy || deletionOtp.length !== 6} className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{deletionBusy && <LoaderCircle size={15} className="animate-spin" />}Confirm deletion</button>
          <button type="button" onClick={() => { setDeletionChallenge(null); setDeletionOtp(""); }} className="h-10 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-950">Cancel</button>
        </form>
      </section>}

      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-(--status-danger-border) bg-(--status-danger-bg) p-3 text-sm text-(--status-danger)"><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
      {notice && <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16} /></button></div>}
      <section aria-label="Recruitment pipeline summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["All candidates", summary.total],
          ["In process", summary.active],
          ["Assessment / interview", summary.interviews],
          ["Hired", summary.hired],
          ["Rejected", summary.rejected],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-(--brand-border) bg-white px-4 py-3 shadow-(--shadow-xs)">
            <p className="text-xs font-medium text-(--brand-text-muted)">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-(--brand-navy)">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-(--brand-border) bg-white shadow-(--shadow-sm)">
        <header className="flex flex-col gap-3 border-b border-(--brand-border) p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-(--brand-navy)">Hiring stages</h2>
            <p className="mt-1 text-xs text-(--brand-text-muted)">{summary.total} candidates · Drag a card or use its stage controls to move candidates</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canLead && <button type="button" onClick={() => setSelectedOfferIds((stageData.OFFER?.entries ?? []).map((entry) => entry._id))} disabled={!stageData.OFFER?.entries.length} className="h-10 rounded-lg border border-(--brand-border) px-3 text-xs font-semibold text-(--brand-navy) disabled:opacity-40">Select loaded Offers</button>}
            {canLead && selectedOfferIds.length > 0 && <button type="button" onClick={() => void requestCandidateDeletion(selectedOfferIds)} disabled={deletionBusy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-700 px-3 text-xs font-semibold text-white disabled:opacity-50"><Trash2 size={14} />Delete selected ({selectedOfferIds.length})</button>}
            {canLead && <button type="button" onClick={() => void requestCandidateDeletion([], true)} disabled={deletionBusy || summary.total === 0} className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 disabled:opacity-40"><Trash2 size={14} />Delete all candidates</button>}
            <label className="relative block w-full sm:w-72">
              <Search size={15} className="pointer-events-none absolute left-3 top-3 text-(--brand-text-muted)" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search loaded candidates" className="h-10 w-full rounded-lg border border-(--brand-border) bg-(--input-background) pl-9 pr-3 text-sm text-(--brand-text) outline-none focus:border-(--brand-red)" />
            </label>
          </div>
        </header>
        {loading && <div role="status" className="flex items-center justify-center gap-2 border-b border-(--brand-border) py-3 text-sm text-(--brand-text-secondary)"><LoaderCircle size={16} className="animate-spin" />Loading company pipeline…</div>}
        <div className="min-w-0">
          <div className={boardStyles.board}>
          {RECRUITMENT_PIPELINE_STAGES.map((stage) => {
            const data = stageData[stage];
            const count = data?.pagination.total ?? 0;
            return (
              <section
                key={stage}
                aria-label={`${stageLabels[stage]} stage`}
                onDragOver={(event) => { if (dragged && !busy) { event.preventDefault(); setOverStage(stage); } }}
                onDragLeave={() => setOverStage(null)}
                onDrop={(event) => { event.preventDefault(); setOverStage(null); if (dragged) void updateStage(dragged, stage); setDragged(null); }}
                data-accent={recruitmentStageAccent(stage)}
                data-over={overStage === stage}
                className={boardStyles.column}
              >
                <header className={boardStyles.columnHeader}>
                  <div className={boardStyles.headingRow}>
                    <h3 className={boardStyles.stageName} title={stageLabels[stage]}><span className={boardStyles.stageDot} />{stageLabels[stage]}</h3>
                    <span className={boardStyles.count}>{data ? count : "…"}</span>
                  </div>
                  <p className={boardStyles.stageHint}>{stageHints[stage]}</p>
                </header>
                <div className={boardStyles.cards}>
                  {(data?.entries ?? []).filter(matchesSearch).map((entry) => (
                    <article key={entry._id} draggable={!busy && stage !== "ACTIVE" && stage !== "REJECTED"} onDragStart={(event) => { event.dataTransfer.setData("text/plain", entry._id); event.dataTransfer.effectAllowed = "move"; setDragged(entry); }} onDragEnd={() => { setDragged(null); setOverStage(null); }} className={boardStyles.card}>
                      <div className="flex items-start gap-2">
                        {canLead && stage === "OFFER" && <input type="checkbox" aria-label={`Select ${candidateName(entry)}`} checked={selectedOfferIds.includes(entry._id)} onChange={() => toggleOfferCandidate(entry._id)} onClick={(event) => event.stopPropagation()} className="mt-1 size-4 shrink-0 accent-red-700" />}
                        <button type="button" onClick={() => openCandidate(entry._id)} className={`${boardStyles.cardTitle} min-w-0 flex-1 text-left`}>
                          <span className="block">{candidateName(entry)}</span>
                          <span className={boardStyles.cardSubtitle}>{entry.applicationId.opportunityId?.title || "Role not available"}</span>
                        </button>
                        {stage !== "ACTIVE" && stage !== "REJECTED" && <GripVertical size={16} className="mt-1 shrink-0 text-(--brand-text-muted)" aria-label="Drag candidate" />}
                      </div>
                      <div className={boardStyles.cardFooter}>
                        <span className="truncate" title={`Recruiter: ${personName(entry.recruiterId)}`}>{personName(entry.recruiterId)}</span><span className="shrink-0">{dateLabel(entry.applicationId.appliedAt)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] text-(--brand-text-secondary)">{entry.latestOffer ? `Offer · ${entry.latestOffer.status.replaceAll("_", " ")}` : entry.assessmentSummary.total ? `Assessments · ${entry.assessmentSummary.passed}/${entry.assessmentSummary.total} passed` : "No assessments"}</span>
                        {stage !== "ACTIVE" && stage !== "REJECTED" && <button type="button" aria-label={`Move ${candidateName(entry)} to next stage`} disabled={busy} onClick={() => { const next = activeStages[activeStages.indexOf(stage) + 1]; if (next) void updateStage(entry, next); }} className="rounded p-1 text-(--brand-red) hover:bg-(--brand-red-pale) disabled:opacity-40"><ArrowRight size={14} /></button>}
                      </div>
                      <div className={boardStyles.cardMeta}><CircleUserRound size={15} />{personName(entry.managerId)}</div>
                    </article>
                  ))}
                  {data && data.entries.filter(matchesSearch).length === 0 && <p className={boardStyles.empty}>{search.trim() ? "No loaded candidates match" : "No candidates at this stage"}</p>}
                  {!data && !loading && <p className={boardStyles.empty}>Could not load this stage.</p>}
                </div>
                {data && data.pagination.page < data.pagination.totalPages && <button type="button" onClick={() => void loadMore(stage)} className={boardStyles.loadMore}>Load more ({data.entries.length} of {count})</button>}
              </section>
            );
          })}
        </div>
        </div>
        <p className="flex items-center gap-2 border-t border-(--brand-border) px-4 py-3 text-xs text-(--brand-text-muted)"><GripVertical size={14} />Drag a candidate to another stage, or open their page to manage stage details and approvals.</p>
      </section>
    </main>
  );
}

function CandidateDetails({ entry, staff, userId, canLead, onClose, onDeleteCandidate, onError, onUpdated }: {
  entry: RecruitmentPipelineEntry;
  staff: RecruitmentPipelineStaff;
  userId: string;
  canLead: boolean;
  onClose: () => void;
  onDeleteCandidate: () => void;
  onError: (message: string) => void;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [assessments, setAssessments] = useState<ApplicationAssessment[]>([]);
  const [localError, setLocalError] = useState("");
  const currentUserManages = idOf(entry.managerId) === userId;
  const currentUserHiringManages = idOf(entry.hiringManagerId) === userId;
  const assignedRecruiter = idOf(entry.recruiterId);
  const employeeOffer = entry.applicationId.opportunityId?.type === "JOB";
  const [assessmentMinimumDate] = useState(() => {
    const minimum = new Date(Date.now() + 60000);
    minimum.setMinutes(minimum.getMinutes() - minimum.getTimezoneOffset());
    return minimum.toISOString().slice(0, 16);
  });

  useEffect(() => {
    if (entry.stage !== "ASSESSMENT") return;
    void RecruitmentService.pipelineAssessments(entry._id)
      .then(setAssessments)
      .catch((error) => setLocalError(errorMessage(error)));
  }, [entry._id, entry.applicationId._id, entry.stage]);

  async function action(endpoint: string, data: unknown, method: "patch" | "post" = "patch") {
    setBusy(true);
    setLocalError("");
    onError("");
    try {
      await RecruitmentService.pipelineAction(entry._id, endpoint, data, method);
      onUpdated();
    } catch (error) {
      const message = errorMessage(error);
      setLocalError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  function submit(endpoint: string, method: "patch" | "post" = "patch") {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const payload: Record<string, string | number | null> = {};
      form.forEach((value, key) => {
        if (typeof value !== "string") return;
        if (key === "score") payload[key] = value.trim() ? Number(value) : null;
        else if (["joiningDate", "employmentEndDate", "acceptanceDeadline", "hiringManagerId"].includes(key) && !value.trim()) payload[key] = null;
        else payload[key] = value;
      });
      void action(endpoint, payload, method);
    };
  }

  async function downloadResume() {
    try {
      const response = await RecruitmentService.pipelineResume(entry.applicationId._id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = entry.applicationId.resumeFileName || "candidate-resume.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setLocalError(errorMessage(error));
    }
  }

  async function downloadAssessment(assessment: ApplicationAssessment) {
    try {
      const response = await RecruitmentService.pipelineAssessmentSubmission(entry._id, assessment._id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = assessment.submissionFileName || "assessment-submission";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setLocalError(errorMessage(error));
    }
  }

  async function manageOffer() {
    setBusy(true);
    setLocalError("");
    onError("");
    try {
      if (!entry.latestOffer || entry.latestOffer.status === "DRAFT") await RecruitmentService.createPipelineOffer(entry.applicationId._id);
      else await RecruitmentService.sendPipelineOffer(entry.latestOffer._id);
      onUpdated();
    } catch (error) {
      const message = errorMessage(error);
      setLocalError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 pb-8 text-(--brand-text)">
      <button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-text-secondary) transition hover:text-(--brand-navy)">
        <ArrowLeft size={16} /> Back to hiring stages
      </button>
      <RecruitmentProgress stage={entry.stage} />
      <section aria-labelledby="candidate-title" className="rounded-xl border border-(--brand-border) bg-white shadow-(--shadow-sm)">
        <header className="flex items-start justify-between gap-3 border-b border-(--brand-border) p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">{stageLabels[entry.stage]}</p>
            <h1 id="candidate-title" className="mt-1 break-words text-xl font-bold">{candidateName(entry)}</h1>
            <p className="mt-1 break-all text-sm text-slate-500">{candidateEmail(entry)} · {entry.applicationId.opportunityId?.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canLead && <button type="button" onClick={onDeleteCandidate} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"><Trash2 size={14} />Delete candidate</button>}
            <button type="button" onClick={onClose} className="hidden rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:block">All candidates</button>
          </div>
        </header>

        <div className="space-y-5 p-4 sm:p-5">
          {(localError) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{localError}</p>}
          <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <div><p className="text-[11px] font-bold uppercase text-slate-400">Contact</p><p className="mt-1 text-sm font-semibold">{entry.applicationId.candidatePhone || entry.applicationId.userId?.phoneNumber || "No phone provided"}</p></div>
            <div><p className="text-[11px] font-bold uppercase text-slate-400">Source</p><p className="mt-1 text-sm font-semibold">{entry.applicationId.source || "WEBSITE"}{entry.applicationId.sourceDetail ? ` · ${entry.applicationId.sourceDetail}` : ""}</p></div>
            <div><p className="text-[11px] font-bold uppercase text-slate-400">Recruiter / Manager</p><p className="mt-1 text-sm font-semibold">{personName(entry.recruiterId)} / {personName(entry.managerId)}</p></div>
            <div><p className="text-[11px] font-bold uppercase text-slate-400">Applied</p><p className="mt-1 text-sm font-semibold">{dateLabel(entry.applicationId.appliedAt)}</p></div>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              {entry.applicationId.resumeFileName && <button type="button" onClick={() => void downloadResume()} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><ExternalLink size={13} />Download resume</button>}
              {entry.applicationId.resumeUrl && <a href={entry.applicationId.resumeUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700">Source resume ↗</a>}
              {entry.applicationId.portfolioUrl && <a href={entry.applicationId.portfolioUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700">Portfolio ↗</a>}
              {entry.applicationId.linkedInUrl && <a href={entry.applicationId.linkedInUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700">LinkedIn ↗</a>}
              {entry.applicationId.githubUrl && <a href={entry.applicationId.githubUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700">GitHub ↗</a>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Candidate profile</h3>
            {entry.applicationId.education && <div className="mt-3"><p className="text-xs font-bold text-slate-500">Education</p><p className="mt-1 whitespace-pre-wrap text-sm">{entry.applicationId.education}</p></div>}
            {(entry.applicationId.experienceSummary || entry.applicationId.currentCompany || entry.applicationId.experienceYears !== undefined) && <div className="mt-3"><p className="text-xs font-bold text-slate-500">Experience</p><p className="mt-1 text-sm">{entry.applicationId.currentCompany}{entry.applicationId.experienceYears !== undefined ? ` / ${entry.applicationId.experienceYears} years` : ""}</p><p className="mt-1 whitespace-pre-wrap text-sm">{entry.applicationId.experienceSummary}</p></div>}
            {!!entry.applicationId.skills?.length && <div className="mt-3 flex flex-wrap gap-2">{entry.applicationId.skills.map((skill, index) => <span key={`${skill}:${index}`} className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{skill}</span>)}</div>}
            {entry.applicationId.coverLetter && <div className="mt-3"><p className="text-xs font-bold text-slate-500">Application statement</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{entry.applicationId.coverLetter}</p></div>}
            {entry.applicationId.screeningAnswers?.map((answer, index) => <div key={index} className="mt-3"><p className="text-xs font-bold text-slate-500">{answer.question}</p><p className="mt-1 whitespace-pre-wrap text-sm">{answer.answer}</p></div>)}
            {!entry.applicationId.education && !entry.applicationId.experienceSummary && !entry.applicationId.skills?.length && !entry.applicationId.coverLetter && !entry.applicationId.screeningAnswers?.length && <p className="mt-2 text-xs text-slate-500">No additional profile details were supplied by the source.</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UserRoundCog size={18} /></span>
              <div><h3 className="text-sm font-bold text-slate-900">Candidate ownership</h3><p className="mt-0.5 text-xs text-slate-500">Assign the HR recruiter and hiring manager responsible for this candidate.</p></div>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action("/assignment", { recruiterId: data.get("recruiterId") || undefined, hiringManagerId: data.get("hiringManagerId") || null }); }} className="grid gap-4 sm:grid-cols-2">
              <label><span className={labelClass}>Recruiter</span><SearchableDropdown name="recruiterId" defaultValue={assignedRecruiter} placeholder="Search HR owners" options={staff.hrStaff.map((person) => ({ value: person._id, label: `${person.name} · ${person.level}` }))} /></label>
              <label><span className={labelClass}>Hiring manager</span><SearchableDropdown name="hiringManagerId" defaultValue={idOf(entry.hiringManagerId)} placeholder="Not assigned" options={staff.hiringManagers.map((person) => ({ value: person._id, label: `${person.name} · ${person.department}` }))} /></label>
              <button disabled={busy} className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2">Save ownership</button>
            </form>
          </section>

          {entry.stage === "SCREENING" && <StageForm title="Screening checklist" icon={<ClipboardCheck size={16} />} onSubmit={submit("/screening")}>
            {(["skillsFit", "educationFit", "experienceFit", "locationFit", "eligibility"] as const).map((field) => <label key={field}><span className={labelClass}>{field.replace(/([A-Z])/g, " $1")}</span><SearchableDropdown name={field} defaultValue={entry.screening[field]} options={dropdownOptions(reviewOptions)} /></label>)}
            <label><span className={labelClass}>Expected compensation</span><input name="expectedCompensation" defaultValue={entry.screening.expectedCompensation} className={control} /></label>
            <label><span className={labelClass}>Notice period / availability</span><input name="noticePeriod" defaultValue={entry.screening.noticePeriod} className={control} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>Screening notes</span><textarea name="notes" rows={3} defaultValue={entry.screening.notes} className={control} /></label>
          </StageForm>}

          {entry.stage === "ASSESSMENT" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h3 className="text-sm font-bold text-slate-900">Candidate assessments</h3><p className="mt-1 text-xs text-slate-500">Review submissions, record outcomes, and provide feedback.</p></div>
            {assessments.length ? <div className="mt-3 space-y-3">{assessments.map((assessment) => <form key={assessment._id} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action(`/assessments/${assessment._id}`, { result: data.get("result"), score: data.get("score") ? Number(data.get("score")) : null, feedback: data.get("feedback") }); }} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-[1fr_110px_100px]">
              <div className="sm:col-span-3"><p className="text-sm font-bold">{assessment.title}</p><p className="mt-1 text-xs text-slate-500">Submission: {assessment.status}</p></div>
              <p className="text-xs text-slate-500 sm:col-span-3">Due {dateLabel(assessment.deadline)}{assessment.submittedAt ? ` · submitted ${dateLabel(assessment.submittedAt)}` : ""}</p>
              {assessment.submissionFileName && <button type="button" onClick={() => void downloadAssessment(assessment)} className="text-left text-xs font-bold text-blue-700 sm:col-span-3">Download candidate submission: {assessment.submissionFileName}</button>}
              {assessment.submissionText && <p className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-600 sm:col-span-3">{assessment.submissionText}</p>}
                <label><span className={labelClass}>Outcome</span><SearchableDropdown name="result" defaultValue={assessment.result === "PASS" || assessment.result === "FAIL" ? assessment.result : ""} placeholder="Choose outcome" required options={dropdownOptions(["PASS", "FAIL"])} /></label>
              <label><span className={labelClass}>Score</span><input name="score" type="number" min="0" max="100" defaultValue={assessment.score ?? ""} className={control} /></label>
              <button disabled={busy || assessment.status === "ASSIGNED"} className="self-end rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Save result</button>
              <label className="sm:col-span-3"><span className={labelClass}>Reviewer feedback</span><textarea name="feedback" required minLength={1} maxLength={4000} defaultValue={assessment.feedback || ""} className={control} rows={2} /></label>
            </form>)}</div> : <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No assessment assigned. Assign a test or get an HR Manager waiver before advancing.</p>}
            <form onSubmit={(event) => { event.preventDefault(); const formElement = event.currentTarget; const data = new FormData(formElement); setBusy(true); setLocalError(""); void RecruitmentService.createPipelineAssessment(entry._id, { title: String(data.get("title")), instructions: String(data.get("instructions")), deadline: new Date(String(data.get("deadline"))).toISOString() }).then((assignment) => { setAssessments((current) => [assignment, ...current]); formElement.reset(); }).catch((error) => setLocalError(errorMessage(error))).finally(() => setBusy(false)); }} className="mt-4 grid gap-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4">
              <h4 className="text-xs font-bold">Assign an assessment</h4>
              <label><span className={labelClass}>Title</span><input name="title" required minLength={3} maxLength={120} className={control} /></label>
              <label><span className={labelClass}>Instructions</span><textarea name="instructions" required minLength={10} maxLength={10000} rows={3} className={control} /></label>
              <label><span className={labelClass}>Due date</span><input name="deadline" type="datetime-local" required min={assessmentMinimumDate} className={control} /></label>
              <button disabled={busy} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Assign to candidate</button>
            </form>
            {canLead && <form onSubmit={(event) => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("reason")); void action("/assessment-waiver", { reason }, "post"); }} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input name="reason" required minLength={5} placeholder="Manager&apos;s reason to waive assessment" className={control} />
              <button disabled={busy} className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Approve waiver</button>
            </form>}
            {entry.assessmentWaiverReason && <p className="mt-2 text-xs text-amber-800">Assessment waived: {entry.assessmentWaiverReason}</p>}
          </section>}

          {entry.stage === "INTERVIEW" && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div><h3 className="text-sm font-bold text-slate-900">Interview rounds</h3><p className="mt-1 text-xs text-slate-500">Schedule each round and capture the interviewer’s feedback.</p></div>
            {entry.interviewRounds.map((round) => <form key={round._id} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const status = String(data.get("status")); void action(`/interviews/${round._id}`, { status, feedback: data.get("feedback"), ...(status === "PASSED" || status === "FAILED" ? { result: data.get("result") } : {}), score: data.get("score") ? Number(data.get("score")) : null }); }} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3">
              <div className="sm:col-span-3"><p className="text-sm font-bold">{round.type} · {dateLabel(round.scheduledAt)}</p><p className="text-xs text-slate-500">Status: {round.status}</p></div>
              <label><span className={labelClass}>Next status</span><SearchableDropdown name="status" required placeholder="Choose next status" options={dropdownOptions(nextInterviewStatuses(round.status))} /></label>
              <label><span className={labelClass}>Result (for final status)</span><SearchableDropdown name="result" defaultValue={round.result === "PENDING" ? "" : round.result} placeholder="Choose result" options={dropdownOptions(["PASS", "FAIL"])} /></label>
              <label><span className={labelClass}>Score</span><input name="score" type="number" min="0" max="100" defaultValue={round.score ?? ""} className={control} /></label>
              <label className="sm:col-span-3"><span className={labelClass}>Feedback</span><textarea name="feedback" rows={2} defaultValue={round.feedback} className={control} /></label>
              <button disabled={busy || round.status === "PASSED" || round.status === "FAILED"} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white sm:col-span-3">Save interview round</button>
            </form>)}
            <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action("/interviews", { type: data.get("type"), scheduledAt: new Date(String(data.get("scheduledAt"))).toISOString(), interviewerIds: [data.get("interviewerId")] }, "post"); }} className="grid gap-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4 sm:grid-cols-3">
              <label><span className={labelClass}>Round</span><SearchableDropdown name="type" defaultValue="HR Interview" placeholder="Search interview types" options={dropdownOptions(["HR Interview", "Technical Interview", "Managerial Interview", "Final Interview"])} /></label>
              <label><span className={labelClass}>Scheduled at</span><input name="scheduledAt" type="datetime-local" required className={control} /></label>
              <label><span className={labelClass}>Interviewer</span><SearchableDropdown name="interviewerId" placeholder="Search interviewers" required options={staff.hiringManagers.map((person) => ({ value: person._id, label: person.name }))} /></label>
              <button disabled={busy} className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 sm:col-span-3">Schedule interview</button>
            </form>
            {canLead && <form onSubmit={(event) => { event.preventDefault(); void action("/interview-waiver", { reason: new FormData(event.currentTarget).get("reason") }, "post"); }} className="flex flex-col gap-2 sm:flex-row"><input name="reason" required minLength={5} placeholder="Manager&apos;s reason to waive interviews" className={control} /><button disabled={busy} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Approve waiver</button></form>}
            {entry.interviewWaiverReason && <p className="text-xs text-amber-800">Interviews waived: {entry.interviewWaiverReason}</p>}
          </section>}

          {entry.stage === "FINAL_SELECTION" && <StageForm title="Final selection & hiring manager approval" icon={<BriefcaseBusiness size={16} />} onSubmit={submit("/final-selection")}>
            <label><span className={labelClass}>Selected role</span><SearchableDropdown name="selectedRole" defaultValue={entry.finalSelection.selectedRole ?? (entry.applicationId.opportunityId?.type === "JOB" ? "EMPLOYEE" : "INTERN")} required options={dropdownOptions(["EMPLOYEE", "INTERN"])} /></label>
            <label><span className={labelClass}>Department</span><SearchableDropdown name="department" defaultValue={entry.finalSelection.department ?? ""} placeholder="Search departments" required options={dropdownOptions(departmentOptions)} /></label>
            <label><span className={labelClass}>Compensation</span><input name="compensationAmount" type="text" maxLength={200} required defaultValue={entry.finalSelection.compensationAmount ?? ""} placeholder="e.g. 3000 or performance based" className={control} /></label>
            <label><span className={labelClass}>Pay frequency</span><SearchableDropdown name="compensationFrequency" defaultValue={entry.finalSelection.compensationFrequency ?? "MONTHLY"} required options={dropdownOptions(["MONTHLY", "ANNUAL"])} /></label>
            <label><span className={labelClass}>Annual CTC <span className="font-normal text-slate-500">(employees)</span></span><input name="annualCtc" type="text" maxLength={200} required={employeeOffer} defaultValue={entry.finalSelection.annualCtc ?? ""} placeholder="e.g. 600000 or performance based" className={control} /></label>
            <label><span className={labelClass}>Monthly gross salary <span className="font-normal text-slate-500">(employees)</span></span><input name="monthlyGrossSalary" type="text" maxLength={200} required={employeeOffer} defaultValue={entry.finalSelection.monthlyGrossSalary ?? ""} placeholder="e.g. 50000 or performance based" className={control} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>Salary structure reference <span className="font-normal text-slate-500">(employees)</span></span><input name="salaryStructureReference" type="text" required={employeeOffer} maxLength={200} defaultValue={entry.finalSelection.salaryStructureReference ?? ""} placeholder="e.g. Performance-based incentive plan" className={control} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>Benefits (optional)</span><textarea name="benefits" maxLength={1000} rows={2} defaultValue={entry.finalSelection.benefits ?? ""} placeholder="Additional allowances or benefits" className={control} /></label>
            <label><span className={labelClass}>Currency</span><input name="currency" minLength={3} maxLength={3} defaultValue={entry.finalSelection.currency || "INR"} className={control} /></label>
            <label><span className={labelClass}>Joining date</span><input name="joiningDate" type="date" required defaultValue={entry.finalSelection.joiningDate?.slice(0, 10) ?? ""} className={control} /></label>
            <label><span className={labelClass}>Employment / contract end date</span><input name="employmentEndDate" type="date" required defaultValue={entry.finalSelection.employmentEndDate?.slice(0, 10) ?? ""} className={control} /></label>
            <label><span className={labelClass}>Probation period</span><input name="probationPeriod" required maxLength={120} defaultValue={entry.finalSelection.probationPeriod ?? ""} placeholder="e.g. 3 months, or Not applicable" className={control} /></label>
            <label><span className={labelClass}>Working hours</span><input name="workingHours" required maxLength={120} defaultValue={entry.finalSelection.workingHours ?? ""} placeholder="e.g. 40 hours per week" className={control} /></label>
            <label><span className={labelClass}>Acceptance deadline</span><input name="acceptanceDeadline" type="date" required defaultValue={entry.finalSelection.acceptanceDeadline?.slice(0, 10) ?? ""} className={control} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>Hiring manager</span><SearchableDropdown name="hiringManagerId" defaultValue={idOf(entry.hiringManagerId)} placeholder="Search hiring managers" required options={staff.hiringManagers.map((person) => ({ value: person._id, label: `${person.name} · ${person.department}` }))} /></label>
            <p className="text-xs text-slate-500 sm:col-span-2">Use approved pay figures and terms. Annual CTC, monthly gross salary, and the schedule reference are required for employee offers. Save these details, then the assigned hiring manager must approve before the Offer stage.</p>
          </StageForm>}
          {entry.stage === "FINAL_SELECTION" && <ApprovalControls entry={entry} isManager={canLead || currentUserHiringManages} onAction={action} busy={busy} approvalType="final" />}

          {entry.stage === "OFFER" && <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/50 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Offer letter</h3>
            <p className="mt-1 text-sm text-slate-600">{entry.latestOffer ? `Current status: ${entry.latestOffer.status.replaceAll("_", " ")}` : "No offer has been generated yet."}</p>
            <p className="mt-2 text-xs text-slate-500">The approved role, compensation and dates populate the existing company offer-letter template. Candidate acceptance is required before Pre-Joining.</p>
            {(!entry.latestOffer || ["DRAFT", "GENERATED", "SENT", "VIEWED"].includes(entry.latestOffer.status)) && <button type="button" disabled={busy} onClick={() => void manageOffer()} className="mt-4 inline-flex h-11 items-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50">
              {busy ? "Processing…" : !entry.latestOffer || entry.latestOffer.status === "DRAFT" ? "Generate offer" : entry.latestOffer.status === "GENERATED" ? "Send offer to candidate" : "Resend offer"}
            </button>}
            <Link href={`/dashboard/admin/applications?candidate=${encodeURIComponent(candidateEmail(entry))}`} onClick={onClose} className="ml-2 mt-3 inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Applications <ExternalLink size={13} /></Link>
          </section>}

          {["PRE_JOINING", "ONBOARDING"].includes(entry.stage) && <StageForm title={entry.stage === "PRE_JOINING" ? "Pre-joining checklist" : "Onboarding checklist"} icon={<ClipboardCheck size={16} />} onSubmit={submit(entry.stage === "PRE_JOINING" ? "/pre-joining" : "/onboarding")}>
            {entry.stage === "PRE_JOINING" ? <>
              {(["documents", "backgroundVerification", "bankDetails", "identityVerification", "communication"] as const).map((field) => <label key={field}><span className={labelClass}>{field.replace(/([A-Z])/g, " $1")}</span><SearchableDropdown name={field} defaultValue={entry.preJoining[field] ?? "PENDING"} options={dropdownOptions(checkOptions)} /></label>)}
              <label className="sm:col-span-2"><span className={labelClass}>Notes (do not enter bank credentials or sensitive identity numbers)</span><textarea name="notes" maxLength={3000} rows={2} defaultValue={entry.preJoining.notes ?? ""} className={control} /></label>
            </> : <>
              <label><span className={labelClass}>Employee ID</span><input name="employeeId" required defaultValue={entry.onboarding.employeeId ?? ""} className={control} /></label>
              <label><span className={labelClass}>Company email</span><input name="companyEmail" type="email" required defaultValue={entry.onboarding.companyEmail ?? ""} className={control} /></label>
              {(["systemAccess", "policiesAccepted", "equipmentAssigned", "orientationCompleted"] as const).map((field) => <label key={field}><span className={labelClass}>{field.replace(/([A-Z])/g, " $1")}</span><SearchableDropdown name={field} defaultValue={entry.onboarding[field] ?? "PENDING"} options={dropdownOptions(checkOptions)} /></label>)}
              <label className="sm:col-span-2"><span className={labelClass}>Onboarding notes</span><textarea name="notes" maxLength={3000} rows={2} defaultValue={entry.onboarding.notes ?? ""} className={control} /></label>
            </>}
          </StageForm>}
          {entry.stage === "ONBOARDING" && <ApprovalControls entry={entry} isManager={canLead || currentUserManages} onAction={action} busy={busy} approvalType="onboarding" />}

          {entry.stage === "ACTIVE" && <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-bold text-emerald-900">Recruitment complete</h3><p className="mt-1 text-sm text-emerald-800">Employee ID {entry.onboarding.employeeId} · {entry.onboarding.companyEmail}</p></section>}

          <Tasks entry={entry} staff={staff} userId={userId} canLead={canLead} action={action} busy={busy} />
          <StageMover entry={entry} busy={busy} onMove={(stage) => void action("/stage", { stage })} />
        </div>
      </section>
    </main>
  );
}

function RecruitmentProgress({ stage }: { stage: RecruitmentPipelineStage }) {
  const currentIndex = stage === "REJECTED" ? -1 : activeStages.indexOf(stage);
  const rejected = stage === "REJECTED";

  return <nav aria-label="Recruitment stage progress" className="overflow-x-auto rounded-xl border border-(--brand-border) bg-white p-4 shadow-(--shadow-xs)">
    <ol className="flex min-w-[680px] items-center px-1">
      {activeStages.map((step, index) => {
        const reached = currentIndex >= 0 && index <= currentIndex;
        const current = index === currentIndex;
        return <li key={step} className="flex min-w-0 flex-1 items-center">
          <span
            aria-label={`${index + 1}. ${stageLabels[step]}${current ? ", current stage" : ""}`}
            aria-current={current ? "step" : undefined}
            title={stageLabels[step]}
            className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
              reached
                ? "border-blue-800 bg-blue-800 text-white"
                : "border-slate-100 bg-slate-100 text-slate-500"
            }`}
          >
            {index + 1}
          </span>
          {index < activeStages.length - 1 && <span aria-hidden="true" className={`mx-2 h-1 min-w-4 flex-1 rounded-full ${currentIndex > index ? "bg-blue-800" : "bg-slate-100"}`} />}
        </li>;
      })}
    </ol>
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
      <span className="font-medium text-slate-500">Current stage</span>
      <span className={`font-bold ${rejected ? "text-rose-700" : "text-blue-800"}`}>{stageLabels[stage]}</span>
    </div>
  </nav>;
}

function StageForm({ title, icon, onSubmit, children }: { title: string; icon: React.ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) {
  return <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <header className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icon}</span>
      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Stage details</p><h3 className="mt-1 text-base font-bold text-slate-900">{title}</h3></div>
    </header>
    <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">{children}</div>
    <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
      <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"><Check size={15} />Save details</button>
    </div>
  </form>;
}

function ApprovalControls({ entry, isManager, onAction, busy, approvalType }: {
  entry: RecruitmentPipelineEntry;
  isManager: boolean;
  onAction: (endpoint: string, data: unknown, method?: "patch" | "post") => Promise<void>;
  busy: boolean;
  approvalType: "final" | "onboarding";
}) {
  const final = approvalType === "final";
  const approved = final ? entry.finalSelection.hiringManagerApproved : entry.finalApproval.status === "CONFIRMED";
  const title = final ? "Hiring manager decision" : "HR Manager onboarding confirmation";
  return <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><Check size={18} /></span>
      <div><h3 className="text-sm font-bold text-amber-950">{title}</h3><p className="mt-1 text-xs leading-5 text-amber-800">{approved ? "This approval has been confirmed." : final ? "Awaiting confirmation from the assigned hiring manager." : "Manager confirmation is required before activation."}</p></div>
    </div>
    {isManager && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void onAction("/approval", { confirm: form.get("confirm") === "true", note: form.get("note") }); }} className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto] sm:items-end">
      <label><span className={labelClass}>Decision note</span><input name="note" maxLength={1000} defaultValue={final ? entry.finalSelection.approvalNote : entry.finalApproval.note} placeholder="Add a short note (optional)" className={control} /></label>
      <label><span className={labelClass}>Decision</span><SearchableDropdown name="confirm" defaultValue={approved ? "true" : "false"} options={[{ value: "true", label: "Confirm approval" }, { value: "false", label: "Request changes / reject" }]} /></label>
      <button disabled={busy} className="h-11 rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-950 disabled:opacity-60">Record decision</button>
    </form>}
  </section>;
}

function Tasks({ entry, staff, userId, canLead, action, busy }: {
  entry: RecruitmentPipelineEntry;
  staff: RecruitmentPipelineStaff;
  userId: string;
  canLead: boolean;
  action: (endpoint: string, data: unknown, method?: "patch" | "post") => Promise<void>;
  busy: boolean;
}) {
  const tasks = entry.tasks.filter((task) => task.stage === entry.stage);
  const [minimumDueDate] = useState(() => {
    const minimum = new Date(Date.now() + 60000);
    minimum.setMinutes(minimum.getMinutes() - minimum.getTimezoneOffset());
    return minimum.toISOString().slice(0, 16);
  });
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ClipboardCheck size={18} /></span>
      <div><h3 className="text-sm font-bold text-slate-900">Stage tasks <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Optional</span></h3><p className="mt-1 text-xs leading-5 text-slate-500">Use internal tasks to coordinate HR work. Open or unconfirmed tasks do not block stage progression.</p></div>
    </div>
    {tasks.length ? <ul className="space-y-2">{tasks.map((task) => <li key={task._id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-center">
      <div><p className="text-sm font-semibold">{task.title}</p><p className="mt-1 text-xs text-slate-500">Assigned to {personName(task.assignedTo)} · due {dateLabel(task.dueDate)} · {task.status}</p></div>
      <div className="flex gap-2">{task.status === "OPEN" && (idOf(task.assignedTo) === userId || canLead) && <button type="button" disabled={busy} onClick={() => void action(`/tasks/${task._id}/complete`, {})} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold">Mark done</button>}
        {task.status === "COMPLETED" && (canLead || idOf(entry.managerId) === userId) && <button type="button" disabled={busy} onClick={() => void action(`/tasks/${task._id}/confirm`, {})} className="rounded-lg bg-emerald-700 px-2 py-1.5 text-xs font-bold text-white">Confirm work</button>}</div>
    </li>)}</ul> : <p className="mb-3 text-xs text-slate-500">No tasks assigned for this stage.</p>}
    {entry.stage !== "ACTIVE" && entry.stage !== "REJECTED" && <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action("/tasks", { title: data.get("title"), description: data.get("description"), assignedTo: data.get("assignedTo"), dueDate: new Date(String(data.get("dueDate"))).toISOString() }, "post"); event.currentTarget.reset(); }} className="mt-4 grid gap-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4 sm:grid-cols-2">
      <label><span className={labelClass}>Task title</span><input name="title" required minLength={3} maxLength={160} className={control} /></label>
      <label><span className={labelClass}>Assign to HR member</span><SearchableDropdown name="assignedTo" defaultValue={idOf(entry.recruiterId)} placeholder="Search HR team" required options={staff.hrStaff.map((person) => ({ value: person._id, label: person.name }))} /></label>
      <label><span className={labelClass}>Due date</span><input name="dueDate" type="datetime-local" required min={minimumDueDate} className={control} /></label>
      <label><span className={labelClass}>Description</span><input name="description" maxLength={2000} className={control} /></label>
      <button disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold sm:col-span-2"><Plus size={13} className="mr-1 inline" />Add stage task</button>
    </form>}
  </section>;
}

function StageMover({ entry, busy, onMove }: { entry: RecruitmentPipelineEntry; busy: boolean; onMove: (stage: RecruitmentPipelineStage) => void }) {
  if (entry.stage === "ACTIVE" || entry.stage === "REJECTED") return null;
  const next = activeStages[activeStages.indexOf(entry.stage) + 1];
  return <section className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 p-5 text-white shadow-sm sm:flex-row sm:items-center">
    <div><p className="text-sm font-bold">Ready for the next stage?</p><p className="mt-1 text-xs text-slate-300">Required workflow checks are verified when you advance the candidate.</p></div>
    {next && <button type="button" disabled={busy} onClick={() => onMove(next)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50">Move to {stageLabels[next]} <ArrowRight size={15} /></button>}
  </section>;
}

function nextInterviewStatuses(status: PipelineInterviewStatus): PipelineInterviewStatus[] {
  const next: Record<PipelineInterviewStatus, PipelineInterviewStatus[]> = {
    SCHEDULED: ["COMPLETED"],
    COMPLETED: ["FEEDBACK_PENDING"],
    FEEDBACK_PENDING: ["PASSED", "FAILED"],
    PASSED: [],
    FAILED: [],
  };
  return next[status];
}
