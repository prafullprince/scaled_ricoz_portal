import api from "./axios";

export type DeliveryStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "REWORK" | "SUBMITTED" | "COMPLETED";
export type DeliveryAction = "START" | "SUBMIT" | "APPROVE" | "REQUEST_REWORK";
export type DeliveryDepartment = "PRODUCT" | "ENGINEERING" | "IT";
export const deliveryDepartmentLabel = (department: DeliveryDepartment) =>
  department === "IT" ? "IT / DevOps" : department === "ENGINEERING" ? "Engineering" : "Product";
export type DeliverySubmission = { summary: string; githubUrl: string; liveUrl: string; submittedAt: string };
export type DeliveryPerson = {
  id: string;
  name: string;
  level: string | null;
  department: string | null;
  employmentType: "EMPLOYEE" | "INTERN" | null;
  reportsTo: string | null;
  active: boolean;
};
export type DeliveryWorkItem = {
  id: string;
  parentId: string | null;
  kind: "HEAD" | "MANAGER" | "MEMBER";
  assigneeId: string;
  title: string;
  description: string;
  deadline: string;
  status: DeliveryStatus;
  progress: number;
  completedAt: string | null;
  githubUrl: string;
  contributionInstructions: string;
  submission: DeliverySubmission | null;
  actions: DeliveryAction[];
  canDelegate: boolean;
};
export type DeliveryPackage = {
  _id: string;
  department: DeliveryDepartment;
  headId: string | null;
  createdBy: string;
  title: string;
  description: string;
  deadline: string;
  githubUrl: string;
  contributionInstructions: string;
  status: DeliveryStatus;
  progress: number;
  phase: "DELIVERY" | "ADMIN_REVIEW" | "CEO_REVIEW" | "COMPLETED";
  submission: DeliverySubmission | null;
  workItems: DeliveryWorkItem[];
  history: { nodeId: string | null; actorId: string; action: string; note: string; createdAt: string }[];
  revision: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  actions: DeliveryAction[];
  canDelegate: boolean;
};
export type DeliveryProgressReport = {
  nodeId: string;
  actorId: string;
  reportDate: string;
  progress: number;
  previousProgress: number;
  summary: string;
  createdAt: string;
  updatedAt: string;
};
export type DeliveryReportsPage = {
  packages: Array<DeliveryPackage & { progressReports: DeliveryProgressReport[] }>;
  people: DeliveryPerson[];
  access: DeliveryAccess & { canViewLeaderboard: boolean };
  analytics: {
    period: "WEEK" | "MONTH" | "YEAR";
    leaderboard: Array<{ userId: string; name: string; level: string | null; progressGained: number; completedTasks: number; score: number }>;
    calendar: Array<{ date: string; updates: number; progressGained: number; completedTasks: number }>;
  };
};
export type DeliveryAccess = {
  id: string;
  level: "HEAD" | "MANAGER" | "MEMBER" | null;
  department: DeliveryDepartment;
  ceo: boolean;
  admin: boolean;
  authorizedHr: boolean;
  canCreate: boolean;
  canSelectDepartment: boolean;
};
export type DeliveryPage = {
  packages: DeliveryPackage[];
  people: DeliveryPerson[];
  access: DeliveryAccess;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
export type DeliveryBrief = {
  title: string;
  description: string;
  deadline: string;
  githubUrl: string;
  contributionInstructions: string;
};
export type DeliveryTransition = {
  revision: number;
  nodeId: string | null;
  action: DeliveryAction;
  summary?: string;
  note?: string;
  githubUrl?: string;
  liveUrl?: string;
};

export const EngineeringDeliveryService = {
  async list(department: DeliveryDepartment, page = 1, signal?: AbortSignal) {
    const response = await api.get<DeliveryPage>("/tasks/engineering-delivery", { params: { department, page, pageSize: 20 }, signal });
    return response.data;
  },
  async create(input: DeliveryBrief & { department: DeliveryDepartment; assigneeId: string }) {
    const response = await api.post<{ package: DeliveryPackage }>("/tasks/engineering-delivery", input);
    return response.data.package;
  },
  async delegate(packageId: string, input: { revision: number; parentId: string | null; workItems: Array<DeliveryBrief & { assigneeId: string }> }) {
    const response = await api.post<{ package: DeliveryPackage }>(`/tasks/engineering-delivery/${packageId}/work`, input);
    return response.data.package;
  },
  async transition(packageId: string, input: DeliveryTransition) {
    const response = await api.patch<{ package: DeliveryPackage }>(`/tasks/engineering-delivery/${packageId}/transition`, input);
    return response.data.package;
  },
  async reports(department: DeliveryDepartment, period: "WEEK" | "MONTH" | "YEAR", signal?: AbortSignal) {
    const response = await api.get<DeliveryReportsPage>("/tasks/engineering-delivery/reports", { params: { department, period }, signal });
    return response.data;
  },
  async reportProgress(packageId: string, input: { revision: number; nodeId: string; progress: number; summary: string }) {
    const response = await api.patch<{ package: DeliveryPackage }>(`/tasks/engineering-delivery/${packageId}/progress`, input);
    return response.data.package;
  },
};
