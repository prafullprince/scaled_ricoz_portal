import api from "./axios";

export type LeaveRequest = { id: string; type: "EARNED" | "SICK" | "CASUAL"; startDate: string; endDate: string; days: number; reason: string; status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string };
export type LeaveBalances = { earned: number; earnedTotal: number; sick: number; sickTotal: number; casual: number; casualTotal: number } | null;
export type DepartmentLeavePolicy = { department: string; earned: number; sick: number; casual: number };
export const LeavePolicyService = {
	async list() { return (await api.get<{ policies: DepartmentLeavePolicy[] }>("/leave/policies")).data.policies; },
	async save(policy: DepartmentLeavePolicy) { return (await api.put<{ policy: DepartmentLeavePolicy }>("/leave/policies", policy)).data.policy; },
	async allowance() { return (await api.get<{ balances: LeaveBalances }>("/leave/allowance")).data.balances; },
};
export const LeaveService = { async list(personal = false) { const response = await api.get<{ leave: { requests: LeaveRequest[]; balances: LeaveBalances } }>("/leave", { params: personal ? { scope: "self" } : undefined }); return response.data.leave; }, async create(input: { type: LeaveRequest["type"]; startDate: string; endDate: string; reason: string }) { const response = await api.post<{ request: LeaveRequest }>("/leave", input); return response.data.request; } };
