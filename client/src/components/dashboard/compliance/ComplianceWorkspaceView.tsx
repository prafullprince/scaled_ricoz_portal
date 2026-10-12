"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  CalendarRange,
  Check,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Flag,
  Gauge,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Upload,
} from "lucide-react";
import {
  ComplianceService,
  type ComplianceCalendarEvent,
  type ComplianceCapability,
  type ComplianceCategory,
  type ComplianceDashboard,
  type ComplianceEvidence,
  type ComplianceIssue,
  type CompliancePolicy,
  type ComplianceRequirement,
  type ComplianceRisk,
} from "@/services/compliance.service";
import { useAppSelector } from "@/redux/hooks";

const recipientOptions = ["OWNER", "REVIEWER", "DEPARTMENT_HEAD", "COMPLIANCE_MANAGERS", "EXECUTIVES"];
const tabs: Array<{ id: string; label: string; icon: typeof ShieldCheck; capability?: ComplianceCapability }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "requirements", label: "Requirements", icon: ClipboardCheck },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "evidence", label: "Evidence", icon: FileCheck2 },
  { id: "approvals", label: "Approvals", icon: BadgeCheck, capability: "COMPLIANCE_APPROVE" },
  { id: "risks", label: "Risk register", icon: TriangleAlert, capability: "COMPLIANCE_MANAGE_RISKS" },
  { id: "issues", label: "Issues", icon: Flag },
  { id: "policies", label: "Policies", icon: FileText },
  { id: "audits", label: "Audit trail", icon: ShieldCheck, capability: "COMPLIANCE_AUDIT" },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "reports", label: "Reports", icon: ArrowDownToLine },
  { id: "settings", label: "Settings", icon: Settings2, capability: "COMPLIANCE_MANAGE_SETTINGS" },
];
const label = (value?: string | null) => value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not set";
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No date";
const categoryName = (category: ComplianceCategory | string) => typeof category === "string" ? "Category" : category.name;

