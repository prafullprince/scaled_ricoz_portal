import { Schema, Types } from "mongoose";

export const salesTaskKinds = ["TARGET", "EXECUTION", "LEAD_LINKED"] as const;
export const salesTargetMetrics = ["REVENUE", "CUSTOMERS", "ACTIVITY", "STRATEGY"] as const;
export type SalesTargetMetric = typeof salesTargetMetrics[number];
export interface SalesAccountability {
  kind: typeof salesTaskKinds[number];
  metric: SalesTargetMetric;
  target: number;
  unit: string;
  currency: string;
  expectedOutcome: string;
  periodStart: Date;
  leadIds: Types.ObjectId[];
  supervisorIds: Types.ObjectId[];
  state: "ACTIVE" | "BLOCKED" | "REVIEW" | "ACCEPTED";
  achieved: number;
  reports: Array<{ actorId: Types.ObjectId; summary: string; evidence: string; achieved: number; createdAt: Date }>;
}

export const salesAccountabilitySchema = new Schema<SalesAccountability>({
  kind: { type: String, enum: salesTaskKinds, required: true },
  metric: { type: String, enum: salesTargetMetrics, required: true },
  target: { type: Number, required: true, min: 0.01 },
  unit: { type: String, default: "activities", required: true, trim: true, maxlength: 80 },
  currency: { type: String, default: "INR", match: /^[A-Z]{3}$/ },
  expectedOutcome: { type: String, required: true, maxlength: 2000 },
  periodStart: { type: Date, default: Date.now, required: true },
  leadIds: [{ type: Schema.Types.ObjectId, ref: "SalesLead" }],
  supervisorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  state: { type: String, enum: ["ACTIVE", "BLOCKED", "REVIEW", "ACCEPTED"], default: "ACTIVE" },
  achieved: { type: Number, default: 0, min: 0 },
  reports: { type: [new Schema({
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    summary: { type: String, required: true, maxlength: 4000 },
    evidence: { type: String, required: true, maxlength: 4000 },
    achieved: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now },
  }, { _id: false })], default: [] },
}, { _id: false });

export function salesTargetProgress(target: number, achieved: number) {
  return Math.min(100, Math.round(100 * achieved / target));
}

export function salesCustomerKey(lead: { company?: string; email?: string; phone?: string; _id: unknown }) {
  return lead.company?.trim().toLowerCase() || lead.email?.trim().toLowerCase() || lead.phone?.replace(/\D/g, "") || String(lead._id);
}

export function crmTargetValue(metric: SalesTargetMetric, currency: string, start: Date, end: Date, leads: Array<{ _id: unknown; status: string; currency: string; closedAt?: Date | null; expectedValue: number; company?: string; email?: string; phone?: string }>, existingCustomers: ReadonlySet<string> = new Set()) {
  const unique = new Map(leads.map((lead) => [String(lead._id), lead]));
  const won = [...unique.values()].filter((lead) => lead.status === "WON" && lead.closedAt && lead.closedAt >= start && lead.closedAt <= end);
  return metric === "REVENUE"
    ? won.filter((lead) => lead.currency === currency).reduce((total, lead) => total + lead.expectedValue / 100, 0)
    : new Set(won.map(salesCustomerKey).filter((key) => !existingCustomers.has(key))).size;
}
