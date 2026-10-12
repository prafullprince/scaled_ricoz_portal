"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Archive,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileUp,
  KeyRound,
  LoaderCircle,
  Mail,
  MessageCircle,
  Pencil,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRoundPlus,
  X,
} from "lucide-react";
import {
  ClientCampaignHistory,
  ClientCommunicationDialog,
} from "@/components/dashboard/sales/ClientCommunicationDialog";
import {
  RecruitmentService,
  type CandidateListEntry,
  type CandidateSourceImportRow,
} from "@/services/recruitment.service";

type ParsedSheet = {
  name: string;
  headers: string[];
  rows: Array<{ rowNumber: number; values: Record<string, string> }>;
};
type CandidateField = "name" | "email" | "phoneNumber" | "sourcePlatform";
type Mapping = Record<CandidateField, string>;
type ImportResult = Awaited<ReturnType<typeof RecruitmentService.importCandidateSource>>;

const fields: Array<{ key: CandidateField; label: string; required?: boolean; aliases: string[] }> = [
  { key: "name", label: "Candidate name", required: true, aliases: ["candidate name", "full name", "applicant name", "name"] },
  { key: "email", label: "Email", required: true, aliases: ["email address", "email", "e mail"] },
  { key: "phoneNumber", label: "Phone number", required: true, aliases: ["phone number", "mobile number", "phone", "mobile", "telephone"] },
  { key: "sourcePlatform", label: "Candidate source", aliases: ["source platform", "candidate source", "application source", "source", "platform"] },
];
const initialMapping: Mapping = { name: "", email: "", phoneNumber: "", sourcePlatform: "" };
const MAX_ROWS = 500;