export function ComplianceWorkspaceView({ settingsOnly = false }: { settingsOnly?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAppSelector((state) => state.auth.user);
  const routeView = pathname.split("/").filter(Boolean).at(-1) ?? "compliance";
  const view = settingsOnly ? "settings" : routeView === "compliance" ? "overview" : routeView;
  const department = searchParams.get("department") ?? user?.organization_department ?? "";
  const [capabilities, setCapabilities] = useState<Partial<Record<ComplianceCapability, boolean>>>({});
  const [categories, setCategories] = useState<ComplianceCategory[]>([]);
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [events, setEvents] = useState<ComplianceCalendarEvent[]>([]);
  const [risks, setRisks] = useState<ComplianceRisk[]>([]);
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [evidence, setEvidence] = useState<ComplianceEvidence[]>([]);
  const [notifications, setNotifications] = useState<Array<{ _id: string; title: string; message: string; dueDate: string; readAt: string | null }>>([]);
  const [auditEvents, setAuditEvents] = useState<Array<{ _id: string; actorId: { name?: string } | null; actorType: string; action: string; entityType: string; entityId: string; createdAt: string }>>([]);
  const [rules, setRules] = useState<Array<{ name: string; daysBeforeDue: number; recipients: string[]; active: boolean }>>([]);
  const [selectedRequirement, setSelectedRequirement] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let current = true;
    const query: Record<string, string> = department ? { departmentId: department } : {};
    ComplianceService.access().then((result) => { if (current) setCapabilities(result); }).catch(() => { if (current) setError("Compliance access could not be loaded."); });
    ComplianceService.categories().then((result) => { if (current) setCategories(result.filter((item) => item.active)); }).catch(() => undefined);
    const onFailure = () => { if (current) setError("Compliance information could not be loaded. Check your access and try again."); };
    if (view === "overview") ComplianceService.dashboard(query).then((result) => { if (current) setDashboard(result); }).catch(onFailure);
    if (["requirements", "approvals", "evidence"].includes(view)) {
      ComplianceService.requirements({ ...query, limit: "100" }).then((result) => { if (current) setRequirements(result.requirements); }).catch(onFailure);
    }
    if (view === "calendar") {
      const [year, monthNumber] = month.split("-").map(Number);
      const from = new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString();
      const to = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59)).toISOString();
      ComplianceService.calendar({ ...query, from, to }).then((result) => { if (current) setEvents(result); }).catch(onFailure);
    }
    if (view === "risks") ComplianceService.risks(query).then((result) => { if (current) setRisks(result); }).catch(onFailure);
    if (view === "issues") ComplianceService.issues(query).then((result) => { if (current) setIssues(result); }).catch(onFailure);
    if (view === "policies") ComplianceService.policies().then((result) => { if (current) setPolicies(result); }).catch(onFailure);
    if (view === "notifications") ComplianceService.notifications().then((result) => { if (current) setNotifications(result); }).catch(onFailure);
    if (view === "audits") ComplianceService.auditLogs().then((result) => { if (current) setAuditEvents(result); }).catch(onFailure);
    if (view === "settings" && capabilities.COMPLIANCE_MANAGE_SETTINGS) ComplianceService.notificationRules().then((result) => { if (current) setRules(result); }).catch(onFailure);
    if (view === "evidence" && selectedRequirement) ComplianceService.evidence(selectedRequirement).then((result) => { if (current) setEvidence(result); }).catch(onFailure);
    return () => { current = false; };
  }, [view, department, month, selectedRequirement, reloadKey, capabilities.COMPLIANCE_MANAGE_SETTINGS]);

  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const can = (capability: ComplianceCapability) => Boolean(capabilities[capability]);
  const visibleTabs = tabs.filter((tab) => !tab.capability || can(tab.capability));
  const filteredRequirements = requirements.filter((item) => `${item.title} ${item.description} ${item.departmentId ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 text-(--brand-text)">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-(--brand-border) pb-5">
        <div>
          <p className="text-xs font-semibold uppercase text-(--brand-red)">{department ? `${label(department)} department` : "Organization-wide"} · Internal management system</p>
          <h1 className="mt-1 text-2xl font-semibold text-(--brand-navy)">{settingsOnly ? "Compliance settings" : "Compliance Center"}</h1>
          <p className="mt-1 text-sm text-(--brand-text-secondary)">{dashboard?.metricLabel ?? "Configured obligations, evidence, decisions, and deadlines in one company-scoped workspace."}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-(--brand-border) px-3 text-sm font-semibold"><RefreshCw size={16} />Refresh</button>
          {can("COMPLIANCE_CREATE") && view === "requirements" ? <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-(--brand-red) px-3 text-sm font-semibold text-white"><Plus size={16} />New requirement</button> : null}
          {can("COMPLIANCE_VIEW") ? <Link href="/dashboard/settings/compliance" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-(--brand-border) px-3 text-sm font-semibold"><Settings2 size={16} />Settings</Link> : null}
        </div>
      </header>

      <nav aria-label="Compliance sections" className="flex gap-1 overflow-x-auto border-b border-(--brand-border) pb-2">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const href = tab.id === "overview" ? "/dashboard/compliance" : `/dashboard/compliance/${tab.id}`;
          return <Link key={tab.id} href={href} aria-current={view === tab.id ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${view === tab.id ? "border-(--brand-red) text-(--brand-red)" : "border-transparent text-(--brand-text-secondary) hover:text-(--brand-navy)"}`}><Icon size={16} />{tab.label}</Link>;
        })}
      </nav>

      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
      {busy ? <p role="status" className="flex items-center gap-2 text-sm text-(--brand-text-muted)"><LoaderCircle size={16} className="animate-spin" />Saving compliance changes</p> : null}

      {view === "overview" ? <Overview dashboard={dashboard} /> : null}
      {view === "requirements" ? <section className="space-y-4">
        {showForm && can("COMPLIANCE_CREATE") ? <RequirementForm categories={categories} department={department} onSubmit={(input) => perform(async () => { await ComplianceService.createRequirement(input); setShowForm(false); }, "Requirement created and recorded in the audit trail.")} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Requirements <span className="text-sm font-normal text-(--brand-text-muted)">{filteredRequirements.length}</span></h2><label className="flex h-10 items-center gap-2 rounded-md border border-(--brand-border) bg-white px-3"><Search size={15} /><input aria-label="Search requirements" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requirements" className="w-48 bg-transparent text-sm outline-none" /></label></div>
        <RequirementsTable requirements={filteredRequirements} onSubmit={(id) => perform(() => ComplianceService.submitRequirement(id), "Requirement submitted for review.")} canUpdate={can("COMPLIANCE_UPDATE")} />
      </section> : null}
      {view === "approvals" ? <section className="space-y-3"><h2 className="text-lg font-semibold">Review queue</h2><RequirementsTable requirements={requirements.filter((item) => ["PENDING_REVIEW", "PENDING_APPROVAL"].includes(item.status))} onSubmit={() => undefined} canUpdate={false} onDecision={(item, decision) => perform(() => item.status === "PENDING_REVIEW" ? ComplianceService.reviewRequirement(item._id, decision, decision === "REJECT" ? window.prompt("Reason for rejection") ?? undefined : undefined) : ComplianceService.decideRequirement(item._id, decision, decision === "REJECT" ? window.prompt("Reason for rejection") ?? undefined : undefined), decision === "APPROVE" ? "Decision recorded." : "Requirement returned to its owner.")} /></section> : null}
      {view === "calendar" ? <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Compliance calendar</h2><label className="flex items-center gap-2 text-sm">Month<input type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} className="h-10 rounded-md border border-(--brand-border) bg-white px-3" /></label></div><EventList events={events} /></section> : null}
      {view === "evidence" ? <EvidencePanel requirements={requirements} selected={selectedRequirement} onSelect={setSelectedRequirement} evidence={evidence} userId={user?.user_id ?? ""} canManageDocuments={can("COMPLIANCE_MANAGE_DOCUMENTS")} canVerify={can("COMPLIANCE_MANAGE_DOCUMENTS")} criticalApproval={can("COMPLIANCE_APPROVE")} onUpload={(form) => perform(() => ComplianceService.uploadEvidence(form), "Evidence uploaded privately.")} onDownload={(id) => perform(async () => { const blob = await ComplianceService.downloadEvidence(id); const href = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = href; link.download = evidence.find((item) => item._id === id)?.fileName ?? "compliance-evidence"; link.click(); URL.revokeObjectURL(href); }, "Evidence downloaded.")} onVerify={(id, decision) => perform(() => ComplianceService.verifyEvidence(id, decision, decision === "REJECTED" ? window.prompt("Reason for rejecting evidence") ?? undefined : undefined), "Evidence decision recorded.")} /> : null}
      {view === "risks" ? <RiskPanel risks={risks} canManage={can("COMPLIANCE_MANAGE_RISKS")} department={department} onCreate={(input) => perform(() => ComplianceService.createRisk(input), "Risk added to the register.")} /> : null}
      {view === "issues" ? <IssuePanel issues={issues} canUpdate={can("COMPLIANCE_UPDATE")} department={department} onCreate={(input) => perform(() => ComplianceService.createIssue(input), "Issue reported and assigned to your organization.")} onUpdate={(id, input) => perform(() => ComplianceService.updateIssue(id, input), "Issue updated.")} /> : null}
      {view === "policies" ? <PolicyPanel policies={policies} canManage={can("COMPLIANCE_MANAGE_POLICIES")} canApprove={can("COMPLIANCE_APPROVE")} onAcknowledge={(id) => perform(() => ComplianceService.acknowledgePolicy(id), "Policy acknowledgement recorded.")} onPublish={(id) => perform(() => ComplianceService.publishPolicy(id), "Policy published.")} onCreate={(input) => perform(() => ComplianceService.createPolicy(input), "Policy draft created.")} /> : null}
      {view === "audits" ? <AuditPanel events={auditEvents} /> : null}
      {view === "notifications" ? <NotificationPanel notifications={notifications} onRead={(id) => perform(() => ComplianceService.markRead(id), "Notification marked as read.")} /> : null}
      {view === "reports" ? <ReportPanel department={department} onExport={() => perform(async () => { const blob = await ComplianceService.reportCsv(department ? { departmentId: department } : {}); const href = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = href; link.download = "ricoz-compliance-report.csv"; link.click(); URL.revokeObjectURL(href); }, "Report downloaded.")} /> : null}
      {view === "settings" ? <SettingsPanel categories={categories} rules={rules} canManage={can("COMPLIANCE_MANAGE_SETTINGS")} onCreateCategory={(input) => perform(() => ComplianceService.createCategory(input), "Category added.")} onRulesChange={setRules} onSaveRules={() => perform(() => ComplianceService.saveNotificationRules(rules), "Reminder rules saved.")} /> : null}
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 border-y border-(--brand-border) py-4 ${className}`}>{children}</section>;
}

function Overview({ dashboard }: { dashboard: ComplianceDashboard | null }) {
  const metrics = dashboard?.metrics;
  const stats = [
    ["Total requirements", metrics?.total ?? 0, ClipboardCheck],
    ["Compliant", metrics?.compliant ?? 0, CircleCheck],
    ["Due soon", metrics?.dueSoon ?? 0, Clock3],
    ["Overdue", metrics?.overdue ?? 0, CircleAlert],
    ["Expiring soon", metrics?.expiringSoon ?? 0, CalendarRange],
    ["Pending approval", metrics?.pendingApproval ?? 0, BadgeCheck],
    ["High risk", metrics?.highRisk ?? 0, TriangleAlert],
    ["Open issues", metrics?.openIssues ?? 0, Flag],
  ] as const;
  const maxStatus = Math.max(1, ...(dashboard?.byStatus.map((item) => item.count) ?? [1]));
  const maxDepartment = Math.max(1, ...(dashboard?.byDepartment.map((item) => item.count) ?? [1]));
  return <div className="space-y-7">
    <section aria-label="Compliance indicators" className="grid grid-cols-2 border-y border-(--brand-border) sm:grid-cols-4">
      {stats.map(([name, value, Icon]) => <div key={name} className="flex min-h-24 items-start gap-3 border-b border-r border-(--brand-border) p-4 last:border-r-0"><Icon size={17} className="mt-1 shrink-0 text-(--brand-red)" /><div><p className="text-xs text-(--brand-text-muted)">{name}</p><strong className="mt-1 block text-2xl text-(--brand-navy)">{value}</strong></div></div>)}
    </section>
    <div className="grid gap-8 lg:grid-cols-2">
      <Panel><h2 className="font-semibold text-(--brand-navy)">Requirement status</h2><div className="mt-4 space-y-3">{dashboard?.byStatus.length ? dashboard.byStatus.map((item) => <div key={item._id} className="grid grid-cols-[130px_1fr_36px] items-center gap-3 text-sm"><span className="truncate">{label(item._id)}</span><div className="h-2 bg-(--brand-surface-hover)"><div className="h-full bg-(--brand-red)" style={{ width: `${Math.max(3, item.count / maxStatus * 100)}%` }} /></div><strong className="text-right">{item.count}</strong></div>) : <Empty>No requirements have been configured.</Empty>}</div></Panel>
      <Panel><h2 className="font-semibold text-(--brand-navy)">Requirements by department</h2><div className="mt-4 space-y-3">{dashboard?.byDepartment.length ? dashboard.byDepartment.map((item) => <div key={item._id ?? "unassigned"} className="grid grid-cols-[130px_1fr_36px] items-center gap-3 text-sm"><span className="truncate">{label(item._id)}</span><div className="h-2 bg-(--brand-surface-hover)"><div className="h-full bg-emerald-600" style={{ width: `${Math.max(3, item.count / maxDepartment * 100)}%` }} /></div><strong className="text-right">{item.count}</strong></div>) : <Empty>No department data yet.</Empty>}</div></Panel>
    </div>
    <Panel><div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold text-(--brand-navy)">Action required</h2><p className="mt-1 text-xs text-(--brand-text-muted)">Items due, awaiting a decision, or flagged for attention</p></div><Link href="/dashboard/compliance/requirements" className="inline-flex items-center gap-1 text-sm font-semibold text-(--brand-red)">All requirements <ArrowRight size={15} /></Link></div><RequirementsTable requirements={dashboard?.actionRequired ?? []} onSubmit={() => undefined} canUpdate={false} compact /></Panel>
    <p className="text-xs text-(--brand-text-muted)">Updated {dashboard?.generatedAt ? new Date(dashboard.generatedAt).toLocaleString() : "when data loads"}. This is an internal management view, not a legal compliance determination.</p>
  </div>;
}

function RequirementsTable({ requirements, onSubmit, canUpdate, onDecision, compact = false }: { requirements: ComplianceRequirement[]; onSubmit: (id: string) => void; canUpdate: boolean; onDecision?: (item: ComplianceRequirement, decision: "APPROVE" | "REJECT") => void; compact?: boolean }) {
  if (!requirements.length) return <Empty>No requirements need attention in this view.</Empty>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-(--brand-border) text-xs text-(--brand-text-muted)"><tr><th className="py-3 pr-4 font-medium">Requirement</th><th className="py-3 pr-4 font-medium">Department</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 pr-4 font-medium">Risk</th><th className="py-3 pr-4 font-medium">Due</th><th className="py-3 font-medium">Owner / action</th></tr></thead><tbody className="divide-y divide-(--brand-border)">{requirements.map((item) => <tr key={item._id} className="align-top"><td className="max-w-xs py-3 pr-4"><strong className="block break-words text-(--brand-navy)">{item.title}</strong><span className="mt-1 block text-xs text-(--brand-text-muted)">{categoryName(item.categoryId)}</span></td><td className="py-3 pr-4">{label(item.departmentId)}</td><td className="py-3 pr-4"><StatusBadge value={item.status} /></td><td className="py-3 pr-4"><StatusBadge value={item.riskLevel} /></td><td className="py-3 pr-4">{dateLabel(item.dueDate)}</td><td className="py-3">{onDecision && ["PENDING_REVIEW", "PENDING_APPROVAL"].includes(item.status) ? <div className="flex gap-2"><button onClick={() => onDecision(item, "APPROVE")} className="text-xs font-semibold text-emerald-700">Approve</button><button onClick={() => onDecision(item, "REJECT")} className="text-xs font-semibold text-red-700">Return</button></div> : canUpdate && !compact && ["NOT_STARTED", "IN_PROGRESS", "PARTIALLY_COMPLIANT", "NON_COMPLIANT"].includes(item.status) ? <button onClick={() => onSubmit(item._id)} className="text-xs font-semibold text-(--brand-red)">Submit for review</button> : <span className="text-xs text-(--brand-text-muted)">{typeof item.ownerId === "object" ? item.ownerId?.name ?? "Unassigned" : item.ownerId ? "Assigned" : "Unassigned"}</span>}</td></tr>)}</tbody></table></div>;
}

function StatusBadge({ value }: { value: string }) {
  const color = ["COMPLIANT", "VERIFIED", "PUBLISHED", "RESOLVED", "CLOSED"].includes(value) ? "bg-emerald-50 text-emerald-800" : ["CRITICAL", "NON_COMPLIANT", "EXPIRED", "REJECTED", "OVERDUE"].includes(value) ? "bg-red-50 text-red-800" : ["HIGH", "PENDING_APPROVAL", "PENDING_REVIEW", "IN_REMEDIATION"].includes(value) ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold ${color}`}>{label(value)}</span>;
}

