"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Bot, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, LoaderCircle, Send, UserRound, UserRoundCheck, Users, WalletCards, XCircle } from "lucide-react";
import { streamAssistant, type AssistantMessage } from "@/services/assistant.service";
import { HrService } from "@/services/hr.service";
import { HrFinanceWorkspace } from "./HrFinanceWorkspace";
import { HrDocumentsWorkspace } from "./HrDocumentsWorkspace";
import { CandidateSourceWorkspace } from "./CandidateSourceWorkspace";
import type { HrDashboardData, HrLeaveRequest } from "@/types/hr";
import { DashboardError, DashboardSkeleton } from "../DashboardPrimitives";
import { ManagerTeamMemberDialog } from "../ManagerTeamMemberDialog";
import { useAppSelector } from "@/redux/hooks";
import { setActiveCompanyId } from "@/lib/company";
import { useRouter } from "next/navigation";
import { MyWorkInbox, type MyWorkItem } from "../MyWorkInbox";

export type HrView = "dashboard" | "work" | "calendar" | "approvals" | "requests" | "people" | "finance" | "documents" | "training" | "employee-os" | "reports" | "assistant" | "candidate-source";

const title: Record<HrView, string> = { dashboard: "HR Dashboard", work: "My Work", calendar: "Calendar", approvals: "Approvals Queue", requests: "Department Requests", people: "HR & Payroll", finance: "Finance & Payroll", documents: "HR Documents", training: "Training & LMS", "employee-os": "Employee OS", reports: "HR Reports", assistant: "GEOS AI Assistant", "candidate-source": "Candidates Lists" };
const dateLabel = (value: string) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function HrWorkspace({ view }: { view: HrView }) {
  const user = useAppSelector((state) => state.auth.user);
  const systemHr = Boolean(user?.system_roles?.includes("HR"));
  const [data, setData] = useState<HrDashboardData | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => HrService.dashboard().then(setData).catch(() => setError("The HR workspace could not be loaded.")), []);
  useEffect(() => { if (view === "candidate-source" || (systemHr && view === "dashboard")) return; let active = true; HrService.dashboard().then((value) => active && setData(value)).catch(() => active && setError("The HR workspace could not be loaded.")); return () => { active = false; }; }, [systemHr, view]);
  if (systemHr && view === "dashboard") return <SystemHrPortfolio/>;
  if (view === "candidate-source") return <CandidateSourceWorkspace />;
  if (error && !data) return <DashboardError message={error} onRetry={load}/>;
  if (!data) return <DashboardSkeleton/>;
  const workItems: MyWorkItem[] = [
    ...data.tasks.filter((task) => task.status === "PENDING").map((task) => ({
      id: task._id, title: task.title, description: task.description, kind: "TASK" as const,
      priority: task.priority ?? "MEDIUM", dueAt: task.deadline, tags: ["HR", task.workflowStage?.replaceAll("_", " ") ?? "Assigned"],
      href: "/dashboard/admin/tasks?department=HR",
    })),
    ...data.leaveRequests.filter((leave) => leave.status === "PENDING").map((leave) => ({
      id: `leave:${leave.id}`, title: `${leave.employee?.name ?? "Employee"} · ${leave.type} leave`,
      description: leave.reason, kind: "APPROVAL" as const, priority: "MEDIUM", dueAt: leave.startDate,
      tags: ["Leave", `${leave.days} days`], href: "/dashboard/hr/approvals", actionLabel: "Review request",
    })),
  ];
  return <div className="mx-auto max-w-[1440px] space-y-5 text-[#17233a]">{view !== "work" && <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-lg font-extrabold">{title[view]}</h1><p className="mt-1 text-xs text-[#657795]">HR Head / HR Manager · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>{view === "dashboard" || view === "people" || view === "employee-os" ? <ManagerTeamMemberDialog department="HR" onSuccess={load}/> : null}</header>}{error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p> : null}{view === "dashboard" ? <Overview data={data}/> : null}{view === "work" ? <MyWorkInbox items={workItems}/> : null}{view === "calendar" ? <Calendar data={data}/> : null}{view === "approvals" ? <Approvals requests={data.leaveRequests} reload={load}/> : null}{view === "requests" ? <Empty title="Department requests are not configured" text="This workspace will populate when the cross-department request workflow is enabled."/> : null}{view === "people" || view === "employee-os" ? <People data={data} payroll={view === "people"}/> : null}{view === "finance" ? <HrFinanceWorkspace/> : null}{view === "documents" ? <HrDocumentsWorkspace/> : null}{view === "training" ? <Empty title="Training and LMS are not configured" text="No training catalog or enrollment records exist yet."/> : null}{view === "reports" ? <Reports data={data}/> : null}{view === "assistant" ? <Assistant/> : null}</div>;
}

function SystemHrPortfolio() {
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof HrService.managedCompanies>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    HrService.managedCompanies().then((result) => { if (active) setData(result); }).catch(() => { if (active) setError("Your assigned companies could not be loaded."); });
    return () => { active = false; };
  }, []);
  function setCompany(company: { id: string; slug: string }) {
    setActiveCompanyId(company.slug === "ricoz-innovation" ? null : company.id);
  }
  function manage(company: { id: string; slug: string }) {
    setCompany(company);
    router.push("/dashboard/organization");
  }
  function openFinance(company: { id: string; slug: string }) {
    setCompany(company);
    router.push("/dashboard/hr/finance");
  }
  return <main className="mx-auto max-w-5xl space-y-6 text-(--brand-text)">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-(--brand-border) pb-5"><div><p className="text-xs font-semibold uppercase text-(--brand-red)">System HR · All active companies</p><h1 className="mt-1 text-xl font-semibold">Organization management</h1></div><p className="text-sm font-semibold text-(--brand-text-secondary)">{data ? `${data.companies.length} active companies` : "Loading companies…"}</p></header>
    {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    {!data && !error ? <p role="status" className="py-8 text-sm text-(--brand-text-secondary)">Loading active companies…</p> : null}
    {data && !data.companies.length ? <section className="border-y border-(--brand-border) py-12 text-center"><Building2 size={24} className="mx-auto text-(--brand-text-muted)"/><h2 className="mt-3 text-sm font-semibold">No active companies</h2></section> : null}
    <ul className="divide-y divide-(--brand-border) border-y border-(--brand-border)">{data?.companies.map((company) => <li key={company.id} className="flex flex-wrap items-center gap-4 py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-(--brand-surface-hover) text-(--brand-navy)"><Building2 size={18}/></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{company.name}</h2><p className="mt-1 truncate text-xs text-(--brand-text-secondary)">{company.industry || "Organization"}{company.description ? ` · ${company.description}` : ""}</p></div><ManagerTeamMemberDialog onBeforeOpen={() => setCompany(company)}/><button type="button" onClick={() => openFinance(company)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-(--brand-border) px-3 text-xs font-semibold text-(--brand-navy)"><WalletCards size={14}/>Finance</button><button type="button" onClick={() => manage(company)} className="h-9 rounded-md bg-(--brand-navy) px-3 text-xs font-semibold text-white">Manage organization</button></li>)}</ul>
  </main>;
}

function Overview({ data }: { data: HrDashboardData }) {
  const maxAttendance = Math.max(1, data.metrics.totalEmployees, ...data.attendanceTrend.map((item) => item.present));
  const maxDepartment = Math.max(1, ...data.departmentHeadcount.map((item) => item.count));
  return <><div className="grid gap-4 sm:grid-cols-2"><Metric label="Total Employees" value={data.metrics.totalEmployees} detail="Active employees and interns" icon={Users}/><Metric label="Present Today" value={data.metrics.presentToday} detail={`${data.metrics.attendanceRate}% attendance rate`} icon={UserRoundCheck} green/><Metric label="Leave Requests" value={data.metrics.pendingLeaveRequests} detail="Pending approval" icon={CalendarDays}/><Metric label="Open Positions" value={data.metrics.openPositions} detail="Published opportunities" icon={BriefcaseBusiness}/></div><Panel title="Attendance Trend" subtitle="Recent attendance from recorded check-ins"><div className="flex h-52 items-end gap-4 border-b border-dashed border-[#d8e0ec] px-3">{data.attendanceTrend.map((item) => <div key={item.date} className="flex h-full flex-1 flex-col justify-end text-center"><span className="mb-2 text-[10px] font-bold text-[#7183a0]">{item.present}</span><div className="mx-auto w-full max-w-28 rounded-t bg-[#7c3aed]" style={{ height: `${Math.max(4, item.present / maxAttendance * 75)}%` }}/><span className="mt-2 text-[10px] text-[#7183a0]">{new Date(`${item.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}</span></div>)}</div></Panel><Panel title="Department Headcount" subtitle={`${data.metrics.totalEmployees} total employees`}><div className="flex h-52 items-end gap-4 border-b border-dashed border-[#d8e0ec] px-3">{data.departmentHeadcount.map((item) => <div key={item.department} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center"><span className="mb-2 text-[10px] font-bold">{item.count}</span><div className="mx-auto w-full max-w-28 rounded-t bg-[#7c3aed]" style={{ height: `${Math.max(4, item.count / maxDepartment * 80)}%` }}/><span className="mt-2 truncate text-[10px] text-[#7183a0]">{item.department}</span></div>)}</div></Panel></>;
}

function Metric({ label, value, detail, icon: Icon, green }: { label: string; value: number; detail: string; icon: typeof Users; green?: boolean }) { return <section className="min-h-28 rounded-lg border border-[#d8e1ed] bg-white p-4"><div className="flex items-start justify-between"><p className="text-[10px] font-extrabold uppercase text-[#627492]">{label}</p><span className={`rounded-md p-2 ${green ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"}`}><Icon size={17}/></span></div><p className="mt-2 text-xl font-extrabold">{value}</p><p className={`mt-2 text-[11px] font-semibold ${green ? "text-emerald-600" : "text-[#64748b]"}`}>{detail}</p></section>; }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-lg border border-[#d8e1ed] bg-white p-5"><h2 className="text-sm font-extrabold">{title}</h2><p className="mt-1 text-xs text-[#657795]">{subtitle}</p><div className="mt-5">{children}</div></section>; }


function Calendar({ data }: { data: HrDashboardData }) { const events = [...data.tasks.filter((task) => task.status === "PENDING").map((task) => ({ id: task._id, date: task.deadline, title: task.title, kind: "Task" })), ...data.leaveRequests.filter((leave) => leave.status === "PENDING").map((leave) => ({ id: leave.id, date: leave.startDate, title: `${leave.employee?.name ?? "Employee"} · ${leave.type} leave`, kind: "Leave" }))].sort((a, b) => +new Date(a.date) - +new Date(b.date)); return <Panel title="Upcoming Events" subtitle="Task deadlines and pending leave dates"> <div className="divide-y divide-[#e6ebf2]">{events.map((event) => <div key={`${event.kind}-${event.id}`} className="flex items-center gap-4 py-3"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f1f5f9] text-xs font-extrabold">{new Date(event.date).getDate()}</span><div><p className="text-xs font-bold">{event.title}</p><p className="mt-1 text-[10px] text-[#657795]">{dateLabel(event.date)} · {event.kind}</p></div></div>)}{!events.length ? <Empty title="No upcoming events" text="HR deadlines and approvals will appear here."/> : null}</div></Panel>; }

function Approvals({ requests, reload }: { requests: HrLeaveRequest[]; reload: () => void }) { const [busy, setBusy] = useState<string | null>(null); const pending = requests.filter((request) => request.status === "PENDING"); const review = async (requestId: string, decision: "APPROVED" | "REJECTED") => { setBusy(requestId); try { await HrService.reviewLeave(requestId, decision); reload(); } finally { setBusy(null); } }; return <div className="space-y-3">{pending.map((request) => <article key={request.id} className="rounded-lg border border-[#d8e1ed] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold text-[#7183a0]">{request.type} · {request.days} day{request.days === 1 ? "" : "s"}</p><h2 className="mt-1 text-sm font-extrabold">Leave Request: {request.employee?.name ?? "Unknown employee"}</h2><p className="mt-1 text-xs text-[#657795]">{dateLabel(request.startDate)} to {dateLabel(request.endDate)} · {request.reason}</p></div><span className="text-xs font-bold text-red-600">Pending</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><button disabled={busy === request.id} onClick={() => void review(request.id, "APPROVED")} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 size={14}/> Approve</button><button disabled={busy === request.id} onClick={() => void review(request.id, "REJECTED")} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-600 text-xs font-bold text-white disabled:opacity-50"><XCircle size={14}/> Reject</button></div></article>)}{!pending.length ? <Empty title="Approvals are clear" text="No pending leave requests require HR action."/> : null}</div>; }

function People({ data, payroll }: { data: HrDashboardData; payroll: boolean }) { const [query, setQuery] = useState(""); const employees = useMemo(() => data.employees.filter((employee) => `${employee.name} ${employee.email} ${employee.department ?? ""} ${employee.role}`.toLowerCase().includes(query.toLowerCase())), [data.employees, query]); return <Panel title={payroll ? "Employees" : "Employee Operating System"} subtitle={payroll ? "Employee directory. Payroll records are not configured." : "Active workforce identity and organization placement"}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees..." className="mb-4 h-10 w-full rounded-md border border-[#d8e1ed] px-3 text-xs outline-none focus:border-[#1645a2]"/><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-[#f7f9fc] text-[#627492]"><tr><th className="px-4 py-3">Employee</th><th>Role</th><th>Department</th><th>Employment</th><th>Joining</th><th>Status</th></tr></thead><tbody className="divide-y divide-[#e6ebf2]">{employees.map((employee) => <tr key={employee.id}><td className="px-4 py-3"><p className="font-bold">{employee.name}</p><p className="text-[10px] text-[#7183a0]">{employee.email}</p></td><td>{employee.role}</td><td>{employee.department ?? "Unassigned"}</td><td>{employee.employmentType}</td><td>{dateLabel(employee.joiningDate)}</td><td><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{employee.status}</span></td></tr>)}</tbody></table></div></Panel>; }

function Reports({ data }: { data: HrDashboardData }) { const prompts = ["Summarize attendance risks and recommended actions", "Analyze pending leave workload", "Summarize workforce distribution by department"]; return <div className="grid gap-4 lg:grid-cols-3">{prompts.map((prompt) => <AiReportCard key={prompt} prompt={prompt} data={data}/>)}</div>; }
function AiReportCard({ prompt, data }: { prompt: string; data: HrDashboardData }) { const [report, setReport] = useState(""); const [busy, setBusy] = useState(false); const generate = async () => { setBusy(true); try { setReport((await HrService.aiReport(prompt)).report); } finally { setBusy(false); } }; return <section className="rounded-lg border border-[#d8e1ed] bg-white p-5"><Bot size={18} className="text-[#1645a2]"/><h2 className="mt-3 text-sm font-extrabold">{prompt}</h2><p className="mt-2 text-xs leading-5 text-[#657795]">{report || `Generate from the current snapshot of ${data.metrics.totalEmployees} employees.`}</p><button disabled={busy} onClick={() => void generate()} className="mt-4 h-9 rounded-md bg-[#1645a2] px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? "Generating..." : "Generate AI report"}</button></section>; }

function Assistant() {
  const starters = ["Who is on leave today?", "Summarize attendance today", "Show pending leave requests", "How is headcount distributed?"];
  const [messages, setMessages] = useState<AssistantMessage[]>([{ role: "assistant", content: "Ask me about authorized HR workspace data. I can search and summarize records, but I cannot change them." }]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = async (message = prompt) => {
    const value = message.trim();
    if (value.length < 2 || busy) return;
    setPrompt("");
    setBusy(true);
    setMessages((current) => [...current, { role: "user", content: value }, { role: "assistant", content: "" }]);
    try {
      await streamAssistant(value, "hr-workspace", (text) => setMessages((current) => {
        const next = [...current];
        const last = next.at(-1);
        next[next.length - 1] = { role: "assistant", content: `${last?.content ?? ""}${text}` };
        return next;
      }));
    } catch {
      setMessages((current) => {
        const next = [...current];
        next[next.length - 1] = { role: "assistant", content: "The assistant is unavailable right now. Please try again." };
        return next;
      });
    } finally { setBusy(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void ask(); };
  return <div className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-[#d8e1ed] bg-white"><header className="flex items-center justify-between gap-3 border-b border-[#e6ebf2] p-4"><div className="flex items-center gap-3"><span className="rounded-md bg-blue-50 p-2 text-[#1645a2]"><Bot size={18}/></span><div><h2 className="text-sm font-extrabold">GEOS AI Assistant</h2><p className="text-[10px] text-[#657795]">Role-aware, read-only workspace intelligence</p></div></div><span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>Online</span></header><div className="border-b border-[#e6ebf2] bg-[#f8fafc] px-4 py-3"><p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#7183a0]">Suggested</p><div className="flex flex-wrap gap-2">{starters.map((starter) => <button key={starter} disabled={busy} onClick={() => void ask(starter)} className="rounded-full border border-[#d8e1ed] bg-white px-3 py-2 text-[10px] font-bold text-[#34445f] hover:border-[#1645a2] disabled:opacity-50">{starter}</button>)}</div></div><div className="flex-1 space-y-4 overflow-y-auto bg-[#f8fafc] p-5">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex items-start gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${message.role === "user" ? "bg-[#1645a2] text-white" : "bg-blue-50 text-[#1645a2]"}`}>{message.role === "user" ? <UserRound size={14}/> : <Bot size={15}/>}</span><div className={`max-w-[82%] whitespace-pre-wrap rounded-lg px-4 py-3 text-xs leading-6 ${message.role === "user" ? "bg-[#1645a2] text-white" : "border border-[#d8e1ed] bg-white text-[#17233a]"}`}>{message.content || <LoaderCircle size={15} className="animate-spin text-[#1645a2]"/>}</div></div>)}</div><form onSubmit={submit} className="border-t border-[#e6ebf2] bg-white p-4"><div className="flex gap-2"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(); } }} placeholder="Ask about authorized workspace data..." className="min-h-12 flex-1 resize-none rounded-md border border-[#d8e1ed] p-3 text-xs outline-none focus:border-[#1645a2]"/><button disabled={busy || prompt.trim().length < 2} aria-label="Send" className="h-12 w-12 rounded-md bg-[#1645a2] text-white disabled:opacity-50">{busy ? <LoaderCircle className="mx-auto animate-spin" size={17}/> : <Send className="mx-auto" size={17}/>}</button></div><p className="mt-2 text-[9px] text-[#7183a0]">Read-only access · Results are limited by your role · Shift+Enter for a new line</p></form></div>;
}
function Empty({ title, text }: { title: string; text: string }) { return <section className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-[#cfd9e7] bg-white p-6 text-center"><BriefcaseBusiness size={24} className="text-[#94a3b8]"/><h2 className="mt-3 text-sm font-extrabold">{title}</h2><p className="mt-1 max-w-md text-xs text-[#657795]">{text}</p></section>; }