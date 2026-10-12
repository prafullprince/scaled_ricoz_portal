"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { MarketingService } from "@/services/marketing.service";
import type {
  CreateMarketingContentInput,
  MarketingCampaign,
  MarketingContent,
  MarketingContentStatus,
  MarketingContentType,
  MarketingDashboard,
  MarketingLeadHandoffInput,
  MarketingSalesOwner,
} from "@/types/marketing";
import type { SalesLeadSource } from "@/types/sales";

const contentTypes: Array<{ value: MarketingContentType; label: string }> = [
  { value: "BLOG", label: "Blog / article" },
  { value: "SOCIAL_POST", label: "Social post" },
  { value: "EMAIL", label: "Email" },
  { value: "VIDEO", label: "Video" },
  { value: "WEBINAR", label: "Webinar" },
  { value: "LANDING_PAGE", label: "Landing page" },
  { value: "OTHER", label: "Other" },
];

const contentStatuses: Record<MarketingContentStatus, string> = {
  IDEA: "Idea / backlog",
  IN_PRODUCTION: "In production",
  INTERNAL_REVIEW: "Internal review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  ANALYZED: "Analyzed",
};

const salesSources: SalesLeadSource[] = [
  "GOOGLE", "META", "INSTAGRAM", "LINKEDIN", "WEBSITE",
  "REFERRAL", "EMAIL", "YOUTUBE", "COLD_CALLING", "OTHER",
];

const panelClass = "rounded-xl border border-[#d8e1ed] bg-white p-5";
const fieldClass = "mt-1.5 h-10 w-full rounded-md border border-[#d8e1ed] bg-white px-3 text-sm outline-none focus:border-[#1645a2]";
const buttonClass = "inline-flex h-9 items-center justify-center rounded-md bg-[#1645a2] px-3 text-xs font-bold text-white disabled:opacity-50";