function RequirementForm({ categories, department, onSubmit }: { categories: ComplianceCategory[]; department: string; onSubmit: (input: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sourceType, setSourceType] = useState("SYSTEM_CONFIGURATION");
  const [sourceReference, setSourceReference] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [applicability, setApplicability] = useState("REVIEW_REQUIRED");
  const [riskLevel, setRiskLevel] = useState("MEDIUM");
  function submit(event: FormEvent) { event.preventDefault(); onSubmit({ title, categoryId, departmentId: department || null, dueDate: dueDate || null, sourceType, sourceReference, jurisdiction, applicability, riskLevel }); }
  return <form onSubmit={submit} className="grid gap-3 border-y border-(--brand-border) py-4 sm:grid-cols-2 lg:grid-cols-4">
    <input required minLength={3} maxLength={200} aria-label="Requirement title" placeholder="Requirement title" value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
    <select required aria-label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}><option value="">Choose category</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>
    <select aria-label="Department" value={department} onChange={() => undefined} disabled className={inputClass}><option>{label(department)}</option></select>
    <input type="date" aria-label="Due date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} />
    <select aria-label="Source type" value={sourceType} onChange={(event) => setSourceType(event.target.value)} className={inputClass}>{["SYSTEM_CONFIGURATION", "COMPANY_POLICY", "CONTRACTUAL_OBLIGATION", "INDUSTRY_STANDARD", "LEGAL_REGULATORY", "INTERNAL_CONTROL"].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select>
    <input maxLength={120} aria-label="Jurisdiction" placeholder="Jurisdiction (optional)" value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} className={inputClass} />
    <input maxLength={500} aria-label="Source reference" placeholder="Source reference (optional)" value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} className={inputClass} />
    <select aria-label="Applicability" value={applicability} onChange={(event) => setApplicability(event.target.value)} className={inputClass}><option value="REVIEW_REQUIRED">Applicability to review</option><option value="APPLICABLE">Applicable</option><option value="NOT_APPLICABLE">Not applicable</option></select>
    <select aria-label="Risk level" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)} className={inputClass}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((item) => <option key={item}>{item}</option>)}</select>
    <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-semibold text-white sm:col-span-2 lg:col-span-4"><Plus size={16} />Create requirement</button>
  </form>;
}

