"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Archive,
  AlertCircle,
  CheckCircle2,
  Download,
  Filter,
  FileSpreadsheet,
  FileUp,
  KeyRound,
  LoaderCircle,
  Mail,
  MessageCircle,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { SalesService, type ImportedSalesLead, type SalesLeadImportRow } from "@/services/sales.service";
import {
  CLIENT_LIST_BULK_UPDATE_FIELDS,
  CLIENT_FILTER_PROPERTIES,
  clientFilterKind,
  clientFilterOperators,
  matchesClientFilter,
  type ClientFilter,
  type ClientFilterOperator,
} from "@/lib/sales/client-filters";
import { SearchableDropdown } from "../SearchableDropdown";
import { ClientCampaignHistory, ClientCommunicationDialog } from "./ClientCommunicationDialog";
import type { SalesLeadSource } from "@/types/sales";

type SheetRows = {
  sheet: string;
  headers: string[];
  rows: Array<{ rowNumber: number; values: Record<string, string> }>;
};
type FieldMapping = {
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  email: string;
  source: string;
  notes: string;
  serviceInterest: string;
};
type SourceColumn =
  | "name"
  | "firstName"
  | "lastName"
  | "phone"
  | "company"
  | "email"
  | "source"
  | "notes"
  | "serviceInterest";
type ImportResult = Awaited<ReturnType<typeof SalesService.importLeads>>;
const EMPTY_MAPPING: FieldMapping = {
  name: "",
  firstName: "",
  lastName: "",
  phone: "",
  company: "",
  email: "",
  source: "",
  notes: "",
  serviceInterest: "",
};
const SOURCE_VALUES: SalesLeadSource[] = [
  "GOOGLE",
  "META",
  "INSTAGRAM",
  "LINKEDIN",
  "WEBSITE",
  "REFERRAL",
  "EMAIL",
  "YOUTUBE",
  "COLD_CALLING",
  "OTHER",
];
const MAX_IMPORT_ROWS = 5000;
const LEADS_PER_PAGE = 25;
const MAX_SELECTED_CLIENTS = 5000;
const FIELD_LABELS: Array<{ key: SourceColumn; label: string; required?: boolean }> = [
  { key: "name", label: "Full name" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "phone", label: "Phone number", required: true },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "source", label: "Lead source" },
  { key: "notes", label: "Notes / feedback" },
  { key: "serviceInterest", label: "Service interest" },
];

