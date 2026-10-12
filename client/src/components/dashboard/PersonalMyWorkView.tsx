"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/redux/hooks";
import { MyWorkInbox, type MyWorkItem } from "./MyWorkInbox";
import { PersonalTodoWorkspace } from "./PersonalTodoWorkspace";
import { SalesService } from "@/services/sales.service";
import { TaskService, type Task } from "@/services/task.service";
import type { SalesDashboardTask, SalesLead, SalesLeadPage } from "@/types/sales";

const reviewStages = new Set(["MANAGER_REVIEW", "HEAD_REVIEW"]);
const idOf = (value: { _id: string } | string | null | undefined) =>
  value && typeof value !== "string" ? value._id : value ?? "";

async function loadOwnedSalesLeads(userId: string, signal: AbortSignal) {
  const query = { ownerId: userId, pageSize: 50 };
  const [activities, followUps] = await Promise.all([
    SalesService.leadsPage({ ...query, activities: "PENDING", page: 1 }, signal),
    SalesService.leadsPage({ ...query, followUp: "SCHEDULED", page: 1 }, signal),
  ]);
  const pages: SalesLeadPage["leads"] = [];
  const appendRemaining = async (result: SalesLeadPage, baseQuery: typeof query & { activities?: "PENDING"; followUp?: "SCHEDULED" }) => {
    pages.push(...result.leads);
    for (let page = 2; page <= result.pagination.totalPages; page++) {
      const next = await SalesService.leadsPage({ ...baseQuery, page }, signal);
      pages.push(...next.leads);
    }
  };
  await Promise.all([
    appendRemaining(activities, { ...query, activities: "PENDING" }),
    appendRemaining(followUps, { ...query, followUp: "SCHEDULED" }),
  ]);
  return [...new Map(pages.map((lead) => [lead._id, lead])).values()];
}

function salesTaskItems(tasks: SalesDashboardTask[], userId: string, onChanged: () => void): MyWorkItem[] {
  return tasks.flatMap((task) => {
    if (task.status !== "PENDING") return [];
    const assigned = idOf(task.assignedTo) === userId;
    const reviewer = idOf(task.currentOwner) === userId;
    const approval = reviewStages.has(task.workflowStage ?? "") && reviewer;
    if (!assigned && !approval) return [];
    return [{
      id: `sales-task:${task._id}`,
      title: task.title,
      description: task.description,
      kind: approval ? "APPROVAL" as const : "TASK" as const,
      priority: task.priority,
      dueAt: task.deadline,
      tags: approval ? ["Sales", "Review"] : ["Sales", "Task"],
      href: approval ? "/dashboard/sales/approvals" : `/dashboard/tasks/${encodeURIComponent(task._id)}`,
      actionLabel: approval ? "Review" : "View task",
      ...(!approval && assigned && !task.salesAccountability
        ? { onMarkDone: async () => { await SalesService.completeTask(task._id); onChanged(); } }
        : {}),
    }];
  });
}

function salesLeadItems(leads: SalesLead[], userId: string, onChanged: () => void): MyWorkItem[] {
  return leads.flatMap((lead) => {
    if (idOf(lead.ownerId) !== userId || ["WON", "LOST"].includes(lead.status)) return [];
    const pendingActivities = (lead.activities ?? []).filter((activity) =>
      activity.kind !== "STAGE" && !activity.completedAt && activity.dueAt,
    );
    const items: MyWorkItem[] = pendingActivities.map((activity) => ({
      id: `sales-activity:${lead._id}:${activity._id}`,
      title: activity.text || `${activity.kind === "MEETING" ? "Meeting" : "Follow-up"} · ${lead.name}`,
      description: `${lead.name}${lead.company ? ` · ${lead.company}` : ""}`,
      kind: activity.kind === "MEETING" ? "MEETING" : "TASK",
      priority: lead.priority,
      dueAt: activity.dueAt,
      tags: ["Sales", "Lead", activity.kind.replaceAll("_", " ")],
      href: "/dashboard/sales/crm",
      onMarkDone: async () => { await SalesService.completeActivity(lead._id, activity._id); onChanged(); },
    }));
    const hasExplicitFollowUp = (lead.activities ?? []).some((activity) =>
      activity.kind === "FOLLOW_UP" && activity.dueAt === lead.nextFollowUpAt,
    );
    if (lead.nextFollowUpAt && !hasExplicitFollowUp) {
      items.push({
        id: `sales-next-follow-up:${lead._id}`,
        title: `Follow up · ${lead.name}`,
        description: lead.company ? `${lead.company} · ${lead.status.replaceAll("_", " ")}` : lead.status.replaceAll("_", " "),
        kind: "TASK",
        priority: lead.priority,
        dueAt: lead.nextFollowUpAt,
        tags: ["Sales", "Lead", "Follow-up"],
        href: "/dashboard/sales/crm",
      });
    }
    return items;
  });
}