export function CandidateSourceWorkspace() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [candidates, setCandidates] = useState<CandidateListEntry[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [candidateListError, setCandidateListError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editValues, setEditValues] = useState({ name: "", email: "", phoneNumber: "", sourcePlatform: "" });
  const [actionBusy, setActionBusy] = useState(false);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Mapping>(initialMapping);
  const [defaultSource, setDefaultSource] = useState("Spreadsheet import");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [listDeletionOpen, setListDeletionOpen] = useState(false);
  const [listDeletionChallenge, setListDeletionChallenge] = useState<{ email: string; count: number; deleteAll: boolean; entryIds?: string[] } | null>(null);
  const [listDeletionOtp, setListDeletionOtp] = useState("");
  const [listDeletionBusy, setListDeletionBusy] = useState(false);
  const [listDeletionError, setListDeletionError] = useState("");
  const [listDeletionNotice, setListDeletionNotice] = useState("");
  const [listDeletionSelection, setListDeletionSelection] = useState<string[] | null>(null);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sheetFilter, setSheetFilter] = useState("");
  const [rowFilter, setRowFilter] = useState("");
  const [archiveFilter, setArchiveFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkField, setBulkField] = useState<CandidateField>("sourcePlatform");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [campaignChannel, setCampaignChannel] = useState<"EMAIL" | "WHATSAPP" | null>(null);
  const [campaignHistoryOpen, setCampaignHistoryOpen] = useState(false);

  useEffect(() => {
    let active = true;
    RecruitmentService.candidateList()
      .then((entries) => { if (active) setCandidates(entries); })
      .catch((caught) => {
        if (active) setCandidateListError(caught instanceof Error ? caught.message : "Unable to load the candidate list.");
      })
      .finally(() => { if (active) setCandidatesLoading(false); });
    return () => { active = false; };
  }, []);

  const records = sheets.flatMap((sheet) => sheet.rows.map((row) => ({ sheet: sheet.name, ...row })));
  const readyToImport = Boolean(
    mapping.name
    && mapping.email
    && mapping.phoneNumber
    && defaultSource.trim()
    && defaultSource.trim().length <= 80,
  );
  const preview = records.slice(0, 5).map((row) => mapCandidate(row, mapping, defaultSource));
  const filteredCandidates = candidates.filter((entry) => {
    const search = candidateSearch.trim().toLowerCase();
    const source = sourceFilter.trim().toLowerCase();
    const sheet = sheetFilter.trim().toLowerCase();
    const row = rowFilter.trim();
    const created = entry.createdAt?.slice(0, 10) ?? "";
    return (!search || [entry.name, entry.email, entry.phoneNumber].some((value) => value.toLowerCase().includes(search)))
      && (!source || entry.sourcePlatform.toLowerCase().includes(source))
      && (!sheet || entry.sheet.toLowerCase().includes(sheet))
      && (!row || String(entry.rowNumber).includes(row))
      && (archiveFilter === "ALL" || (archiveFilter === "ARCHIVED" ? Boolean(entry.archivedAt) : !entry.archivedAt))
      && (!createdFrom || created >= createdFrom)
      && (!createdTo || created <= createdTo);
  });
  const allFilteredSelected = filteredCandidates.length > 0
    && filteredCandidates.every((entry) => selectedIds.includes(entry._id));

  function toggleSelected(entryId: string) {
    setSelectedIds((current) => current.includes(entryId)
      ? current.filter((id) => id !== entryId)
      : current.length < 5000 ? [...current, entryId] : current);
  }

  function toggleFilteredSelection() {
    setSelectedIds((current) => allFilteredSelected
      ? current.filter((id) => !filteredCandidates.some((entry) => entry._id === id))
      : [...new Set([...current, ...filteredCandidates.map((entry) => entry._id)])].slice(0, 5000));
  }

  function exportFilteredCandidates() {
    const rows = filteredCandidates.map((entry) => [
      entry.name, entry.email, entry.phoneNumber, entry.sourcePlatform, entry.sheet,
      String(entry.rowNumber), entry.archivedAt ? "Archived" : "Active", entry.createdAt ?? "",
    ]);
    const csv = [["Name", "Email", "Phone", "Source", "Worksheet", "Row", "Status", "Created At"], ...rows]
      .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ricoz-candidates-list.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function updateSelectedCandidates() {
    if (!bulkValue.trim() || !selectedIds.length || bulkBusy) return;
    setBulkBusy(true);
    setCandidateListError("");
    try {
      const result = await RecruitmentService.updateCandidateListEntries(selectedIds, bulkField, bulkValue);
      setCandidates((current) => current.map((entry) => result.entries.find((updated) => updated._id === entry._id) ?? entry));
      setSelectedIds([]);
      setBulkValue("");
    } catch (caught) {
      setCandidateListError(caught instanceof Error ? caught.message : "Selected candidates could not be updated.");
    } finally {
      setBulkBusy(false);
    }
  }

  function openCandidateDeletion(entryIds: string[] | null) {
    setListDeletionSelection(entryIds);
    setListDeletionOpen(true);
    setListDeletionChallenge(null);
    setListDeletionOtp("");
    setListDeletionError("");
    setListDeletionNotice("");
  }

  function openCampaign(channel: "EMAIL" | "WHATSAPP") {
    if (!selectedIds.length) {
      setCandidateListError("Select at least one candidate before starting a campaign.");
      return;
    }
    setCampaignChannel(channel);
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSheets([]);
    setMapping(initialMapping);
    setResult(null);
    setError("");
    setParsing(true);
    try {
      const parsed = await parseSpreadsheet(file);
      const count = parsed.reduce((total, sheet) => total + sheet.rows.length, 0);
      if (!count) throw new Error("The selected file has no candidate rows beneath its headers.");
      if (count > MAX_ROWS) throw new Error(`Import up to ${MAX_ROWS} candidates at a time.`);
      if (parsed.some((sheet) => sheet.headers.length > 50)) throw new Error("Each worksheet can contain up to 50 columns.");
      setSheets(parsed);
      setMapping(detectMapping(parsed[0]?.headers ?? []));
    } catch (caught) {
      setFileName("");
      setError(caught instanceof Error ? caught.message : "The spreadsheet could not be read.");
    } finally {
      setParsing(false);
      event.target.value = "";
    }
  }

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!readyToImport || records.length === 0) {
      setError("Map candidate name, email, and phone columns before importing.");
      return;
    }
    const rows = records.map((row) => mapCandidate(row, mapping, defaultSource));
    if (new TextEncoder().encode(JSON.stringify({ rows })).length > 7_000_000) {
      setError("This import is too large to send safely. Split the workbook into smaller files and try again.");
      return;
    }
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const imported = await RecruitmentService.importCandidateSource(rows);
      setResult(imported);
      setCandidates((current) => [...imported.imported, ...current]);
      setSheets([]);
      setFileName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to import candidates.");
    } finally {
      setImporting(false);
    }
  }

  function editCandidate(entry: CandidateListEntry) {
    setEditingId(entry._id);
    setEditValues({ name: entry.name, email: entry.email, phoneNumber: entry.phoneNumber, sourcePlatform: entry.sourcePlatform });
    setCandidateListError("");
  }

  async function saveCandidate(entry: CandidateListEntry) {
    setActionBusy(true);
    setCandidateListError("");
    try {
      const updated = await RecruitmentService.updateCandidateListEntry(entry._id, editValues);
      setCandidates((current) => current.map((item) => item._id === updated._id ? updated : item));
      setEditingId("");
    } catch (caught) {
      setCandidateListError(caught instanceof Error ? caught.message : "Candidate changes could not be saved.");
    } finally {
      setActionBusy(false);
    }
  }

  async function toggleCandidateArchive(entry: CandidateListEntry) {
    const archived = !entry.archivedAt;
    if (archived && !window.confirm(`Archive ${entry.name} from Candidates Lists?`)) return;
    setActionBusy(true);
    setCandidateListError("");
    try {
      const updated = await RecruitmentService.archiveCandidateListEntry(entry._id, archived);
      setCandidates((current) => current.map((item) => item._id === updated._id ? updated : item));
    } catch (caught) {
      setCandidateListError(caught instanceof Error ? caught.message : "Candidate archive status could not be changed.");
    } finally {
      setActionBusy(false);
    }
  }

  async function requestCandidateListDeletionCode() {
    if (listDeletionBusy) return;
    setListDeletionBusy(true);
    setListDeletionError("");
    try {
      const response = await RecruitmentService.requestCandidateListDeletionOtp(listDeletionSelection ?? undefined);
      setListDeletionChallenge({
        email: response.email,
        count: response.entryCount,
        deleteAll: response.deleteAll,
        ...(listDeletionSelection ? { entryIds: listDeletionSelection } : {}),
      });
      setListDeletionOtp("");
    } catch (caught) {
      setListDeletionError(caught instanceof Error ? caught.message : "Unable to start Candidates Lists deletion.");
    } finally {
      setListDeletionBusy(false);
    }
  }

  async function confirmCandidateListDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listDeletionChallenge || listDeletionBusy) return;
    if (listDeletionOtp.length !== 6) {
      setListDeletionError("Enter the 6-digit verification code sent to your email.");
      return;
    }
    setListDeletionBusy(true);
    setListDeletionError("");
    try {
      const response = await RecruitmentService.deleteCandidateListEntries(listDeletionOtp, listDeletionChallenge.entryIds);
      setCandidates((current) => listDeletionChallenge.entryIds
        ? current.filter((entry) => !listDeletionChallenge.entryIds!.includes(entry._id))
        : []);
      setSelectedIds((current) => listDeletionChallenge.entryIds
        ? current.filter((id) => !listDeletionChallenge.entryIds!.includes(id))
        : []);
      setEditingId("");
      setListDeletionNotice(response.message);
      setListDeletionOpen(false);
      setListDeletionChallenge(null);
      setListDeletionSelection(null);
      setListDeletionOtp("");
    } catch (caught) {
      setListDeletionError(caught instanceof Error ? caught.message : "Candidates Lists entries could not be deleted.");
    } finally {
      setListDeletionBusy(false);
    }
  }

  function downloadCsvTemplate() {
    const csv = "Candidate Name,Email,Phone Number,Candidate Source\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ricoz-candidates-list-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadExcelTemplate() {
    setDownloadingExcel(true);
    setError("");
    try {
      const writeXlsxFile = (await import("write-excel-file/browser")).default;
      const headers = ["Candidate Name", "Email", "Phone Number", "Candidate Source"];
      const blob = await writeXlsxFile([headers], { sheet: "Candidates" }).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ricoz-candidates-list-template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? `Excel template could not be created: ${caught.message}` : "Excel template could not be created.");
    } finally {
      setDownloadingExcel(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] space-y-5 text-(--brand-text)">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-(--brand-border) pb-4">
        <div>
          <p className="text-xs font-semibold text-(--brand-text-secondary)">HR Workspace · Recruitment</p>
          <h1 className="mt-1 text-xl font-extrabold tracking-tight">Candidates Lists</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-(--brand-text-secondary)">
            Import and manage candidate contact lists here. Candidates stay on this page until you manually add them to Applications or a recruitment pipeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadCsvTemplate} className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 text-xs font-semibold hover:bg-(--brand-surface)">
            <Download size={14} />CSV template
          </button>
          <button type="button" onClick={() => void downloadExcelTemplate()} disabled={downloadingExcel} className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 text-xs font-semibold hover:bg-(--brand-surface) disabled:opacity-50">
            {downloadingExcel ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />}
            Excel template
          </button>
        </div>
      </header>

      {candidateListError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{candidateListError}</p> : null}

      <form onSubmit={(event) => void submitImport(event)} className="space-y-5">
        <section className="space-y-4 rounded-xl border border-(--brand-border) bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">1. Choose your spreadsheet</h2>
              <p className="mt-1 text-[11px] leading-5 text-(--brand-text-secondary)">CSV up to 2 MB or .xlsx up to 10 MB. Workbooks can contain multiple sheets with matching headers.</p>
            </div>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={parsing || importing} className="inline-flex h-9 items-center gap-2 rounded-lg bg-(--brand-navy) px-3 text-xs font-semibold text-white hover:bg-(--brand-red) disabled:opacity-50">
              {parsing ? <LoaderCircle size={14} className="animate-spin" /> : <FileUp size={14} />}
              {parsing ? "Reading file…" : fileName || "Browse files"}
            </button>
            <input ref={inputRef} type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void chooseFile(event)} className="sr-only" />
          </div>
          {sheets.length > 1 ? <p className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-800"><FileSpreadsheet size={12} />{sheets.length} worksheets · {records.length} candidate rows</p> : null}
        </section>

        {records.length ? (
          <>
            <section className="space-y-4 rounded-xl border border-(--brand-border) bg-white p-4 shadow-sm sm:p-5">
              <div>
                <h2 className="text-sm font-bold">2. Match spreadsheet columns</h2>
                <p className="mt-1 text-[11px] text-(--brand-text-secondary)">Name, email, and phone are required. This import only saves entries to Candidates Lists.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <label key={field.key} className="text-xs font-semibold text-(--brand-text-secondary)">
                    {field.label}{field.required ? " *" : ""}
                    <select required={field.required} value={mapping[field.key]} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-2 h-10 w-full rounded-lg border border-(--brand-border) bg-white px-3 text-xs text-(--brand-text) outline-none focus:border-(--brand-red)">
                      <option value="">Select a column{field.required ? "" : " (optional)"}</option>
                      {sheets[0]?.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                    </select>
                  </label>
                ))}
                <label className="text-xs font-semibold text-(--brand-text-secondary)">
                  Default source when the sheet is blank
                  <input required maxLength={80} value={defaultSource} onChange={(event) => setDefaultSource(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-(--brand-border) bg-white px-3 text-xs text-(--brand-text) outline-none focus:border-(--brand-red)" />
                </label>
              </div>
              <div className="overflow-x-auto rounded-lg border border-(--brand-border)">
                <table className="w-full min-w-[580px] text-left text-[11px]">
                  <thead className="bg-(--brand-surface) text-(--brand-text-secondary)"><tr>{["Name", "Email", "Phone", "Source"].map((heading) => <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-(--brand-border)">{preview.map((row, index) => <tr key={`${row.sheet}:${row.rowNumber}:${index}`}><td className="px-3 py-2">{row.values.name || "—"}</td><td className="px-3 py-2">{row.values.email || "—"}</td><td className="px-3 py-2">{row.values.phoneNumber || "—"}</td><td className="px-3 py-2">{row.values.sourcePlatform || "—"}</td></tr>)}</tbody>
                </table>
                <p className="border-t border-(--brand-border) px-3 py-2 text-[10px] text-(--brand-text-secondary)">Previewing {preview.length} of {records.length} candidates.</p>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-(--brand-text-secondary)">Candidates are saved only in Candidates Lists. Add them to Applications or a pipeline later when you choose.</p>
              <button type="submit" disabled={!readyToImport || importing} className="inline-flex h-10 items-center gap-2 rounded-lg bg-(--brand-red) px-4 text-xs font-bold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
                {importing ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
                {importing ? "Importing candidates…" : `Import ${records.length} candidates`}
              </button>
            </div>
          </>
        ) : null}
      </form>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {result ? (
        <section role="status" className="rounded-xl border border-(--brand-border) bg-emerald-50 p-4">
          <div className="flex items-start gap-2">
            {result.skipped ? <AlertCircle size={17} className="mt-0.5 text-amber-700" /> : <CheckCircle2 size={17} className="mt-0.5 text-emerald-700" />}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold">{result.imported.length} candidates added to Candidates Lists · {result.skipped} skipped</h2>
              <p className="mt-1 text-[10px] leading-4 text-(--brand-text-secondary)">These entries were saved only to this list. No candidate accounts, applications, or pipeline records were created.</p>
              {result.errors.length ? <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-[10px] leading-4 text-amber-950">{result.errors.slice(0, 100).map((item, index) => <li key={`${item.sheet}:${item.row}:${index}`}><strong>{item.sheet}, row {item.row}:</strong> {item.message}</li>)}</ul> : null}
              {result.errors.length > 100 ? <p className="mt-2 text-[10px] text-amber-900">Showing first 100 of {result.errors.length} row errors.</p> : null}
            </div>
            <button type="button" onClick={() => { setResult(null); setSheets([]); setFileName(""); }} aria-label="Clear import result" className="rounded p-1 text-(--brand-text-muted) hover:bg-white"><RotateCcw size={14} /></button>
          </div>
        </section>
      ) : null}

      {candidates.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-(--brand-border) bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-(--brand-border) px-4 py-3">
            <div><h2 className="text-sm font-bold">Candidates Lists</h2><p className="mt-1 text-[10px] text-(--brand-text-secondary)">These candidate records remain separate from Applications and all pipeline stages.</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setCampaignHistoryOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 text-xs font-semibold hover:bg-(--brand-surface)"><Clock3 size={14} />Campaign history</button>
              <button type="button" disabled={!selectedIds.length} onClick={() => openCampaign("EMAIL")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 text-xs font-semibold disabled:opacity-50"><Mail size={14} />Email selected</button>
              <button type="button" disabled={!selectedIds.length} onClick={() => openCampaign("WHATSAPP")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 text-xs font-semibold disabled:opacity-50"><MessageCircle size={14} />WhatsApp selected</button>
              <button type="button" disabled={!selectedIds.length || listDeletionBusy} onClick={() => openCandidateDeletion(selectedIds)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} />Delete selected ({selectedIds.length})</button>
              <button type="button" disabled={listDeletionBusy || candidatesLoading} onClick={() => openCandidateDeletion(null)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} />Delete all saved</button>
            </div>
          </header>
          <div className="space-y-3 border-b border-(--brand-border) p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <label className="relative sm:col-span-2 lg:col-span-2"><Search size={14} className="absolute left-3 top-3 text-(--brand-text-muted)" /><input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search name, email, or phone" className="h-9 w-full rounded-lg border border-(--brand-border) pl-9 pr-3 text-xs outline-none focus:border-(--brand-red)" /></label>
              <label className="relative"><SlidersHorizontal size={14} className="absolute left-3 top-3 text-(--brand-text-muted)" /><input value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="Source contains…" className="h-9 w-full rounded-lg border border-(--brand-border) pl-9 pr-3 text-xs outline-none focus:border-(--brand-red)" /></label>
              <input aria-label="Worksheet filter" value={sheetFilter} onChange={(event) => setSheetFilter(event.target.value)} placeholder="Worksheet contains…" className="h-9 rounded-lg border border-(--brand-border) px-3 text-xs outline-none focus:border-(--brand-red)" />
              <input aria-label="Spreadsheet row filter" inputMode="numeric" value={rowFilter} onChange={(event) => setRowFilter(event.target.value.replace(/\D/g, ""))} placeholder="Row number" className="h-9 rounded-lg border border-(--brand-border) px-3 text-xs outline-none focus:border-(--brand-red)" />
              <select aria-label="Archive status" value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value as typeof archiveFilter)} className="h-9 rounded-lg border border-(--brand-border) bg-white px-3 text-xs"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></select>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3"><input aria-label="Created from" type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-(--brand-border) px-2 text-[10px]" /><input aria-label="Created to" type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-(--brand-border) px-2 text-[10px]" /></div>
              <button type="button" onClick={() => { setCandidateSearch(""); setSourceFilter(""); setSheetFilter(""); setRowFilter(""); setArchiveFilter("ALL"); setCreatedFrom(""); setCreatedTo(""); }} className="h-9 rounded-lg border border-(--brand-border) px-3 text-xs font-semibold">Clear filters</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={toggleFilteredSelection} disabled={!filteredCandidates.length} className="h-8 rounded-lg border border-(--brand-border) px-3 text-[11px] font-semibold disabled:opacity-50">{allFilteredSelected ? "Deselect filtered" : `Select filtered (${filteredCandidates.length})`}</button>
              <button type="button" onClick={() => setSelectedIds([])} disabled={!selectedIds.length} className="h-8 rounded-lg border border-(--brand-border) px-3 text-[11px] font-semibold disabled:opacity-50">Clear selection</button>
              <button type="button" onClick={exportFilteredCandidates} disabled={!filteredCandidates.length} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--brand-border) px-3 text-[11px] font-semibold disabled:opacity-50"><Download size={13} />Export filtered ({filteredCandidates.length})</button>
              <span className="text-[10px] text-(--brand-text-secondary)">{selectedIds.length} selected · showing {filteredCandidates.length} of {candidates.length}</span>
            </div>
            {selectedIds.length ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-(--brand-surface) p-2">
                <span className="px-1 text-[11px] font-semibold">Update selected field</span>
                <select value={bulkField} onChange={(event) => setBulkField(event.target.value as CandidateField)} className="h-8 rounded border border-(--brand-border) bg-white px-2 text-[11px]">
                  {fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                </select>
                <input value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} maxLength={bulkField === "email" ? 254 : bulkField === "name" ? 120 : 80} type={bulkField === "email" ? "email" : "text"} placeholder={`New ${fields.find((field) => field.key === bulkField)?.label.toLowerCase()}`} className="h-8 min-w-48 rounded border border-(--brand-border) px-2 text-[11px]" />
                <button type="button" disabled={bulkBusy || !bulkValue.trim()} onClick={() => void updateSelectedCandidates()} className="inline-flex h-8 items-center gap-1 rounded bg-(--brand-navy) px-3 text-[11px] font-semibold text-white disabled:opacity-50">{bulkBusy ? <LoaderCircle size={12} className="animate-spin" /> : <Save size={12} />}Apply to {selectedIds.length}</button>
              </div>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
              <thead className="bg-(--brand-surface) text-(--brand-text-secondary)"><tr><th className="border-b border-(--brand-border) px-3 py-2.5"><input type="checkbox" aria-label="Select all filtered candidates" checked={allFilteredSelected} onChange={toggleFilteredSelection} disabled={!filteredCandidates.length} /></th>{["Name", "Email", "Phone", "Source", "Actions"].map((heading) => <th key={heading} className="border-b border-(--brand-border) px-3 py-2.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{filteredCandidates.map((entry) => editingId === entry._id ? (
                <tr key={entry._id} className="border-b border-(--brand-border) bg-blue-50/40">
                  <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.includes(entry._id)} onChange={() => toggleSelected(entry._id)} aria-label={`Select ${entry.name}`} /></td>
                  {(["name", "email", "phoneNumber", "sourcePlatform"] as const).map((field) => <td key={field} className="px-2 py-2"><input aria-label={field} type={field === "email" ? "email" : "text"} value={editValues[field]} onChange={(event) => setEditValues((current) => ({ ...current, [field]: event.target.value }))} className="w-40 rounded border border-(--brand-border) bg-white px-2 py-1.5" /></td>)}
                  <td className="px-2 py-2"><div className="flex gap-1"><button type="button" disabled={actionBusy} onClick={() => void saveCandidate(entry)} title="Save candidate" className="inline-flex items-center gap-1 rounded bg-(--brand-navy) px-2 py-1.5 font-semibold text-white disabled:opacity-50"><Save size={12} />Save</button><button type="button" disabled={actionBusy} onClick={() => setEditingId("")} title="Cancel edit" className="rounded border border-(--brand-border) p-1.5 disabled:opacity-50"><X size={13} /></button></div></td>
                </tr>
              ) : (
                <tr key={entry._id} className={`border-b border-(--brand-border) ${entry.archivedAt ? "bg-slate-50 text-slate-500" : ""}`}>
                  <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.includes(entry._id)} onChange={() => toggleSelected(entry._id)} aria-label={`Select ${entry.name}`} /></td>
                  <td className="px-3 py-2.5 font-semibold">{entry.name}{entry.archivedAt ? <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase">Archived</span> : null}</td>
                  <td className="px-3 py-2.5">{entry.email}</td><td className="px-3 py-2.5">{entry.phoneNumber}</td><td className="px-3 py-2.5">{entry.sourcePlatform}</td>
                  <td className="px-2 py-2"><div className="flex gap-1">{!entry.archivedAt ? <button type="button" disabled={actionBusy} onClick={() => editCandidate(entry)} className="inline-flex items-center gap-1 rounded border border-(--brand-border) px-2 py-1.5 font-semibold disabled:opacity-50"><Pencil size={12} />Edit</button> : null}<button type="button" disabled={actionBusy} onClick={() => void toggleCandidateArchive(entry)} className="inline-flex items-center gap-1 rounded border border-(--brand-border) px-2 py-1.5 font-semibold disabled:opacity-50">{entry.archivedAt ? <RotateCcw size={12} /> : <Archive size={12} />}{entry.archivedAt ? "Restore" : "Archive"}</button></div></td>
                </tr>
              ))}{!filteredCandidates.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-(--brand-text-secondary)">No candidates match these filters.</td></tr> : null}</tbody>
            </table>
          </div>
          <footer className="border-t border-(--brand-border) px-4 py-2 text-[10px] text-(--brand-text-secondary)">{candidatesLoading ? "Refreshing candidate list…" : `${filteredCandidates.length} shown of ${candidates.length} saved candidates`}</footer>
        </section>
      ) : null}
      {!sheets.length && !parsing && !candidates.length ? <section className="rounded-xl border border-dashed border-(--brand-border-strong) bg-white p-8 text-center"><UserRoundPlus size={24} className="mx-auto text-(--brand-red)" /><h2 className="mt-3 text-sm font-bold">Build your candidate list</h2><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-(--brand-text-secondary)">Upload candidate details and keep them here until you are ready to manually add them to Applications or a pipeline.</p></section> : null}
      {listDeletionNotice ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{listDeletionNotice}</p> : null}
      {listDeletionOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#081f47]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-candidate-list-title">
          <form onSubmit={(event) => { if (listDeletionChallenge) void confirmCandidateListDeletion(event); else { event.preventDefault(); void requestCandidateListDeletionCode(); } }} className="w-full max-w-lg rounded-xl border border-red-100 bg-white p-5 shadow-2xl">
            <h2 id="delete-candidate-list-title" className="text-lg font-extrabold text-[#8f1d1d]">{listDeletionSelection ? `Delete ${listDeletionSelection.length} selected Candidates Lists entries?` : "Delete all saved Candidates Lists entries?"}</h2>
            <p className="mt-2 text-sm leading-6 text-[#475467]">This permanently deletes {listDeletionSelection ? "only the selected list rows" : "all saved list rows across previous uploads"}. It does not delete candidate accounts, applications, or recruitment pipeline records.</p>
            {listDeletionChallenge ? (
              <div className="mt-4 space-y-3">
                <p className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><KeyRound size={14} />A code was sent to {listDeletionChallenge.email}; it is bound to exactly {listDeletionChallenge.count} {listDeletionChallenge.deleteAll ? "saved list entries" : "selected entries"}.</p>
                <label className="block text-xs font-semibold text-(--brand-text-secondary)">Verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={listDeletionOtp} onChange={(event) => setListDeletionOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1.5 h-11 w-full rounded-lg border border-(--brand-border) px-3 text-sm tracking-[0.25em] outline-none focus:border-[#0d3fa3] focus:ring-2 focus:ring-[#0d3fa3]/10" /></label>
              </div>
            ) : <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">An email verification code is required and will be bound to this exact deletion target.</p>}
            {listDeletionError ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{listDeletionError}</p> : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {listDeletionChallenge ? <button type="button" disabled={listDeletionBusy} onClick={() => void requestCandidateListDeletionCode()} className="mr-auto h-10 rounded-lg border border-(--brand-border) px-3 text-xs font-semibold disabled:opacity-50">Send a new code</button> : null}
              <button type="button" disabled={listDeletionBusy} onClick={() => { setListDeletionOpen(false); setListDeletionChallenge(null); setListDeletionSelection(null); setListDeletionOtp(""); setListDeletionError(""); }} className="h-10 rounded-lg border border-(--brand-border) px-4 text-xs font-semibold disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={listDeletionBusy || Boolean(listDeletionChallenge && listDeletionOtp.length !== 6)} className="h-10 rounded-lg bg-red-700 px-4 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50">{listDeletionBusy ? "Working…" : listDeletionChallenge ? "Verify and delete" : "Send verification code"}</button>
            </div>
          </form>
        </div>
      ) : null}
      {campaignChannel ? (
        <ClientCommunicationDialog
          channel={campaignChannel}
          leadIds={selectedIds}
          sourceType="CANDIDATE"
          onClose={() => setCampaignChannel(null)}
          onCreated={(message) => { setListDeletionNotice(message); setCampaignChannel(null); }}
        />
      ) : null}
      {campaignHistoryOpen ? <ClientCampaignHistory sourceType="CANDIDATE" onClose={() => setCampaignHistoryOpen(false)} /> : null}
    </main>
  );
}

function mapCandidate(
  row: { sheet: string; rowNumber: number; values: Record<string, string> },
  mapping: Mapping,
  fallbackSource: string,
): CandidateSourceImportRow {
  const get = (column: string) => column ? row.values[column]?.trim() ?? "" : "";
  return {
    sheet: row.sheet,
    rowNumber: row.rowNumber,
    values: {
      name: get(mapping.name),
      email: get(mapping.email),
      phoneNumber: get(mapping.phoneNumber),
      sourcePlatform: get(mapping.sourcePlatform) || fallbackSource.trim(),
    },
  };
}

function detectMapping(headers: string[]): Mapping {
  return Object.fromEntries(fields.map(({ key, aliases }) => [
    key,
    headers.find((header) => aliases.includes(normalizeHeader(header))) ?? "",
  ])) as Mapping;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

async function parseSpreadsheet(file: File): Promise<ParsedSheet[]> {
  if (!file.size) throw new Error("The selected file is empty.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    if (file.size > 2_000_000) throw new Error("CSV files must be 2 MB or smaller.");
    return [toSheet("CSV", parseCsv(await file.text()))];
  }
  if (extension !== "xlsx") throw new Error("Choose a .csv file or an .xlsx workbook. Save legacy .xls files as .xlsx first.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Excel workbooks must be 10 MB or smaller.");
  try {
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    const workbook = await readXlsxFile(file);
    const sheets = workbook.flatMap((sheet) => {
      const rows = sheet.data.filter((row) => row.some((cell) => cellText(cell) !== ""));
      return rows.length ? [toSheet(sheet.sheet, rows)] : [];
    });
    if (!sheets.length) throw new Error("The workbook has no candidate rows beneath its headers.");
    const expectedHeaders = sheets[0]?.headers.join("\u0000");
    if (sheets.some((sheet) => sheet.headers.join("\u0000") !== expectedHeaders)) {
      throw new Error("All worksheets in a workbook must use the same column headings.");
    }
    return sheets;
  } catch (caught) {
    if (caught instanceof Error && /workbook|candidate rows|column headings/i.test(caught.message)) throw caught;
    throw new Error("Could not read this workbook. Check that it is a valid .xlsx file and try again.");
  }
}

function toSheet(name: string, grid: unknown[][]): ParsedSheet {
  const headerCounts = new Map<string, number>();
  const headers = (grid[0] ?? []).map((cell, index) => {
    const text = cellText(cell);
    const header = text || `Column ${index + 1}`;
    const key = normalizeHeader(header);
    const count = (headerCounts.get(key) ?? 0) + 1;
    headerCounts.set(key, count);
    return count === 1 ? header : `${header} (${count})`;
  });
  if (!headers.length) throw new Error(`Worksheet "${name}" has no headers.`);
  const rows = grid.slice(1).flatMap((cells, index) => {
    const values = Object.fromEntries(headers.map((header, column) => [header, cellText(cells[column])]));
    return Object.values(values).some(Boolean) ? [{ rowNumber: index + 2, values }] : [];
  });
  return { name, headers, rows };
}

function cellText(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  return value == null ? "" : String(value).trim();
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += character;
      if (cell.length > 2000) throw new Error("Spreadsheet cells cannot exceed 2,000 characters.");
      continue;
    }
    if (character === '"' && cell.length === 0) quoted = true;
    else if (character === "," || character === "\n" || character === "\r") {
      row.push(cell.trim());
      cell = "";
      if (character === ",") continue;
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += character;
    if (cell.length > 2000) throw new Error("Spreadsheet cells cannot exceed 2,000 characters.");
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV must contain a header and at least one candidate row.");
  const headers = rows[0]!;
  if (headers[0]?.startsWith("\uFEFF")) headers[0] = headers[0].slice(1);
  return rows;
}
