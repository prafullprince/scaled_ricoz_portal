"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { SalesService } from "@/services/sales.service";
import type { SalesDashboardTask, SalesLeadPage } from "@/types/sales";
import { taskPriorityTier } from "@/lib/task-priority";
import { MyWorkInbox, type MyWorkItem } from "../MyWorkInbox";

const reviewStages = new Set(["MANAGER_REVIEW", "HEAD_REVIEW"]);
const nameOf = (value: { _id: string; name: string } | string | null | undefined) =>
  value && typeof value !== "string" ? value._id : value ?? "";

async function loadLeadPages(
  query: { ownerId: string; activities?: "PENDING"; followUp?: "SCHEDULED" },
  signal: AbortSignal,
) {
  const pages: SalesLeadPage["leads"] = [];
  const first = await SalesService.leadsPage({ ...query, page: 1, pageSize: 50 }, signal);
  pages.push(...first.leads);
  for (let page = 2; page <= first.pagination.totalPages; page++) {
    const next = await SalesService.leadsPage({ ...query, page, pageSize: 50 }, signal);
    pages.push(...next.leads);
  }
  return pages;
}

export function SalesMyWorkInbox({
  tasks,
  currentUserId,
  onComplete,
}: {
  tasks: SalesDashboardTask[];
  currentUserId: string;
  onComplete: (id: string) => Promise<void>;
}) {
  const [leads, setLeads] = useState<SalesLeadPage["leads"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selectedTask, setSelectedTask] = useState<SalesDashboardTask | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([
      loadLeadPages({ ownerId: currentUserId, activities: "PENDING" }, abort.signal),
      loadLeadPages({ ownerId: currentUserId, followUp: "SCHEDULED" }, abort.signal),
    ]).then(([activityLeads, followUpLeads]) => {
      if (abort.signal.aborted) return;
      const merged = new Map([...activityLeads, ...followUpLeads].map((lead) => [lead._id, lead]));
      setLeads([...merged.values()]);
      setError("");
    }).catch((caught: unknown) => {
      if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : "CRM follow-ups could not be loaded.");
    }).finally(() => {
      if (!abort.signal.aborted) setLoading(false);
    });
    return () => abort.abort();
  }, [currentUserId, revision]);

  const items = useMemo(() => {
    const work: MyWorkItem[] = tasks.flatMap((task) => {
      if (task.status !== "PENDING") return [];
      const reviewer = nameOf(task.currentOwner) === currentUserId;
      const assigned = nameOf(task.assignedTo) === currentUserId;
      const approval = reviewStages.has(task.workflowStage ?? "") && reviewer;
      if (!assigned && !approval) return [];
      return [{
        id: task._id,
        title: task.title,
        description: task.description,
        kind: approval ? "APPROVAL" as const : "TASK" as const,
        priority: task.priority,
        dueAt: task.deadline,
        tags: approval ? ["Sales", "Review"] : ["Sales", "Task"],
        href: approval ? "/dashboard/sales/approvals" : undefined,
        onAction: approval ? undefined : () => setSelectedTask(task),
        onMarkDone: !approval && assigned ? () => onComplete(task._id) : undefined,
      }];
    });

    for (const lead of leads) {
      const ownerId = nameOf(lead.ownerId);
      if (ownerId !== currentUserId || ["WON", "LOST"].includes(lead.status)) continue;
      const pendingActivities = (lead.activities ?? []).filter((activity) => activity.kind !== "STAGE" && !activity.completedAt && activity.dueAt);
      for (const activity of pendingActivities) {
        const meeting = activity.kind === "MEETING";
        work.push({
          id: `${lead._id}:${activity._id}`,
          title: activity.text || `${meeting ? "Meeting" : "Follow-up"} · ${lead.name}`,
          description: `${lead.name}${lead.company ? ` · ${lead.company}` : ""}`,
          kind: meeting ? "MEETING" : "TASK",
          priority: lead.priority,
          dueAt: activity.dueAt,
          tags: ["CRM", "Lead", activity.kind.replaceAll("_", " ")],
          href: "/dashboard/sales/crm",
          onMarkDone: () => SalesService.completeActivity(lead._id, activity._id).then(() => setRevision((value) => value + 1)),
        });
      }

      const hasExplicitLegacyFollowUp = (lead.activities ?? []).some((activity) => activity.kind === "FOLLOW_UP" && activity.dueAt === lead.nextFollowUpAt);
      if (lead.nextFollowUpAt && !hasExplicitLegacyFollowUp) {
        work.push({
          id: `${lead._id}:next-follow-up`,
          title: `Follow up · ${lead.name}`,
          description: lead.company ? `${lead.company} · ${lead.status.replaceAll("_", " ")}` : lead.status.replaceAll("_", " "),
          kind: "TASK",
          priority: lead.priority,
          dueAt: lead.nextFollowUpAt,
          tags: ["CRM", "Lead", "Follow-up"],
          href: "/dashboard/sales/crm",
        });
      }
    }
    return work;
  }, [currentUserId, leads, onComplete, tasks]);

  return <>
    <MyWorkInbox items={items} loading={loading} error={error} />
    {selectedTask && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTask(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="sales-work-task-title" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <header className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Sales task</p><h2 id="sales-work-task-title" className="mt-1 text-base font-bold text-slate-900">{selectedTask.title}</h2></div><button type="button" aria-label="Close task details" onClick={() => setSelectedTask(null)} className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={15} /></button></header>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedTask.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs"><div><dt className="text-slate-500">Due</dt><dd className="mt-1 font-semibold text-slate-800">{new Date(selectedTask.deadline).toLocaleString("en-IN")}</dd></div><div><dt className="text-slate-500">Priority</dt><dd className="mt-1 font-semibold text-slate-800">{taskPriorityTier(selectedTask.priority) ?? selectedTask.priority}</dd></div><div><dt className="text-slate-500">Assigned by</dt><dd className="mt-1 font-semibold text-slate-800">{selectedTask.assignedBy?.name ?? "Unavailable user"}</dd></div><div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-semibold text-slate-800">{selectedTask.workflowStage?.replaceAll("_", " ") ?? "Assigned"}</dd></div></dl>
        <footer className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setSelectedTask(null)} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button><Link href="/dashboard/sales/crm" className="rounded-md bg-blue-800 px-3 py-2 text-xs font-semibold text-white">Open CRM &amp; Leads</Link></footer>
      </section>
    </div>}
  </>;
}
