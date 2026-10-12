"use client";

export type DailyReport = { _id: string; taskId: string; userId: string; reportDate: string; summary: string; progress: number };

export function TaskContributionGrid({ reports = [], title = "Daily contribution" }: { reports?: DailyReport[]; title?: string }) {
  const today = new Date();
  const days = Array.from({ length: 84 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (83 - index));
    return date.toISOString().slice(0, 10);
  });
  const byDate = new Map<string, DailyReport[]>();
  reports.forEach((report) => byDate.set(report.reportDate, [...(byDate.get(report.reportDate) ?? []), report]));
  return <div className="rounded-md border border-(--brand-border) bg-(--brand-surface) p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-(--brand-navy)">{title}</p><p className="text-xs text-(--brand-text-muted)">{reports.length} reports</p></div><div className="mt-4 grid grid-cols-12 gap-1.5 sm:grid-cols-21">{days.map((date) => { const entries = byDate.get(date) ?? []; const progress = entries.length ? Math.max(...entries.map((entry) => entry.progress)) : 0; const tone = !entries.length ? "bg-(--brand-border)" : progress >= 80 ? "bg-(--status-success)" : progress >= 40 ? "bg-(--brand-red-soft)" : "bg-(--brand-red-pale)"; return <span key={date} title={`${date}: ${entries.length ? `${progress}% progress` : "No report"}`} className={`aspect-square rounded-sm ${tone}`} />; })}</div><div className="mt-3 flex items-center justify-between text-[11px] text-(--brand-text-muted)"><span>Last 12 weeks</span><span>Less <i className="mx-1 inline-block h-2.5 w-2.5 rounded-sm bg-(--brand-border)" /><i className="mx-1 inline-block h-2.5 w-2.5 rounded-sm bg-(--brand-red-pale)" /><i className="mx-1 inline-block h-2.5 w-2.5 rounded-sm bg-(--brand-red-soft)" /><i className="mx-1 inline-block h-2.5 w-2.5 rounded-sm bg-(--status-success)" /> More</span></div></div>;
}