export function MarketingContentPlanner({
  content,
  campaigns,
  team,
  actorId,
  canOverrideReview,
  canManage,
  reload,
}: {
  content: MarketingContent[];
  campaigns: MarketingCampaign[];
  team: MarketingDashboard["team"];
  actorId: string;
  canOverrideReview: boolean;
  canManage: boolean;
  reload: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const counts = Object.keys(contentStatuses) as MarketingContentStatus[];
  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Content Calendar</h2>
          <p className="mt-1 text-xs text-slate-600">Plan work, review drafts, schedule publishing, and record results.</p>
        </div>
        {canManage ? <button type="button" onClick={() => setCreating((value) => !value)} className={buttonClass}><Plus size={14} className="mr-1.5" />Plan content</button> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {counts.map((status) => <span key={status} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{contentStatuses[status]} · {content.filter((item) => item.status === status).length}</span>)}
      </div>
      {creating ? <CreateContentForm campaigns={campaigns} team={team} actorId={actorId} cancel={() => setCreating(false)} created={() => { setCreating(false); reload(); }} /> : null}
      <div className="mt-5 space-y-3">
        {content.map((item) => <ContentCard key={item._id} item={item} actorId={actorId} canOverrideReview={canOverrideReview} canManage={canManage} reload={reload} />)}
        {!content.length ? <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><p className="text-sm font-bold text-slate-800">No content planned yet</p><p className="mt-1 text-xs text-slate-500">Add campaign content, social posts, emails, blogs, videos, or webinars to begin.</p></div> : null}
      </div>
    </section>
  );
}

function CreateContentForm({
  campaigns,
  team,
  actorId,
  cancel,
  created,
}: {
  campaigns: MarketingCampaign[];
  team: MarketingDashboard["team"];
  actorId: string;
  cancel: () => void;
  created: () => void;
}) {
  const [form, setForm] = useState<CreateMarketingContentInput>({
    title: "",
    brief: "",
    type: "SOCIAL_POST",
    channel: "LINKEDIN",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await MarketingService.createContent({
        ...form,
        ...(form.scheduledAt ? { scheduledAt: new Date(form.scheduledAt).toISOString() } : {}),
      });
      created();
    } catch {
      setError("Content could not be added. Check the selected team member and campaign.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-4 sm:grid-cols-2">
      <label className="text-xs font-bold text-slate-700 sm:col-span-2">Content title<input required minLength={2} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={fieldClass} /></label>
      <label className="text-xs font-bold text-slate-700 sm:col-span-2">Brief and expected result<textarea required minLength={2} maxLength={4000} rows={3} value={form.brief} onChange={(event) => setForm({ ...form, brief: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#d8e1ed] bg-white px-3 py-2 text-sm outline-none focus:border-[#1645a2]" /></label>
      <label className="text-xs font-bold text-slate-700">Content type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as MarketingContentType })} className={fieldClass}>{contentTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-700">Channel<select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value as CreateMarketingContentInput["channel"] })} className={fieldClass}>{["GOOGLE", "META", "EMAIL", "WHATSAPP", "LINKEDIN", "ORGANIC", "OTHER"].map((channel) => <option key={channel}>{channel}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-700">Campaign (optional)<select value={form.campaignId ?? ""} onChange={(event) => setForm({ ...form, campaignId: event.target.value || undefined })} className={fieldClass}><option value="">Unlinked</option>{campaigns.map((campaign) => <option key={campaign._id} value={campaign._id}>{campaign.name}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-700">Assign to<select value={form.assigneeId ?? actorId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value === actorId ? undefined : event.target.value })} className={fieldClass}><option value={actorId}>Myself</option>{team.filter((person) => person.assignable).map((person) => <option key={person.user._id} value={person.user._id}>{person.user.name} · {person.level}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-700">Planned publish time (optional)<input type="datetime-local" value={form.scheduledAt ?? ""} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value || null })} className={fieldClass} /></label>
      <label className="text-xs font-bold text-slate-700">Draft asset URL (optional)<input type="url" value={form.assetUrl ?? ""} onChange={(event) => setForm({ ...form, assetUrl: event.target.value })} className={fieldClass} /></label>
      {error ? <p role="alert" className="text-xs font-semibold text-red-700 sm:col-span-2">{error}</p> : null}
      <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={cancel} className="h-9 rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-600">Cancel</button><button disabled={busy} className={buttonClass}>{busy ? "Saving…" : "Add content"}</button></div>
    </form>
  );
}

function ContentCard({
  item,
  actorId,
  canOverrideReview,
  canManage,
  reload,
}: {
  item: MarketingContent;
  actorId: string;
  canOverrideReview: boolean;
  canManage: boolean;
  reload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = async (patch: Partial<MarketingContent>) => {
    setBusy(true);
    setError("");
    try {
      await MarketingService.updateContent(item._id, patch);
      reload();
    } catch {
      setError("Update failed. Check the workflow stage and required information.");
    } finally {
      setBusy(false);
    }
  };
  const canReview = canManage && (canOverrideReview || item.assignedTo?._id !== actorId);
  const approve = async (status: "APPROVED" | "CHANGES_REQUESTED") => {
    const approvalNote = status === "CHANGES_REQUESTED" ? window.prompt("Describe the required changes")?.trim() : undefined;
    if (status === "CHANGES_REQUESTED" && !approvalNote) return;
    await update({ status, ...(approvalNote ? { approvalNote } : {}) });
  };
  const schedule = async () => {
    const rawDate = item.scheduledAt ?? window.prompt("Enter the publishing date and time");
    if (!rawDate) return;
    await update({ status: "SCHEDULED", scheduledAt: new Date(rawDate).toISOString() });
  };
  const publish = async () => {
    const publishedUrl = window.prompt("Paste the public URL for this content")?.trim();
    if (publishedUrl) await update({ status: "PUBLISHED", publishedUrl });
  };
  const action = {
    IDEA: { label: "Start production", status: "IN_PRODUCTION" as const },
    IN_PRODUCTION: { label: "Submit for review", status: "INTERNAL_REVIEW" as const },
    CHANGES_REQUESTED: { label: "Resume production", status: "IN_PRODUCTION" as const },
  }[item.status as "IDEA" | "IN_PRODUCTION" | "CHANGES_REQUESTED"];
  const campaignName = item.campaignId && typeof item.campaignId === "object" ? item.campaignId.name : "";
  return (
    <article className="rounded-lg border border-[#dce4ef] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-extrabold text-slate-900">{item.title}</h3><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-800">{contentStatuses[item.status]}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">{item.type.replaceAll("_", " ")}</span></div>
          <p className="mt-2 text-xs leading-5 text-slate-600">{item.brief}</p>
          <p className="mt-2 text-[10px] font-semibold text-slate-500">{item.channel} · {item.assignedTo?.name ?? "Marketing"}{campaignName ? ` · ${campaignName}` : ""}{item.scheduledAt ? ` · ${new Date(item.scheduledAt).toLocaleString()}` : ""}</p>
          {item.assetUrl ? <a href={item.assetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">Open draft asset <ExternalLink size={12} /></a> : null}
          {item.publishedUrl ? <a href={item.publishedUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">View published item <ExternalLink size={12} /></a> : null}
        </div>
      </div>
      {canManage ? <div className="mt-3 flex flex-wrap gap-2">
        {action ? <button disabled={busy} onClick={() => void update({ status: action.status })} className="rounded-md bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-800">{action.label}</button> : null}
        {item.status === "INTERNAL_REVIEW" && canReview ? <><button disabled={busy} onClick={() => void approve("CHANGES_REQUESTED")} className="rounded-md bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800">Request changes</button><button disabled={busy} onClick={() => void approve("APPROVED")} className="rounded-md bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-800">Approve</button></> : null}
        {item.status === "APPROVED" ? <button disabled={busy} onClick={() => void schedule()} className="rounded-md bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-800">Schedule</button> : null}
        {item.status === "SCHEDULED" ? <button disabled={busy} onClick={() => void publish()} className="rounded-md bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-800">Mark published</button> : null}
        {item.status === "PUBLISHED" ? <ContentAnalysis item={item} busy={busy} save={update} /> : null}
      </div> : null}
      {item.status === "ANALYZED" ? <p className="mt-3 text-[10px] font-semibold text-slate-600">Results: {item.impressions.toLocaleString()} impressions · {item.clicks.toLocaleString()} clicks · {item.conversions} conversions</p> : null}
      {error ? <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}
    </article>
  );
}

function ContentAnalysis({ item, busy, save }: { item: MarketingContent; busy: boolean; save: (patch: Partial<MarketingContent>) => Promise<void> }) {
  const [values, setValues] = useState({ impressions: String(item.impressions), clicks: String(item.clicks), conversions: String(item.conversions) });
  return <form onSubmit={(event) => { event.preventDefault(); void save({ status: "ANALYZED", impressions: Number(values.impressions), clicks: Number(values.clicks), conversions: Number(values.conversions) }); }} className="flex flex-wrap items-end gap-2">
    {(["impressions", "clicks", "conversions"] as const).map((key) => <label key={key} className="text-[9px] font-bold capitalize text-slate-600">{key}<input type="number" min="0" required value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} className="mt-1 block h-8 w-24 rounded border border-slate-200 px-2 text-xs" /></label>)}
    <button disabled={busy} className="h-8 rounded-md bg-emerald-700 px-3 text-[10px] font-bold text-white disabled:opacity-50">Save analysis</button>
  </form>;
}

export function MarketingLeadHandoff({
  campaigns,
  salesOwners,
  error,
  canHandoff,
  reload,
}: {
  campaigns: MarketingCampaign[];
  salesOwners: MarketingSalesOwner[];
  error: string;
  canHandoff: boolean;
  reload: () => void;
}) {
  const [form, setForm] = useState<Omit<MarketingLeadHandoffInput, "consent">>({
    name: "", company: "", email: "", phone: "", source: "WEBSITE", serviceInterest: "", notes: "", salesOwnerId: "",
  });
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const handoff = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFormError("");
    try {
      const lead = await MarketingService.handoffLead({ ...form, consent: true });
      setMessage(`${lead.name} was handed to ${lead.ownerId?.name ?? "Sales"} in the Sales CRM.`);
      setForm({ name: "", company: "", email: "", phone: "", source: "WEBSITE", serviceInterest: "", notes: "", salesOwnerId: "" });
      setConsented(false);
      reload();
    } catch {
      setFormError("Lead handoff failed. Verify the contact details, permission, and Sales owner.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
      <section className={panelClass}>
        <h2 className="text-base font-extrabold text-slate-900">Capture and hand off a lead</h2>
        <p className="mt-1 text-xs text-slate-600">Keep the original source and campaign attached when Sales receives the lead.</p>
        {!canHandoff ? <p className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">Your Marketing role does not have permission to hand leads to Sales.</p> : <>
          {error ? <p role="alert" className="mt-3 text-xs font-semibold text-red-700">{error}</p> : null}
          <form onSubmit={handoff} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">Contact name<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldClass} /></label>
            <label className="text-xs font-bold text-slate-700">Company (optional)<input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} className={fieldClass} /></label>
            <label className="text-xs font-bold text-slate-700">Email (optional)<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={fieldClass} /></label>
            <label className="text-xs font-bold text-slate-700">Phone<input type="tel" minLength={7} required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={fieldClass} /></label>
            <label className="text-xs font-bold text-slate-700">Lead source<select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as SalesLeadSource })} className={fieldClass}>{salesSources.map((source) => <option key={source}>{source}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">Sales owner<select required value={form.salesOwnerId} onChange={(event) => setForm({ ...form, salesOwnerId: event.target.value })} className={fieldClass}><option value="">Select a Sales Head or Manager</option>{salesOwners.map((owner) => <option key={owner._id} value={owner._id}>{owner.name} · Sales {owner.level.toLowerCase()}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700 sm:col-span-2">Campaign attribution<select value={form.campaignId ?? ""} onChange={(event) => setForm({ ...form, campaignId: event.target.value || undefined })} className={fieldClass}><option value="">No campaign</option>{campaigns.filter((campaign) => campaign.status !== "CANCELLED").map((campaign) => <option key={campaign._id} value={campaign._id}>{campaign.name}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">Service interest<input value={form.serviceInterest} onChange={(event) => setForm({ ...form, serviceInterest: event.target.value })} className={fieldClass} /></label>
            <label className="text-xs font-bold text-slate-700">Notes for Sales<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className={fieldClass} /></label>
            <label className="flex items-start gap-2 text-[11px] leading-5 text-slate-600 sm:col-span-2"><input required type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-1" />The contact has agreed to be contacted about Ricoz products or services.</label>
            {message ? <p role="status" className="rounded-md bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 sm:col-span-2">{message}</p> : null}
            {formError ? <p role="alert" className="rounded-md bg-red-50 p-3 text-xs font-semibold text-red-700 sm:col-span-2">{formError}</p> : null}
            <button disabled={busy || !salesOwners.length} className={`${buttonClass} sm:col-span-2`}>{busy ? "Handing off…" : "Create Sales CRM lead"}</button>
          </form>
        </>}
      </section>
      <section className={panelClass}>
        <h2 className="text-base font-extrabold text-slate-900">Campaign lead targets</h2>
        <p className="mt-1 text-xs text-slate-600">Attributed counts come from CRM leads linked to these campaigns.</p>
        <div className="mt-5 space-y-4">
          {campaigns.map((campaign) => {
            const progress = campaign.targetLeads ? Math.min(100, Math.round((campaign.attributedLeads / campaign.targetLeads) * 100)) : 0;
            return <div key={campaign._id}><div className="flex justify-between gap-3 text-xs"><span className="font-bold text-slate-800">{campaign.name}</span><span className="text-slate-500">{campaign.attributedLeads}{campaign.targetLeads ? ` / ${campaign.targetLeads}` : ""}</span></div>{campaign.targetLeads ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress}%` }} /></div> : null}</div>;
          })}
          {!campaigns.length ? <p className="rounded-md bg-slate-50 p-4 text-xs text-slate-500">Create a campaign to start tracking qualified lead targets.</p> : null}
        </div>
      </section>
    </div>
  );
}
