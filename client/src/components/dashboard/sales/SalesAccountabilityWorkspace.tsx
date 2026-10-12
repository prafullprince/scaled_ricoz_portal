"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Activity, AlertTriangle, ArrowUpRight, Check, Clock3, Plus, RefreshCw, Target, Users, X } from "lucide-react";
import { isAxiosError } from "axios";
import { SalesAccountabilityService } from "@/services/sales-accountability.service";
import type { AccountabilityLeadPage, CreateSalesAccountabilityInput, SalesAccountabilityPage, SalesAccountabilityTask, SalesTargetMetric, SalesTaskKind } from "@/types/sales/accountability";
import { DashboardEmptyState, DashboardError, DashboardSkeleton } from "../DashboardPrimitives";
import { MarkdownContent } from "../MarkdownContent";
import { taskPriorityOptions, taskPriorityTier } from "@/lib/task-priority";
import styles from "./SalesAccountabilityWorkspace.module.css";

const control = `${styles.control} mt-1 w-full rounded-xl border border-(--brand-border) bg-white px-3 py-2.5 text-sm`;
const action = `${styles.action} inline-flex items-center justify-center gap-2 rounded-xl border border-(--brand-border) px-3 py-2.5 text-sm font-semibold disabled:opacity-50`;
const errorMessage = (error: unknown) => isAxiosError<{ message?: string }>(error) ? error.response?.data.message ?? error.message : error instanceof Error ? error.message : "Sales work could not be saved.";
const numberLabel = (value: number, task: SalesAccountabilityTask) => task.salesAccountability.metric === "REVENUE"
  ? new Intl.NumberFormat("en-IN", { style: "currency", currency: task.salesAccountability.currency }).format(value)
  : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function SalesAccountabilityWorkspace() {
  const [data, setData] = useState<SalesAccountabilityPage | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState("ALL");
  const [creating, setCreating] = useState<{ parent?: SalesAccountabilityTask } | null>(null);
  const [reporting, setReporting] = useState<SalesAccountabilityTask | null>(null);
  const [reviewing, setReviewing] = useState<SalesAccountabilityTask | null>(null);
  const [commenting, setCommenting] = useState<SalesAccountabilityTask | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    void SalesAccountabilityService.list(abort.signal).then((result) => {
      if (!abort.signal.aborted) { setData(result); setError(""); }
    }).catch((caught: unknown) => { if (!abort.signal.aborted) setError(errorMessage(caught)); });
    return () => abort.abort();
  }, [revision]);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60_000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  if (!data) return error ? <DashboardError message={error} onRetry={() => setRevision((value) => value + 1)} /> : <DashboardSkeleton />;
  const tasks = data.tasks.filter((task) => filter === "ALL" || (filter === "OVERDUE" ? task.overdue : task.salesAccountability.state === filter));
  const changed = () => { setCreating(null); setReporting(null); setReviewing(null); setCommenting(null); setRevision((value) => value + 1); };
  return <section className={`${styles.workspace} mx-auto max-w-6xl space-y-5`}>
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}><Target size={14} /> SALES PERFORMANCE</span>
        <h2>Targets &amp; accountability</h2>
        <p>Turn business goals into focused team plans. Track real CRM outcomes, unblock work, and review evidence as progress rolls up to leadership.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button className={`${action} ${styles.iconAction}`} onClick={() => setRevision((value) => value + 1)} aria-label="Refresh Sales targets" title="Refresh"><RefreshCw size={16} /></button>
        {data.canCreate && <button className={`${action} ${styles.primaryAction}`} onClick={() => setCreating({})}><Plus size={17} />Assign department target</button>}
      </div>
    </header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.metrics}>
      {[
        { label: "Open tasks", count: data.tasks.filter((task) => task.status === "PENDING").length, icon: Activity, tone: "blue" },
        { label: "Completed", count: data.tasks.filter((task) => task.status === "DONE").length, icon: Check, tone: "green" },
        { label: "Overdue", count: data.tasks.filter((task) => task.overdue).length, icon: Clock3, tone: "red" },
        { label: "Blocked", count: data.tasks.filter((task) => task.salesAccountability.state === "BLOCKED").length, icon: AlertTriangle, tone: "amber" },
      ].map(({ label, count, icon: Icon, tone }) => <div key={label} className={`${styles.metricCard} ${styles[`metric${tone[0]!.toUpperCase()}${tone.slice(1)}`]}`}>
        <span className={styles.metricIcon}><Icon size={17} /></span><p>{label}</p><strong>{count}</strong>
      </div>)}
    </div>
    <div className={styles.listToolbar}>
      <div><h3>Delegated work</h3><p>{tasks.length} {tasks.length === 1 ? "task" : "tasks"} in this view</p></div>
      <label className={styles.filterLabel}>Status<select className={control} value={filter} onChange={(event) => setFilter(event.target.value)}>{["ALL", "ACTIVE", "BLOCKED", "REVIEW", "ACCEPTED", "OVERDUE"].map((value) => <option key={value} value={value}>{value === "ALL" ? "All statuses" : value.replaceAll("_", " ")}</option>)}</select></label>
    </div>
    {!tasks.length ? <DashboardEmptyState icon={Target} title="No Sales targets in this view" description="CEO, Admin or HR with TASK_ASSIGN can assign a department target to the Sales Head." /> : tasks.map((task) => {
      const parent = data.tasks.find((item) => item._id === task.parentTaskId);
      return <article key={task._id} className={styles.taskCard}>
        <div className={styles.cardAccent} />
        <div className={styles.cardBody}>
          <div className={styles.taskHeader}>
            <div className={styles.taskHeading}>
              <div className={styles.badges}><span className={styles.kindBadge}>{task.salesAccountability.kind.replaceAll("_", " ")}</span><span className={styles.priorityBadge}>{taskPriorityTier(task.priority) ?? task.priority}</span><span className={`${styles.stateBadge} ${task.overdue ? styles.dangerBadge : task.salesAccountability.state === "ACCEPTED" ? styles.successBadge : task.salesAccountability.state === "BLOCKED" ? styles.warningBadge : ""}`}>{task.overdue ? "OVERDUE" : task.salesAccountability.state.replaceAll("_", " ")}</span></div>
              <h3>{task.title}</h3>
              {parent && <p className={styles.parentLabel}><ArrowUpRight size={13} /> Parent target: {parent.title}</p>}
            </div>
            <div className={styles.progressSummary}><strong>{numberLabel(task.achieved, task)} <span>/ {numberLabel(task.salesAccountability.target, task)}</span></strong><span>{task.salesAccountability.metric === "ACTIVITY" ? task.salesAccountability.unit : task.salesAccountability.metric.replaceAll("_", " ")} · {task.progress}%</span></div>
          </div>
          <div className={styles.progressTrack} role="progressbar" aria-label={`${task.title} progress`} aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${task.progress}%` }} /></div>
          {task.reportedProgress !== task.progress && <p className={styles.reportedProgress}>Reported {task.reportedProgress}% <span>·</span> Reviewed / CRM-backed {task.progress}%</p>}
          <div className={styles.taskDescription}>
            {task.description && <MarkdownContent className={styles.markdown}>{task.description}</MarkdownContent>}
            <div className={styles.expectedOutcome}><strong>Expected outcome</strong><MarkdownContent className={styles.markdown}>{task.salesAccountability.expectedOutcome}</MarkdownContent></div>
          </div>
          <div className={styles.assignmentMeta}><Users size={15} /><span>{task.assignedBy?.name ?? "Unavailable user"} assigned to {task.assignedTo?.name ?? "Unavailable user"}</span><i /><span>Period starts {new Date(task.salesAccountability.periodStart).toLocaleDateString("en-IN")}</span><i /><span>Due {new Date(task.deadline).toLocaleString("en-IN")}</span></div>
          <div className={styles.cardActions}>{task.canDelegate && <button className={action} onClick={() => setCreating({ parent: task })}><Users size={15} />Delegate sub-task</button>}{task.canReport && <button className={action} onClick={() => setReporting(task)}><Activity size={15} />Report progress</button>}{task.canReview && <button className={`${action} ${styles.primaryAction}`} onClick={() => setReviewing(task)}><Check size={15} />Review evidence</button>}{task.canComment && <button className={action} onClick={() => setCommenting(task)}>Add comment</button>}</div>
          <details className={styles.history}>
            <summary>Reports, evidence &amp; activity history <span>{task.salesAccountability.reports.length + task.workflowHistory.length}</span></summary>
            <div className={styles.historyContent}>
              {[...task.salesAccountability.reports].reverse().map((report, index) => <div key={index} className={styles.reportEntry}><p className={styles.entryMeta}>{report.actorId?.name ?? task.assignedTo?.name} <span>·</span> {new Date(report.createdAt).toLocaleString("en-IN")}</p><div className={styles.markdown}><MarkdownContent>{report.summary}</MarkdownContent></div><div className={styles.evidence}><strong>Evidence</strong><MarkdownContent className={styles.markdown}>{report.evidence}</MarkdownContent></div></div>)}
              {[...task.workflowHistory].reverse().map((event, index) => <div key={index} className={styles.activityEntry}><span>{event.actorId?.name ?? "Unavailable user"}</span><strong>{event.action.replaceAll("_", " ")}</strong><time>{new Date(event.createdAt).toLocaleString("en-IN")}</time>{event.note && <MarkdownContent className={styles.markdown}>{event.note}</MarkdownContent>}</div>)}
              {!task.salesAccountability.reports.length && !task.workflowHistory.length && <p className={styles.emptyHistory}>No reports or activity yet.</p>}
            </div>
          </details>
        </div>
      </article>;
    })}
    {creating && <CreateDialog data={data} parent={creating.parent} onClose={() => setCreating(null)} onSaved={changed} />}
    {reporting && <ReportDialog task={reporting} onClose={() => setReporting(null)} onSaved={changed} />}
    {reviewing && <ReviewDialog task={reviewing} onClose={() => setReviewing(null)} onSaved={changed} />}
    {commenting && <CommentDialog task={commenting} onClose={() => setCommenting(null)} onSaved={changed} />}
  </section>;
}

function Dialog({ title, onClose, children, variant = "default" }: { title: string; onClose: () => void; children: ReactNode; variant?: "default" | "report" }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-label={title} onCancel={onClose} onClose={onClose} className={`${styles.dialog} ${variant === "report" ? styles.reportDialog : ""} m-auto max-h-[92dvh] w-full ${variant === "report" ? "max-w-3xl overflow-hidden" : "max-w-2xl overflow-y-auto"} rounded-2xl border border-(--brand-border) bg-white p-0 text-(--brand-text) backdrop:bg-black/40`}>
    <header className={`${styles.dialogHeader} ${variant === "report" ? styles.reportDialogHeader : ""}`}><div><span className={styles.eyebrow}>{variant === "report" ? "PROGRESS REPORT" : "SALES WORKSPACE"}</span><h2>{title}</h2></div><button type="button" onClick={onClose} className={`${action} ${styles.iconAction}`} aria-label={variant === "report" ? "Close progress report" : "Close Sales task dialog"}><X size={17} /></button></header>
    <div className={`${styles.dialogBody} ${variant === "report" ? styles.reportDialogBody : ""}`}>{children}</div>
  </dialog>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className={styles.field}>{label}{children}</label>; }

function MarkdownField({ label, name, rows = 3, maxLength, required = true, placeholder }: { label: string; name: string; rows?: number; maxLength: number; required?: boolean; placeholder?: string }) {
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState(false);
  const id = `sales-markdown-${name}`;
  return <div className={styles.markdownField}>
    <label className={styles.fieldLabel} htmlFor={id}>{label}</label>
    <div className={styles.editor}>
      <div className={styles.editorToolbar}><span>Markdown supported</span><div role="group" aria-label={`${label} editor view`}><button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Write</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button></div></div>
      {preview
        ? <><input type="hidden" name={name} value={value} /><div className={`${styles.markdownPreview} ${styles.markdown}`}><MarkdownContent>{value || "_Nothing to preview yet._"}</MarkdownContent></div></>
        : <textarea id={id} className={styles.editorTextarea} name={name} required={required} maxLength={maxLength} rows={rows} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />}
      <p className={styles.editorHint}>Use **bold**, headings, bullet lists and links to make updates easy to scan.</p>
    </div>
  </div>;
}

function LeadPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AccountabilityLeadPage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void SalesAccountabilityService.leads(search, page, abort.signal).then((data) => { if (!abort.signal.aborted) { setResult(data); setError(""); } }).catch((caught: unknown) => { if (!abort.signal.aborted) setError(errorMessage(caught)); });
    }, 250);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [search, page]);
  return <fieldset className={styles.leadPicker}><legend>Linked CRM leads <span>{ids.length} selected</span></legend><input aria-label="Search linked Sales leads" className={control} placeholder="Search leads" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); setResult(null); }} />{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.leadResults}>{result?.leads.map((lead) => <label key={lead._id} className={styles.leadOption}><input type="checkbox" checked={ids.includes(lead._id)} onChange={(event) => onChange(event.target.checked ? [...ids, lead._id] : ids.filter((id) => id !== lead._id))} /><span>{lead.name}<small>{lead.status.replaceAll("_", " ")}</small></span></label>)}</div><div className={styles.pickerActions}><button type="button" className={action} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={action} onClick={() => onChange([])}>Clear links</button><button type="button" className={action} disabled={!result || page >= result.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></fieldset>;
}

function CreateDialog({ data, parent, onClose, onSaved }: { data: SalesAccountabilityPage; parent?: SalesAccountabilityTask; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<SalesTaskKind>(parent ? "EXECUTION" : "TARGET");
  const [metric, setMetric] = useState<SalesTargetMetric>(parent ? "ACTIVITY" : "REVENUE");
  const [leadIds, setLeadIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const candidates = data.candidates.filter((candidate) => parent ? candidate.reportsTo === parent.assignedTo?._id : candidate.level === "HEAD");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? "");
    setBusy(true); setError("");
    try {
      await SalesAccountabilityService.create({
        title: text("title"), description: text("description"), assignedTo: text("assignedTo"), parentTaskId: parent?._id,
        deadline: new Date(text("deadline")).toISOString(), periodStart: text("periodStart") ? new Date(text("periodStart")).toISOString() : undefined, priority: text("priority") as CreateSalesAccountabilityInput["priority"],
        kind, metric, target: Number(text("target")), unit: text("unit") || "activities", currency: text("currency"), expectedOutcome: text("expectedOutcome"), leadIds,
      });
      onSaved();
    } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  return <Dialog title={parent ? `Delegate: ${parent.title}` : "Assign Sales department target"} onClose={onClose}><form onSubmit={submit}><fieldset disabled={busy} className="space-y-3">
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Field label="Task title"><input className={control} name="title" required minLength={2} maxLength={160} placeholder="e.g. Generate 500 qualified leads this month" /></Field>
    <MarkdownField label="Description / plan" name="description" maxLength={4000} placeholder={"## Plan\n- Define the target audience\n- Review progress each week"} />
    <Field label="Assigned to"><select className={control} name="assignedTo" required defaultValue=""><option value="">Select next-level Sales assignee</option>{candidates.map((candidate) => <option key={candidate.user._id} value={candidate.user._id}>{candidate.user.name} ({candidate.level})</option>)}</select></Field>
    {!candidates.length && <p className="text-sm text-red-700">No active next-level Sales team member is available. Check the reporting structure.</p>}
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Task type"><select className={control} value={kind} onChange={(event) => { const next = event.target.value as SalesTaskKind; setKind(next); if (next !== "TARGET") setMetric("ACTIVITY"); }} disabled={!parent}>{["TARGET", "EXECUTION", "LEAD_LINKED"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
    <Field label="Target metric"><select className={control} value={metric} onChange={(event) => setMetric(event.target.value as SalesTargetMetric)}>{(kind === "TARGET" ? ["REVENUE", "CUSTOMERS", "ACTIVITY", "STRATEGY"] : ["ACTIVITY", "STRATEGY"]).map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
    <Field label={metric === "REVENUE" ? "Target amount (rupees, not paise)" : "Target count / outcome units"}><input className={control} name="target" type="number" min="0.01" step="0.01" required defaultValue={metric === "STRATEGY" ? 1 : undefined} /></Field>
    {metric === "ACTIVITY" && <Field label="Activity unit (calls, qualified leads, demos, etc.)"><input className={control} name="unit" required maxLength={80} defaultValue={parent?.salesAccountability.unit ?? "activities"} /></Field>}
    <Field label="Currency"><input className={control} name="currency" required pattern="[A-Z]{3}" defaultValue={parent?.salesAccountability.currency ?? "INR"} /></Field>
    <Field label="Target period start (optional)"><input className={control} name="periodStart" type="datetime-local" /></Field><Field label="Deadline"><input className={control} name="deadline" type="datetime-local" required /></Field><Field label="Priority"><select className={control} name="priority" defaultValue="P2">{taskPriorityOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
    <MarkdownField label="Expected outcome / completion evidence" name="expectedOutcome" maxLength={2000} rows={2} placeholder="Describe what success looks like and how it will be verified." />
    <LeadPicker ids={leadIds} onChange={setLeadIds} />
    <p className="text-xs text-(--brand-text-muted)">Revenue and customer targets count distinct linked closed-won deals during the target period. Activity / strategy evidence requires review. Lead-linked tasks need exactly one lead in the assignee&apos;s scope.</p>
    <div className={styles.dialogFooter}><p>Revenue and customer targets use linked closed-won CRM deals. Activity and strategy work needs evidence and review.</p><button className={`${action} ${styles.primaryAction}`} disabled={busy || !candidates.length}>{busy ? "Assigning..." : <><Plus size={16} />Assign Sales task</>}</button></div>
  </fieldset></form></Dialog>;
}

function ReportDialog({ task, onClose, onSaved }: { task: SalesAccountabilityTask; onClose: () => void; onSaved: () => void }) {
  const [leadIds, setLeadIds] = useState(task.salesAccountability.leadIds);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const crm = ["REVENUE", "CUSTOMERS"].includes(task.salesAccountability.metric);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await SalesAccountabilityService.report(task._id, { summary: String(values.get("summary")), evidence: String(values.get("evidence")), achieved: Number(values.get("achieved") ?? 0), state: String(values.get("state")) as "ACTIVE" | "BLOCKED" | "REVIEW", leadIds });
      onSaved();
    } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  return <Dialog title={`Report: ${task.title}`} onClose={onClose} variant="report"><form onSubmit={submit}><fieldset disabled={busy} className={`${styles.formStack} ${styles.reportForm}`}>{error && <p role="alert" className={styles.error}>{error}</p>}
    <MarkdownField label="Progress, plan or blocker" name="summary" maxLength={4000} placeholder={"## Progress\n- Completed:\n- Next up:\n- Blocker:"} /><MarkdownField label="Completion evidence / CRM activity references" name="evidence" maxLength={4000} placeholder="Add links, CRM activity IDs, or supporting details." />
    {!crm && <Field label="Achieved count / outcome units (cumulative)"><input className={control} name="achieved" type="number" min={0} step="0.01" required defaultValue={task.salesAccountability.reports.at(-1)?.achieved ?? task.achieved} /></Field>}
    {crm && <p className={styles.infoNote}>Achieved value is calculated from linked closed-won CRM deals, not entered manually.</p>}
    <LeadPicker ids={leadIds} onChange={setLeadIds} />
    <div className={`${styles.dialogFooter} ${styles.reportFooter}`}><Field label="Next action"><select className={control} name="state"><option value="ACTIVE">Share progress</option><option value="BLOCKED">Escalate blocker</option><option value="REVIEW">Submit for review</option></select></Field><button className={`${action} ${styles.primaryAction}`} disabled={busy}>{busy ? "Saving..." : "Save progress report"}</button></div>
  </fieldset></form></Dialog>;
}

function ReviewDialog({ task, onClose, onSaved }: { task: SalesAccountabilityTask; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try { await SalesAccountabilityService.review(task._id, String(values.get("decision")) as "APPROVE" | "ENHANCEMENT", String(values.get("note"))); onSaved(); }
    catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  return <Dialog title={`Review: ${task.title}`} onClose={onClose}><form onSubmit={submit}><fieldset disabled={busy} className={styles.formStack}>{error && <p role="alert" className={styles.error}>{error}</p>}<p className={styles.infoNote}>Approval requires the target to be achieved and all child tasks reviewed and completed.</p><Field label="Decision"><select className={control} name="decision"><option value="APPROVE">Approve completion</option><option value="ENHANCEMENT">Request changes</option></select></Field><MarkdownField label="Review note" name="note" maxLength={500} rows={2} placeholder="Share a clear decision and actionable feedback." /><div className={styles.dialogFooter}><span /><button className={`${action} ${styles.primaryAction}`} disabled={busy}>{busy ? "Reviewing..." : "Submit review"}</button></div></fieldset></form></Dialog>;
}

function CommentDialog({ task, onClose, onSaved }: { task: SalesAccountabilityTask; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note"));
    setBusy(true); setError("");
    try { await SalesAccountabilityService.comment(task._id, note); onSaved(); }
    catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  return <Dialog title={`Comment: ${task.title}`} onClose={onClose}><form onSubmit={submit}><fieldset disabled={busy} className={styles.formStack}>{error && <p role="alert" className={styles.error}>{error}</p>}<MarkdownField label="Comment" name="note" maxLength={500} rows={3} placeholder="Write a useful update or question." /><div className={styles.dialogFooter}><span /><button className={`${action} ${styles.primaryAction}`} disabled={busy}>{busy ? "Saving..." : "Save comment"}</button></div></fieldset></form></Dialog>;
}
