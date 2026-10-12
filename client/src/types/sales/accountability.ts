import type { TaskPriorityValue } from "@/lib/task-priority";

export type SalesTaskKind = "TARGET" | "EXECUTION" | "LEAD_LINKED";
export type SalesTargetMetric = "REVENUE" | "CUSTOMERS" | "ACTIVITY" | "STRATEGY";
export type SalesAccountabilityState = "ACTIVE" | "BLOCKED" | "REVIEW" | "ACCEPTED";
export interface SalesAccountabilityTask {
  _id: string;
  title: string;
  description: string;
  parentTaskId: string | null;
  assignedTo: { _id: string; name: string } | null;
  assignedBy: { _id: string; name: string } | null;
  deadline: string;
  priority: string;
  status: "PENDING" | "DONE";
  achieved: number;
  progress: number;
  reportedProgress: number;
  overdue: boolean;
  canDelegate: boolean;
  canReport: boolean;
  canReview: boolean;
  canComment: boolean;
  salesAccountability: {
    kind: SalesTaskKind;
    metric: SalesTargetMetric;
    target: number;
    unit: string;
    currency: string;
    expectedOutcome: string;
    periodStart: string;
    leadIds: string[];
    state: SalesAccountabilityState;
    reports: Array<{ summary: string; evidence: string; achieved: number; createdAt: string; actorId?: { _id: string; name: string } | null }>;
  };
  workflowHistory: Array<{ action: string; note?: string; createdAt: string; actorId?: { _id: string; name: string } | null }>;
}
export interface SalesAccountabilityPage {
  tasks: SalesAccountabilityTask[];
  canCreate: boolean;
  candidates: Array<{ user: { _id: string; name: string }; level: string; reportsTo: string | null }>;
}
export interface CreateSalesAccountabilityInput {
  title: string;
  description: string;
  parentTaskId?: string;
  assignedTo: string;
  deadline: string;
  priority: TaskPriorityValue;
  kind: SalesTaskKind;
  metric: SalesTargetMetric;
  target: number;
  unit: string;
  currency: string;
  expectedOutcome: string;
  periodStart?: string;
  leadIds: string[];
}
export interface AccountabilityLeadPage {
  leads: Array<{ _id: string; name: string; status: string; ownerId: string; currency: string; expectedValue: number }>;
  pagination: { page: number; totalPages: number };
}
