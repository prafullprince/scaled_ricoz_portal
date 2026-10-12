import api from "./axios";
import type { AccountabilityLeadPage, CreateSalesAccountabilityInput, SalesAccountabilityPage, SalesAccountabilityState } from "@/types/sales/accountability";

export const SalesAccountabilityService = {
  async list(signal?: AbortSignal) {
    return (await api.get<SalesAccountabilityPage>("/sales/accountability/tasks", { signal })).data;
  },
  async leads(search: string, page: number, signal?: AbortSignal) {
    return (await api.get<AccountabilityLeadPage>("/sales/accountability/leads", { params: { search, page, pageSize: 20 }, signal })).data;
  },
  async create(input: CreateSalesAccountabilityInput) {
    await api.post("/sales/accountability/tasks", input);
  },
  async report(id: string, input: { summary: string; evidence: string; achieved: number; state: Exclude<SalesAccountabilityState, "ACCEPTED">; leadIds: string[] }) {
    await api.post(`/sales/accountability/tasks/${id}/reports`, input);
  },
  async review(id: string, decision: "APPROVE" | "ENHANCEMENT", note: string) {
    await api.patch(`/sales/accountability/tasks/${id}/review`, { decision, note });
  },
  async comment(id: string, note: string) {
    await api.post(`/sales/accountability/tasks/${id}/comments`, { note });
  },
};
