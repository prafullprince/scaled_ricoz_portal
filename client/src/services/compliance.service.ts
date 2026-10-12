import api from "./axios";

export type ComplianceCapability =
  | "COMPLIANCE_VIEW"
  | "COMPLIANCE_CREATE"
  | "COMPLIANCE_UPDATE"
  | "COMPLIANCE_DELETE"
  | "COMPLIANCE_ASSIGN"
  | "COMPLIANCE_APPROVE"
  | "COMPLIANCE_AUDIT"
  | "COMPLIANCE_MANAGE_DOCUMENTS"
  | "COMPLIANCE_MANAGE_POLICIES"
  | "COMPLIANCE_MANAGE_RISKS"
  | "COMPLIANCE_MANAGE_SETTINGS";

export type ComplianceCategory = { _id: string; key: string; name: string; description: string; active: boolean };
export type ComplianceRequirement = {
  _id: string;
  title: string;
  description: string;
  categoryId: ComplianceCategory | string;
  departmentId: string | null;
  ownerId: { _id?: string; name?: string } | string | null;
  reviewerId?: { _id?: string; name?: string } | string | null;
  approverId?: { _id?: string; name?: string } | string | null;
  status: string;
  riskLevel: string;
  applicability: string;
  sourceType: string;
  sourceReference: string;
  jurisdiction: string;
  dueDate: string | null;
  renewalDate: string | null;
  nextReviewDate: string | null;
  requiredEvidence: string[];
  approvedBy?: { name?: string } | string | null;
  approvedAt?: string | null;
};
export type ComplianceDashboard = {
  metrics: Record<string, number>;
  byStatus: Array<{ _id: string; count: number }>;
  byDepartment: Array<{ _id: string | null; count: number }>;
  actionRequired: ComplianceRequirement[];
  generatedAt: string;
  metricLabel: string;
};
export type ComplianceEvidence = {
  _id: string;
  requirementId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  issueDate: string | null;
  expiryDate: string | null;
  version: string;
  description: string;
  verificationStatus: string;
  verifiedBy: { name?: string } | null;
  verifiedAt: string | null;
  uploadedBy: { name?: string } | null;
};
export type ComplianceRisk = {
  _id: string;
  title: string;
  departmentId: string | null;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: string;
  status: string;
  dueDate: string | null;
  mitigation: string;
};
export type ComplianceIssue = {
  _id: string;
  title: string;
  severity: string;
  status: string;
  departmentId: string | null;
  dueDate: string | null;
  description: string;
};
export type CompliancePolicy = {
  _id: string;
  title: string;
  description: string;
  version: string;
  status: string;
  effectiveDate: string | null;
  reviewDate: string | null;
  acknowledged: boolean;
};
export type ComplianceCalendarEvent = { id: string; kind: string; date: string; title: string; requirementId: string; riskLevel?: string };

