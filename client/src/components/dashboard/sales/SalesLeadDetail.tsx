"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, Mail, Phone, Plus, Save, Trash2, X } from "lucide-react";
import { SalesService } from "@/services/sales.service";
import type { SalesActivity, SalesLead, SalesLeadPriority, SalesPipeline } from "@/types/sales";

const inputStyle = "mt-1 w-full rounded-md border border-[#d5dfec] bg-white px-3 py-2 text-sm font-normal";
const localDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const dateLabel = (value: string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function SalesLeadDetail({ lead, pipelines, onClose, onUpdated, canEdit = true, canDelete = false, onDelete, canLog = true, initialStage }: {
  lead: SalesLead; pipelines: SalesPipeline[]; onClose: () => void; onUpdated: (lead: SalesLead) => void; canEdit?: boolean; canDelete?: boolean; onDelete?: () => void; canLog?: boolean; initialStage?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"record" | "activities" | "history">("record");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(initialStage ?? lead.stageId ?? lead.status);
  const [pipelineKey, setPipelineKey] = useState(lead.pipeline || "Sales");
  const pipeline = pipelines.find((item) => item.key === pipelineKey);
  const stageDefinition = pipeline?.stages.find((item) => item.key === stage);
  const savedPipeline = pipelines.find((item) => item.key === (lead.pipeline || "Sales"));
  const savedStage = savedPipeline?.stages.find((item) => item.key === (lead.stageId ?? lead.status));
  const [kind, setKind] = useState<Exclude<SalesActivity["kind"], "STAGE">>("CALL");
  useEffect(() => { dialog.current?.showModal(); }, []);

  const perform = async (operation: () => Promise<SalesLead>) => {
    setBusy(true);
    setError("");
    try { onUpdated(await operation()); return true; }
    catch (caught) {
      const message = (caught as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || "Changes could not be saved. Please try again.");
      return false;
    } finally { setBusy(false); }
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? "").trim();
    const date = (key: string) => text(key) ? new Date(text(key)).toISOString() : null;
    void perform(() => SalesService.updateLead(lead._id, {
      name: text("name"), company: text("company"), email: text("email"), phone: text("phone"),
      stageId: stage, status: stageDefinition?.status, priority: text("priority") as SalesLeadPriority,
      pipeline: pipelineKey, tags: text("tags").split(",").map((tag) => tag.trim()).filter(Boolean),
      serviceInterest: text("serviceInterest"), expectedValue: Math.round(Number(text("value")) * 100),
      probability: Number(text("probability")), expectedCloseAt: date("close"), nextFollowUpAt: date("followUp"),
      notes: text("notes"), lostReason: text("lostReason"),
      ...(text("need") || text("budget") || text("authority") || text("timeline") ? {
        qualification: { need: text("need"), budget: text("budget"), authority: text("authority"), timeline: text("timeline") },
      } : {}),
      meetingNotes: text("meetingNotes"),
    }));
  };
  const addActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const due = String(values.get("due") ?? "");
    const saved = await perform(() => SalesService.addActivity(lead._id, { kind, text: String(values.get("text")), dueAt: due ? new Date(due).toISOString() : null }));
    if (saved) form.reset();
  };
  const activities = [...(lead.activities ?? [])].reverse();
  return (
    <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-labelledby="sales-record-title" className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-2xl overflow-y-auto border-l border-[#d9e2ee] bg-white p-0 text-[#17233a] shadow-xl backdrop:bg-black/40">
      <header className="sticky top-0 z-10 border-b border-[#d9e2ee] bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs font-semibold text-[#60718d]">{savedPipeline?.name || lead.pipeline || "Sales"} / {savedStage?.name || lead.status}</p><h2 id="sales-record-title" className="mt-1 break-words text-xl font-bold">{lead.name}</h2><p className="mt-1 break-words text-xs text-[#60718d]">{lead.company || "Individual"} · {lead.ownerId?.name || "Deleted owner"}</p><p className="mt-1 break-words text-[10px] font-semibold text-[#60718d]">Source: {lead.source}{lead.sourceDetail ? ` · ${lead.sourceDetail}` : ""}{lead.campaignId ? " · Marketing attribution recorded" : ""}{lead.marketingConsentAt ? ` · Consent recorded ${new Date(lead.marketingConsentAt).toLocaleDateString("en-IN")}` : ""}</p></div>
          <div className="flex shrink-0 gap-2">
            {canDelete && onDelete && <button type="button" onClick={onDelete} aria-label={`Delete ${lead.name}`} title="Permanently delete lead" className="rounded border border-red-200 p-2 text-red-700 hover:bg-red-50"><Trash2 size={16} /></button>}
            <button type="button" onClick={onClose} aria-label="Close record" title="Close record" className="rounded border p-2"><X size={18} /></button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-[#0d3fa3]">
          <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1"><Phone size={14} />{lead.phone}</a>
          {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex min-w-0 items-center gap-1 break-all"><Mail size={14} />{lead.email}</a>}
        </div>
        <div className="mt-4 flex gap-4" role="tablist" aria-label="Record sections">
          {(["record", "activities", "history"] as const).map((section) => <button key={section} role="tab" aria-selected={tab === section} onClick={() => setTab(section)} className={`border-b-2 pb-2 text-xs font-bold capitalize ${tab === section ? "border-[#0d3fa3] text-[#0d3fa3]" : "border-transparent text-[#60718d]"}`}>{section}</button>)}
        </div>
      </header>
      <div className="p-5">
        {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {tab === "record" && <form key={`${lead.updatedAt}-${lead.status}`} onSubmit={save}>
          <fieldset disabled={busy || !canEdit} className="grid gap-4 sm:grid-cols-2 disabled:opacity-70">
            <Field label="Contact name"><input name="name" required minLength={2} maxLength={160} defaultValue={lead.name} className={inputStyle} /></Field>
            <Field label="Company"><input name="company" maxLength={160} defaultValue={lead.company} className={inputStyle} /></Field>
            <Field label="Phone"><input name="phone" required minLength={7} maxLength={30} defaultValue={lead.phone} className={inputStyle} /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={lead.email} className={inputStyle} /></Field>
            <Field label="Pipeline"><select required value={pipelineKey} onChange={(event) => { const next = pipelines.find((item) => item.key === event.target.value); setPipelineKey(event.target.value); setStage(next?.stages.find((item) => !item.archived && !["WON", "LOST"].includes(item.status))?.key || ""); }} className={inputStyle}>{pipelines.map((item) => <option key={item.key} value={item.key} disabled={item.archived && item.key !== lead.pipeline}>{item.name}{item.archived ? " (archived)" : ""}</option>)}</select></Field>
            <Field label="Stage"><select required value={stage} onChange={(event) => setStage(event.target.value)} className={inputStyle}>{pipeline?.stages.map((item) => <option key={item.key} value={item.key} disabled={item.archived && item.key !== (lead.stageId ?? lead.status)}>{item.name}{item.archived ? " (archived)" : ""}</option>)}</select></Field>
            {(["need", "budget", "authority", "timeline"] as const).map((key) => <Field key={key} label={`Qualification: ${key}`}><input name={key} required={stageDefinition?.status === "QUALIFIED"} maxLength={1000} defaultValue={lead.qualification?.[key]} className={inputStyle} /></Field>)}
            <Field label="Meeting requirements and objections"><textarea name="meetingNotes" maxLength={2000} required={stage === "MEETING_COMPLETED"} defaultValue={lead.meetingNotes} className={inputStyle} /></Field>
            <Field label={`Deal value (${lead.currency})`}><input name="value" type="number" min={0} step="0.01" required defaultValue={lead.expectedValue / 100} className={inputStyle} /></Field>
            <Field label="Win probability (%)"><input name="probability" type="number" min={0} max={100} required defaultValue={lead.probability ?? 10} className={inputStyle} /></Field>
            <Field label="Expected close"><input name="close" type="datetime-local" defaultValue={localDate(lead.expectedCloseAt)} className={inputStyle} /></Field>
            <Field label="Next follow-up"><input name="followUp" type="datetime-local" defaultValue={localDate(lead.nextFollowUpAt)} className={inputStyle} /></Field>
            <Field label="Priority"><select name="priority" defaultValue={lead.priority} className={inputStyle}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Service interest"><input name="serviceInterest" maxLength={160} defaultValue={lead.serviceInterest} className={inputStyle} /></Field>
            <div className="sm:col-span-2"><Field label="Tags (comma separated)"><input name="tags" defaultValue={lead.tags?.join(", ")} className={inputStyle} /></Field></div>
            <div className="sm:col-span-2"><Field label="Loss reason"><textarea name="lostReason" required={stageDefinition?.status === "LOST"} maxLength={1000} defaultValue={lead.lostReason} className={inputStyle} /></Field></div>
            <div className="sm:col-span-2"><Field label="Notes"><textarea name="notes" rows={4} maxLength={4000} defaultValue={lead.notes} className={inputStyle} /></Field></div>
          </fieldset>
          {canEdit && <button disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#0d3fa3] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={15} />{busy ? "Saving..." : "Save changes"}</button>}
        </form>}
        {tab === "activities" && <>
          {canLog && <form onSubmit={addActivity} className="mb-6 space-y-3 border-b border-[#d9e2ee] pb-5">
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Activity type"><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className={inputStyle}>{["CALL", "EMAIL", "MEETING", "FOLLOW_UP", "NOTE"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Scheduled for"><input name="due" type="datetime-local" required={kind === "FOLLOW_UP"} className={inputStyle} /></Field></div>
            <Field label="Activity notes"><textarea name="text" required maxLength={4000} rows={3} className={inputStyle} /></Field>
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-[#0d3fa3] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus size={15} />Log activity</button>
          </form>}
          <ol className="divide-y divide-[#d9e2ee]">{activities.map((activity) => <li key={activity._id} className="py-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-[#0d3fa3]">{activity.kind.replace("_", " ")}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{activity.text}</p></div>{canLog && activity.kind !== "STAGE" && !activity.completedAt && <button disabled={busy} title="Complete activity" aria-label="Complete activity" onClick={() => void perform(() => SalesService.completeActivity(lead._id, activity._id))} className="rounded border p-2"><Check size={15} /></button>}</div>
            <p className="mt-2 text-xs text-[#60718d]">{dateLabel(activity.createdAt)}</p>{activity.dueAt && <p className="mt-1 text-xs text-amber-700">Due {dateLabel(activity.dueAt)}</p>}{activity.completedAt && <p className="mt-1 text-xs font-semibold text-emerald-700">Completed {dateLabel(activity.completedAt)}</p>}
          </li>)}</ol>{!activities.length && <p className="py-8 text-center text-sm text-[#60718d]">No activities recorded.</p>}
        </>}
        {tab === "history" && <ol className="divide-y divide-[#d9e2ee]">{[...(lead.assignmentHistory ?? [])].reverse().map((entry, index) => <li key={`${entry.timestamp}-${index}`} className="py-4"><p className="text-sm font-semibold">{entry.reason || "Owner changed"}</p><p className="mt-1 text-xs text-[#60718d]">{dateLabel(entry.timestamp)}</p><p className="mt-1 break-all text-xs text-[#60718d]">Owner ID: {entry.newOwner}</p></li>)}{!(lead.assignmentHistory?.length) && <li className="py-8 text-center text-sm text-[#60718d]">No assignment history.</li>}</ol>}
      </div>
    </dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 text-xs font-semibold">{label}{children}</label>;
}