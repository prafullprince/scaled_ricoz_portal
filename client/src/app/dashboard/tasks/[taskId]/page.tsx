"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, CircleUserRound, ListChecks } from "lucide-react";
import { NotificationService } from "@/services/notification.service";
import type { Task } from "@/services/task.service";
import { taskPriorityTier } from "@/lib/task-priority";

function personName(person: Task["assignedTo"] | Task["assignedBy"] | Task["currentOwner"]) {
  return person && typeof person !== "string" ? person.name : "Not assigned";
}

export default function NotificationTaskDetailsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    NotificationService.taskDetails(taskId)
      .then((result) => { if (active) setTask(result); })
      .catch(() => { if (active) setError("This task could not be opened. It may have been removed or you may no longer have access."); });
    return () => { active = false; };
  }, [taskId]);

  if (error) return <main className="mx-auto max-w-3xl p-6"><Link href="/dashboard/notifications" className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-navy)"><ArrowLeft size={16} />Notifications</Link><p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p></main>;
  if (!task) return <main className="mx-auto max-w-3xl p-6"><p role="status">Loading task details...</p></main>;

  const tier = taskPriorityTier(task.priority);
  const history = [...(task.workflowHistory ?? [])].reverse();

  return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
    <Link href="/dashboard/notifications" className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-navy) hover:underline"><ArrowLeft size={16} />Notifications</Link>
    <article className="overflow-hidden rounded-2xl border border-(--brand-border) bg-white shadow-sm">
      <header className="border-b border-(--brand-border) bg-slate-50/80 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{task.status === "DONE" ? "Completed" : task.workflowStage?.replaceAll("_", " ") ?? "Assigned"}</span>
          {tier && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tier === "P1" ? "bg-red-50 text-red-700" : tier === "P2" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{tier}</span>}
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{task.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{task.description}</p>
      </header>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
        <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4"><CalendarClock size={18} className="mt-0.5 text-blue-700" /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deadline</p><p className="mt-1 text-sm font-semibold text-slate-900">{new Date(task.deadline).toLocaleString()}</p></div></div>
        <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4"><CircleUserRound size={18} className="mt-0.5 text-blue-700" /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned to</p><p className="mt-1 text-sm font-semibold text-slate-900">{personName(task.assignedTo)}</p><p className="mt-1 text-xs text-slate-500">Assigned by {personName(task.assignedBy)}</p></div></div>
      </div>
      {task.projectObjective && <section className="border-t border-slate-100 px-5 py-4 sm:px-7"><h2 className="text-sm font-bold text-slate-900">Expected outcome</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{task.projectObjective}</p></section>}
      {Boolean(task.finalDeliverables?.length || task.requirements?.length) && <section className="border-t border-slate-100 px-5 py-4 sm:px-7"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ListChecks size={16} />Requirements and deliverables</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">{[...(task.requirements ?? []), ...(task.finalDeliverables ?? [])].map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
      {history.length > 0 && <section className="border-t border-slate-100 px-5 py-4 sm:px-7"><h2 className="text-sm font-bold text-slate-900">Activity</h2><ol className="mt-3 space-y-3">{history.map((event, index) => <li key={`${event.action}-${event.createdAt}-${index}`} className="border-l-2 border-blue-100 pl-3"><p className="text-sm font-semibold text-slate-800">{event.action.replaceAll("_", " ")}</p>{event.note && <p className="mt-1 text-xs leading-5 text-slate-600">{event.note}</p>}<time className="mt-1 block text-[11px] text-slate-400">{new Date(event.createdAt).toLocaleString()}</time></li>)}</ol></section>}
    </article>
  </main>;
}
