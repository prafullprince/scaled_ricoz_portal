"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Filter,
  UserRoundCheck,
  X,
  Columns3,
  List,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Settings2,
  BadgeCheck,
  CircleDollarSign,
  Eye,
  Trash2,
  UsersRound,
} from "lucide-react";
import { SalesService } from "@/services/sales.service";
import { SalesLeadDetail } from "./SalesLeadDetail";
import { SalesPipelineBoard, SalesPipelineSettings } from "./SalesPipelineBoard";
import { SearchableDropdown } from "../SearchableDropdown";
import {
  CLIENT_FILTER_PROPERTIES,
  clientFilterKind,
  clientFilterOperators,
  type ClientFilter,
  type ClientFilterOperator,
} from "@/lib/sales/client-filters";
import type {
  CreateSalesLeadInput,
  SalesDashboardData,
  SalesLead,
  SalesLeadPriority,
  SalesLeadSource,
  SalesLeadStatus,
  SalesLeadQuery,
  SalesPipeline,
} from "@/types/sales";

const statuses: SalesLeadStatus[] = [
  "NEW",
  "QUALIFIED",
  "CONTACTED",
  "REQUIREMENT",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];
const defaultSalesPipeline: SalesPipeline = {
  key: "Sales",
  name: "Sales",
  description: "",
  archived: false,
  revision: 0,
  stages: statuses.map((status, index) => ({
    key: status,
    name: status.charAt(0) + status.slice(1).toLowerCase(),
    status,
    probability: [10, 20, 30, 40, 60, 80, 100, 0][index],
    archived: false,
  })),
};
const sources: SalesLeadSource[] = [
  "WEBSITE",
  "REFERRAL",
  "GOOGLE",
  "LINKEDIN",
  "META",
  "INSTAGRAM",
  "EMAIL",
  "YOUTUBE",
  "COLD_CALLING",
  "OTHER",
];
const priorities: SalesLeadPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const emptyForm: CreateSalesLeadInput = {
  name: "",
  company: "",
  email: "",
  phone: "",
  source: "WEBSITE",
  priority: "MEDIUM",
  expectedValue: 0,
  serviceInterest: "",
  notes: "",
};
const money = (value: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);

