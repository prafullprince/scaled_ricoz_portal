"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CalendarClock, Check, Clock3, MessageCircle, Phone, Plus, RotateCcw, X } from "lucide-react";
import { SalesService } from "@/services/sales.service";
import type { SalesActivity, SalesLead, SalesLeadPage } from "@/types/sales";

type FollowUpRecord = {
  id: string;
  lead: SalesLead;
  activity: SalesActivity | null;
  dueAt: string;
  nextAction: string;
};

const dateInputValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const isClosed = (lead: SalesLead) => lead.status === "WON" || lead.status === "LOST";
const dateLabel = (value: string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

async function loadLeads(signal: AbortSignal) {
  const first = await SalesService.leadsPage({ page: 1, pageSize: 50 }, signal);
  const leads: SalesLeadPage["leads"] = [...first.leads];
  for (let page = 2; page <= first.pagination.totalPages; page++) {
    const result = await SalesService.leadsPage({ page, pageSize: 50 }, signal);
    leads.push(...result.leads);
  }
  return leads;
}

function followUpsFromLeads(leads: SalesLead[]): FollowUpRecord[] {
  return leads.flatMap((lead) => {
    if (isClosed(lead)) return [];
    const scheduled = (lead.activities ?? []).filter((activity) =>
      activity.kind !== "STAGE" && !activity.completedAt && activity.dueAt,
    );
    const records: FollowUpRecord[] = scheduled.map((activity) => ({
      id: `${lead._id}:${activity._id}`,
      lead,
      activity,
      dueAt: activity.dueAt!,
      nextAction: activity.text,
    }));

    const hasExplicitLegacyFollowUp = (lead.activities ?? []).some((activity) =>
      activity.kind === "FOLLOW_UP" && activity.dueAt === lead.nextFollowUpAt,
    );
    if (lead.nextFollowUpAt && !hasExplicitLegacyFollowUp) {
      records.push({
        id: `${lead._id}:next-follow-up`,
        lead,
        activity: null,
        dueAt: lead.nextFollowUpAt,
        nextAction: `Follow up with ${lead.name}`,
      });
    }
    return records;
  }).sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime());
}

