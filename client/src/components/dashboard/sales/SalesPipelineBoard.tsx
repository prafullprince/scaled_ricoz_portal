"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Save, UserRoundCheck, X } from "lucide-react";
import { SalesService } from "@/services/sales.service";
import { scopeBoardPage } from "@/lib/sales/board";
import type { SalesLead, SalesLeadPage, SalesLeadQuery, SalesLeadStatus, SalesPipeline, SalesPipelineStage } from "@/types/sales";
import boardStyles from "../PipelineStageBoard.module.css";

const control = "w-full min-w-0 rounded-lg border border-(--brand-border) bg-(--input-background) px-3 py-2.5 text-sm text-(--brand-text) outline-none transition focus:border-(--brand-red) focus:ring-2 focus:ring-(--brand-red)/15";
const money = (value: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);
const message = (error: unknown) => (error as { response?: { data?: { message?: string; errors?: Array<{ message: string }> } } }).response?.data?.message || "Changes could not be saved. Try again.";
function stageAccent(stage: SalesPipelineStage) {
  if (stage.status === "WON") return "success";
  if (stage.status === "LOST") return "danger";
  if (stage.status === "NEW") return "neutral";
  if (stage.status === "REQUIREMENT" || stage.status === "NEGOTIATION") return "warning";
  if (stage.status === "PROPOSAL") return "purple";
  return "info";
}

