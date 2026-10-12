"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, Trophy } from "lucide-react";
import { TaskService, type HierarchyPerformance } from "@/services/task.service";
import { UserProfileDialog } from "./UserProfileDialog";

const rankTone = [
  "bg-[#111827] text-white",
  "bg-[#dce7f6] text-[#28405f]",
  "bg-[#f4e4c8] text-[#7a4b14]",
];

export function HierarchyPerformanceBoard({ department }: { department?: string } = {}) {
  const [result, setResult] = useState<{ scope: string; leaderboard: HierarchyPerformance[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    TaskService.hierarchyPerformance(department)
      .then((data) => active && setResult(data))
      .catch(() => active && setFailed(true));
    return () => { active = false; };
  }, [department]);

  if (!result && !failed) {
    return <div className="flex min-h-36 items-center justify-center rounded-lg border border-[#dfe6ee] bg-white"><LoaderCircle size={20} className="animate-spin text-[#1645a2]" /></div>;
  }
  if (failed) return null;

  const leaders = result?.leaderboard ?? [];
  const totalDelivered = leaders.reduce((sum, item) => sum + item.delivered, 0);
  const totalOverdue = leaders.reduce((sum, item) => sum + item.overdue, 0);
  const averageScore = leaders.length ? Math.round(leaders.reduce((sum, item) => sum + item.score, 0) / leaders.length) : 0;

  return (
    <section className="overflow-hidden rounded-lg border border-[#d7dee8] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
      <header className="grid gap-5 bg-[#111827] px-5 py-5 text-white md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase text-[#9fb6d0]"><Trophy size={14} />Performance intelligence</p>
          <h2 className="mt-2 text-xl font-extrabold">{result?.scope}</h2>
          <p className="mt-1 text-xs text-[#b8c5d5]">Ranked by delivery, deadline reliability, and CEO-accepted outcomes.</p>
        </div>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md bg-white/15">
          <Stat value={averageScore} label="Avg score" />
          <Stat value={totalDelivered} label="Delivered" />
          <Stat value={totalOverdue} label="Overdue" alert={totalOverdue > 0} />
        </div>
      </header>
      {leaders.length ? (
        <div className="divide-y divide-[#edf1f5]">
          {leaders.map((item, index) => (
            <article key={item.key} className="grid gap-4 px-5 py-4 transition hover:bg-[#f8fafc] md:grid-cols-[minmax(220px,1fr)_100px_100px_100px_160px] md:items-center">
              <button type="button" disabled={!item.profileUserId} onClick={() => setProfileUserId(item.profileUserId)} className="flex min-w-0 items-center gap-3 text-left disabled:cursor-default">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-black ${rankTone[index] ?? "bg-[#f1f5f9] text-[#64748b]"}`}>{index + 1}</span>
                <div className="min-w-0"><h3 className="truncate text-sm font-extrabold text-[#172033]">{item.label}</h3><p className="truncate text-[11px] text-[#7b8ba3]">{item.subtitle}</p></div>
              </button>
              <Metric icon={CheckCircle2} value={`${item.delivered}/${item.total}`} label="Delivered" />
              <Metric icon={Clock3} value={`${item.onTimeRate}%`} label="On time" />
              <Metric icon={AlertTriangle} value={item.overdue} label="Overdue" alert={item.overdue > 0} />
              <div><div className="flex items-center justify-between text-xs"><span className="font-bold text-[#64748b]">Performance</span><strong className="text-[#172033]">{item.score}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8edf3]"><div className="h-full rounded-full bg-[#00a978]" style={{ width: `${item.score}%` }} /></div><p className="mt-1 text-right text-[10px] text-[#8a9ab3]">{item.accepted} CEO accepted</p></div>
            </article>
          ))}
        </div>
      ) : (
        <div className="px-5 py-10 text-center"><p className="text-sm font-bold text-[#334155]">No performance data yet</p><p className="mt-1 text-xs text-[#8492a6]">Rankings appear as work is delegated and reviewed.</p></div>
      )}
      <UserProfileDialog userId={profileUserId} onClose={() => setProfileUserId(null)} />
    </section>
  );
}

function Stat({ value, label, alert = false }: { value: number; label: string; alert?: boolean }) {
  return <div className="bg-[#1b2638] px-4 py-3 text-center"><strong className={alert ? "text-[#ffba6b]" : "text-white"}>{value}</strong><p className="mt-0.5 text-[9px] uppercase text-[#9fb0c5]">{label}</p></div>;
}

function Metric({ icon: Icon, value, label, alert = false }: { icon: typeof Clock3; value: number | string; label: string; alert?: boolean }) {
  return <div className="flex items-center gap-2"><Icon size={15} className={alert ? "text-red-500" : "text-[#8ca0b8]"} /><div><strong className={alert ? "block text-xs text-red-600" : "block text-xs text-[#334155]"}>{value}</strong><span className="text-[10px] text-[#8a9ab3]">{label}</span></div></div>;
}
