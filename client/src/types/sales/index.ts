import type { TaskPriorityValue } from "@/lib/task-priority";
import type { ClientFilter } from "@/lib/sales/client-filters";

export type SalesDesignation = "SALES_HEAD" | "SALES_MANAGER" | "SALES_EXECUTIVE";
export type SalesEmploymentType = "EMPLOYEE" | "INTERN";
export type SalesAccessScope = "OWN" | "TEAM" | "DEPARTMENT";

export interface SalesAccess {
  designation: SalesDesignation | null;
  employmentType: SalesEmploymentType | null;
  reportsTo: string | null;
  scope: SalesAccessScope;
  permissions: string[];
}

export interface SalesDashboardTask {
  _id: string;
  title: string;
  description: string;
  deadline: string;
  priority: SalesTaskPriority;
  status: "PENDING" | "DONE";
  effectiveStatus: "PENDING" | "DONE" | "OVERDUE";
  workflowStage?: string;
  salesAccountability?: { kind: string } | null;
  assignedTo?: { _id: string; name: string; email: string; roles: string[] } | null;
  assignedBy?: { _id: string; name: string; email: string; roles: string[] } | null;
  currentOwner?: { _id: string; name: string } | string | null;
}

export type SalesTaskPriority = TaskPriorityValue;
export interface CreateSalesTaskInput {
  title: string;
  description: string;
  assignedToIds: string[];
  priority: SalesTaskPriority;
  deadline: string;
}

export interface SalesDashboardMember {
  user: { _id: string; name: string; email: string; roles: string[] };
  level: string;
  designation: SalesDesignation | null;
  employmentType: SalesEmploymentType | null;
  reportsTo: string | null;
  assignable: boolean;
  activeTasks: number;
  completedTasks: number;
  overdueTasks: number;
}

export interface SalesDashboardData {
  permissions?: string[];
  scope: SalesAccessScope;
  designation: SalesDesignation | null;
  employmentType: SalesEmploymentType | null;
  metrics: {
    totalLeads: number;
    qualifiedLeads: number;
    openDeals: number;
    pipelineValue: number;
    wonRevenue: number;
    conversionRate: number;
    pendingTasks: number;
    overdueTasks: number;
    dueToday: number;
    completedTasks: number;
  };
  pipeline: Array<{ stage: string; count: number; value: number }>;
  tasks: SalesDashboardTask[];
  team: SalesDashboardMember[];
}

export interface SalesAssistantOverview {
  generatedAt: string;
  scope: SalesAccessScope;
  totalLeads: number;
  openLeads: number;
  hotLeads: number;
  overdueFollowUps: number;
  dueToday: number;
  pipeline: Array<{ _id: string; pipelineValue: number; weightedForecast: number }>;
  stages: Array<{ _id: string; count: number }>;
}

export type SalesLeadSource = "GOOGLE" | "META" | "INSTAGRAM" | "LINKEDIN" | "WEBSITE" | "REFERRAL" | "EMAIL" | "YOUTUBE" | "COLD_CALLING" | "OTHER";
export type SalesLeadPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type SalesLeadStatus = "NEW" | "QUALIFIED" | "CONTACTED" | "REQUIREMENT" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
export interface SalesActivity { _id: string; kind: "NOTE" | "CALL" | "EMAIL" | "MEETING" | "FOLLOW_UP" | "STAGE"; text: string; actorId: string; dueAt?: string | null; completedAt?: string | null; createdAt: string }
export interface SalesLead { _id: string; name: string; company?: string; email?: string; phone: string; source: SalesLeadSource; sourceCategory?: string; sourceDetail?: string; campaignId?: string | null; marketingConsentAt?: string | null; serviceInterest?: string; status: SalesLeadStatus; priority: SalesLeadPriority; expectedValue: number; currency: string; ownerId: { _id: string; name: string; email: string; roles: string[] } | null; nextFollowUpAt?: string | null; notes?: string; updatedAt: string; pipeline?: string; tags?: string[]; probability?: number; expectedCloseAt?: string | null; lostReason?: string; activities?: SalesActivity[]; assignmentHistory?: Array<{ reason?: string; timestamp: string; newOwner: string; previousOwner: string | null }> }
export interface CreateSalesLeadInput { name: string; company?: string; email?: string; phone: string; source: SalesLeadSource; priority: SalesLeadPriority; expectedValue: number; serviceInterest?: string; notes?: string; ownerId?: string; pipeline?: string; tags?: string[]; probability?: number; expectedCloseAt?: string | null; nextFollowUpAt?: string | null; lostReason?: string }
export type UpdateSalesLeadInput = Partial<Omit<CreateSalesLeadInput, "ownerId" | "source">> & { status?: SalesLeadStatus };
export interface SalesLeadQuery { search?: string; page?: number; pageSize?: number; status?: SalesLeadStatus; pipeline?: string; ownerId?: string; followUp?: "OVERDUE" | "SCHEDULED"; activities?: "PENDING"; filters?: ClientFilter[] }
export interface SalesLeadPage { leads: SalesLead[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
export interface SalesReportRow { _id: { key: string; currency: string }; name?: string; count: number; value: number; won: number; lost: number; wonValue: number; openValue: number; weightedValue: number; overdue: number }
export interface SalesReport { scope: SalesAccessScope; generatedAt: string; stages: SalesReportRow[]; owners: SalesReportRow[]; sources: SalesReportRow[] }
export interface SalesPipelineStage { key: string; name: string; status: SalesLeadStatus; probability: number; archived: boolean }
export interface SalesPipeline { key: string; name: string; description: string; stages: SalesPipelineStage[]; archived: boolean; revision: number }
export interface SalesLead { stageId?: string }
export interface CreateSalesLeadInput { stageId?: string }
export interface SalesLeadQuery { stageId?: string; board?: "true" }
export interface SalesLeadPage { amounts?: Array<{ _id: string; value: number }> }
export interface SalesLead { qualification?: { need: string; budget: string; authority: string; timeline: string }; meetingNotes?: string; closedAt?: string | null }
export interface CreateSalesLeadInput { qualification?: { need: string; budget: string; authority: string; timeline: string }; meetingNotes?: string }