export function SalesPipelineBoard({ pipeline, query, revision, canEdit, onOpen, onChanged, onAssign }: {
  pipeline: SalesPipeline; query: SalesLeadQuery; revision: number; canEdit: boolean;
  onOpen: (lead: SalesLead) => void; onChanged: () => void;
  onAssign?: (lead: SalesLead) => void;
}) {
  const [dragged, setDragged] = useState<SalesLead | null>(null);
  const [closing, setClosing] = useState<{ lead: SalesLead; stage: SalesPipelineStage } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const persist = async (lead: SalesLead, stage: SalesPipelineStage, lostReason?: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError("");
    try {
      await SalesService.updateLead(lead._id, { pipeline: pipeline.key, stageId: stage.key, status: stage.status, ...(lostReason ? { lostReason } : {}) });
      setClosing(null); onChanged();
    } catch (caught) { setError(message(caught)); }
    finally { lock.current = false; setBusy(false); }
  };
  const move = (lead: SalesLead, stage: SalesPipelineStage) => {
    if (!canEdit || busy || pipeline.archived || stage.archived || stage.key === (lead.stageId ?? lead.status)) return;
    if (stage.status === "LOST") setClosing({ lead, stage });
    else void persist(lead, stage);
  };
  const stages = pipeline.stages.filter((stage) => (!query.status || stage.status === query.status) && (!query.stageId || stage.key === query.stageId));
  return <>
    {error && <p role="alert" className="bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="min-w-0" aria-label={`${pipeline.name} pipeline`}>
      <div className={boardStyles.board}>
        {stages.map((stage) => <PipelineColumn key={`${pipeline.key}-${stage.key}`} pipeline={pipeline} stage={stage} stageAccent={stageAccent(stage)} query={query} revision={revision} canEdit={canEdit && !busy && !pipeline.archived} onOpen={onOpen} onAssign={onAssign} onMove={move} onDrag={setDragged} onDrop={() => { if (dragged) move(dragged, stage); setDragged(null); }} />)}
      </div>
    </div>
    {closing && <LossDialog name={closing.lead.name} busy={busy} error={error} onClose={() => setClosing(null)} onSubmit={(reason) => void persist(closing.lead, closing.stage, reason)} />}
  </>;
}

function PipelineColumn({ pipeline, stage, stageAccent, query, revision, canEdit, onOpen, onMove, onDrag, onDrop, onAssign }: {
  pipeline: SalesPipeline; stage: SalesPipelineStage; query: SalesLeadQuery; revision: number; canEdit: boolean;
  stageAccent: string;
  onOpen: (lead: SalesLead) => void; onMove: (lead: SalesLead, stage: SalesPipelineStage) => void;
  onDrag: (lead: SalesLead | null) => void; onDrop: () => void;
  onAssign?: (lead: SalesLead) => void;
}) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SalesLeadPage | null>(null);
  const [unreliableTotals, setUnreliableTotals] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [over, setOver] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    SalesService.leadsPage({ ...query, pipeline: pipeline.key, stageId: stage.key, status: stage.status, page, pageSize: 20, board: "true" }, abort.signal)
      .then((data) => {
        if (abort.signal.aborted) return;
        const scoped = scopeBoardPage(data, pipeline.key, stage.key);
        setUnreliableTotals((previous) => scoped.rejected || (page > 1 && previous));
        setResult((previous) => page === 1 ? scoped.page : { ...scoped.page, leads: [...(previous?.leads ?? []).filter((lead) => !scoped.page.leads.some((item) => item._id === lead._id)), ...scoped.page.leads] });
        setError("");
      }).catch(() => { if (!abort.signal.aborted) setError("Stage could not be loaded."); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [pipeline.key, stage.key, stage.status, query, page, revision, retry]);
  return <section aria-label={`${stage.name} stage`} data-accent={stageAccent} data-over={over} onDragOver={(event) => { if (canEdit && !stage.archived) { event.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={(event) => { event.preventDefault(); setOver(false); if (canEdit && !stage.archived) onDrop(); }} className={boardStyles.column}>
    <header className={boardStyles.columnHeader}>
      <div className={boardStyles.headingRow}>
        <h3 className={boardStyles.stageName} title={stage.name}><span className={boardStyles.stageDot} />{stage.name}{stage.archived ? " (archived)" : ""}</h3>
        <span className={boardStyles.count}>{unreliableTotals ? "-" : result?.pagination.total ?? "…"}</span>
      </div>
      <p className={boardStyles.stageHint}>{!unreliableTotals && result?.amounts?.length ? result.amounts.map((amount) => money(amount.value, amount._id)).join(" · ") : `${stage.probability}% probability`}</p>
    </header>
    {error && <div role="alert" className="p-2 text-xs text-(--status-danger)">{error}<button onClick={() => setRetry((value) => value + 1)} className="ml-2 underline">Retry</button></div>}
    <div className={boardStyles.cards}>{result?.leads.map((lead) => <article key={lead._id} draggable={canEdit} onDragStart={(event) => { event.dataTransfer.setData("text/plain", lead._id); event.dataTransfer.effectAllowed = "move"; onDrag(lead); }} onDragEnd={() => onDrag(null)} className={boardStyles.card}>
      <div className="flex items-start gap-2"><button onClick={() => onOpen(lead)} className={`${boardStyles.cardTitle} min-w-0 flex-1 text-left`}>{lead.name}</button>{canEdit && <GripVertical size={16} className="shrink-0 text-(--brand-text-muted)" aria-hidden="true" />}</div>
      <p className={boardStyles.cardSubtitle}>{lead.company || lead.source}</p>
      <p className={boardStyles.cardValue}>{money(lead.expectedValue, lead.currency)}</p>
      <p className={boardStyles.cardMeta}>{lead.ownerId?.name || "Deleted owner"}</p>
      {lead.nextFollowUpAt && <p className={`${boardStyles.cardMeta} ${boardStyles.warningMeta}`}>Follow-up {new Date(lead.nextFollowUpAt).toLocaleDateString("en-IN")}</p>}
      <div className="my-3 flex flex-wrap gap-2">{lead.tags?.map((tag) => <span key={tag} className={boardStyles.tag}>{tag}</span>)}</div>
      {onAssign && <button onClick={() => onAssign(lead)} title="Assign owner" aria-label={`Assign ${lead.name}`} className={boardStyles.actionLink}><UserRoundCheck size={14} />Assign owner</button>}
      <select aria-label={`Move ${lead.name} to stage`} disabled={!canEdit} value={lead.stageId ?? lead.status} onChange={(event) => { const destination = pipeline.stages.find((item) => item.key === event.target.value); if (destination) onMove(lead, destination); }} className={boardStyles.select}>{pipeline.stages.map((item) => <option key={item.key} value={item.key} disabled={item.archived}>{item.name}{item.archived ? " (archived)" : ""}</option>)}</select>
    </article>)}
      {loading && <p role="status" className={boardStyles.empty}>Loading stage…</p>}
      {!loading && !error && !result?.leads.length && <p className={boardStyles.empty}>{result && result.pagination.page < result.pagination.totalPages ? "No matching deals on loaded pages" : "No deals at this stage"}</p>}
    </div>
    {result && result.pagination.page < result.pagination.totalPages && <button disabled={loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className={boardStyles.loadMore}>{unreliableTotals ? "Load more" : `Load more (${result.leads.length} of ${result.pagination.total})`}</button>}
  </section>;
}

function LossDialog({ name, busy, error, onClose, onSubmit }: { name: string; busy: boolean; error: string; onClose: () => void; onSubmit: (reason: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={onClose} aria-label="Close deal as lost" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-(--brand-border) bg-white p-5 text-(--brand-text) shadow-(--shadow-xl) backdrop:bg-black/40"><form onSubmit={(event) => { event.preventDefault(); onSubmit(String(new FormData(event.currentTarget).get("reason"))); }}><div className="flex items-center justify-between gap-2"><h2 className="break-words text-lg font-bold text-(--brand-navy)">Close {name} as lost</h2><button type="button" onClick={onClose} title="Cancel" aria-label="Cancel" className="flex size-8 items-center justify-center rounded-lg text-(--brand-text-muted) transition hover:bg-(--brand-surface-hover)"><X size={18} /></button></div><label className="mt-4 block text-xs font-semibold text-(--brand-text-secondary)">Loss reason<textarea name="reason" required maxLength={1000} rows={3} className={`${control} mt-2`} /></label>{error && <p role="alert" className="mt-2 text-xs text-(--status-danger)">{error}</p>}<button disabled={busy} className="mt-4 rounded-lg bg-(--brand-red) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--brand-red-hover)">{busy ? "Saving..." : "Close as lost"}</button></form></dialog>;
}

export function SalesPipelineSettings({ pipeline, onClose, onSaved }: { pipeline: SalesPipeline; onClose: () => void; onSaved: (pipeline: SalesPipeline) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<SalesPipeline>(() => structuredClone(pipeline));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existing = new Set(pipeline.stages.map((stage) => stage.key));
  useEffect(() => { dialog.current?.showModal(); }, []);
  const changeStage = (key: string, update: Partial<SalesPipelineStage>) => setDraft((current) => ({ ...current, stages: current.stages.map((stage) => stage.key === key ? { ...stage, ...update } : stage) }));
  const reorder = (index: number, direction: number) => setDraft((current) => { const stages = [...current.stages]; [stages[index], stages[index + direction]] = [stages[index + direction], stages[index]]; return { ...current, stages }; });
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    const active = draft.stages.filter((stage) => !stage.archived);
    if (!active.some((stage) => !["WON", "LOST"].includes(stage.status)) || ["WON", "LOST"].some((status) => active.filter((stage) => stage.status === status).length !== 1)) { setError("Keep at least one open stage and exactly one active won and lost stage."); return; }
    if (new Set(active.map((stage) => stage.name.trim().toLowerCase())).size !== active.length) { setError("Active stage names must be unique."); return; }
    setBusy(true);
    try { onSaved(await SalesService.savePipeline(draft)); } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  };
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="pipeline-settings-title" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-(--brand-border) bg-white p-5 text-(--brand-text) shadow-(--shadow-xl) backdrop:bg-black/40"><form onSubmit={save}>
    <header className="flex items-start justify-between gap-3"><h2 id="pipeline-settings-title" className="text-lg font-bold text-(--brand-navy)">Pipeline settings</h2><button type="button" onClick={onClose} title="Close settings" aria-label="Close settings" className="flex size-8 items-center justify-center rounded-lg text-(--brand-text-muted) transition hover:bg-(--brand-surface-hover)"><X size={20} /></button></header>
    <fieldset disabled={busy} className="mt-5 space-y-4">
      <label className="block text-xs font-semibold text-(--brand-text-secondary)">Pipeline name<input required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={`${control} mt-1`} /></label>
      <label className="block text-xs font-semibold text-(--brand-text-secondary)">Description<textarea maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={`${control} mt-1`} /></label>
      <label className="flex items-center gap-2 text-xs font-medium text-(--brand-text-secondary)"><input type="checkbox" checked={draft.archived} onChange={(event) => setDraft({ ...draft, archived: event.target.checked })} />Archived pipeline</label>
      <div className="flex items-center justify-between border-t border-(--brand-border) pt-4"><h3 className="text-sm font-bold text-(--brand-navy)">Stages</h3><button type="button" disabled={draft.stages.length >= 30} onClick={() => setDraft({ ...draft, stages: [...draft.stages, { key: crypto.randomUUID(), name: "", status: "CONTACTED", probability: 30, archived: false }] })} className="inline-flex items-center gap-1 rounded-lg border border-(--brand-border) bg-(--brand-surface) px-2.5 py-1.5 text-xs font-semibold text-(--brand-text-secondary) transition hover:bg-(--brand-surface-hover)"><Plus size={14} />Add stage</button></div>
      <ol className="divide-y divide-(--brand-border)">{draft.stages.map((stage, index) => <li key={stage.key} className="grid grid-cols-[1fr_auto] gap-3 py-3 sm:grid-cols-[2fr_1fr_80px_auto]">
        <label className="min-w-0 text-xs font-semibold text-(--brand-text-secondary)">Stage name<input required aria-label={`Stage ${index + 1} name`} maxLength={80} value={stage.name} onChange={(event) => changeStage(stage.key, { name: event.target.value })} className={`${control} mt-1`} /></label>
        <label className="min-w-0 text-xs font-semibold text-(--brand-text-secondary)">Category<select disabled={existing.has(stage.key)} value={stage.status} onChange={(event) => { const status = event.target.value as SalesLeadStatus; changeStage(stage.key, { status, probability: status === "WON" ? 100 : status === "LOST" ? 0 : 30 }); }} className={`${control} mt-1`}>{["NEW", "QUALIFIED", "CONTACTED", "REQUIREMENT", "PROPOSAL", "NEGOTIATION", "WON", "LOST"].map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="text-xs">Win %<input type="number" min={0} max={100} required disabled={["WON", "LOST"].includes(stage.status)} value={stage.probability} onChange={(event) => changeStage(stage.key, { probability: Number(event.target.value) })} className={`${control} mt-1`} /></label>
        <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={index === 0} title="Move stage up" aria-label={`Move ${stage.name || "stage"} up`} onClick={() => reorder(index, -1)} className="rounded-lg border border-(--brand-border) p-1.5 text-(--brand-text-secondary) transition hover:bg-(--brand-surface-hover) disabled:opacity-30"><ArrowUp size={15} /></button><button type="button" disabled={index === draft.stages.length - 1} title="Move stage down" aria-label={`Move ${stage.name || "stage"} down`} onClick={() => reorder(index, 1)} className="rounded-lg border border-(--brand-border) p-1.5 text-(--brand-text-secondary) transition hover:bg-(--brand-surface-hover) disabled:opacity-30"><ArrowDown size={15} /></button><label className="flex items-center gap-1 text-xs font-medium text-(--brand-text-secondary)"><input type="checkbox" checked={stage.archived} onChange={(event) => changeStage(stage.key, { archived: event.target.checked })} />Archived</label></div>
      </li>)}</ol>
    </fieldset>
    {error && <p role="alert" className="mt-3 rounded-lg border border-(--status-danger-border) bg-(--status-danger-bg) p-3 text-sm text-(--status-danger)">{error}</p>}
    <footer className="mt-4 flex justify-end"><button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-(--brand-red) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--brand-red-hover) disabled:opacity-50"><Save size={16} />{busy ? "Saving..." : "Save pipeline"}</button></footer>
  </form></dialog>;
}