function EventList({ events }: { events: ComplianceCalendarEvent[] }) {
  if (!events.length) return <Empty>No deadlines, renewals, or reviews are scheduled for this month.</Empty>;
  return <div className="divide-y divide-(--brand-border)">{events.map((event) => <article key={event.id} className="flex flex-wrap items-center gap-4 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-(--brand-surface-hover) text-(--brand-red)"><CalendarDays size={18} /></span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{event.title}</p><p className="mt-1 text-xs text-(--brand-text-muted)">{label(event.kind)} · {dateLabel(event.date)}</p></div><StatusBadge value={event.riskLevel ?? "MEDIUM"} /></article>)}</div>;
}

function EvidencePanel({ requirements, selected, onSelect, evidence, userId, canManageDocuments, canVerify, criticalApproval, onUpload, onDownload, onVerify }: { requirements: ComplianceRequirement[]; selected: string; onSelect: (id: string) => void; evidence: ComplianceEvidence[]; userId: string; canManageDocuments: boolean; canVerify: boolean; criticalApproval: boolean; onUpload: (form: FormData) => void; onDownload: (id: string) => void; onVerify: (id: string, decision: "VERIFIED" | "REJECTED") => void }) {
  const requirement = requirements.find((item) => item._id === selected);
  const ownerId = typeof requirement?.ownerId === "string" ? requirement.ownerId : requirement?.ownerId?._id;
  const canUpload = canManageDocuments || ownerId === userId;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const form = new FormData(event.currentTarget); form.set("requirementId", selected); onUpload(form); event.currentTarget.reset(); }
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Documents &amp; evidence</h2><p className="mt-1 text-xs text-(--brand-text-muted)">Files are private and only returned after requirement-level authorization.</p></div><select aria-label="Requirement for evidence" value={selected} onChange={(event) => onSelect(event.target.value)} className={inputClass}><option value="">Choose requirement</option>{requirements.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></div>
    {selected && canUpload ? <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-y border-(--brand-border) py-4"><label className="grid gap-2 text-xs font-semibold">Evidence file<input required name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="max-w-full text-sm" /></label><label className="grid gap-2 text-xs font-semibold">Document type<input name="documentType" required maxLength={120} className={inputClass} /></label><label className="grid gap-2 text-xs font-semibold">Expiry date<input name="expiryDate" type="date" className={inputClass} /></label><button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-semibold text-white"><Upload size={16} />Upload</button></form> : null}
    {!selected ? <Empty>Select a requirement to review or submit its evidence.</Empty> : !evidence.length ? <Empty>No evidence has been attached yet.</Empty> : <div className="divide-y divide-(--brand-border)">{evidence.map((item) => <article key={item._id} className="flex flex-wrap items-center gap-3 py-4"><FileText size={18} className="text-(--brand-red)" /><div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold">{item.fileName}</p><p className="mt-1 text-xs text-(--brand-text-muted)">{item.documentType || "Evidence"} · {Math.ceil(item.fileSize / 1024)} KB · Expires {dateLabel(item.expiryDate)}</p></div><StatusBadge value={item.verificationStatus} /><button type="button" onClick={() => onDownload(item._id)} className="inline-flex min-h-9 items-center gap-1 rounded border border-(--brand-border) px-3 text-xs font-semibold"><ArrowDownToLine size={14} />Download</button>{canVerify && item.verificationStatus === "PENDING" && (requirement?.riskLevel !== "CRITICAL" || criticalApproval) ? <div className="flex gap-2"><button type="button" onClick={() => onVerify(item._id, "VERIFIED")} className="text-xs font-semibold text-emerald-700">Verify</button><button type="button" onClick={() => onVerify(item._id, "REJECTED")} className="text-xs font-semibold text-red-700">Reject</button></div> : null}</article>)}</div>}</section>;
}

function RiskPanel({ risks, canManage, department, onCreate }: { risks: ComplianceRisk[]; canManage: boolean; department: string; onCreate: (input: Record<string, unknown>) => void }) {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [mitigation, setMitigation] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); onCreate({ title, departmentId: department || null, likelihood, impact, mitigation }); setShow(false); }
  return <section className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Risk register</h2><p className="mt-1 text-xs text-(--brand-text-muted)">Scores are internal prioritization signals, not a legal materiality assessment.</p></div>{canManage ? <button onClick={() => setShow((value) => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-(--brand-red) px-3 text-sm font-semibold text-white"><Plus size={15} />Add risk</button> : null}</div>
    {show ? <form onSubmit={submit} className="grid gap-3 border-y border-(--brand-border) py-4 sm:grid-cols-4"><input required aria-label="Risk title" placeholder="Risk title" value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} /><label className="grid gap-1 text-xs">Likelihood (1–5)<input type="number" min={1} max={5} value={likelihood} onChange={(event) => setLikelihood(Number(event.target.value))} className={inputClass} /></label><label className="grid gap-1 text-xs">Impact (1–5)<input type="number" min={1} max={5} value={impact} onChange={(event) => setImpact(Number(event.target.value))} className={inputClass} /></label><input aria-label="Mitigation" placeholder="Mitigation plan" value={mitigation} onChange={(event) => setMitigation(event.target.value)} className={inputClass} /><button className="min-h-10 rounded-md bg-(--brand-red) px-4 text-sm font-semibold text-white sm:col-span-4">Save risk</button></form> : null}
    {!risks.length ? <Empty>No risks have been recorded.</Empty> : <div className="divide-y divide-(--brand-border)">{risks.map((risk) => <article key={risk._id} className="flex flex-wrap items-center gap-4 py-4"><TriangleAlert size={18} className="text-amber-700" /><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{risk.title}</h3><p className="mt-1 text-xs text-(--brand-text-muted)">{label(risk.departmentId)} · {risk.mitigation || "Mitigation not recorded"}</p></div><strong className="text-sm">Score {risk.riskScore}/25</strong><StatusBadge value={risk.riskLevel} /></article>)}</div>}</section>;
}

function IssuePanel({ issues, canUpdate, department, onCreate, onUpdate }: { issues: ComplianceIssue[]; canUpdate: boolean; department: string; onCreate: (input: Record<string, unknown>) => void; onUpdate: (id: string, input: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  function submit(event: FormEvent) { event.preventDefault(); onCreate({ title, description, severity, departmentId: department || null }); setTitle(""); setDescription(""); }
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">Issues &amp; corrective actions</h2><p className="mt-1 text-xs text-(--brand-text-muted)">Report a concern with an owner, root cause, and remediation history.</p></div><form onSubmit={submit} className="grid gap-3 border-y border-(--brand-border) py-4 sm:grid-cols-[1fr_160px_2fr_auto]"><input required minLength={3} aria-label="Issue title" placeholder="Issue title" value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} /><select aria-label="Severity" value={severity} onChange={(event) => setSeverity(event.target.value)} className={inputClass}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((item) => <option key={item}>{item}</option>)}</select><input aria-label="Issue description" placeholder="Describe the concern" value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} /><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-semibold text-white"><Plus size={15} />Report</button></form>
    {!issues.length ? <Empty>No open issues have been reported.</Empty> : <div className="divide-y divide-(--brand-border)">{issues.map((issue) => <article key={issue._id} className="flex flex-wrap items-center gap-4 py-4"><CircleAlert size={18} className="text-(--brand-red)" /><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{issue.title}</h3><p className="mt-1 text-xs text-(--brand-text-muted)">{issue.description || label(issue.departmentId)}</p></div><StatusBadge value={issue.severity} /><StatusBadge value={issue.status} />{canUpdate && issue.status !== "RESOLVED" && issue.status !== "CLOSED" ? <button onClick={() => onUpdate(issue._id, { status: "RESOLVED", correctiveAction: window.prompt("Describe the corrective action") ?? "" })} className="text-xs font-semibold text-emerald-700">Resolve</button> : null}</article>)}</div>}</section>;
}

function PolicyPanel({ policies, canManage, canApprove, onAcknowledge, onPublish, onCreate }: { policies: CompliancePolicy[]; canManage: boolean; canApprove: boolean; onAcknowledge: (id: string) => void; onPublish: (id: string) => void; onCreate: (input: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("1.0");
  function submit(event: FormEvent) { event.preventDefault(); onCreate({ title, version }); setTitle(""); }
  return <section className="space-y-4"><div><h2 className="text-lg font-semibold">Policies</h2><p className="mt-1 text-xs text-(--brand-text-muted)">Published policies are filtered by department and role applicability.</p></div>{canManage ? <form onSubmit={submit} className="flex flex-wrap gap-3 border-y border-(--brand-border) py-4"><input required aria-label="Policy title" placeholder="Policy title" value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} /><input required aria-label="Policy version" value={version} onChange={(event) => setVersion(event.target.value)} className={inputClass} /><button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-semibold text-white"><Plus size={15} />Create draft</button></form> : null}{!policies.length ? <Empty>No applicable policies are published.</Empty> : <div className="divide-y divide-(--brand-border)">{policies.map((policy) => <article key={policy._id} className="flex flex-wrap items-center gap-4 py-4"><FileText size={18} className="text-(--brand-red)" /><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{policy.title}</h3><p className="mt-1 text-xs text-(--brand-text-muted)">Version {policy.version} · Effective {dateLabel(policy.effectiveDate)} · Review {dateLabel(policy.reviewDate)}</p></div><StatusBadge value={policy.status} />{policy.status === "PUBLISHED" && !policy.acknowledged ? <button onClick={() => onAcknowledge(policy._id)} className="text-xs font-semibold text-(--brand-red)">Acknowledge</button> : policy.acknowledged ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Check size={14} />Acknowledged</span> : canApprove && policy.status !== "RETIRED" ? <button onClick={() => onPublish(policy._id)} className="text-xs font-semibold text-emerald-700">Publish</button> : null}</article>)}</div>}</section>;
}

function AuditPanel({ events }: { events: Array<{ _id: string; actorId: { name?: string } | null; actorType: string; action: string; entityType: string; entityId: string; createdAt: string }> }) {
  return <section><h2 className="text-lg font-semibold">Immutable activity log</h2><div className="mt-4 divide-y divide-(--brand-border)">{events.length ? events.map((event) => <article key={event._id} className="grid gap-2 py-4 sm:grid-cols-[180px_1fr_180px]"><time className="text-xs text-(--brand-text-muted)">{new Date(event.createdAt).toLocaleString()}</time><div><strong className="text-sm">{label(event.action)}</strong><p className="mt-1 text-xs text-(--brand-text-muted)">{label(event.entityType)} · {event.entityId}</p></div><span className="text-xs text-(--brand-text-secondary)">{event.actorType === "SYSTEM" ? "System worker" : event.actorId?.name ?? "User"}</span></article>) : <Empty>No audit activity is recorded yet.</Empty>}</div></section>;
}

function NotificationPanel({ notifications, onRead }: { notifications: Array<{ _id: string; title: string; message: string; dueDate: string; readAt: string | null }>; onRead: (id: string) => void }) {
  return <section><h2 className="text-lg font-semibold">Notifications</h2><div className="mt-4 divide-y divide-(--brand-border)">{notifications.length ? notifications.map((item) => <article key={item._id} className="flex flex-wrap items-center gap-3 py-4"><Bell size={17} className={item.readAt ? "text-(--brand-text-muted)" : "text-(--brand-red)"} /><div className="min-w-0 flex-1"><strong className="text-sm">{item.title}</strong><p className="mt-1 text-xs text-(--brand-text-secondary)">{item.message} · {dateLabel(item.dueDate)}</p></div>{!item.readAt ? <button onClick={() => onRead(item._id)} className="text-xs font-semibold text-(--brand-red)">Mark read</button> : <span className="text-xs text-(--brand-text-muted)">Read</span>}</article>) : <Empty>There are no compliance notifications.</Empty>}</div></section>;
}

function ReportPanel({ department, onExport }: { department: string; onExport: () => void }) {
  return <section className="max-w-2xl space-y-4"><h2 className="text-lg font-semibold">Compliance summary report</h2><p className="text-sm leading-6 text-(--brand-text-secondary)">Export includes requirement status, category, department, risk, due and renewal dates, configured source, and generation metadata. Access follows your department scope.</p><div className="flex items-center gap-3 border-y border-(--brand-border) py-4 text-sm"><span>Department</span><StatusBadge value={department || "ORGANIZATION"} /></div><button onClick={onExport} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-semibold text-white"><ArrowDownToLine size={16} />Download CSV</button><p className="text-xs text-(--brand-text-muted)">Generated reports identify the time, user, period, and company data source. PDF export is not enabled in this release.</p></section>;
}

function SettingsPanel({ categories, rules, canManage, onCreateCategory, onRulesChange, onSaveRules }: { categories: ComplianceCategory[]; rules: Array<{ name: string; daysBeforeDue: number; recipients: string[]; active: boolean }>; canManage: boolean; onCreateCategory: (input: { key: string; name: string; description: string }) => void; onRulesChange: (rules: Array<{ name: string; daysBeforeDue: number; recipients: string[]; active: boolean }>) => void; onSaveRules: () => void }) {
  const [categoryName, setCategoryName] = useState("");
  function createCategory(event: FormEvent) { event.preventDefault(); const key = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); onCreateCategory({ key, name: categoryName, description: "Company-configured compliance category; applicability is determined by the company." }); setCategoryName(""); }
  return <div className="space-y-8"><section><h2 className="text-lg font-semibold">Categories</h2><p className="mt-1 text-xs text-(--brand-text-muted)">Categories classify records; they do not declare legal obligations.</p><div className="mt-3 flex flex-wrap gap-2">{categories.map((category) => <StatusBadge key={category._id} value={category.name} />)}</div>{canManage ? <form onSubmit={createCategory} className="mt-4 flex flex-wrap gap-3"><input required minLength={2} aria-label="New category name" placeholder="Add category" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} className={inputClass} /><button className="min-h-10 rounded-md border border-(--brand-border) px-4 text-sm font-semibold">Add category</button></form> : null}</section><section><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Reminder schedule</h2><p className="mt-1 text-xs text-(--brand-text-muted)">Offsets are measured from the requirement or evidence due date. Negative offsets escalate after due.</p></div>{canManage ? <button onClick={onSaveRules} className="min-h-10 rounded-md bg-(--brand-red) px-4 text-sm font-semibold text-white">Save schedule</button> : null}</div><div className="mt-3 divide-y divide-(--brand-border)">{rules.map((rule, index) => <article key={`${rule.daysBeforeDue}-${index}`} className="grid gap-3 py-4 sm:grid-cols-[1fr_140px_180px_auto]"><input aria-label="Reminder name" value={rule.name} onChange={(event) => onRulesChange(rules.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} disabled={!canManage} className={inputClass} /><label className="grid gap-1 text-xs">Days before (negative = overdue)<input type="number" min={-365} max={365} value={rule.daysBeforeDue} disabled={!canManage} onChange={(event) => onRulesChange(rules.map((item, itemIndex) => itemIndex === index ? { ...item, daysBeforeDue: Number(event.target.value) } : item))} className={inputClass} /></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={rule.active} disabled={!canManage} onChange={(event) => onRulesChange(rules.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item))} />Enabled</label><button type="button" disabled={!canManage} onClick={() => onRulesChange(rules.filter((_, itemIndex) => itemIndex !== index))} className="text-xs font-semibold text-red-700 disabled:opacity-50">Remove</button><div className="flex flex-wrap gap-3 sm:col-span-4">{recipientOptions.map((recipient) => <label key={recipient} className="flex items-center gap-1.5 text-xs"><input type="checkbox" disabled={!canManage} checked={rule.recipients.includes(recipient)} onChange={(event) => onRulesChange(rules.map((item, itemIndex) => itemIndex === index ? { ...item, recipients: event.target.checked ? [...item.recipients, recipient] : item.recipients.filter((value) => value !== recipient) } : item))} />{label(recipient)}</label>)}</div></article>)}</div>{canManage ? <button onClick={() => onRulesChange([...rules, { name: "New reminder", daysBeforeDue: 3, recipients: ["OWNER"], active: true }])} className="mt-3 inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-(--brand-red)"><Plus size={15} />Add reminder rule</button> : null}</section><Link href="/dashboard/compliance" className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-red)">Back to overview <ArrowRight size={15} /></Link></div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="border-y border-dashed border-(--brand-border) py-8 text-center text-sm text-(--brand-text-muted)">{children}</p>;
}

const inputClass = "min-h-10 min-w-0 rounded-md border border-(--brand-border) bg-white px-3 text-sm text-(--brand-text) outline-none focus:border-(--brand-red)";