export function PersonalMyWorkView() {
  const [view, setView] = useState<"WORK" | "TODO" | "TODO_HISTORY">("WORK");
  const user = useAppSelector((state) => state.auth.user);
  const userId = user?.user_id ?? "";
  const canViewSalesDashboard = user?.permissions?.includes("SALES_DASHBOARD_VIEW") ?? false;
  const canViewSalesLeads = user?.permissions?.includes("SALES_LEAD_VIEW") ?? false;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [salesTasks, setSalesTasks] = useState<SalesDashboardTask[]>([]);
  const [salesLeads, setSalesLeads] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    void Promise.allSettled([
      TaskService.mine(),
      userId && canViewSalesDashboard ? SalesService.dashboard() : Promise.resolve(null),
      userId && canViewSalesLeads ? loadOwnedSalesLeads(userId, abort.signal) : Promise.resolve([]),
    ]).then(([assignedResult, dashboardResult, leadsResult]) => {
      if (!active) return;
      const errors: string[] = [];
      if (assignedResult.status === "fulfilled") setTasks(assignedResult.value);
      else errors.push("Your assigned tasks could not be loaded.");
      if (dashboardResult.status === "fulfilled") setSalesTasks(dashboardResult.value?.tasks ?? []);
      else errors.push("Sales tasks could not be loaded.");
      if (leadsResult.status === "fulfilled") setSalesLeads(leadsResult.value);
      else errors.push("Sales follow-ups could not be loaded.");
      setError(errors.join(" "));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      abort.abort();
    };
  }, [canViewSalesDashboard, canViewSalesLeads, revision, userId]);

  const items = useMemo<MyWorkItem[]>(() => [
    ...tasks
      .filter((task) => task.status === "PENDING" && task.department !== "SALES")
      .map((task) => ({
        id: task._id,
        title: task.title,
        description: task.description,
        kind: "TASK" as const,
        priority: task.priority,
        dueAt: task.deadline,
        tags: [task.department ?? "Task", task.workflowStage?.replaceAll("_", " ") ?? "Assigned"],
        href: `/dashboard/tasks/${encodeURIComponent(task._id)}`,
        actionLabel: "View task",
      })),
    ...salesTaskItems(salesTasks, userId, refresh),
    ...salesLeadItems(salesLeads, userId, refresh),
  ], [refresh, salesLeads, salesTasks, tasks, userId]);

  return <main className="mx-auto max-w-[1440px] space-y-5">
    <nav aria-label="My Work sections" role="tablist" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-[#e0e7f0] bg-[#f7f9fc] p-1.5 shadow-sm">
      {[
        { id: "WORK" as const, label: "My Work" },
        { id: "TODO" as const, label: "TODO" },
        { id: "TODO_HISTORY" as const, label: "TODO History" },
      ].map((tab) => <button key={tab.id} id={`my-work-tab-${tab.id.toLowerCase()}`} type="button" role="tab" aria-selected={view === tab.id} aria-controls="my-work-tabpanel" onClick={() => setView(tab.id)} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:px-5 ${view === tab.id ? "bg-white text-[#1645a2] shadow-[0_2px_8px_rgba(24,43,77,0.09)]" : "text-[#7183a0] hover:bg-white/70 hover:text-[#34445f]"}`}>{tab.label}</button>)}
    </nav>
    <div id="my-work-tabpanel" role="tabpanel" aria-labelledby={`my-work-tab-${view.toLowerCase()}`}>
      {view === "WORK"
        ? <MyWorkInbox items={items} loading={loading} error={error} />
        : <PersonalTodoWorkspace view={view === "TODO" ? "ACTIVE" : "HISTORY"} />}
    </div>
  </main>;
}
