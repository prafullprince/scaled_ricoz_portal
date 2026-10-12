"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ClipboardList, LoaderCircle } from "lucide-react";
import { TaskService, type HierarchyProgressPackage } from "@/services/task.service";

export function HierarchyProgressBoard({ department }: { department?: string } = {}) {
  const [packages, setPackages] = useState<HierarchyProgressPackage[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    TaskService.hierarchyProgress(department)
      .then((result) => active && setPackages(result))
      .catch(() => active && setPackages([]));
    return () => { active = false; };
  }, [department]);

  if (!packages) return <div className="flex min-h-32 items-center justify-center rounded-lg border border-[#dfe6ee] bg-white"><LoaderCircle className="animate-spin text-[#1645a2]" size={20} /></div>;

  return (
    <section className="overflow-hidden rounded-lg border border-[#dfe6ee] bg-white shadow-[0_3px_14px_rgba(15,23,42,0.04)]">
      <header className="flex items-center justify-between border-b border-[#e8edf3] px-5 py-4">
        <div><p className="flex items-center gap-2 text-xs font-extrabold text-[#172033]"><ClipboardList size={16} className="text-[#1645a2]" />Live task reports</p><p className="mt-1 text-[11px] text-[#7b8ba3]">Latest member updates rolled up across each work package.</p></div>
        <span className="rounded-md bg-[#eef4ff] px-2.5 py-1 text-[10px] font-bold text-[#1645a2]">{packages.length} packages</span>
      </header>
      {packages.length ? <div className="divide-y divide-[#edf1f5]">{packages.map((item) => {
        const open = expanded === item.taskId;
        return <article key={item.taskId}>
          <button type="button" onClick={() => setExpanded(open ? null : item.taskId)} className="grid w-full gap-4 px-5 py-4 text-left hover:bg-[#f8fafc] md:grid-cols-[1fr_180px_auto] md:items-center">
            <div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-sm bg-[#eef4ff] px-2 py-1 text-[9px] font-bold uppercase text-[#1645a2]">{item.department ?? "Cross-functional"}</span><span className="text-[10px] text-[#8492a6]">{item.stage.replaceAll("_", " ")}</span></div><h3 className="mt-2 truncate text-sm font-extrabold text-[#172033]">{item.title}</h3><p className="mt-1 text-[11px] text-[#7b8ba3]">{item.reportedWorkItems}/{item.totalWorkItems} reporting · {item.submittedWorkItems} in review · {item.acceptedWorkItems} accepted</p></div>
            <div><div className="flex justify-between text-[11px]"><span className="font-bold text-[#64748b]">Overall progress</span><strong className="text-[#172033]">{item.progress}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8edf3]"><div className="h-full rounded-full bg-[#1645a2]" style={{ width: `${item.progress}%` }} /></div></div>
            <ChevronDown size={17} className={`text-[#7b8ba3] transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open ? <div className="border-t border-[#edf1f5] bg-[#f8fafc] px-5 py-3"><div className="grid gap-2 lg:grid-cols-2">{item.workItems.map((work) => <div key={work.taskId} className="rounded-md border border-[#dfe6ee] bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-[#27364b]">{work.title}</p><p className="mt-0.5 text-[10px] text-[#8492a6]">{work.assignee?.name ?? "Unassigned"}</p></div><strong className="text-xs text-[#1645a2]">{work.progress}%</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8edf3]"><div className={`h-full rounded-full ${work.accepted ? "bg-[#00a978]" : work.submitted ? "bg-[#f59e0b]" : "bg-[#1645a2]"}`} style={{ width: `${work.progress}%` }} /></div>{work.report ? <><p className="mt-2 text-xs leading-5 text-[#52637d]">{work.report.summary}</p><p className="mt-1 text-[9px] text-[#94a3b8]">Reported {new Date(work.report.reportDate).toLocaleDateString()}</p></> : <p className="mt-2 text-[10px] text-[#94a3b8]">No progress report submitted yet.</p>}</div>)}</div></div> : null}
        </article>;
      })}</div> : <div className="px-5 py-10 text-center text-xs text-[#8492a6]">Delegated work packages and member reports will appear here.</div>}
    </section>
  );
}
