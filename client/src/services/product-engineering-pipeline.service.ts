import api from "./axios";
import type { TaskPriorityValue } from "@/lib/task-priority";

export type ProductEngineeringDepartment = "PRODUCT" | "ENGINEERING";
export type ProductEngineeringRequestType = "IDEA" | "BUG" | "REQUIREMENT" | "REQUEST";
export type ProductEngineeringPriority = TaskPriorityValue;
export type ProductEngineeringRating = "LOW" | "MEDIUM" | "HIGH";
export type ProductEngineeringEffort = "EXTRA_SMALL" | "SMALL" | "MEDIUM" | "LARGE" | "EXTRA_LARGE";
export type ProductEngineeringStage =
  | "TASK_INTAKE"
  | "ANALYSIS"
  | "PRIORITIZED"
  | "READY_FOR_DEVELOPMENT"
  | "IN_DEVELOPMENT"
  | "CODE_REVIEW"
  | "QA_TESTING"
  | "REWORK_FIXES"
  | "READY_FOR_RELEASE"
  | "RELEASED_COMPLETED";

export const PRODUCT_ENGINEERING_STAGES: Array<{
  key: ProductEngineeringStage;
  label: string;
  hint: string;
}> = [
  { key: "TASK_INTAKE", label: "Task Intake", hint: "New requests, ideas, bugs, or requirements" },
  { key: "ANALYSIS", label: "Analysis", hint: "Clarify requirements, value, and feasibility" },
  { key: "PRIORITIZED", label: "Prioritized", hint: "Rank by impact, urgency, and effort" },
  { key: "READY_FOR_DEVELOPMENT", label: "Ready for Development", hint: "Requirements and dependencies are ready" },
  { key: "IN_DEVELOPMENT", label: "In Development", hint: "Implementation is underway" },
  { key: "CODE_REVIEW", label: "Code Review", hint: "Peer review and approval" },
  { key: "QA_TESTING", label: "QA / Testing", hint: "Functionality, security, and performance checks" },
  { key: "REWORK_FIXES", label: "Rework / Fixes", hint: "Address review or QA findings" },
  { key: "READY_FOR_RELEASE", label: "Ready for Release", hint: "Approved and prepared to deploy" },
  { key: "RELEASED_COMPLETED", label: "Released / Completed", hint: "Deployed and verified" },
];

export type PipelinePerson = { _id: string; name: string; email?: string } | string;

export type ProductEngineeringPipelineItem = {
  _id: string;
  department: ProductEngineeringDepartment;
  requestType: ProductEngineeringRequestType;
  title: string;
  description: string;
  stage: ProductEngineeringStage;
  priority: ProductEngineeringPriority;
  impact: ProductEngineeringRating;
  urgency: ProductEngineeringRating;
  effortEstimate: ProductEngineeringEffort | null;
  businessValue: string;
  feasibilityNotes: string;
  acceptanceCriteria: string[];
  dependencies: string[];
  designUrl: string;
  createdBy: PipelinePerson;
  stageHistory: Array<{
    fromStage: ProductEngineeringStage | null;
    toStage: ProductEngineeringStage;
    actorId: PipelinePerson;
    note: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type ProductEngineeringPipelineAccess = {
  department: ProductEngineeringDepartment;
  canMoveStages: boolean;
  canCreate: boolean;
  canSelectDepartment: boolean;
};

export type ProductEngineeringPipelinePage = {
  items: ProductEngineeringPipelineItem[];
  access: ProductEngineeringPipelineAccess;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type CreateProductEngineeringPipelineItem = {
  department?: ProductEngineeringDepartment;
  requestType: ProductEngineeringRequestType;
  title: string;
  description: string;
  priority: ProductEngineeringPriority;
  impact: ProductEngineeringRating;
  urgency: ProductEngineeringRating;
  effortEstimate: ProductEngineeringEffort | null;
  businessValue: string;
  feasibilityNotes: string;
  acceptanceCriteria: string[];
  dependencies: string[];
  designUrl: string;
};

export const ProductEngineeringPipelineService = {
  async list(department?: ProductEngineeringDepartment, page = 1, signal?: AbortSignal) {
    const response = await api.get<ProductEngineeringPipelinePage>("/tasks/product-engineering-pipeline", {
      params: { ...(department ? { department } : {}), page, pageSize: 100 },
      signal,
    });
    return response.data;
  },
  async create(input: CreateProductEngineeringPipelineItem) {
    const response = await api.post<{ success: true; item: ProductEngineeringPipelineItem }>(
      "/tasks/product-engineering-pipeline",
      input,
    );
    return response.data.item;
  },
  async move(itemId: string, stage: ProductEngineeringStage) {
    const response = await api.patch<{ success: true; item: ProductEngineeringPipelineItem }>(
      `/tasks/product-engineering-pipeline/${itemId}/stage`,
      { stage },
    );
    return response.data.item;
  },
};
