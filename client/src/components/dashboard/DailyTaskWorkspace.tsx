"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Code2,
  ExternalLink,
  LoaderCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { TaskService, type DailyReport, type Task } from "@/services/task.service";
import { ProductDeliveryPanel } from "../products/ProductDeliveryPanel";
import { MyWorkInbox, type MyWorkItem } from "./MyWorkInbox";

function latestEnhancement(task: Task) {
  return [...(task.workflowHistory ?? [])]
    .reverse()
    .find((event) => event.action === "ENHANCEMENT_REQUESTED");
}

export function DailyTaskWorkspace({ role }: { role: "intern" | "employee" }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [productRevision, setProductRevision] = useState(0);

  useEffect(() => {
    Promise.all([TaskService.mine(), TaskService.report()])
      .then(([taskList, report]) => {
        setTasks(taskList);
        setReports(report.dailyReports ?? []);
      })
      .catch(() => setLoadError("Your work items could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  async function markDone(input: {
    submissionDescription: string;
    githubUrl?: string;
    liveUrl?: string;
  }) {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await TaskService.submitMyTask(selected._id, input);
      setTasks((current) =>
        current.map((task) => (task._id === updated._id ? updated : task)),
      );
      setSelected(updated);
      setProductRevision((value) => value + 1);
      toast.success("Work submitted to your supervisor for review");
    } catch {
      toast.error("Could not submit work. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function submitReport(input: { summary: string; progress: number }) {
    if (!selected) return;
    setSavingReport(true);
    try {
      const report = await TaskService.submitDailyReport({ taskId: selected._id, ...input });
      setReports((current) => [report, ...current.filter((item) => item._id !== report._id)]);
      setProductRevision((value) => value + 1);
      toast.success("Progress report shared with the leadership chain");
    } catch {
      toast.error("Could not save the progress report. Please try again.");
    } finally {
      setSavingReport(false);
    }
  }

  const workItems: MyWorkItem[] = tasks
    .filter((task) => task.status === "PENDING")
    .map((task) => ({
      id: task._id,
      title: task.title,
      description: task.description,
      kind: "TASK",
      priority: task.priority,
      dueAt: task.deadline,
      tags: [task.department ?? (role === "employee" ? "Employee" : "Intern"), task.workflowStage?.replaceAll("_", " ") ?? "Assigned"],
      actionLabel: "Take Action",
      onAction: () => setSelected(task),
    }));

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <header>
        <p className="text-sm font-bold text-(--brand-navy)">My Workspace</p>
        <p className="text-xs text-[#71829e]">
          {role === "employee" ? "Employee Portal" : "Intern Portal"}
        </p>
        <nav aria-label="Personal workspace" className="mt-5 flex gap-6 overflow-x-auto border-b border-(--brand-border) text-xs font-semibold text-(--brand-text-secondary)">
          <Link href={`/dashboard/${role}/calendar`} className="whitespace-nowrap px-2 pb-3 hover:text-(--brand-text)">My Calendar</Link>
          <span className="border-b-2 border-[#1645a2] px-2 pb-3 text-[#1645a2]">
            My Work
          </span>
          {[ ["Attendance", "attendance"], ["Goals & OKRs", "goals"], ["Performance", "performance"] ].map(([label, path]) => <Link key={path} href={`/dashboard/${role}/${path}`} className="whitespace-nowrap px-2 pb-3 hover:text-(--brand-text)">{label}</Link>)}
        </nav>
      </header>
      <MyWorkInbox items={workItems} loading={loading} error={loadError} />
      <details className="rounded-lg border border-(--brand-border) bg-white">
        <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-(--brand-text-secondary)">Product delivery progress</summary>
        <div className="border-t border-(--brand-border) p-4"><ProductDeliveryPanel revision={productRevision} /></div>
      </details>
      <section className="rounded-2xl border border-[#dfe6ee] bg-white p-5">
        <div className="flex justify-between">
          <h2 className="text-sm font-bold text-(--brand-navy)">
            Task progress
          </h2>
          <span className="text-xs text-[#71829e]">
            {tasks.filter((task) => task.workflowStage === "COMPLETED").length}{" "}
            accepted ·{" "}
            {
              tasks.filter(
                (task) =>
                  task.workflowStage === "SUBMITTED",
              ).length
            }{" "}
            in review ·{" "}
            {tasks.filter((task) => task.status === "PENDING").length} active
          </span>
        </div>
      </section>
      {selected ? (
        <TaskDrawer
          task={selected}
          saving={saving}
          savingReport={savingReport}
          latestReport={reports.find((report) => String(report.taskId) === selected._id) ?? null}
          onClose={() => setSelected(null)}
          onDone={markDone}
          onReport={submitReport}
        />
      ) : null}
    </div>
  );
}

function TaskDrawer({
  task,
  saving,
  savingReport,
  latestReport,
  onClose,
  onDone,
  onReport,
}: {
  task: Task;
  saving: boolean;
  savingReport: boolean;
  latestReport: DailyReport | null;
  onClose: () => void;
  onDone: (input: {
    submissionDescription: string;
    githubUrl?: string;
    liveUrl?: string;
  }) => void;
  onReport: (input: { summary: string; progress: number }) => void;
}) {
  const enhancement = latestEnhancement(task);
  const accepted = task.workflowStage === "COMPLETED";
  const [description, setDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [reportSummary, setReportSummary] = useState(latestReport?.summary ?? "");
  const [reportProgress, setReportProgress] = useState(latestReport?.progress ?? 0);
  const canSubmit = description.trim().length >= 20;
  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <aside className="absolute right-0 top-0 h-full w-full max-w-[455px] overflow-y-auto bg-white shadow-2xl">
        <div className="flex justify-between border-b border-[#dfe6ee] px-5 py-4">
          <strong className="text-sm text-(--brand-navy)">
            {task._id.slice(-5)}
          </strong>
          <button type="button" onClick={onClose} aria-label="Close task">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <h2 className="text-base font-bold text-(--brand-navy)">
              {task.title}
            </h2>
            <span className="mt-2 inline-block rounded bg-[#fff8e7] px-2 py-1 text-[10px] font-bold text-[#b66a00]">
              {accepted
                ? "ACCEPTED"
                : task.workflowStage === "SUBMITTED"
                  ? "IN REVIEW"
                  : "ACTIVE"}
            </span>
          </div>
          {enhancement && task.status === "PENDING" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-900">
                Enhancement requested
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                {enhancement.note}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Due date", new Date(task.deadline).toLocaleDateString()],
              [
                "Status",
                accepted
                  ? "Accepted"
                  : task.workflowStage === "SUBMITTED"
                    ? "Submitted"
                    : "Active",
              ],
              ["Project", task.projectObjective ?? "Workspace"],
              ["Created", new Date(task.createdAt).toLocaleDateString()],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-[#dfe6ee] bg-[#f8fafc] p-3"
              >
                <p className="text-[10px] text-[#71829e]">{label}</p>
                <p className="mt-1 text-xs font-bold text-(--brand-navy)">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold text-(--brand-navy)">Description</p>
            <p className="mt-2 text-sm leading-6 text-[#71829e]">
              {task.description}
            </p>
          </div>
          {task.submission ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold text-emerald-900">Submitted delivery</p>
              <p className="mt-2 text-sm leading-6 text-emerald-800">{task.submission.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {task.submission.githubUrl ? <a href={task.submission.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1645a2]"><Code2 size={14} />Repository</a> : null}
                {task.submission.liveUrl ? <a href={task.submission.liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1645a2]"><ExternalLink size={14} />Live app</a> : null}
              </div>
            </section>
          ) : null}
          {task.status === "PENDING" && task.workflowStage === "ASSIGNED" && !accepted ? (
            <section className="space-y-4 border-t border-[#e7edf3] pt-5">
              <div className="rounded-lg border border-[#dbe4ee] bg-[#f8fafc] p-4">
                <div className="flex items-center justify-between"><p className="text-xs font-bold text-(--brand-navy)">Progress report</p><strong className="text-sm text-[#1645a2]">{reportProgress}%</strong></div>
                <input type="range" min="0" max="100" step="5" value={reportProgress} onChange={(event) => setReportProgress(Number(event.target.value))} className="mt-3 w-full accent-[#1645a2]" />
                <textarea rows={3} value={reportSummary} onChange={(event) => setReportSummary(event.target.value)} placeholder="Describe what was completed, current blockers, and your next step." className="mt-3 w-full resize-none rounded-md border border-[#d6dee8] bg-white p-3 text-xs leading-5 outline-none focus:border-[#1645a2]" />
                <button type="button" disabled={savingReport || reportSummary.trim().length < 2} onClick={() => onReport({ summary: reportSummary.trim(), progress: reportProgress })} className="mt-3 h-9 w-full rounded-md border border-[#1645a2] bg-white text-xs font-bold text-[#1645a2] disabled:opacity-50">{savingReport ? "Sharing report..." : latestReport ? "Update progress report" : "Share progress report"}</button>
              </div>
              <div>
                <label htmlFor="delivery-description" className="text-xs font-bold text-(--brand-navy)">What did you build? <span className="text-red-600">*</span></label>
                <textarea id="delivery-description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the implementation, key decisions, completed features, and anything your manager should verify." className="mt-2 w-full resize-none rounded-lg border border-[#d6dee8] bg-[#fbfcfe] px-3 py-3 text-sm leading-6 text-[#334155] outline-none focus:border-[#1645a2]" />
                <p className={`mt-1 text-[10px] ${canSubmit ? "text-emerald-600" : "text-[#94a3b8]"}`}>{description.trim().length}/20 minimum characters</p>
              </div>
              <div className="grid gap-3">
                <label className="text-xs font-bold text-(--brand-navy)">GitHub repository <span className="font-normal text-[#94a3b8]">Optional</span><span className="mt-2 flex items-center gap-2 rounded-lg border border-[#d6dee8] bg-white px-3"><Code2 size={15} className="text-[#64748b]" /><input type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/..." className="h-11 min-w-0 flex-1 text-sm font-normal outline-none" /></span></label>
                <label className="text-xs font-bold text-(--brand-navy)">Live application <span className="font-normal text-[#94a3b8]">Optional</span><span className="mt-2 flex items-center gap-2 rounded-lg border border-[#d6dee8] bg-white px-3"><ExternalLink size={15} className="text-[#64748b]" /><input type="url" value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} placeholder="https://your-app.com" className="h-11 min-w-0 flex-1 text-sm font-normal outline-none" /></span></label>
              </div>
            </section>
          ) : null}
          <button
            type="button"
            disabled={saving || task.workflowStage !== "ASSIGNED" || accepted || !canSubmit}
            onClick={() => onDone({ submissionDescription: description.trim(), ...(githubUrl.trim() ? { githubUrl: githubUrl.trim() } : {}), ...(liveUrl.trim() ? { liveUrl: liveUrl.trim() } : {}) })}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00a96f] py-3 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}{" "}
            {accepted
              ? "Accepted by CEO"
              : task.workflowStage === "SUBMITTED"
                ? "Submitted for review"
                : enhancement
                  ? "Resubmit enhancement"
                  : "Submit for manager review"}
          </button>
        </div>
      </aside>
    </div>
  );
}
