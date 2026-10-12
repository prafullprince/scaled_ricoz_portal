"use client";

import { useState } from "react";
import type { AnalyticsPeriodParams } from "@/services/analytics/types";

const PRESETS = ["monthly", "quarterly", "yearly"] as const;

export function InvestorPeriodSelector({
  value,
  onChange,
}: {
  value: AnalyticsPeriodParams;
  onChange: (params: AnalyticsPeriodParams) => void;
}) {
  const [mode, setMode] = useState<"monthly" | "quarterly" | "yearly" | "custom">(
    value.period ?? (value.from && value.to ? "custom" : "monthly"),
  );
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");
  const [error, setError] = useState("");

  function selectPreset(preset: (typeof PRESETS)[number]) {
    setMode(preset);
    setError("");
    onChange({ period: preset });
  }

  function applyCustom() {
    if (!from || !to) return setError("Select both dates.");
    if (from > to) return setError("From date must be before or equal to the To date.");
    setError("");
    onChange({ from, to });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => selectPreset(preset)}
            aria-pressed={mode === preset}
            className={`rounded-lg px-3 py-2 text-xs font-bold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red)/30 ${
              mode === preset ? "bg-gradient-to-r from-(--brand-red) to-[#e13b3e] text-white shadow-[0_3px_8px_rgba(201,29,32,0.2)]" : "text-(--brand-text-secondary) hover:bg-slate-50"
            }`}
          >
            {preset}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMode("custom")}
          aria-pressed={mode === "custom"}
          className={`rounded-lg px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-red)/30 ${
            mode === "custom" ? "bg-gradient-to-r from-(--brand-red) to-[#e13b3e] text-white shadow-[0_3px_8px_rgba(201,29,32,0.2)]" : "text-(--brand-text-secondary) hover:bg-slate-50"
          }`}
        >
          Custom Range
        </button>
      </div>

      {mode === "custom" ? (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="analytics-from" className="mb-1 block text-xs font-semibold text-(--brand-text-muted)">
              From
            </label>
            <input
              id="analytics-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-(--brand-red) focus:ring-4 focus:ring-red-50"
            />
          </div>
          <div>
            <label htmlFor="analytics-to" className="mb-1 block text-xs font-semibold text-(--brand-text-muted)">
              To
            </label>
            <input
              id="analytics-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-(--brand-red) focus:ring-4 focus:ring-red-50"
            />
          </div>
          <button
            type="button"
            onClick={applyCustom}
            className="h-10 rounded-xl bg-(--brand-red) px-4 text-sm font-bold text-white shadow-sm transition hover:bg-(--brand-red-hover) hover:shadow-md"
          >
            Apply
          </button>
        </div>
      ) : null}

      {error ? <p className="w-full text-xs text-(--status-danger)">{error}</p> : null}
    </div>
  );
}