function lastContact(lead: SalesLead, now: number) {
  const latest = (lead.activities ?? [])
    .filter((activity) => ["CALL", "EMAIL", "MEETING"].includes(activity.kind))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  if (!latest) return "No contact logged";
  const days = Math.floor((now - new Date(latest.createdAt).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function dueToday(value: string, now: number) {
  const due = new Date(value);
  const today = new Date(now);
  return due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate();
}

function priorityStyle(priority: SalesLead["priority"]) {
  if (priority === "URGENT" || priority === "HIGH") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-(--brand-border) bg-(--brand-surface-hover) text-(--brand-text-secondary)";
}

function snoozeDate(record: FollowUpRecord, choice: "hour" | "tomorrow" | "week") {
  const date = new Date(Math.max(Date.now(), new Date(record.dueAt).getTime()));
  if (choice === "hour") date.setHours(date.getHours() + 1);
  if (choice === "tomorrow") date.setDate(date.getDate() + 1);
  if (choice === "week") date.setDate(date.getDate() + 7);
  return date.toISOString();
}

export function SalesFollowUpsWorkspace() {
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [snoozeMenu, setSnoozeMenu] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newDueAt, setNewDueAt] = useState(() => dateInputValue(new Date(Date.now() + 86_400_000)));

  useEffect(() => {
    const abort = new AbortController();
    void loadLeads(abort.signal).then((result) => {
      if (abort.signal.aborted) return;
      setLeads(result);
      setNow(Date.now());
      setError("");
    }).catch((caught: unknown) => {
      if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : "Sales follow-ups could not be loaded.");
    }).finally(() => {
      if (!abort.signal.aborted) setLoading(false);
    });
    return () => abort.abort();
  }, [revision]);

  const records = useMemo(() => followUpsFromLeads(leads), [leads]);
  const todayCount = records.filter((record) => dueToday(record.dueAt, now)).length;
  const overdueCount = records.filter((record) => new Date(record.dueAt).getTime() < now).length;
  const highPriorityCount = records.filter((record) => record.lead.priority === "HIGH" || record.lead.priority === "URGENT").length;

  function refresh() {
    setLoading(true);
    setRevision((value) => value + 1);
  }

  async function complete(record: FollowUpRecord) {
    setBusyId(record.id);
    setError("");
    try {
      if (record.activity) await SalesService.completeActivity(record.lead._id, record.activity._id);
      else await SalesService.updateLead(record.lead._id, { nextFollowUpAt: null });
      refresh();
    } catch {
      setError("This follow-up could not be completed. Refresh and try again.");
    } finally {
      setBusyId("");
    }
  }

  async function snooze(record: FollowUpRecord, choice: "hour" | "tomorrow" | "week") {
    setBusyId(record.id);
    setError("");
    try {
      const dueAt = snoozeDate(record, choice);
      if (record.activity) await SalesService.rescheduleActivity(record.lead._id, record.activity._id, dueAt);
      else await SalesService.updateLead(record.lead._id, { nextFollowUpAt: dueAt });
      setSnoozeMenu("");
      refresh();
    } catch {
      setError("This follow-up could not be rescheduled. Refresh and try again.");
    } finally {
      setBusyId("");
    }
  }

  async function addFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const leadId = String(values.get("leadId") ?? "");
    const text = String(values.get("nextAction") ?? "").trim();
    if (!leadId || !text || !newDueAt) return;
    setBusyId("new");
    setError("");
    try {
      await SalesService.addActivity(leadId, { kind: "FOLLOW_UP", text, dueAt: new Date(newDueAt).toISOString() });
      setShowForm(false);
      setNewDueAt(dateInputValue(new Date(Date.now() + 86_400_000)));
      refresh();
    } catch {
      setError("The follow-up could not be saved. Check your access and try again.");
    } finally {
      setBusyId("");
    }
  }

  return <section className="space-y-5">
    <header className="flex flex-col gap-3 rounded-2xl border border-(--brand-border) bg-(--brand-surface) p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold text-(--brand-text-secondary)">CRM &amp; Sales Operations</p>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-(--brand-text)">Follow-ups</h2>
        <p className="mt-1 text-sm text-(--brand-text-secondary)">Customer acquisition · Lead management · Revenue pipeline</p>
      </div>
      <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-full bg-[#0d3fa3] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#103783] sm:self-auto">
        {showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? "Close" : "Add Follow-up"}
      </button>
    </header>

    {showForm && <form onSubmit={(event) => void addFollowUp(event)} className="grid gap-3 rounded-2xl border border-[#dce4ef] bg-white p-4 shadow-sm md:grid-cols-[1fr_1.4fr_220px_auto] md:items-end">
      <label className="grid gap-1 text-xs font-semibold text-(--brand-text-secondary)">Lead
        <select name="leadId" required defaultValue="" className="h-10 min-w-0 rounded-lg border border-(--brand-border) bg-(--input-background) px-3 text-sm text-(--brand-text)">
          <option value="" disabled>Select a lead</option>
          {leads.filter((lead) => !isClosed(lead)).map((lead) => <option key={lead._id} value={lead._id}>{lead.name}{lead.company ? ` · ${lead.company}` : ""}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-(--brand-text-secondary)">Next action
        <input name="nextAction" required maxLength={4000} placeholder="Call to confirm site visit time" className="h-10 min-w-0 rounded-lg border border-(--brand-border) bg-(--input-background) px-3 text-sm font-normal text-(--brand-text) outline-none focus:border-[#0d3fa3] focus:ring-2 focus:ring-blue-100" />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-(--brand-text-secondary)">Reminder
        <input required type="datetime-local" value={newDueAt} onChange={(event) => setNewDueAt(event.target.value)} className="h-10 min-w-0 rounded-lg border border-(--brand-border) bg-(--input-background) px-3 text-sm font-normal text-(--brand-text) outline-none focus:border-[#0d3fa3] focus:ring-2 focus:ring-blue-100" />
      </label>
      <button type="submit" disabled={busyId === "new" || leads.every(isClosed)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0d3fa3] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15} />Save</button>
    </form>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary icon={<Clock3 size={17} />} tone="blue" label="Today" value={todayCount} />
      <Summary icon={<AlertCircle size={17} />} tone="red" label="Overdue" value={overdueCount} />
      <Summary icon={<CalendarClock size={17} />} tone="amber" label="High Priority" value={highPriorityCount} />
      <Summary icon={<RotateCcw size={17} />} tone="slate" label="Total Pending" value={records.length} />
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <section className="overflow-visible rounded-2xl border border-[#dce4ef] bg-white shadow-[0_8px_28px_rgba(23,35,58,0.06)]">
      <header className="flex items-center justify-between gap-3 border-b border-[#e4eaf2] px-4 py-4 sm:px-5">
        <h3 className="text-sm font-bold text-(--brand-text)">All Follow-ups <span className="ml-1 text-(--brand-text-secondary)">({records.length})</span></h3>
        {loading && <span role="status" className="text-xs font-medium text-[#60718d]">Loading…</span>}
      </header>
      {records.length ? <div className="divide-y divide-[#e7ecf3]">
        {records.map((record) => {
          const phoneDigits = record.lead.phone.replace(/\D/g, "");
          const whatsappHref = phoneDigits.length >= 7 ? `https://wa.me/${phoneDigits}` : null;
          const busy = busyId === record.id;
          return <article key={record.id} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_84px]">
            <div className="min-w-0">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e9eef8] text-sm font-bold text-[#1645a2]" aria-hidden="true">{record.lead.name.trim().charAt(0).toUpperCase() || "?"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-sm font-bold text-(--brand-text)">{record.lead.name}</h4>
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${priorityStyle(record.lead.priority)}`}>{record.lead.priority === "URGENT" ? "Urgent" : `${record.lead.priority.charAt(0)}${record.lead.priority.slice(1).toLowerCase()}`}</span>
                  </div>
                  {record.lead.company && <p className="mt-0.5 truncate text-xs text-[#60718d]">{record.lead.company}</p>}
                  <a href={`tel:${record.lead.phone}`} className="mt-1 inline-block text-xs font-medium text-(--brand-text-secondary) hover:text-[#0d3fa3]">{record.lead.phone}</a>
                </div>
              </div>

              <div className="mt-4 grid gap-3 pl-0 sm:grid-cols-3 sm:pl-[52px]">
                <div><p className="text-[11px] font-medium text-(--brand-text-secondary)">Next Action</p><p className="mt-0.5 break-words text-xs font-semibold text-(--brand-text)">{record.nextAction}</p></div>
                <div><p className="text-[11px] font-medium text-(--brand-text-secondary)">Reminder</p><p className={`mt-0.5 text-xs font-semibold ${new Date(record.dueAt).getTime() < now ? "text-red-700" : "text-(--brand-text)"}`}>{dateLabel(record.dueAt)}</p></div>
                <div><p className="text-[11px] font-medium text-(--brand-text-secondary)">Last Contact</p><p className="mt-0.5 text-xs font-semibold text-(--brand-text)">{lastContact(record.lead, now)}</p></div>
              </div>
              <div className="mt-3 flex min-h-9 items-start gap-2 rounded-lg border border-purple-200 bg-purple-50/80 px-3 py-2 text-xs leading-5 text-purple-800 sm:ml-[52px]">
                <MessageCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="break-words">{record.lead.notes?.trim() || "Add a note to keep useful customer context with this lead."}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
              <a href={`tel:${record.lead.phone}`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2 text-xs font-semibold text-green-700 hover:bg-green-100 lg:flex-auto"><Phone size={13} />Call</a>
              {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2 text-xs font-semibold text-green-700 hover:bg-green-100 lg:flex-auto"><MessageCircle size={13} />WA</a> : <button type="button" disabled title="No valid phone number for WhatsApp" className="inline-flex h-8 flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-(--brand-border) bg-(--brand-surface-hover) px-2 text-xs font-semibold text-(--brand-text-muted) lg:flex-auto"><MessageCircle size={13} />WA</button>}
              <div className="relative flex-1 lg:flex-auto">
                <button type="button" aria-expanded={snoozeMenu === record.id} onClick={() => setSnoozeMenu((current) => current === record.id ? "" : record.id)} disabled={busy} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-(--brand-border) bg-(--brand-surface-hover) px-2 text-xs font-semibold text-(--brand-text-secondary) hover:bg-(--brand-surface-active) disabled:opacity-50"><Clock3 size={13} />Snooze</button>
                {snoozeMenu === record.id && <div className="absolute right-0 top-9 z-10 grid min-w-36 gap-1 rounded-xl border border-[#dce4ef] bg-white p-1.5 shadow-xl">
                  <button type="button" onClick={() => void snooze(record, "hour")} className="rounded-lg px-3 py-2 text-left text-xs font-medium text-(--brand-text) hover:bg-(--brand-surface-hover)">1 hour</button>
                  <button type="button" onClick={() => void snooze(record, "tomorrow")} className="rounded-lg px-3 py-2 text-left text-xs font-medium text-(--brand-text) hover:bg-(--brand-surface-hover)">Tomorrow</button>
                  <button type="button" onClick={() => void snooze(record, "week")} className="rounded-lg px-3 py-2 text-left text-xs font-medium text-(--brand-text) hover:bg-(--brand-surface-hover)">Next week</button>
                </div>}
              </div>
              <button type="button" onClick={() => void complete(record)} disabled={busy} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-[#1645a2] hover:bg-blue-100 disabled:opacity-50 lg:flex-auto"><Check size={13} />Done</button>
            </div>
          </article>;
        })}
      </div> : <div className="px-5 py-14 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#f0f4fa] text-[#60718d]"><CalendarClock size={19} /></span>
        <p className="mt-3 text-sm font-bold text-(--brand-text)">{loading ? "Loading follow-ups" : "You’re all caught up"}</p>
        <p className="mt-1 text-xs text-[#60718d]">{loading ? "Scheduled sales activities will appear here." : "Add a follow-up to keep the next customer action on track."}</p>
      </div>}
    </section>
  </section>;
}

function Summary({ icon, tone, label, value }: { icon: React.ReactNode; tone: "blue" | "red" | "amber" | "slate"; label: string; value: number }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return <article className="rounded-2xl border border-[#dce4ef] bg-white p-4 shadow-[0_3px_12px_rgba(23,35,58,0.035)]">
    <span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}>{icon}</span>
    <p className="mt-3 text-xl font-extrabold tracking-tight text-(--brand-text)">{value}</p>
    <p className="mt-0.5 text-xs font-medium text-[#60718d]">{label}</p>
  </article>;
}