export function SalesLeadsWorkspace({
  dashboard,
  customersOnly = false,
}: {
  dashboard: SalesDashboardData;
  customersOnly?: boolean;
}) {
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftProperty, setDraftProperty] = useState("");
  const [draftOperator, setDraftOperator] = useState<ClientFilterOperator>("contains");
  const [draftValue, setDraftValue] = useState("");
  const [filterError, setFilterError] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [leadDeletionTarget, setLeadDeletionTarget] = useState<string[] | null>(null);
  const [leadDeletionChallenge, setLeadDeletionChallenge] = useState<{ leadIds: string[]; email: string; count: number } | null>(null);
  const [leadDeletionOtp, setLeadDeletionOtp] = useState("");
  const [leadDeletionBusy, setLeadDeletionBusy] = useState(false);
  const [leadDeletionError, setLeadDeletionError] = useState("");
  const [leadDeletionNotice, setLeadDeletionNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [assigning, setAssigning] = useState<SalesLead | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CreateSalesLeadInput>(emptyForm);
  const [rupeeValue, setRupeeValue] = useState("");
  const [mode, setMode] = useState<"board" | "list" | "activities">(customersOnly ? "list" : "board");
  const [query, setQuery] = useState<SalesLeadQuery>({ page: 1, pageSize: 20, pipeline: customersOnly ? undefined : "Sales" });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<SalesLead | null>(null);
  const [initialStage, setInitialStage] = useState<string>();
  const [pipelines, setPipelines] = useState<SalesPipeline[]>([]);
  const [pipelineError, setPipelineError] = useState("");
  const [editingPipeline, setEditingPipeline] = useState<SalesPipeline | null>(null);
  const [accessPermissions, setAccessPermissions] = useState<string[] | null>(null);
  const permissions = accessPermissions ?? dashboard.permissions ?? [];
  const canEdit = permissions.includes("SALES_LEAD_UPDATE");
  const canCreate = permissions.includes("SALES_LEAD_CREATE");
  const canAssign = permissions.includes("SALES_LEAD_ASSIGN") && dashboard.scope !== "OWN";
  const canManagePipelines = dashboard.scope === "DEPARTMENT" && permissions.includes("SALES_DEAL_UPDATE");
  const activePipeline = pipelines.find((pipeline) => pipeline.key === query.pipeline);
  const stagesFor = (lead: SalesLead) => pipelines.find((pipeline) => pipeline.key === (lead.pipeline || "Sales"))?.stages ?? statuses.map((status) => ({ key: status, name: status, status, archived: false }));
  const refresh = () => setRevision((value) => value + 1);
  const filter = (updates: SalesLeadQuery) => { setSelectedLeadIds([]); setLoading(true); setQuery((current) => ({ ...current, ...updates, page: 1 })); };
  const open = (lead: SalesLead, stage?: string) => { setSelected(lead); setInitialStage(stage); };
  const chooseFilterProperty = (property: string) => {
    const existing = query.filters?.find((item) => item.property === property);
    setDraftProperty(property);
    setDraftOperator(existing?.operator ?? (clientFilterKind(property) === "number" ? "greater than" : clientFilterKind(property) === "date" ? "after" : clientFilterKind(property) === "boolean" ? "is" : "contains"));
    setDraftValue(existing?.value ?? (clientFilterKind(property) === "boolean" ? "Yes" : ""));
    setFilterError("");
  };
  const applyLeadFilter = () => {
    if (!draftProperty) {
      setFilterError("Choose a property to filter leads.");
      return;
    }
    if (!["is empty", "is not empty"].includes(draftOperator) && !draftValue.trim()) {
      setFilterError("Enter or choose a value for this filter.");
      return;
    }
    const nextFilter: ClientFilter = { property: draftProperty, operator: draftOperator, value: draftValue.trim() };
    filter({ filters: [...(query.filters ?? []).filter((item) => item.property !== nextFilter.property), nextFilter] });
    setFilterOpen(false);
    setFilterError("");
  };

  useEffect(() => {
    const controller = new AbortController();
    SalesService.pipelines(controller.signal).then((items) => { if (!controller.signal.aborted) { setPipelines(items); setPipelineError(""); } }).catch(() => { if (!controller.signal.aborted) { setPipelines((current) => current.length ? current : [defaultSalesPipeline]); setPipelineError("Pipeline settings could not be loaded. Using the default Sales pipeline; custom pipeline changes require the latest API deployment."); } });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    let active = true;
    SalesService.access()
      .then((access) => {
        if (active) setAccessPermissions(access.permissions);
      })
      .catch(() => {
        if (active) setAccessPermissions(null);
      });
    return () => { active = false; };
  }, []);

  const createPipeline = () => setEditingPipeline({
    key: crypto.randomUUID(), name: "", description: "", archived: false, revision: 0,
    stages: [
      { key: "NEW", name: "New lead", status: "NEW", probability: 10, archived: false },
      { key: "ASSIGNED", name: "Assigned", status: "NEW", probability: 10, archived: false },
      { key: "CONTACT_ATTEMPTED", name: "Contact attempted", status: "NEW", probability: 15, archived: false },
      { key: "CONTACTED", name: "Contacted", status: "CONTACTED", probability: 20, archived: false },
      { key: "QUALIFIED", name: "Qualified", status: "QUALIFIED", probability: 30, archived: false },
      { key: "DEMO_SCHEDULED", name: "Meeting / demo scheduled", status: "CONTACTED", probability: 40, archived: false },
      { key: "MEETING_COMPLETED", name: "Meeting completed", status: "REQUIREMENT", probability: 50, archived: false },
      { key: "PROPOSAL", name: "Proposal", status: "PROPOSAL", probability: 60, archived: false },
      { key: "NEGOTIATION", name: "Negotiation", status: "NEGOTIATION", probability: 80, archived: false },
      { key: "WON", name: "Closed won", status: "WON", probability: 100, archived: false },
      { key: "LOST", name: "Closed lost", status: "LOST", probability: 0, archived: false },
    ],
  });

  useEffect(() => {
    const controller = new AbortController();
    SalesService.leadsPage({ ...query, ...(mode === "activities" ? { activities: "PENDING" as const } : {}), ...(customersOnly ? { status: "WON" as const } : {}) }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) { setLeads(result.leads); setPagination(result.pagination); setError(""); }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Leads could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, revision, customersOnly, mode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await SalesService.createLead({
        ...form,
        expectedValue: Math.round((Number(rupeeValue) || 0) * 100),
      });
      setForm(emptyForm);
      setRupeeValue("");
      setFormOpen(false);
      refresh();
    } catch {
      setError("Lead creation failed. Check the fields and try again.");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (lead: SalesLead, stageId: string) => {
    if (stagesFor(lead).find((stage) => stage.key === stageId)?.status === "LOST") { open(lead, stageId); return; }
    setBusy(true);
    setError("");
    try {
      const updated = await SalesService.updateLead(lead._id, { stageId, status: stagesFor(lead).find((stage) => stage.key === stageId)?.status });
      setLeads((items) =>
        items.map((item) => (item._id === updated._id ? updated : item)),
      );
      refresh();
    } catch {
      setError("Lead status could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const assign = async (ownerId: string) => {
    if (!assigning) return;
    setBusy(true);
    setError("");
    try {
      const updated = await SalesService.assignLead(assigning._id, ownerId);
      setLeads((items) =>
        items.map((item) => (item._id === updated._id ? updated : item)),
      );
      setAssigning(null);
      refresh();
    } catch {
      setError(
        "Lead assignment failed. The selected user may be outside your team.",
      );
    } finally {
      setBusy(false);
    }
  };

  const beginLeadDeletion = (leadIds: string[]) => {
    if (!canEdit || leadIds.length === 0) return;
    setSelected(null);
    setSelectedLeadIds([]);
    setLeadDeletionTarget([...new Set(leadIds)]);
    setLeadDeletionChallenge(null);
    setLeadDeletionOtp("");
    setLeadDeletionError("");
    setLeadDeletionNotice("");
  };

  const closeLeadDeletion = () => {
    if (leadDeletionBusy) return;
    setLeadDeletionTarget(null);
    setLeadDeletionChallenge(null);
    setLeadDeletionOtp("");
    setLeadDeletionError("");
  };

  const requestLeadDeletionCode = async () => {
    if (!leadDeletionTarget?.length || leadDeletionBusy) return;
    setLeadDeletionBusy(true);
    setLeadDeletionError("");
    try {
      const response = await SalesService.requestLeadDeletionOtp(leadDeletionTarget, true);
      setLeadDeletionChallenge({ leadIds: leadDeletionTarget, email: response.email, count: response.leadCount });
      setLeadDeletionOtp("");
    } catch (caught) {
      setLeadDeletionError(caught instanceof Error ? caught.message : "A verification code could not be sent.");
    } finally {
      setLeadDeletionBusy(false);
    }
  };

  const completeLeadDeletion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leadDeletionChallenge || leadDeletionBusy) return;
    if (leadDeletionOtp.length !== 6) {
      setLeadDeletionError("Enter the 6-digit verification code sent to your email.");
      return;
    }
    setLeadDeletionBusy(true);
    setLeadDeletionError("");
    try {
      const response = await SalesService.deleteLeads(leadDeletionChallenge.leadIds, {
        deleteAll: true,
        otp: leadDeletionOtp,
      });
      const deletedIds = new Set(leadDeletionChallenge.leadIds);
      setLeads((current) => current.filter((lead) => !deletedIds.has(lead._id)));
      setSelectedLeadIds([]);
      setSelected(null);
      setQuery((current) => ({ ...current, page: 1 }));
      setLeadDeletionNotice(response.message);
      setLeadDeletionTarget(null);
      setLeadDeletionChallenge(null);
      setLeadDeletionOtp("");
      refresh();
    } catch (caught) {
      setLeadDeletionError(caught instanceof Error ? caught.message : "The selected Sales leads could not be deleted.");
    } finally {
      setLeadDeletionBusy(false);
    }
  };

  const team = dashboard.team.filter((member) => Boolean(member.user?._id));
  const pendingActivities = leads.flatMap((lead) => (lead.activities ?? []).filter((activity) => !activity.completedAt && activity.dueAt && activity.kind !== "STAGE").map((activity) => ({ lead, activity }))).sort((first, second) => new Date(first.activity.dueAt!).getTime() - new Date(second.activity.dueAt!).getTime());
  const customerClosedValue = leads.reduce((total, lead) => total + lead.expectedValue, 0);
  const customerOwners = new Set(leads.flatMap((lead) => lead.ownerId?._id ? [lead.ownerId._id] : [])).size;
  return (
    <>
      {mode !== "board" && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={<UserRoundCheck size={17} />} tone="blue" label={customersOnly ? "Matching Customers" : "Matching Leads"} value={pagination.total} />
        <Summary
          icon={customersOnly ? <CircleDollarSign size={17} /> : <BadgeCheck size={17} />}
          tone={customersOnly ? "green" : "violet"}
          label={customersOnly ? "Closed Value on Page" : "Qualified on Page"}
          value={customersOnly ? money(customerClosedValue) : leads.filter((lead) => !["NEW", "LOST"].includes(lead.status)).length}
        />
        <Summary
          icon={customersOnly ? <CalendarClock size={17} /> : <CircleDollarSign size={17} />}
          tone={customersOnly ? "amber" : "blue"}
          label={customersOnly ? "Scheduled Activities" : "Open Deals on Page"}
          value={customersOnly ? pendingActivities.length : leads.filter((lead) => !["WON", "LOST"].includes(lead.status)).length}
        />
        <Summary
          icon={<UsersRound size={17} />}
          tone="violet"
          label={customersOnly ? "Owners on Page" : "Scheduled Activities on Page"}
          value={customersOnly ? customerOwners : pendingActivities.length}
        />
      </div>}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${customersOnly ? "rounded-xl border border-[#dce4ef] bg-white p-3 shadow-sm" : "border-b border-(--brand-border) pb-3"}`}>
        <select aria-label="Pipeline" value={query.pipeline || ""} onChange={(event) => filter({ pipeline: event.target.value || undefined, stageId: undefined })} className="max-w-full rounded-lg border border-(--brand-border) bg-(--input-background) px-3 py-2 text-sm font-semibold text-(--brand-text) focus:border-[#0d3fa3] focus:outline-none focus:ring-2 focus:ring-[#0d3fa3]/10"><option value="">All pipelines</option>{pipelines.map((pipeline) => <option key={pipeline.key} value={pipeline.key}>{pipeline.name}{pipeline.archived ? " (archived)" : ""}</option>)}</select>
        {canManagePipelines && <div className="flex gap-2"><button onClick={createPipeline} className="inline-flex items-center gap-2 rounded-lg border border-(--brand-border) bg-(--brand-surface) px-3 py-2 text-xs font-semibold text-(--brand-text-secondary) transition hover:bg-(--brand-surface-hover)"><Plus size={15} />New pipeline</button><button disabled={!activePipeline} onClick={() => { if (activePipeline) setEditingPipeline(activePipeline); }} title="Pipeline settings" aria-label="Pipeline settings" className="rounded-lg border border-(--brand-border) bg-(--brand-surface) p-2 text-(--brand-text-secondary) transition hover:bg-(--brand-surface-hover) disabled:opacity-40"><Settings2 size={17} /></button></div>}
      </div>
      {pipelineError && <p role="alert" className="rounded-lg border border-(--status-danger-border) bg-(--status-danger-bg) p-3 text-sm text-(--status-danger)">{pipelineError}</p>}
      <section className={`min-w-0 overflow-hidden border border-(--brand-border) bg-white ${customersOnly ? "rounded-2xl shadow-[0_8px_28px_rgba(23,35,58,0.06)]" : "rounded-xl shadow-(--shadow-sm)"}`}>
        <div className={`flex flex-col gap-3 border-b border-(--brand-border) p-4 md:flex-row md:items-center md:justify-between ${customersOnly ? "bg-gradient-to-r from-white to-[#f8faff]" : ""}`}>
          <form
            className="flex w-full max-w-md gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              filter({ search });
            }}
          >
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-(--brand-border) bg-white px-3 transition focus-within:border-[#0d3fa3] focus-within:ring-2 focus-within:ring-[#0d3fa3]/10">
              <Search size={15} className="text-(--brand-text-muted)" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full bg-transparent text-sm text-(--brand-text) outline-none placeholder:text-[#8793a5]"
                placeholder="Search name, company, phone or email"
              />
            </label>
            <button
              type="submit"
              aria-label="Apply search"
              className="rounded-lg border border-(--brand-border) bg-(--brand-surface) px-3 text-(--brand-text-secondary) transition hover:border-[#c5d2e4] hover:bg-(--brand-surface-hover) focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d3fa3]"
            >
              <SlidersHorizontal size={15} />
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
          <button type="button" aria-expanded={filterOpen} onClick={() => { setFilterOpen((open) => !open); setFilterError(""); }} className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${query.filters?.length ? "border-blue-200 bg-blue-50 text-blue-800" : "border-(--brand-border) bg-white text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)"}`}>
            <Filter size={15} />Filters{query.filters?.length ? ` (${query.filters.length})` : ""}
          </button>
          {canEdit && mode === "list" && selectedLeadIds.length > 0 && <button type="button" onClick={() => beginLeadDeletion(selectedLeadIds)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100">
            <Trash2 size={15} />Delete selected ({selectedLeadIds.length})
          </button>}
          <div className="flex rounded-lg border border-(--brand-border) bg-(--brand-surface)" role="group" aria-label="CRM view">
            {([{ value: "board", label: "Pipeline board", Icon: Columns3 }, { value: "list", label: "Lead list", Icon: List }, { value: "activities", label: "Scheduled activities", Icon: CalendarClock }] as const).map(({ value, label, Icon }) => <button key={value} title={label} aria-label={label} aria-pressed={mode === value} onClick={() => { setMode(value); filter({}); }} className={`rounded-md p-2.5 transition ${mode === value ? "bg-(--brand-red-pale) text-(--brand-red)" : "text-(--brand-text-muted) hover:text-(--brand-text)"}`}><Icon size={17} /></button>)}
          </div>
          {canCreate && !customersOnly && <button
            disabled={!pipelines.some((pipeline) => !pipeline.archived)}
            onClick={() => { setForm({ ...emptyForm, pipeline: activePipeline && !activePipeline.archived ? activePipeline.key : pipelines.find((pipeline) => !pipeline.archived)?.key }); setFormOpen(true); }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-(--brand-red) px-4 text-sm font-semibold text-white transition hover:bg-(--brand-red-hover)"
          >
            <Plus size={15} /> Add Lead
          </button>}
          </div>
        </div>
        {filterOpen ? (
          <form onSubmit={(event) => { event.preventDefault(); applyLeadFilter(); }} className="grid gap-3 border-b border-(--brand-border) bg-[#f8faff] p-4 sm:grid-cols-[minmax(180px,1fr)_minmax(150px,0.8fr)_minmax(180px,1fr)_auto] sm:items-end">
            <label className="block text-xs font-semibold text-(--brand-text-secondary)">
              Choose a Property
              <span className="mt-1.5 block">
                <SearchableDropdown
                  name="salesLeadFilterProperty"
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
                  <select value={draftOperator} onChange={(event) => setDraftOperator(event.target.value as ClientFilterOperator)} className="mt-1.5 h-10 w-full rounded-lg border border-(--brand-border) bg-white px-3 text-sm text-(--brand-text) outline-none focus:border-[#0d3fa3] focus:ring-2 focus:ring-[#0d3fa3]/10">
                    {clientFilterOperators(draftProperty).map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                  </select>
                </label>
                {!["is empty", "is not empty"].includes(draftOperator) ? (
                  <label className="block text-xs font-semibold text-(--brand-text-secondary)">
                    Value
                    {clientFilterKind(draftProperty) === "boolean" ? (
                      <select value={draftValue} onChange={(event) => setDraftValue(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-(--brand-border) bg-white px-3 text-sm text-(--brand-text)">
                        <option value="Yes">Yes</option><option value="No">No</option>
                      </select>
                    ) : (
                      <input required type={clientFilterKind(draftProperty) === "number" ? "number" : clientFilterKind(draftProperty) === "date" ? "date" : "text"} step={clientFilterKind(draftProperty) === "number" ? "any" : undefined} min={draftProperty === "Pipeline Amount" ? 0 : undefined} value={draftValue} onChange={(event) => setDraftValue(event.target.value)} placeholder={draftProperty === "Pipeline Amount" ? "Enter amount in major units" : clientFilterKind(draftProperty) === "date" ? "Choose date" : "Enter a value"} className="mt-1.5 h-10 w-full rounded-lg border border-(--brand-border) bg-white px-3 text-sm text-(--brand-text) outline-none focus:border-[#0d3fa3] focus:ring-2 focus:ring-[#0d3fa3]/10" />
                    )}
                  </label>
                ) : <div />}
              </>
            ) : <p className="rounded-lg bg-white px-3 py-2 text-xs text-(--brand-text-secondary) sm:col-span-2">Choose a property to set its filter condition and value.</p>}
            <div className="flex items-center gap-2 sm:justify-end">
              <button type="button" onClick={() => setFilterOpen(false)} className="h-10 rounded-lg border border-(--brand-border) bg-white px-3 text-xs font-semibold text-(--brand-text-secondary)">Close</button>
              <button type="submit" disabled={!draftProperty || (!["is empty", "is not empty"].includes(draftOperator) && !draftValue.trim())} className="h-10 rounded-lg bg-(--brand-navy) px-3 text-xs font-semibold text-white hover:bg-(--brand-red) disabled:opacity-50">Apply Filter</button>
            </div>
            {filterError ? <p role="alert" className="text-xs text-red-700 sm:col-span-full">{filterError}</p> : null}
          </form>
        ) : null}
        {query.filters?.length ? <div className="flex flex-wrap items-center gap-2 border-b border-(--brand-border) px-4 py-2.5">
          {query.filters.map((item) => <span key={item.property} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] text-blue-900">
            <span className="font-semibold">{item.property}</span> {item.operator}{item.value ? ` “${item.value}”` : ""}
            <button type="button" aria-label={`Remove ${item.property} filter`} onClick={() => filter({ filters: query.filters?.filter((current) => current.property !== item.property) })} className="ml-1 rounded-full p-0.5 hover:bg-blue-100"><X size={11} /></button>
          </span>)}
          <button type="button" onClick={() => filter({ filters: [] })} className="text-[10px] font-semibold text-slate-600 underline underline-offset-2">Clear all</button>
          <span className="ml-auto text-[10px] text-slate-500">Applied to all matching CRM records</span>
        </div> : null}
        <div className={`flex flex-wrap gap-2 border-b border-(--brand-border) px-4 py-3 text-xs [&>select]:min-w-0 [&>select]:rounded-lg [&>select]:border [&>select]:border-(--brand-border) [&>select]:bg-(--input-background) [&>select]:px-3 [&>select]:py-2 [&>select]:text-(--brand-text-secondary) [&>select]:transition [&>select]:focus:border-[#0d3fa3] [&>select]:focus:outline-none ${customersOnly ? "bg-[#fbfcfe]" : ""}`}>
          {!customersOnly && <select aria-label="Filter stage" value={query.status || ""} onChange={(event) => filter({ status: (event.target.value || undefined) as SalesLeadStatus | undefined })}><option value="">All stages</option>{statuses.map((stage) => <option key={stage}>{stage}</option>)}</select>}
          {activePipeline && <select aria-label="Filter pipeline stage" value={query.stageId || ""} onChange={(event) => filter({ stageId: event.target.value || undefined })}><option value="">All pipeline stages</option>{activePipeline.stages.map((stage) => <option key={stage.key} value={stage.key}>{stage.name}</option>)}</select>}
          {dashboard.scope !== "OWN" && <select aria-label="Filter owner" value={query.ownerId || ""} onChange={(event) => filter({ ownerId: event.target.value || undefined })}><option value="">All owners</option>{team.map((member) => <option key={member.user._id} value={member.user._id}>{member.user.name}</option>)}</select>}
          <select aria-label="Filter follow-up" value={query.followUp || ""} onChange={(event) => filter({ followUp: (event.target.value || undefined) as SalesLeadQuery["followUp"] })}><option value="">All follow-ups</option><option value="OVERDUE">Overdue follow-ups</option><option value="SCHEDULED">Scheduled follow-ups</option></select>
        </div>
        {error ? (
          <p
            role="alert"
            className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
          >
            {error}
          </p>
        ) : null}
        {mode === "board" && (activePipeline ? <SalesPipelineBoard key={`${activePipeline.key}-${JSON.stringify(query)}-${revision}`} pipeline={activePipeline} query={{ ...query, ...(customersOnly ? { status: "WON" } : {}) }} revision={revision} canEdit={canEdit} onOpen={open} onAssign={canAssign ? setAssigning : undefined} onChanged={refresh} /> : <p className="p-8 text-center text-sm text-[#60718d]">{pipelines.length ? "Select a pipeline" : "Loading pipelines..."}</p>)}
        {mode === "activities" && !loading && <div className="divide-y divide-[#e1e8f1] px-4">{pendingActivities.map(({ lead, activity }) => <button key={activity._id} onClick={() => open(lead)} className="flex w-full flex-wrap items-center justify-between gap-2 py-4 text-left text-xs"><span className="min-w-0"><strong className="text-[#0d3fa3]">{lead.name}</strong><span className="mt-1 block break-words">{activity.kind.replace("_", " ")}: {activity.text}</span></span><span className="text-amber-700">{new Date(activity.dueAt!).toLocaleString("en-IN")}</span></button>)}{!pendingActivities.length && <p className="py-10 text-center text-sm text-[#60718d]">No scheduled activities on this page.</p>}</div>}
        <div className={mode === "list" ? "overflow-x-auto" : "hidden"}>
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className={`${customersOnly ? "bg-[#f6f8fc] text-[10px] uppercase tracking-[0.04em]" : "bg-[#f7f9fc]"} text-[#60718d]`}>
              <tr>
                <Th>{canEdit && <input type="checkbox" aria-label="Select all leads on this page" checked={leads.length > 0 && selectedLeadIds.length === leads.length} onChange={(event) => setSelectedLeadIds(event.target.checked ? leads.map((lead) => lead._id) : [])} disabled={loading || !leads.length} className="h-4 w-4 accent-[#0d3fa3]" />}</Th>
                <Th>{customersOnly ? "Customer" : "Lead"}</Th>
                <Th>Contact</Th>
                <Th>Owner</Th>
                <Th>{customersOnly ? "Status" : "Stage"}</Th>
                <Th>Priority</Th>
                <Th>{customersOnly ? "Closed Value" : "Expected Value"}</Th>
                <Th>Follow-up</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8edf4] [&>tr]:transition-colors [&>tr:hover]:bg-[#f9fbff]">
              {leads.map((lead) => (
                <tr key={lead._id}>
                  <Td className="w-10">{canEdit && <input type="checkbox" aria-label={`Select ${lead.name}`} checked={selectedLeadIds.includes(lead._id)} onChange={(event) => setSelectedLeadIds((current) => event.target.checked ? [...current, lead._id] : current.filter((id) => id !== lead._id))} className="h-4 w-4 accent-[#0d3fa3]" />}</Td>
                  <Td>
                    <div className="flex min-w-[150px] items-center gap-3">
                      {customersOnly && <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#dce7fa] bg-[#eff4ff] text-xs font-extrabold text-[#1645a2]">{lead.name.trim().charAt(0).toUpperCase() || "C"}</span>}
                      <div className="min-w-0">
                        <button onClick={() => open(lead)} className="max-w-full truncate text-left font-bold text-[#183b78] hover:text-[#0d3fa3] hover:underline">{lead.name}</button>
                        <p className="mt-1 truncate text-[10px] text-[#7183a0]">{lead.company || (customersOnly ? "Customer account" : lead.source)}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <p className="font-semibold text-[#344054]">{lead.phone || "No phone"}</p>
                    <p className="mt-1 text-[10px] text-[#7183a0]">
                      {lead.email || "No email"}
                    </p>
                  </Td>
                  <Td><span className="inline-flex max-w-[150px] items-center truncate rounded-full bg-[#f3f5f8] px-2.5 py-1 text-[11px] font-medium text-[#475467]">{lead.ownerId?.name ?? "Unassigned"}</span></Td>
                  <Td>
                    <select
                      aria-label={`Stage for ${lead.name}`}
                      disabled={busy || !canEdit}
                      value={lead.stageId ?? lead.status}
                      onChange={(event) =>
                        void updateStatus(
                          lead,
                          event.target.value,
                        )
                      }
                      className="rounded-lg border border-[#d5dfec] bg-[#f8faff] px-2.5 py-1.5 font-bold text-[#0d3fa3] outline-none transition focus:border-[#0d3fa3] focus:ring-2 focus:ring-[#0d3fa3]/10 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {stagesFor(lead).map((stage) => (
                        <option key={stage.key} value={stage.key} disabled={stage.archived}>{stage.name}</option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${lead.priority === "URGENT" || lead.priority === "HIGH" ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-100" : lead.priority === "LOW" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100"}`}
                    >
                      {lead.priority}
                    </span>
                  </Td>
                  <Td className="font-bold">{money(lead.expectedValue, lead.currency)}</Td>
                  <Td>{lead.nextFollowUpAt ? <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-2.5 py-1 text-[11px] font-semibold text-[#1d4ed8]">{new Date(lead.nextFollowUpAt).toLocaleDateString("en-IN")}</span> : <span className="text-[#98a2b3]">Not scheduled</span>}</Td>
                  <Td><div className="flex flex-wrap gap-2">
                    {canAssign ? (
                      <button
                        onClick={() => setAssigning(lead)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c7d7f4] bg-white px-3 py-2 font-bold text-[#1645a2] shadow-sm transition hover:border-[#1645a2] hover:bg-[#f5f8ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d3fa3]"
                      >
                        <UserRoundCheck size={13} /> Assign
                      </button>
                    ) : customersOnly ? (
                      <button
                        onClick={() => open(lead)}
                        aria-label={`View ${lead.name}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce4ef] bg-white px-3 py-2 font-bold text-[#475467] transition hover:border-[#c7d7f4] hover:bg-[#f5f8ff] hover:text-[#1645a2]"
                      >
                        <Eye size={13} /> View
                      </button>
                    ) : null}
                    {canEdit && <button type="button" onClick={() => beginLeadDeletion([lead._id])} aria-label={`Delete ${lead.name}`} title="Permanently delete lead" className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-2 font-bold text-red-700 transition hover:bg-red-50">
                      <Trash2 size={13} />Delete
                    </button>}
                    {!canAssign && !customersOnly && !canEdit ? "-" : null}
                  </div></Td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? (
            <p className="p-8 text-center text-sm text-[#60718d]">
              Loading leads...
            </p>
          ) : !leads.length ? (
            <p className="p-10 text-center text-sm text-[#60718d]">
              {customersOnly ? "No customers match these filters. Try adjusting your search or filters." : "No leads in your Sales scope. Add the first lead to begin."}
            </p>
          ) : null}
        </div>
        {loading && mode === "activities" && <p role="status" className="p-8 text-center text-sm text-[#60718d]">Loading records...</p>}
        {mode !== "board" && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e8f1] p-4 text-xs text-[#60718d]">
          <span>{pagination.total} matching {customersOnly ? "customers" : "records"} · Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {leads.length} on this page</span>
          <div className="flex gap-2"><button disabled={loading || pagination.page <= 1} aria-label="Previous page" title="Previous page" onClick={() => { setSelectedLeadIds([]); setLoading(true); setQuery((current) => ({ ...current, page: pagination.page - 1 })); }} className="rounded border p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><button disabled={loading || pagination.page >= pagination.totalPages} aria-label="Next page" title="Next page" onClick={() => { setSelectedLeadIds([]); setLoading(true); setQuery((current) => ({ ...current, page: pagination.page + 1 })); }} className="rounded border p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div>
        </footer>}
      </section>
      {selected && <SalesLeadDetail key={selected._id} lead={selected} pipelines={pipelines} initialStage={initialStage} canEdit={canEdit} canDelete={canEdit} canLog={permissions.includes("SALES_ACTIVITY_CREATE")} onDelete={() => beginLeadDeletion([selected._id])} onClose={() => setSelected(null)} onUpdated={(updated) => { setSelected(updated); refresh(); }} />}
      {editingPipeline && <SalesPipelineSettings key={editingPipeline.key} pipeline={editingPipeline} onClose={() => setEditingPipeline(null)} onSaved={(pipeline) => { setEditingPipeline(null); setPipelines((current) => [...current.filter((item) => item.key !== pipeline.key), pipeline]); filter({ pipeline: pipeline.key, stageId: undefined }); refresh(); }} />}
      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#081f47]/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-lead-title"
        >
          <form
            onSubmit={submit}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 id="add-lead-title" className="text-lg font-extrabold">
                  Add Lead
                </h2>
                <p className="mt-1 text-xs text-[#60718d]">
                  Create and place a lead in your authorized Sales scope.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setFormOpen(false)}
                className="rounded-md border border-[#d5dfec] p-2"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Pipeline"><select required value={form.pipeline ?? "Sales"} onChange={(event) => setForm({ ...form, pipeline: event.target.value, stageId: undefined })}>{pipelines.filter((pipeline) => !pipeline.archived).map((pipeline) => <option key={pipeline.key} value={pipeline.key}>{pipeline.name}</option>)}</select></Field>
              <Field label="Initial stage"><select value={form.stageId ?? ""} onChange={(event) => setForm({ ...form, stageId: event.target.value || undefined })}><option value="">First open stage</option>{pipelines.find((pipeline) => pipeline.key === form.pipeline)?.stages.filter((stage) => !stage.archived && !["WON", "LOST"].includes(stage.status)).map((stage) => <option key={stage.key} value={stage.key}>{stage.name}</option>)}</select></Field>
              {pipelines.find((pipeline) => pipeline.key === form.pipeline)?.stages.find((stage) => stage.key === form.stageId)?.status === "QUALIFIED" && (["need", "budget", "authority", "timeline"] as const).map((key) => <Field key={key} label={`Qualification: ${key}`}><input required maxLength={1000} value={form.qualification?.[key] ?? ""} onChange={(event) => setForm({ ...form, qualification: { need: "", budget: "", authority: "", timeline: "", ...form.qualification, [key]: event.target.value } })} /></Field>)}
              {form.stageId === "MEETING_COMPLETED" && <Field label="Meeting requirements and objections"><textarea required maxLength={2000} value={form.meetingNotes ?? ""} onChange={(event) => setForm({ ...form, meetingNotes: event.target.value })} /></Field>}
              <Field label="Owner"><select value={form.ownerId || ""} onChange={(event) => setForm({ ...form, ownerId: event.target.value || undefined })}><option value="">Me</option>{dashboard.scope !== "OWN" && team.map((member) => <option key={member.user._id} value={member.user._id}>{member.user.name} ({member.level})</option>)}</select></Field>
              <Field label="Lead name *">
                <input
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </Field>
              <Field label="Phone *">
                <input
                  required
                  minLength={7}
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
              </Field>
              <Field label="Company">
                <input
                  value={form.company}
                  onChange={(event) =>
                    setForm({ ...form, company: event.target.value })
                  }
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </Field>
              <Field label="Service interest">
                <input
                  value={form.serviceInterest}
                  onChange={(event) =>
                    setForm({ ...form, serviceInterest: event.target.value })
                  }
                />
              </Field>
              <Field label="Expected value (INR)">
                <input
                  min="0"
                  type="number"
                  value={rupeeValue}
                  onChange={(event) => setRupeeValue(event.target.value)}
                />
              </Field>
              <Field label="Lead source">
                <select
                  value={form.source}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      source: event.target.value as SalesLeadSource,
                    })
                  }
                >
                  {sources.map((source) => (
                    <option key={source}>{source}</option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      priority: event.target.value as SalesLeadPriority,
                    })
                  }
                >
                  {priorities.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </Field>
            </div>
            {error && <p role="alert" className="mt-4 text-xs text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-md border border-[#d5dfec] px-4 py-2 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="rounded-md bg-[#0d3fa3] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy ? "Creating..." : "Create Lead"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {assigning ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#081f47]/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-lead-title"
        >
          <section className="w-full max-w-md rounded-lg bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="assign-lead-title" className="text-lg font-extrabold">
                  Assign Lead
                </h2>
                <p className="mt-1 text-xs text-[#60718d]">{assigning.name}</p>
              </div>
              <button
                aria-label="Close"
                onClick={() => setAssigning(null)}
                className="rounded-md border border-[#d5dfec] p-2"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 divide-y divide-[#e1e8f1]">
              {team.map((member) => (
                <button
                  disabled={busy}
                  key={member.user._id}
                  onClick={() => void assign(member.user._id)}
                  className="flex w-full items-center justify-between py-3 text-left disabled:opacity-50"
                >
                  <div>
                    <p className="text-sm font-bold">{member.user.name}</p>
                    <p className="mt-1 text-[10px] text-[#7183a0]">
                      {member.designation?.replace("SALES_", "") || member.level} ·{" "}
                      {member.employmentType === "INTERN"
                        ? "Intern"
                        : "Employee"}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#0d3fa3]">
                    {member.activeTasks} active
                  </span>
                </button>
              ))}
              {!team.length ? (
                <p className="py-8 text-center text-sm text-[#60718d]">
                  No direct Sales team members are available.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
      {leadDeletionTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#081f47]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-sales-leads-title">
          <form
            onSubmit={(event) => {
              if (leadDeletionChallenge) void completeLeadDeletion(event);
              else { event.preventDefault(); void requestLeadDeletionCode(); }
            }}
            className="w-full max-w-lg rounded-xl border border-red-100 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="delete-sales-leads-title" className="text-lg font-extrabold text-[#8f1d1d]">Permanently delete {leadDeletionTarget.length} Sales lead{leadDeletionTarget.length === 1 ? "" : "s"}?</h2>
                <p className="mt-2 text-sm leading-6 text-[#475467]">
                  This removes the selected records from CRM and the Sales pipeline. Linked accountability tasks will remain, but their links to these leads will be removed. This action cannot be undone.
                </p>
              </div>
              <button type="button" aria-label="Close deletion dialog" disabled={leadDeletionBusy} onClick={closeLeadDeletion} className="rounded-md border border-(--brand-border) p-2 text-(--brand-text-secondary) disabled:opacity-50"><X size={16} /></button>
            </div>
            {leadDeletionChallenge ? (
              <div className="mt-4 space-y-3">
                <p className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><KeyRound size={14} />A 6-digit verification code was sent to {leadDeletionChallenge.email}.</p>
                <label className="block text-xs font-semibold text-(--brand-text-secondary)">Verification code
                  <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={leadDeletionOtp} onChange={(event) => setLeadDeletionOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1.5 h-11 w-full rounded-lg border border-(--brand-border) px-3 text-sm tracking-[0.25em] outline-none focus:border-[#0d3fa3] focus:ring-2 focus:ring-[#0d3fa3]/10" />
                </label>
              </div>
            ) : <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">Email verification is required for every CRM lead deletion. The code will be bound to this exact selection.</p>}
            {leadDeletionError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{leadDeletionError}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {leadDeletionChallenge && <button type="button" disabled={leadDeletionBusy} onClick={() => void requestLeadDeletionCode()} className="mr-auto h-10 rounded-lg border border-(--brand-border) px-3 text-xs font-semibold text-(--brand-text-secondary) disabled:opacity-50">Send a new code</button>}
              <button type="button" disabled={leadDeletionBusy} onClick={closeLeadDeletion} className="h-10 rounded-lg border border-(--brand-border) px-4 text-xs font-semibold text-(--brand-text-secondary) disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={leadDeletionBusy || Boolean(leadDeletionChallenge && leadDeletionOtp.length !== 6)} className="h-10 rounded-lg bg-red-700 px-4 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                {leadDeletionBusy ? "Working..." : leadDeletionChallenge ? "Verify and delete" : "Send verification code"}
              </button>
            </div>
          </form>
        </div>
      )}
      {leadDeletionNotice && <div role="status" className="fixed bottom-6 right-6 z-[70] flex max-w-lg items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg"><span>{leadDeletionNotice}</span><button type="button" aria-label="Dismiss deletion notice" onClick={() => setLeadDeletionNotice("")} className="rounded p-0.5 hover:bg-emerald-100"><X size={15} /></button></div>}
    </>
  );
}

function Summary({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: "blue" | "green" | "violet" | "amber" }) {
  const toneClasses = {
    blue: "border-[#dce7fa] bg-[#eff4ff] text-[#1645a2]",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    violet: "border-violet-100 bg-violet-50 text-violet-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  };
  return (
    <section className="group rounded-xl border border-[#dfe6f0] bg-gradient-to-br from-white to-[#fafcff] p-4 shadow-[0_2px_8px_rgba(23,35,58,0.035)] transition hover:-translate-y-0.5 hover:border-[#cbd8eb] hover:shadow-[0_8px_20px_rgba(23,35,58,0.07)]">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${toneClasses[tone]}`}>{icon}</span>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.045em] text-[#60718d]">
          {label}
        </p>
      </div>
      <p className="mt-3 text-[22px] font-extrabold leading-none tracking-[-0.035em] text-[#17233a] tabular-nums">{value}</p>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ className?: string }>;
}) {
  return (
    <label className="text-xs font-bold text-[#17233a]">
      {label}
      {children && (
        <span className="mt-2 block [&>*]:h-10 [&>*]:w-full [&>*]:rounded-md [&>*]:border [&>*]:border-[#d5dfec] [&>*]:bg-white [&>*]:px-3 [&>*]:text-xs [&>*]:outline-none [&>*]:focus:border-[#0d3fa3]">
          {children}
        </span>
      )}
    </label>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-bold">{children}</th>;
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
