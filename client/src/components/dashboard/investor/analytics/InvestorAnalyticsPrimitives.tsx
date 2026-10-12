"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { AnalyticsTrendPoint } from "@/services/analytics/types";
import { changeDirection, formatPercent } from "@/lib/analytics/format";
import { DashboardError, DashboardSkeleton } from "@/components/dashboard/DashboardPrimitives";

export function InvestorAnalyticsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-7 w-1 rounded-full bg-gradient-to-b from-(--brand-red) to-orange-300" aria-hidden="true" />
        <h2 className="text-lg font-bold tracking-tight text-(--brand-navy)">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

export function InvestorKpiCard({
  title,
  value,
  change,
  changeType,
  estimated,
  caption,
  trend,
  children,
}: {
  title: string;
  value: string;
  change?: number | null;
  changeType?: string | null;
  estimated?: boolean;
  caption?: string;
  trend?: AnalyticsTrendPoint[];
  children?: ReactNode;
}) {
  const direction = changeDirection(changeType);
  const hasChange = change !== null && change !== undefined && !Number.isNaN(change);

  return (
    <article className="group rounded-2xl border border-[#e5eaf2] bg-gradient-to-b from-white to-[#fcfdff] p-5 shadow-[0_4px_16px_rgba(24,36,58,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d7dfeb] hover:shadow-[0_12px_28px_rgba(24,36,58,0.075)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-(--brand-text-secondary)">{title}</p>
        {estimated ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
            Estimated
          </span>
        ) : null}
      </div>
      <p className="mt-3 break-words text-[28px] font-extrabold tracking-tight text-(--brand-navy) tabular-nums">{value}</p>
      {hasChange ? (
        <p
          className={`mt-1 flex items-center gap-1 text-sm font-semibold ${
            direction === "up"
              ? "text-(--status-success)"
              : direction === "down"
                ? "text-(--status-danger)"
                : "text-(--brand-text-muted)"
          }`}
        >
          {direction === "up" ? <ArrowUp size={14} /> : direction === "down" ? <ArrowDown size={14} /> : <Minus size={14} />}
          {formatPercent(Math.abs(change as number))}
        </p>
      ) : null}
      {caption ? <p className="mt-1 text-xs text-(--brand-text-muted)">{caption}</p> : null}
      <InvestorTrendChart trend={trend} />
      {children ? <div className="mt-3 border-t border-slate-100 pt-3">{children}</div> : null}
    </article>
  );
}

/** Renders nothing when there's no real trend data — never fabricates historical points. */
export function InvestorTrendChart({ trend }: { trend?: AnalyticsTrendPoint[] }) {
  if (!trend || trend.length < 2) return null;

  const values = trend.map((point) => Number(point.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-3 h-10 w-full text-(--brand-red)" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function InvestorMetricBreakdown({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-(--brand-text-muted)">{item.label}</dt>
          <dd className="text-right font-medium text-(--brand-text)">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InvestorAssumptions({ assumptions }: { assumptions?: string[] }) {
  if (!assumptions || assumptions.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-(--brand-text-secondary)">
      <p className="mb-1 font-semibold text-(--brand-text)">Assumptions</p>
      <ul className="list-disc space-y-0.5 pl-4">
        {assumptions.map((assumption) => (
          <li key={assumption}>{assumption}</li>
        ))}
      </ul>
    </div>
  );
}

export const InvestorAnalyticsSkeleton = DashboardSkeleton;
export const InvestorAnalyticsError = DashboardError;