export function SalesLeadSourceWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<SheetRows[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>(EMPTY_MAPPING);
  const [defaultSource, setDefaultSource] = useState<SalesLeadSource>("OTHER");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [savedLeads, setSavedLeads] = useState<ImportedSalesLead[]>([]);
  const [savedLeadsLoading, setSavedLeadsLoading] = useState(true);
  const [savedLeadsError, setSavedLeadsError] = useState("");
  const savedLeadsRequestId = useRef(0);
  const [editingLeadId, setEditingLeadId] = useState("");
  const [editValues, setEditValues] = useState({ name: "", company: "", email: "", phone: "" });
  const [leadActionBusy, setLeadActionBusy] = useState(false);
  const [leadActionError, setLeadActionError] = useState("");
  const [leadDeletionBusy, setLeadDeletionBusy] = useState(false);
  const [leadDeletionError, setLeadDeletionError] = useState("");
  const [leadDeletionNotice, setLeadDeletionNotice] = useState("");
  const [leadDeletionChallenge, setLeadDeletionChallenge] = useState<{ leadIds: string[]; allImported: boolean; email: string; count: number } | null>(null);
  const [leadDeletionOtp, setLeadDeletionOtp] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [communicationChannel, setCommunicationChannel] = useState<"EMAIL" | "WHATSAPP" | null>(null);
  const [campaignHistoryOpen, setCampaignHistoryOpen] = useState(false);
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkUpdateField, setBulkUpdateField] = useState<(typeof CLIENT_LIST_BULK_UPDATE_FIELDS)[number] | "">("");
  const [bulkUpdateValue, setBulkUpdateValue] = useState("");
  const [bulkUpdateBusy, setBulkUpdateBusy] = useState(false);
  const [bulkUpdateError, setBulkUpdateError] = useState("");
  const [leadPage, setLeadPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [clientFilters, setClientFilters] = useState<ClientFilter[]>([]);
  const [draftProperty, setDraftProperty] = useState("");
  const [draftOperator, setDraftOperator] = useState<ClientFilterOperator>("contains");
  const [draftValue, setDraftValue] = useState("");
  const [filterError, setFilterError] = useState("");

  async function refreshSavedLeads() {
    const requestId = ++savedLeadsRequestId.current;
    try {
      const leads = await SalesService.importedLeads();
      if (requestId === savedLeadsRequestId.current) {
        setSavedLeads(leads);
        setSelectedClientIds((current) => current.filter((id) => leads.some((lead) => lead._id === id)));
        setSavedLeadsError("");
      }
    } catch (caught) {
      if (requestId === savedLeadsRequestId.current) {
        setSavedLeadsError(caught instanceof Error ? caught.message : "Saved clients could not be loaded.");
      }
    } finally {
      if (requestId === savedLeadsRequestId.current) setSavedLeadsLoading(false);
    }
  }

  useEffect(() => {
    const requestId = ++savedLeadsRequestId.current;
    SalesService.importedLeads()
      .then((leads) => {
        if (requestId === savedLeadsRequestId.current) {
          setSavedLeads(leads);
          setSelectedClientIds((current) => current.filter((id) => leads.some((lead) => lead._id === id)));
          setSavedLeadsError("");
        }
      })
      .catch((caught: unknown) => {
        if (requestId === savedLeadsRequestId.current) {
          setSavedLeadsError(caught instanceof Error ? caught.message : "Saved clients could not be loaded.");
        }
      })
      .finally(() => {
        if (requestId === savedLeadsRequestId.current) setSavedLeadsLoading(false);
      });
    return () => {
      savedLeadsRequestId.current += 1;
    };
  }, []);

  const records = sheets.flatMap((sheet) =>
    sheet.rows.map((row) => ({ sheet: sheet.sheet, ...row })),
  );
  const requiredMappingReady = Boolean(
    mapping.phone && (mapping.name || (mapping.firstName && mapping.lastName)),
  );
  const preview = records.slice(0, 5).map((record) => toImportRow(record, mapping, defaultSource));

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSheets([]);
    setMapping(EMPTY_MAPPING);
    setError("");
    setParsing(true);
    try {
      const parsed = await parseFile(file);
      const count = parsed.reduce((total, sheet) => total + sheet.rows.length, 0);
      if (!count) throw new Error("The selected file has no data rows beneath its headers.");
      if (count > MAX_IMPORT_ROWS) throw new Error(`Import up to ${MAX_IMPORT_ROWS} leads at a time.`);
      if (parsed.some((sheet) => sheet.headers.length > 50)) throw new Error("Each worksheet can contain up to 50 columns.");
      setSheets(parsed);
      setMapping(detectMapping(parsed[0]?.headers ?? []));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The spreadsheet could not be read.");
      setFileName("");
    } finally {
      setParsing(false);
      event.target.value = "";
    }
  }

  async function resendLeadDeletionCode() {
    if (!leadDeletionChallenge || leadDeletionBusy) return;
    setLeadDeletionBusy(true);
    setLeadDeletionError("");
    try {
      const response = leadDeletionChallenge.allImported
        ? await SalesService.requestAllImportedLeadDeletionOtp()
        : await SalesService.requestLeadDeletionOtp(leadDeletionChallenge.leadIds, true);
      setLeadDeletionChallenge({ ...leadDeletionChallenge, email: response.email, count: response.leadCount });
      setLeadDeletionOtp("");
    } catch (caught) {
      setLeadDeletionError(caught instanceof Error ? caught.message : "Unable to send a new verification code.");
    } finally {
      setLeadDeletionBusy(false);
    }
  }

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requiredMappingReady || records.length === 0) {
      setError("Map a name (or first and last name) and phone column before importing.");
      return;
    }
    const rows = records.map((record) => toImportRow(record, mapping, defaultSource));
    const requestSize = new TextEncoder().encode(JSON.stringify({ rows })).length;
    if (requestSize > 7_000_000) {
      setError("This import is too large to send safely. Split the workbook into smaller files and try again.");
      return;
    }
    setImporting(true);
    setError("");
    try {
      const imported = await SalesService.importLeads(rows);
      savedLeadsRequestId.current += 1;
      setResult(imported);
      setSavedLeads(imported.leads);
      void refreshSavedLeads();
      setLeadPage(1);
      setEditingLeadId("");
      setLeadActionError("");
      setLeadDeletionError("");
      setLeadDeletionNotice("");
      setLeadDeletionChallenge(null);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setImporting(false);
    }
  }

  function updateMapping(key: SourceColumn, value: string) {
    setMapping((current) => ({ ...current, [key]: value }));
  }

  function downloadTemplate() {
    const headers = ["Client Name", "Company Name", "Email", "Phone", "Lead Source", "Description", "Service Interest"];
    const blob = new Blob([`${headers.join(",")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ricoz-sales-leads-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function beginEdit(lead: ImportedSalesLead) {
    setEditingLeadId(lead._id);
    setEditValues({
      name: lead.name,
      company: lead.company ?? "",
      email: lead.email ?? "",
      phone: lead.phone,
    });
    setLeadActionError("");
  }

  async function saveLeadEdit(lead: ImportedSalesLead) {
    setLeadActionBusy(true);
    setLeadActionError("");
    try {
      const updated = await SalesService.updateLead(lead._id, {
        name: editValues.name.trim(),
        company: editValues.company.trim(),
        email: editValues.email.trim(),
        phone: editValues.phone.trim(),
      });
      savedLeadsRequestId.current += 1;
      setResult((current) => current ? {
        ...current,
        leads: current.leads.map((item) => item._id === lead._id ? {
          ...item,
          name: updated.name,
          company: updated.company,
          email: updated.email,
          phone: updated.phone,
          filterValues: {
            ...(item.filterValues ?? {}),
            clientname: updated.name,
            companyname: updated.company ?? "",
            email: updated.email ?? "",
            phone: updated.phone,
          },
        } : item),
      } : current);
      setSavedLeads((current) => current.map((item) => item._id === lead._id ? {
        ...item,
        name: updated.name,
        company: updated.company,
        email: updated.email,
        phone: updated.phone,
        filterValues: {
          ...(item.filterValues ?? {}),
          clientname: updated.name,
          companyname: updated.company ?? "",
          email: updated.email ?? "",
          phone: updated.phone,
        },
      } : item));
      setEditingLeadId("");
      void refreshSavedLeads();
    } catch (caught) {
      setLeadActionError(caught instanceof Error ? caught.message : "Lead changes could not be saved.");
    } finally {
      setLeadActionBusy(false);
    }
  }

  async function toggleLeadArchive(lead: ImportedSalesLead) {
    const archived = !lead.archivedAt;
    if (archived && !window.confirm(`Archive ${lead.name}? You can restore it from this imported-leads list.`)) return;
    setLeadActionBusy(true);
    setLeadActionError("");
    try {
      const updated = await SalesService.archiveLead(lead._id, archived);
      savedLeadsRequestId.current += 1;
      setSavedLeads((current) => current.map((item) => item._id === lead._id ? { ...item, archivedAt: updated.archivedAt } : item));
      setResult((current) => current ? {
        ...current,
        leads: current.leads.map((item) => item._id === lead._id ? { ...item, archivedAt: updated.archivedAt } : item),
      } : current);
      void refreshSavedLeads();
    } catch (caught) {
      setLeadActionError(caught instanceof Error ? caught.message : "Lead archive status could not be changed.");
    } finally {
      setLeadActionBusy(false);
    }
  }

  function removeDeletedLeads(leadIds: string[]) {
    savedLeadsRequestId.current += 1;
    const deletedIds = new Set(leadIds);
    setSelectedClientIds((current) => current.filter((id) => !deletedIds.has(id)));
    setSavedLeads((current) => current.filter((lead) => !deletedIds.has(lead._id)));
    setResult((current) => current ? {
      ...current,
      leads: current.leads.filter((lead) => !deletedIds.has(lead._id)),
    } : current);
    setLeadPage(1);
  }

  async function deleteImportedLeads(leadIds: string[], deleteAll = false) {
    if (!leadIds.length || leadDeletionBusy || leadDeletionChallenge) return;
    const confirmation = deleteAll
      ? `Permanently delete the ${leadIds.length} selected clients from Client Lists? Any linked sales tasks will remain but lose their lead links. Email OTP verification is required.`
      : "Permanently delete this client from Client Lists and the Sales pipeline? Any linked sales tasks will remain but lose their lead link.";
    if (!window.confirm(confirmation)) return;

    setLeadDeletionBusy(true);
    setLeadDeletionError("");
    setLeadDeletionNotice("");
    try {
      if (deleteAll) {
        const response = await SalesService.requestLeadDeletionOtp(leadIds, true);
        setLeadDeletionChallenge({ leadIds, allImported: false, email: response.email, count: response.leadCount });
        setLeadDeletionOtp("");
      } else {
        const response = await SalesService.deleteLeads(leadIds);
        removeDeletedLeads(leadIds);
        setLeadDeletionNotice(response.message);
      }
    } catch (caught) {
      setLeadDeletionError(caught instanceof Error ? caught.message : "The selected client records could not be deleted.");
    } finally {
      setLeadDeletionBusy(false);
    }
  }

  async function deleteAllSavedImportedLeads() {
    if (leadDeletionBusy || leadDeletionChallenge) return;
    if (!window.confirm("Permanently delete every saved spreadsheet-imported client in your Sales access scope, including earlier imports and archived entries? This also deletes the linked Sales CRM leads and unlinks them from accountability tasks. Email OTP verification is required.")) return;
    setLeadDeletionBusy(true);
    setLeadDeletionError("");
    setLeadDeletionNotice("");
    try {
      const response = await SalesService.requestAllImportedLeadDeletionOtp();
      setLeadDeletionChallenge({ leadIds: [], allImported: true, email: response.email, count: response.leadCount });
      setLeadDeletionOtp("");
    } catch (caught) {
      setLeadDeletionError(caught instanceof Error ? caught.message : "Unable to start Client Lists deletion.");
    } finally {
      setLeadDeletionBusy(false);
    }
  }

  async function confirmImportedLeadDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leadDeletionChallenge) return;
    if (leadDeletionOtp.length !== 6) {
      setLeadDeletionError("Enter the 6-digit verification code sent to your email.");
      return;
    }
    setLeadDeletionBusy(true);
    setLeadDeletionError("");
    try {
      const response = leadDeletionChallenge.allImported
        ? await SalesService.deleteAllImportedLeads(leadDeletionOtp)
        : await SalesService.deleteLeads(leadDeletionChallenge.leadIds, {
          deleteAll: true,
          otp: leadDeletionOtp,
        });
      if (leadDeletionChallenge.allImported) {
        savedLeadsRequestId.current += 1;
        setSavedLeads([]);
        setSelectedClientIds([]);
        setResult((current) => current ? { ...current, leads: [] } : current);
        setLeadPage(1);
      } else {
        removeDeletedLeads(leadDeletionChallenge.leadIds);
      }
      setLeadDeletionNotice(response.message);
      setLeadDeletionChallenge(null);
      setLeadDeletionOtp("");
    } catch (caught) {
      setLeadDeletionError(caught instanceof Error ? caught.message : "The selected client records could not be deleted.");
    } finally {
      setLeadDeletionBusy(false);
    }
  }

  function chooseFilterProperty(property: string) {
    setDraftProperty(property);
    setDraftOperator(clientFilterKind(property) === "number" ? "greater than" : clientFilterKind(property) === "date" ? "after" : clientFilterKind(property) === "boolean" ? "is" : "contains");
    setDraftValue(clientFilterKind(property) === "boolean" ? "Yes" : "");
    setFilterError("");
  }

  function applyClientFilter() {
    if (!draftProperty) {
      setFilterError("Choose a property to filter clients.");
      return;
    }
    if (!["is empty", "is not empty"].includes(draftOperator) && !draftValue.trim()) {
      setFilterError("Enter or choose a value for this filter.");
      return;
    }
    const nextFilter = { property: draftProperty, operator: draftOperator, value: draftValue };
    setClientFilters((current) => [
      ...current.filter((filter) => filter.property !== nextFilter.property),
      nextFilter,
    ]);
    setSelectedClientIds([]);
    setLeadPage(1);
    setFilterOpen(false);
    setFilterError("");
  }

  const importedLeads = savedLeads;
  const filteredLeads = importedLeads.filter((lead) => clientFilters.every((filter) => matchesClientFilter(lead, filter)));
  const totalLeadPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));
  const pageLeads = filteredLeads.slice((leadPage - 1) * LEADS_PER_PAGE, leadPage * LEADS_PER_PAGE);
  const selectedClientIdSet = new Set(selectedClientIds);
  const allPageClientsSelected = pageLeads.length > 0 && pageLeads.every((lead) => selectedClientIdSet.has(lead._id));
  const somePageClientsSelected = pageLeads.some((lead) => selectedClientIdSet.has(lead._id));
  const allFilteredClientsSelected = filteredLeads.length > 0 && filteredLeads.every((lead) => selectedClientIdSet.has(lead._id));

  function toggleClientSelection(leadId: string, selected: boolean) {
    if (selected && selectedClientIds.length >= MAX_SELECTED_CLIENTS) {
      setLeadActionError(`Select up to ${MAX_SELECTED_CLIENTS.toLocaleString()} clients at a time. Use Delete all clients for the full list.`);
      return;
    }
    setSelectedClientIds((current) => selected
      ? current.includes(leadId) ? current : [...current, leadId]
      : current.filter((id) => id !== leadId));
    setLeadActionError("");
  }

  function togglePageSelection() {
    const pageIds = pageLeads.map((lead) => lead._id);
    if (allPageClientsSelected) {
      setSelectedClientIds((current) => current.filter((id) => !pageIds.includes(id)));
      return;
    }
    const newSelectionCount = selectedClientIds.length + pageIds.filter((id) => !selectedClientIdSet.has(id)).length;
    if (newSelectionCount > MAX_SELECTED_CLIENTS) {
      setLeadActionError(`Select up to ${MAX_SELECTED_CLIENTS.toLocaleString()} clients at a time. Use Delete all clients for the full list.`);
      return;
    }
    setSelectedClientIds((current) => [...new Set([...current, ...pageIds])]);
    setLeadActionError("");
  }

  function selectFilteredClients() {
    const ids = filteredLeads.map((lead) => lead._id);
    if (ids.length > MAX_SELECTED_CLIENTS) {
      setLeadActionError(`Select up to ${MAX_SELECTED_CLIENTS.toLocaleString()} clients at a time. Add filters and try again.`);
      return;
    }
    setSelectedClientIds(ids);
    setLeadActionError("");
  }

  function exportSelectedClients() {
    const leads = selectedClientIds.length
      ? savedLeads.filter((lead) => selectedClientIdSet.has(lead._id))
      : filteredLeads;
    const columns = ["Name", "Company", "Email", "Phone", "Worksheet", "Row"];
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      columns.map(quote).join(","),
      ...leads.map((lead) => [lead.name, lead.company, lead.email, lead.phone, lead.sheet, lead.row].map(quote).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "client-lists.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleCampaignCreated(message: string) {
    setLeadDeletionNotice(message);
    setSelectedClientIds([]);
    setCampaignHistoryOpen(true);
  }

  function openBulkUpdate() {
    setBulkUpdateField("");
    setBulkUpdateValue("");
    setBulkUpdateError("");
    setBulkUpdateOpen(true);
  }

  async function submitBulkUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bulkUpdateField || !selectedClientIds.length || bulkUpdateBusy) return;
    setBulkUpdateBusy(true);
    setBulkUpdateError("");
    try {
      const response = await SalesService.bulkUpdateImportedLeads(
        selectedClientIds,
        bulkUpdateField,
        bulkUpdateValue,
      );
      setLeadDeletionNotice(response.message);
      setBulkUpdateOpen(false);
      void refreshSavedLeads();
    } catch (caught) {
      setBulkUpdateError(caught instanceof Error ? caught.message : "The selected clients could not be updated.");
    } finally {
      setBulkUpdateBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 text-(--brand-text)">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-(--brand-border) pb-4">
        <div>
          <p className="text-xs font-semibold text-(--brand-text-secondary)">Sales Workspace · CRM</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">Client Lists</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-(--brand-text-secondary)">
            Import clients from CSV or Excel and keep them saved here, separate from CRM pipeline stages. Imported clients stay on this page after refresh.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadTemplate} className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 text-xs font-semibold text-(--brand-text) hover:bg-(--brand-surface)">
            <Download size={14} />Download template
          </button>
          <button type="button" disabled={savedLeadsLoading || leadDeletionBusy || Boolean(leadDeletionChallenge)} onClick={() => void deleteAllSavedImportedLeads()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            <Trash2 size={14} />Delete all saved clients
          </button>
        </div>
      </header>

      <form onSubmit={(event) => void submitImport(event)} className="space-y-5">
        <section className="rounded-xl border border-(--brand-border) bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">1. Choose your spreadsheet</h3>
              <p className="mt-1 text-[11px] leading-5 text-(--brand-text-secondary)">CSV up to 2 MB or .xlsx workbook up to 10 MB. Worksheets should use the same header row.</p>
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={parsing || importing} className="inline-flex h-9 items-center gap-2 rounded-lg bg-(--brand-navy) px-3 text-xs font-semibold text-white hover:bg-(--brand-red) disabled:opacity-50">
              {parsing ? <LoaderCircle size={14} className="animate-spin" /> : <FileUp size={14} />}
              {parsing ? "Reading file..." : fileName || "Browse files"}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void chooseFile(event)} className="sr-only" />
          </div>
          {sheets.length > 1 ? <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-800"><FileSpreadsheet size={12} />{sheets.length} worksheets · {records.length} lead rows</p> : null}
        </section>

        {records.length > 0 ? (
          <>
            <section className="rounded-xl border border-(--brand-border) bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold">2. Match spreadsheet columns</h3>
                  <p className="mt-1 text-[11px] text-(--brand-text-secondary)">We matched common headings automatically. Check the required fields before importing.</p>
                </div>
                <label className="grid gap-1 text-[10px] font-semibold text-(--brand-text-secondary)">
                  Default lead source
                  <select value={defaultSource} onChange={(event) => setDefaultSource(event.target.value as SalesLeadSource)} className="h-9 rounded-lg border border-(--brand-border) bg-white px-2.5 text-xs text-(--brand-text)">
                    {SOURCE_VALUES.map((source) => <option key={source} value={source}>{source.replaceAll("_", " ")}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FIELD_LABELS.map(({ key, label, required }) => (
                  <label key={key} className="grid gap-1 text-[10px] font-semibold text-(--brand-text-secondary)">
                    {label}{required ? " *" : ""}
                    <select value={mapping[key]} onChange={(event) => updateMapping(key, event.target.value)} className="h-9 min-w-0 rounded-lg border border-(--brand-border) bg-white px-2.5 text-xs text-(--brand-text)">
                      <option value="">Not mapped</option>
                      {sheets[0]?.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              {mapping.name && (mapping.firstName || mapping.lastName) ? <p className="mt-3 text-[10px] text-(--brand-text-muted)">Full name takes precedence over first/last name when both are mapped.</p> : null}
            </section>

            <section className="overflow-hidden rounded-xl border border-(--brand-border) bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--brand-border) px-4 py-3">
                <div><h3 className="text-sm font-bold">3. Preview imported clients</h3><p className="mt-0.5 text-[10px] text-(--brand-text-secondary)">First 5 of {records.length} rows · uploaded clients are owned by you</p></div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${requiredMappingReady ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                  {requiredMappingReady ? "Required columns mapped" : "Map name and phone"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left text-[11px]">
                  <thead className="bg-(--brand-surface) text-(--brand-text-secondary)"><tr>{["Name", "Phone", "Company", "Email", "Source", "Worksheet"].map((heading) => <th key={heading} className="border-b border-(--brand-border) px-3 py-2.5 font-semibold">{heading}</th>)}</tr></thead>
                  <tbody>{preview.map((row, index) => <tr key={`${row.sheet}:${row.rowNumber}:${index}`} className="border-b border-(--brand-border) last:border-0">
                    <td className="max-w-48 truncate px-3 py-2.5 font-semibold">{row.values.name || "—"}</td>
                    <td className="px-3 py-2.5">{row.values.phone || "—"}</td>
                    <td className="max-w-40 truncate px-3 py-2.5">{row.values.company || "—"}</td>
                    <td className="max-w-48 truncate px-3 py-2.5">{row.values.email || "—"}</td>
                    <td className="px-3 py-2.5">{row.values.sourceCategory || row.values.source}</td>
                    <td className="px-3 py-2.5 text-(--brand-text-muted)">{row.sheet} · row {row.rowNumber}</td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--brand-border) px-4 py-3">
                <p className="max-w-2xl text-[10px] leading-4 text-(--brand-text-secondary)">Existing leads with a matching email or phone are skipped. Rows with invalid required fields are reported and other valid rows continue importing.</p>
                <button type="submit" disabled={importing || parsing || !requiredMappingReady} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {importing ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
                  {importing ? "Importing..." : `Import ${records.length} clients`}
                </button>
              </div>
            </section>
          </>
        ) : null}
      </form>

      {error ? <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div> : null}
      {savedLeadsError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">Saved clients could not be refreshed: {savedLeadsError}</div> : null}
      {leadDeletionError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{leadDeletionError}</div> : null}
      {leadDeletionNotice ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{leadDeletionNotice}</div> : null}
      {leadDeletionChallenge ? (
        <form onSubmit={(event) => void confirmImportedLeadDeletion(event)} className="flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="min-w-64 flex-1">
            <h3 className="text-sm font-bold text-amber-950">Verify imported lead deletion</h3>
            <p className="mt-1 text-xs text-amber-900">Enter the 6-digit code sent to {leadDeletionChallenge.email} to permanently delete {leadDeletionChallenge.allImported ? `all ${leadDeletionChallenge.count} saved imported leads across previous uploads, including archived entries` : `all ${leadDeletionChallenge.count} leads in the selected import batch`} from Client Lists and the Sales pipeline.</p>
          </div>
          <label className="text-xs font-semibold text-amber-950">Verification code
            <span className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-amber-300 bg-white px-2">
              <KeyRound size={14} />
              <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={leadDeletionOtp} onChange={(event) => setLeadDeletionOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="w-32 bg-transparent text-sm tracking-[0.2em] outline-none" />
            </span>
          </label>
          <button type="button" disabled={leadDeletionBusy} onClick={() => void resendLeadDeletionCode()} className="h-10 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-950 disabled:opacity-50">Send a new code</button>
          <button type="submit" disabled={leadDeletionBusy || leadDeletionOtp.length !== 6} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-700 px-3 text-xs font-semibold text-white disabled:opacity-50">{leadDeletionBusy ? <LoaderCircle size={14} className="animate-spin" /> : null}Verify and delete</button>
          <button type="button" disabled={leadDeletionBusy} onClick={() => { setLeadDeletionChallenge(null); setLeadDeletionOtp(""); setLeadDeletionError(""); }} className="h-10 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-950 disabled:opacity-50">Cancel</button>
        </form>
      ) : null}
      {communicationChannel ? (
        <ClientCommunicationDialog
          channel={communicationChannel}
          leadIds={selectedClientIds}
          onClose={() => setCommunicationChannel(null)}
          onCreated={handleCampaignCreated}
        />
      ) : null}
      {campaignHistoryOpen ? <ClientCampaignHistory onClose={() => setCampaignHistoryOpen(false)} /> : null}
      {bulkUpdateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <button type="button" aria-label="Close bulk client update" onClick={() => { if (!bulkUpdateBusy) setBulkUpdateOpen(false); }} className="absolute inset-0 cursor-default" />
          <section role="dialog" aria-modal="true" aria-labelledby="bulk-client-update-title" className="relative w-full max-w-2xl overflow-visible rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 sm:px-7">
              <h2 id="bulk-client-update-title" className="text-xl font-bold text-slate-900">Update Field</h2>
              <span className="text-slate-300">·</span>
              <p className="text-sm font-semibold text-slate-600">{selectedClientIds.length} {selectedClientIds.length === 1 ? "Client" : "Clients"} Selected</p>
            </header>
            <form onSubmit={(event) => void submitBulkUpdate(event)}>
              <div className="grid gap-4 px-5 py-7 sm:grid-cols-[minmax(130px,0.7fr)_minmax(0,1.5fr)] sm:px-7">
                <label className="self-center text-sm font-medium text-slate-700">Select a field</label>
                <SearchableDropdown
                  name="clientBulkUpdateField"
                  ariaLabel="Select a field to update"
                  placeholder="Select"
                  options={CLIENT_LIST_BULK_UPDATE_FIELDS.map((field) => ({ value: field, label: field }))}
                  defaultValue={bulkUpdateField}
                  onValueChange={(field) => {
                    const selectedField = CLIENT_LIST_BULK_UPDATE_FIELDS.find((option) => option === field);
                    if (!selectedField) return;
                    setBulkUpdateField(selectedField);
                    setBulkUpdateValue("");
                    setBulkUpdateError("");
                  }}
                />
                {bulkUpdateField ? (
                  <>
                    <label htmlFor="client-bulk-update-value" className="self-center text-sm font-medium text-slate-700">{bulkUpdateField}</label>
                    <input
                      id="client-bulk-update-value"
                      type={bulkUpdateField === "Email" ? "email" : bulkUpdateField === "Phone" || bulkUpdateField === "Alternative Mob Number" ? "tel" : "text"}
                      inputMode={bulkUpdateField === "Phone" || bulkUpdateField === "Alternative Mob Number" ? "tel" : undefined}
                      maxLength={bulkUpdateField === "Client Name" || bulkUpdateField === "Company Name" ? 160 : bulkUpdateField === "Email" ? 254 : bulkUpdateField === "Phone" ? 30 : bulkUpdateField === "Lead Source" ? 80 : bulkUpdateField === "Notes" ? 4000 : bulkUpdateField === "Service Interest" ? 160 : 2000}
                      value={bulkUpdateValue}
                      onChange={(event) => setBulkUpdateValue(event.target.value)}
                      placeholder={`Enter ${bulkUpdateField.toLocaleLowerCase()}`}
                      autoFocus
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                    />
                  </>
                ) : null}
                {bulkUpdateError ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{bulkUpdateError}</p> : null}
              </div>
              <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-7">
                <button type="button" disabled={bulkUpdateBusy} onClick={() => setBulkUpdateOpen(false)} className="h-10 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={bulkUpdateBusy || !bulkUpdateField || ((bulkUpdateField === "Client Name" || bulkUpdateField === "Phone") && !bulkUpdateValue.trim()) || (bulkUpdateField === "Email" && Boolean(bulkUpdateValue) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bulkUpdateValue.trim()))} className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{bulkUpdateBusy ? <LoaderCircle size={15} className="animate-spin" /> : null}Save</button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
      {result ? (
        <section role="status" className={`rounded-xl border p-4 ${result.skipped ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          <div className="flex items-start gap-2">
            {result.skipped ? <AlertCircle size={17} className="mt-0.5 text-amber-700" /> : <CheckCircle2 size={17} className="mt-0.5 text-emerald-700" />}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold">{result.imported} leads imported · {result.skipped} skipped</h3>
              <p className="mt-1 text-[10px] leading-4 text-(--brand-text-secondary)">Review, edit, or archive these saved clients below. Archived clients can be restored here.</p>
              {result.errors.length ? <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-[10px] leading-4 text-amber-950">{result.errors.slice(0, 100).map((item, index) => <li key={`${item.sheet}:${item.row}:${index}`}><strong>{item.sheet}, row {item.row}:</strong> {item.message}</li>)}</ul> : null}
              {result.errors.length > 100 ? <p className="mt-2 text-[10px] text-amber-900">Showing first 100 of {result.errors.length} row errors.</p> : null}
            </div>
          </div>
        </section>
      ) : null}
      {savedLeadsLoading && !importedLeads.length ? <p role="status" className="rounded-lg border border-(--brand-border) bg-white p-4 text-xs text-(--brand-text-secondary)">Loading saved clients...</p> : null}
      {!savedLeadsLoading && !savedLeadsError && !importedLeads.length ? <p className="rounded-lg border border-dashed border-(--brand-border) bg-white p-6 text-center text-sm text-(--brand-text-secondary)">No saved clients yet. Import a CSV or Excel sheet to add clients here.</p> : null}
      {importedLeads.length ? (
        <section className="rounded-xl border border-(--brand-border) bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-(--brand-border) px-4 py-3">
            <div><h3 className="text-sm font-bold">Saved clients</h3><p className="mt-0.5 text-[10px] text-(--brand-text-secondary)">Manage all clients saved in this list. Archived clients can be restored here.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" aria-expanded={filterOpen} onClick={() => { setFilterOpen((open) => !open); setFilterError(""); }} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${clientFilters.length ? "border-blue-200 bg-blue-50 text-blue-800" : "border-(--brand-border) text-(--brand-text-secondary) hover:bg-(--brand-surface)"}`}><Filter size={12} />Filters{clientFilters.length ? ` (${clientFilters.length})` : ""}</button>
              <button type="button" disabled={!filteredLeads.length || (allFilteredClientsSelected && selectedClientIds.length === filteredLeads.length)} onClick={selectFilteredClients} className="inline-flex h-8 items-center rounded-lg border border-(--brand-border) px-2.5 text-[10px] font-semibold text-(--brand-text-secondary) hover:bg-(--brand-surface) disabled:opacity-40">Select all filtered ({filteredLeads.length})</button>
              <button type="button" onClick={() => setCampaignHistoryOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--brand-border) px-2.5 text-[10px] font-semibold text-(--brand-text-secondary) hover:bg-(--brand-surface)">Campaign history</button>
              {selectedClientIds.length ? (
                <>
                  <button type="button" disabled={bulkUpdateBusy || leadDeletionBusy || Boolean(leadDeletionChallenge)} onClick={openBulkUpdate} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Update Field</button>
                  <button type="button" disabled={leadDeletionBusy || Boolean(leadDeletionChallenge)} onClick={() => void deleteImportedLeads(selectedClientIds, true)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={12} />Delete selected</button>
                  <span className="inline-flex h-8 items-center gap-2 rounded-lg bg-(--brand-surface) px-3 text-[10px] font-semibold text-(--brand-text-secondary)">{selectedClientIds.length} selected<button type="button" aria-label="Clear selected clients" onClick={() => setSelectedClientIds([])} className="rounded p-0.5 hover:bg-white"><X size={14} /></button></span>
                </>
              ) : null}
              <details className="relative">
                <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-lg border border-(--brand-border) px-2.5 text-[10px] font-semibold text-(--brand-text-secondary) hover:bg-(--brand-surface)">More actions</summary>
                <div className="absolute right-0 z-20 mt-1 grid min-w-48 gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
                  <button type="button" disabled={!selectedClientIds.length} onClick={() => setCommunicationChannel("EMAIL")} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Mail size={14} />Email selected clients</button>
                  <button type="button" disabled={!selectedClientIds.length} onClick={() => setCommunicationChannel("WHATSAPP")} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"><MessageCircle size={14} />WhatsApp selected clients</button>
                  <button type="button" onClick={exportSelectedClients} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"><Download size={14} />Export {selectedClientIds.length ? "selected" : "filtered"} clients</button>
                </div>
              </details>
              <button type="button" disabled={leadActionBusy || leadDeletionBusy || Boolean(leadDeletionChallenge)} onClick={() => void deleteAllSavedImportedLeads()} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-[10px] font-semibold text-red-700 disabled:opacity-50"><Trash2 size={12} />Delete all clients ({importedLeads.length})</button>
              {totalLeadPages > 1 ? <div className="flex items-center gap-2 text-[10px]"><button type="button" disabled={leadPage <= 1} onClick={() => setLeadPage((page) => page - 1)} className="rounded border border-(--brand-border) px-2 py-1 disabled:opacity-40">Previous</button><span>Page {leadPage} of {totalLeadPages}</span><button type="button" disabled={leadPage >= totalLeadPages} onClick={() => setLeadPage((page) => page + 1)} className="rounded border border-(--brand-border) px-2 py-1 disabled:opacity-40">Next</button></div> : null}
            </div>
            {filterOpen ? (
              <form onSubmit={(event) => { event.preventDefault(); applyClientFilter(); }} className="grid w-full gap-3 border-t border-(--brand-border) bg-(--brand-surface) p-3 sm:grid-cols-2 lg:grid-cols-[minmax(190px,1.4fr)_minmax(150px,0.8fr)_minmax(180px,1fr)_auto] lg:items-end">
                <label className="block text-xs font-semibold text-(--brand-text-secondary)">
                  Choose a Property
                  <span className="mt-1.5 block">
                    <SearchableDropdown
                      name="clientFilterProperty"
                      ariaLabel="Choose a Property"
                      placeholder="Choose a Property"
                      options={CLIENT_FILTER_PROPERTIES.map((property) => ({ value: property, label: property }))}
                      defaultValue={draftProperty}
                      onValueChange={chooseFilterProperty}
                    />
                  </span>
                </label>
                {draftProperty ? (
                  <>
                    <label className="block text-xs font-semibold text-(--brand-text-secondary)">
                      Condition
                      <select value={draftOperator} onChange={(event) => {
                        const operator = event.target.value as ClientFilterOperator;
                        setDraftOperator(operator);
                        if (operator === "is empty" || operator === "is not empty") setDraftValue("");
                      }} className="mt-1.5 h-11 w-full rounded-xl border border-(--brand-border) bg-white px-3 text-sm text-(--brand-text) outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50">
                        {clientFilterOperators(draftProperty).map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                      </select>
                    </label>
                    {!["is empty", "is not empty"].includes(draftOperator) ? (
                      <label className="block text-xs font-semibold text-(--brand-text-secondary)">
                        Value
                        {clientFilterKind(draftProperty) === "boolean" ? (
                          <select value={draftValue} onChange={(event) => setDraftValue(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-(--brand-border) bg-white px-3 text-sm text-(--brand-text) outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50">
                            <option value="Yes">Yes</option><option value="No">No</option>
                          </select>
                        ) : (
                          <input
                            required
                            type={clientFilterKind(draftProperty) === "number" ? "number" : clientFilterKind(draftProperty) === "date" ? "date" : "text"}
                            step={clientFilterKind(draftProperty) === "number" ? "any" : undefined}
                            value={draftValue}
                            onChange={(event) => setDraftValue(event.target.value)}
                            placeholder={clientFilterKind(draftProperty) === "number" ? "Enter amount in major units" : clientFilterKind(draftProperty) === "date" ? "Choose date" : "Enter a value"}
                            min={draftProperty === "Pipeline Amount" ? 0 : undefined}
                            className="mt-1.5 h-11 w-full rounded-xl border border-(--brand-border) bg-white px-3 text-sm text-(--brand-text) outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                          />
                        )}
                      </label>
                    ) : null}
                  </>
                ) : <p className="rounded-xl bg-white px-4 py-3 text-xs leading-5 text-(--brand-text-secondary)">Choose a property to set its filter condition and value.</p>}
                <div className="flex items-end justify-end gap-2">
                  <button type="button" onClick={() => setFilterOpen(false)} className="h-11 rounded-lg border border-(--brand-border) bg-white px-4 text-xs font-semibold text-(--brand-text-secondary) hover:bg-white">Close</button>
                  <button type="submit" disabled={!draftProperty || (!["is empty", "is not empty"].includes(draftOperator) && !draftValue.trim())} className="h-11 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">Apply Filter</button>
                </div>
                {filterError ? <p role="alert" className="text-xs text-red-700 lg:col-span-full">{filterError}</p> : null}
              </form>
            ) : null}
          </header>
          {clientFilters.length ? <div className="flex flex-wrap items-center gap-2 border-b border-(--brand-border) px-4 py-2.5">
            {clientFilters.map((filter) => <span key={filter.property} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] text-blue-900">
              <span className="font-semibold">{filter.property}</span> {filter.operator}{filter.value ? ` “${filter.value}”` : ""}
              <button type="button" aria-label={`Remove ${filter.property} filter`} onClick={() => { setClientFilters((current) => current.filter((item) => item.property !== filter.property)); setSelectedClientIds([]); setLeadPage(1); }} className="ml-1 rounded-full p-0.5 hover:bg-blue-100"><X size={11} /></button>
            </span>)}
            <button type="button" onClick={() => { setClientFilters([]); setSelectedClientIds([]); setLeadPage(1); }} className="text-[10px] font-semibold text-slate-600 underline underline-offset-2">Clear all</button>
            <span className="ml-auto text-[10px] text-slate-500">{filteredLeads.length} matching</span>
          </div> : null}
          {leadActionError ? <p role="alert" className="mx-4 mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">{leadActionError}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-left text-[11px]">
              <thead className="bg-(--brand-surface) text-(--brand-text-secondary)"><tr>
                <th className="w-10 border-b border-(--brand-border) px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all clients on this page"
                    aria-checked={somePageClientsSelected ? allPageClientsSelected || "mixed" : false}
                    checked={allPageClientsSelected}
                    disabled={!pageLeads.length || leadDeletionBusy || Boolean(leadDeletionChallenge)}
                    onChange={togglePageSelection}
                    ref={(element) => {
                      if (element) element.indeterminate = somePageClientsSelected && !allPageClientsSelected;
                    }}
                    className="size-4 rounded border-(--brand-border) accent-(--brand-navy)"
                  />
                </th>
                {["Name", "Company", "Email", "Phone", "Sheet row", "Actions"].map((heading) => <th key={heading} className="border-b border-(--brand-border) px-3 py-2.5 font-semibold">{heading}</th>)}
              </tr></thead>
              <tbody>{pageLeads.map((lead) => editingLeadId === lead._id ? (
                <tr key={lead._id} className="border-b border-(--brand-border) bg-blue-50/40">
                  <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Select ${lead.name}`} checked={selectedClientIdSet.has(lead._id)} disabled={leadDeletionBusy || Boolean(leadDeletionChallenge)} onChange={(event) => toggleClientSelection(lead._id, event.target.checked)} className="size-4 rounded border-(--brand-border) accent-(--brand-navy)" /></td>
                  <td className="px-2 py-2"><input aria-label="Lead name" required maxLength={160} value={editValues.name} onChange={(event) => setEditValues((current) => ({ ...current, name: event.target.value }))} className="w-32 rounded border border-(--brand-border) bg-white px-2 py-1.5" /></td>
                  <td className="px-2 py-2"><input aria-label="Company" maxLength={160} value={editValues.company} onChange={(event) => setEditValues((current) => ({ ...current, company: event.target.value }))} className="w-28 rounded border border-(--brand-border) bg-white px-2 py-1.5" /></td>
                  <td className="px-2 py-2"><input aria-label="Email" type="email" value={editValues.email} onChange={(event) => setEditValues((current) => ({ ...current, email: event.target.value }))} className="w-36 rounded border border-(--brand-border) bg-white px-2 py-1.5" /></td>
                  <td className="px-2 py-2"><input aria-label="Phone" required minLength={7} maxLength={30} value={editValues.phone} onChange={(event) => setEditValues((current) => ({ ...current, phone: event.target.value }))} className="w-28 rounded border border-(--brand-border) bg-white px-2 py-1.5" /></td>
                  <td className="px-3 py-2 text-(--brand-text-muted)">{lead.sheet ? `${lead.sheet}${lead.row ? ` · ${lead.row}` : ""}` : "Earlier import"}</td>
                  <td className="px-2 py-2"><div className="flex gap-1"><button type="button" disabled={leadActionBusy} onClick={() => void saveLeadEdit(lead)} title="Save lead" className="inline-flex items-center gap-1 rounded bg-(--brand-navy) px-2 py-1.5 font-semibold text-white disabled:opacity-50"><Save size={12} />Save</button><button type="button" disabled={leadActionBusy} onClick={() => setEditingLeadId("")} title="Cancel edit" className="rounded border border-(--brand-border) p-1.5 disabled:opacity-50"><X size={13} /></button></div></td>
                </tr>
              ) : (
                <tr key={lead._id} className={`border-b border-(--brand-border) last:border-0 ${selectedClientIdSet.has(lead._id) ? "bg-sky-50" : lead.archivedAt ? "bg-slate-50 text-slate-500" : ""}`}>
                  <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Select ${lead.name}`} checked={selectedClientIdSet.has(lead._id)} disabled={leadDeletionBusy || Boolean(leadDeletionChallenge)} onChange={(event) => toggleClientSelection(lead._id, event.target.checked)} className="size-4 rounded border-(--brand-border) accent-(--brand-navy)" /></td>
                  <td className="px-3 py-2.5 font-semibold">{lead.name}{lead.archivedAt ? <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase">Archived</span> : null}</td>
                  <td className="px-3 py-2.5">{lead.company || "—"}</td><td className="px-3 py-2.5">{lead.email || "—"}</td><td className="px-3 py-2.5">{lead.phone}</td><td className="px-3 py-2.5 text-(--brand-text-muted)">{lead.sheet ? `${lead.sheet}${lead.row ? ` · ${lead.row}` : ""}` : "Earlier import"}</td>
                  <td className="px-2 py-2"><div className="flex gap-1">{!lead.archivedAt ? <button type="button" disabled={leadActionBusy || leadDeletionBusy} onClick={() => beginEdit(lead)} title="Edit lead" className="inline-flex items-center gap-1 rounded border border-(--brand-border) px-2 py-1.5 font-semibold hover:bg-(--brand-surface) disabled:opacity-50"><Pencil size={12} />Edit</button> : null}<button type="button" disabled={leadActionBusy || leadDeletionBusy} onClick={() => void toggleLeadArchive(lead)} title={lead.archivedAt ? "Restore lead" : "Archive lead"} className="inline-flex items-center gap-1 rounded border border-(--brand-border) px-2 py-1.5 font-semibold hover:bg-(--brand-surface) disabled:opacity-50">{lead.archivedAt ? <RotateCcw size={12} /> : <Archive size={12} />}{lead.archivedAt ? "Restore" : "Archive"}</button><button type="button" disabled={leadActionBusy || leadDeletionBusy} onClick={() => void deleteImportedLeads([lead._id])} title="Permanently delete lead" className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={12} />Delete</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {!pageLeads.length ? <p className="py-10 text-center text-sm text-(--brand-text-secondary)">No clients match these filters. Try changing or clearing a filter.</p> : null}
          <footer className="border-t border-(--brand-border) px-4 py-2 text-[10px] text-(--brand-text-secondary)">Showing {pageLeads.length} of {filteredLeads.length} matching saved clients.</footer>
        </section>
      ) : null}
    </div>
  );
}

function toImportRow(
  record: { sheet: string; rowNumber: number; values: Record<string, string> },
  mapping: FieldMapping,
  defaultSource: SalesLeadSource,
): SalesLeadImportRow {
  const get = (column: string) => column ? record.values[column]?.trim() ?? "" : "";
  const fullName = get(mapping.name) || [get(mapping.firstName), get(mapping.lastName)].filter(Boolean).join(" ");
  const rawSource = get(mapping.source);
  const normalizedSource = normalizeSource(rawSource);
  const notesColumns = Object.keys(record.values).filter((header) => /description|notes?|feedback|comments?/i.test(header));
  const noteParts = [...new Set([get(mapping.notes), ...notesColumns.map((header) => record.values[header]?.trim() ?? "")])].filter(Boolean);
  const mappedColumns = new Set(Object.values(mapping).filter(Boolean));
  const values: Record<string, string> = {
    name: fullName,
    phone: get(mapping.phone),
    company: get(mapping.company),
    email: get(mapping.email),
    source: rawSource ? normalizedSource : defaultSource,
    sourceCategory: rawSource,
    notes: [...new Set(noteParts)].join("\n\n").slice(0, 4000),
    serviceInterest: get(mapping.serviceInterest),
  };
  const reservedKeys = new Set(["name", "phone", "company", "email", "source", "sourcecategory", "notes", "serviceinterest"]);
  for (const [header, value] of Object.entries(record.values)) {
    if (!mappedColumns.has(header) && !reservedKeys.has(normalizeHeader(header).replaceAll(" ", ""))) {
      if (Object.keys(values).length >= 50) break;
      values[header] = value.slice(0, 2000);
    }
  }
  return { sheet: record.sheet, rowNumber: record.rowNumber, values };
}

function normalizeSource(value: string): SalesLeadSource {
  const source = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (["google", "google ads", "search engine", "google search"].includes(source)) return "GOOGLE";
  if (["meta", "facebook", "facebook ads"].includes(source)) return "META";
  if (["instagram", "instagram ads"].includes(source)) return "INSTAGRAM";
  if (["linkedin", "linkedin ads"].includes(source)) return "LINKEDIN";
  if (["website", "web", "website form", "site"].includes(source)) return "WEBSITE";
  if (["referral", "referred", "word of mouth"].includes(source)) return "REFERRAL";
  if (["email", "email campaign"].includes(source)) return "EMAIL";
  if (["youtube", "youtube ads"].includes(source)) return "YOUTUBE";
  if (["cold call", "cold calling", "outbound call"].includes(source)) return "COLD_CALLING";
  return "OTHER";
}

function detectMapping(headers: string[]): FieldMapping {
  const aliases: Record<SourceColumn, string[]> = {
    name: ["client name", "lead name", "contact name", "full name", "name"],
    firstName: ["first name", "firstname", "given name"],
    lastName: ["last name", "lastname", "surname", "family name"],
    phone: ["phone", "phone number", "mobile", "mobile number", "contact number", "telephone", "cell"],
    company: ["company", "company name", "organization", "organisation", "business name"],
    email: ["email", "email address", "e mail"],
    source: ["lead source", "source", "source name", "campaign source"],
    notes: ["description", "notes", "feedback", "feedback 1", "comments"],
    serviceInterest: ["service interest", "service", "product", "interest", "requirement"],
  };
  return Object.fromEntries(Object.entries(aliases).map(([field, candidates]) => [
    field,
    headers.find((header) => candidates.includes(normalizeHeader(header))) ?? "",
  ])) as FieldMapping;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

async function parseFile(file: File): Promise<SheetRows[]> {
  if (!file.size) throw new Error("The selected file is empty.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    if (file.size > 2_000_000) throw new Error("CSV files must be 2 MB or smaller.");
    return [toSheetRows("CSV", parseCsv(await file.text()))];
  }
  if (extension !== "xlsx") throw new Error("Choose a .csv file or an .xlsx workbook. Save legacy .xls files as .xlsx first.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Excel workbooks must be 10 MB or smaller.");
  try {
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    const workbook = await readXlsxFile(file);
    const parsed = workbook.flatMap((sheet) => {
      const rows = sheet.data.filter((row) => row.some((cell) => cellText(cell) !== ""));
      return rows.length ? [toSheetRows(sheet.sheet, rows)] : [];
    });
    if (!parsed.length) throw new Error("The workbook has no data rows beneath its headers.");
    const expectedHeaders = parsed[0]?.headers.join("\u0000");
    if (parsed.some((sheet) => sheet.headers.join("\u0000") !== expectedHeaders)) {
      throw new Error("All worksheets in a workbook must use the same column headings.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && /worksheet|workbook|data rows|column headings/i.test(error.message)) throw error;
    throw new Error("Could not read this workbook. Check that it is a valid .xlsx file and try again.");
  }
}

function toSheetRows(sheet: string, grid: unknown[][]): SheetRows {
  const headerCounts = new Map<string, number>();
  const headers = (grid[0] ?? []).map((value, index) => {
    const text = cellText(value);
    const header = text || `Column ${index + 1}`;
    const key = normalizeHeader(header);
    const count = (headerCounts.get(key) ?? 0) + 1;
    headerCounts.set(key, count);
    return count === 1 ? header : `${header} (${count})`;
  });
  if (!headers.length) throw new Error(`Worksheet "${sheet}" has no headers.`);
  const rows = grid.slice(1).flatMap((cells, index) => {
    const values = Object.fromEntries(headers.map((header, column) => [header, cellText(cells[column])]));
    return Object.values(values).some(Boolean) ? [{ rowNumber: index + 2, values }] : [];
  });
  return { sheet, headers, rows };
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
  if (rows.length < 2) throw new Error("The CSV must contain a header and at least one lead row.");
  const first = rows[0]!;
  if (first[0]?.startsWith("\uFEFF")) first[0] = first[0].slice(1);
  return rows;
}

function apiErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string; errors?: Array<{ message?: string }> } } }).response;
    const message = response?.data?.message;
    const details = response?.data?.errors?.map((item) => item.message).filter(Boolean).join(" ");
    if (message || details) return [message, details].filter(Boolean).join(" ");
  }
  return error instanceof Error ? error.message : "The leads could not be imported.";
}