const base = "/compliance";
export const ComplianceService = {
  async access() {
    return (await api.get<{ capabilities: Partial<Record<ComplianceCapability, boolean>> }>(`${base}/access`)).data.capabilities;
  },
  async dashboard(params: Record<string, string> = {}) {
    return (await api.get<{ dashboard: ComplianceDashboard }>(`${base}/dashboard`, { params })).data.dashboard;
  },
  async categories() {
    return (await api.get<{ categories: ComplianceCategory[] }>(`${base}/categories`)).data.categories;
  },
  async createCategory(input: { key: string; name: string; description: string }) {
    return (await api.post<{ category: ComplianceCategory }>(`${base}/categories`, input)).data.category;
  },
  async requirements(params: Record<string, string> = {}) {
    return (await api.get<{ requirements: ComplianceRequirement[]; pagination: { page: number; limit: number; total: number } }>(`${base}/requirements`, { params })).data;
  },
  async createRequirement(input: Record<string, unknown>) {
    return (await api.post<{ requirement: ComplianceRequirement }>(`${base}/requirements`, input)).data.requirement;
  },
  async submitRequirement(id: string) {
    return (await api.post(`${base}/requirements/${id}/submit`)).data;
  },
  async decideRequirement(id: string, decision: "APPROVE" | "REJECT", reason?: string) {
    return (await api.post(`${base}/requirements/${id}/approve`, { decision, reason })).data;
  },
  async reviewRequirement(id: string, decision: "APPROVE" | "REJECT", reason?: string) {
    return (await api.post(`${base}/requirements/${id}/review`, { decision, reason })).data;
  },
  async calendar(params: Record<string, string>) {
    return (await api.get<{ events: ComplianceCalendarEvent[] }>(`${base}/calendar`, { params })).data.events;
  },
  async evidence(requirementId: string) {
    return (await api.get<{ evidence: ComplianceEvidence[] }>(`${base}/evidence`, { params: { requirementId } })).data.evidence;
  },
  async downloadEvidence(id: string) {
    return (await api.get(`${base}/evidence/${id}/download`, { responseType: "blob" })).data as Blob;
  },
  async uploadEvidence(input: FormData) {
    return (await api.post<{ evidence: ComplianceEvidence }>(`${base}/evidence`, input, { headers: { "Content-Type": "multipart/form-data" } })).data.evidence;
  },
  async verifyEvidence(id: string, decision: "VERIFIED" | "REJECTED", rejectionReason?: string) {
    return (await api.post(`${base}/evidence/${id}/verify`, { decision, rejectionReason })).data;
  },
  async risks(params: Record<string, string> = {}) {
    return (await api.get<{ risks: ComplianceRisk[] }>(`${base}/risks`, { params })).data.risks;
  },
  async createRisk(input: Record<string, unknown>) {
    return (await api.post(`${base}/risks`, input)).data;
  },
  async issues(params: Record<string, string> = {}) {
    return (await api.get<{ issues: ComplianceIssue[] }>(`${base}/issues`, { params })).data.issues;
  },
  async createIssue(input: Record<string, unknown>) {
    return (await api.post(`${base}/issues`, input)).data;
  },
  async updateIssue(id: string, input: Record<string, unknown>) {
    return (await api.patch(`${base}/issues/${id}`, input)).data;
  },
  async policies(params: Record<string, string> = {}) {
    return (await api.get<{ policies: CompliancePolicy[] }>(`${base}/policies`, { params })).data.policies;
  },
  async createPolicy(input: Record<string, unknown>) {
    return (await api.post(`${base}/policies`, input)).data;
  },
  async publishPolicy(id: string) {
    return (await api.post(`${base}/policies/${id}/publish`)).data;
  },
  async acknowledgePolicy(id: string) {
    return (await api.post(`${base}/policies/${id}/acknowledge`)).data;
  },
  async notifications() {
    return (await api.get<{ notifications: Array<{ _id: string; title: string; message: string; dueDate: string; readAt: string | null; requirementId: ComplianceRequirement | null }> }>(`${base}/notifications`)).data.notifications;
  },
  async markRead(id: string) {
    return (await api.patch(`${base}/notifications/${id}/read`)).data;
  },
  async auditLogs() {
    return (await api.get<{ events: Array<{ _id: string; actorId: { name?: string } | null; actorType: string; action: string; entityType: string; entityId: string; createdAt: string; metadata: Record<string, unknown> }> }>(`${base}/audit-logs`)).data.events;
  },
  async reportCsv(params: Record<string, string> = {}) {
    return (await api.get(`${base}/reports`, { params: { ...params, format: "csv" }, responseType: "blob" })).data as Blob;
  },
  async notificationRules() {
    return (await api.get<{ rules: Array<{ _id: string; name: string; daysBeforeDue: number; recipients: string[]; active: boolean }> }>(`${base}/settings/reminder-rules`)).data.rules;
  },
  async saveNotificationRules(rules: Array<{ name: string; daysBeforeDue: number; recipients: string[]; active: boolean }>) {
    return (await api.put<{ rules: Array<{ _id: string; name: string; daysBeforeDue: number; recipients: string[]; active: boolean }> }>(`${base}/settings/reminder-rules`, { rules })).data.rules;
  },
};
