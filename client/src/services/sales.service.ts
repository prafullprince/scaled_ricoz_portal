import type { CreateSalesLeadInput, CreateSalesTaskInput, SalesAccess, SalesAssistantOverview, SalesDashboardData, SalesDashboardTask, SalesLead, SalesActivity, SalesLeadPage, SalesLeadQuery, UpdateSalesLeadInput } from "@/types/sales";
import api from "./axios";
import axios from "axios";
import type { SalesReport, SalesPipeline } from "@/types/sales";
import { getStoreRef } from "@/redux/store.reference";
import { companyHeaders } from "@/lib/company";
import type { CLIENT_LIST_BULK_UPDATE_FIELDS } from "@/lib/sales/client-filters";

export type SalesLeadImportRow = {
  sheet: string;
  rowNumber: number;
  values: Record<string, string>;
};

export type ImportedSalesLead = {
  _id: string;
  sheet?: string;
  row?: number;
  name: string;
  company?: string;
  email?: string;
  phone: string;
  archivedAt: string | null;
  filterValues?: Record<string, string | number | boolean>;
};

export type SalesClientCampaignTemplate = {
  name: string;
  language: string;
  category: string;
  body: string;
  variables: string[];
};

export type SalesClientWhatsAppAccount = {
  _id: string;
  name: string;
  phoneNumberId: string;
  businessAccountId: string;
};

export type SalesClientCampaign = {
  _id: string;
  name: string;
  channel: "EMAIL" | "WHATSAPP";
  status: "SCHEDULED" | "QUEUED" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED";
  subject: string;
  scheduledAt: string | null;
  createdAt: string;
  counts: Record<string, number>;
};

export type SalesClientCampaignRecipient = {
  _id: string;
  name: string;
  recipient: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "BOUNCED" | "REPLIED" | "SKIPPED";
  error: string;
  sentAt: string | null;
  attempts: number;
};

function salesRequestError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (error.response) return `${fallback} (HTTP ${error.response.status})`;
    return `Unable to reach the Sales server: ${error.message}`;
  }
  return error instanceof Error ? error.message : fallback;
}

export const SalesService = {
  async pipelines(signal?: AbortSignal) {
    const response = await api.get<{ pipelines: SalesPipeline[] }>("/sales/pipelines", { signal });
    return response.data.pipelines;
  },
  async savePipeline(pipeline: SalesPipeline) {
    const response = await api.put<{ pipeline: SalesPipeline }>(`/sales/pipelines/${encodeURIComponent(pipeline.key)}`, pipeline);
    return response.data.pipeline;
  },
  async reports(signal?: AbortSignal) {
    const response = await api.get<{ report: SalesReport }>("/sales/reports", { signal });
    return response.data.report;
  },
  async access() {
    const response = await api.get<{ success: true; access: SalesAccess }>("/sales/access");
    return response.data.access;
  },
  async dashboard() {
    const response = await api.get<{ success: true; dashboard: SalesDashboardData }>("/sales/dashboard");
    return response.data.dashboard;
  },
  async salesAssistantOverview(signal?: AbortSignal) {
    const response = await api.get<{ success: true; overview: SalesAssistantOverview }>("/sales/assistant/overview", { signal });
    return response.data.overview;
  },
  async streamSalesAssistant(message: string, sessionId: string, onText: (text: string) => void) {
    const token = getStoreRef().getState().auth.access_token;
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sales/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...companyHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ message, sessionId }),
    });
    if (!response.ok || !response.body) throw new Error("Sales AI Assistant is unavailable.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    function consume(chunk: string) {
      buffer += chunk;
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const item of events) {
        const event = item.match(/^event: (.+)$/m)?.[1];
        const data = item.match(/^data: (.+)$/m)?.[1];
        if (!data) continue;
        if (event === "delta") onText(String((JSON.parse(data) as { text: string }).text));
        if (event === "error") throw new Error((JSON.parse(data) as { message: string }).message);
      }
    }
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        consume(decoder.decode(value, { stream: true }));
      }
      consume(decoder.decode());
    } finally {
      reader.releaseLock();
    }
  },
  async completeTask(taskId: string) {
    const response = await api.patch(`/sales/tasks/${taskId}/complete`);
    return response.data.task;
  },
  async createTask(input: CreateSalesTaskInput) {
    const response = await api.post<{ success: true; task: SalesDashboardTask }>("/sales/tasks", input);
    return response.data.task;
  },
  async leads(search = "") {
    const response = await api.get<{ success: true; leads: SalesLead[] }>("/sales/leads", { params: { search: search || undefined } });
    return response.data.leads;
  },
  async leadsPage(params: SalesLeadQuery = {}, signal?: AbortSignal) {
    const { filters, ...query } = params;
    const response = await api.get<SalesLeadPage>("/sales/leads", {
      params: { ...query, ...(filters?.length ? { filters: JSON.stringify(filters) } : {}) },
      signal,
    });
    return response.data;
  },
  async addActivity(leadId: string, input: { kind: Exclude<SalesActivity["kind"], "STAGE">; text: string; dueAt?: string | null }) {
    const response = await api.post<{ lead: SalesLead }>(`/sales/leads/${leadId}/activities`, input);
    return response.data.lead;
  },
  async completeActivity(leadId: string, activityId: string) {
    const response = await api.patch<{ lead: SalesLead }>(`/sales/leads/${leadId}/activities/${activityId}/complete`);
    return response.data.lead;
  },
  async rescheduleActivity(leadId: string, activityId: string, dueAt: string) {
    const response = await api.patch<{ success: true; lead: SalesLead }>(`/sales/leads/${leadId}/activities/${activityId}/reschedule`, { dueAt });
    return response.data.lead;
  },
  async createLead(input: CreateSalesLeadInput) {
    const response = await api.post<{ success: true; lead: SalesLead }>("/sales/leads", input);
    return response.data.lead;
  },
  async importLeads(rows: SalesLeadImportRow[]) {
    const response = await api.post<{
      success: true;
      result: { imported: number; skipped: number; leads: ImportedSalesLead[]; errors: Array<{ sheet: string; row: number; message: string }> };
    }>("/sales/leads/import", { rows });
    return response.data.result;
  },
  async importedLeads(signal?: AbortSignal) {
    const response = await api.get<{ success: true; leads: ImportedSalesLead[] }>("/sales/leads/imported", { signal });
    return response.data.leads;
  },
  async bulkUpdateImportedLeads(leadIds: string[], field: typeof CLIENT_LIST_BULK_UPDATE_FIELDS[number], value: string) {
    try {
      const response = await api.patch<{ success: true; updatedCount: number; message: string }>(
        "/sales/leads/imported/bulk-update",
        { leadIds, field, value },
      );
      return response.data;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to update the selected clients."));
    }
  },
  async whatsappCampaignTemplates(accountId: string) {
    try {
      const response = await api.get<{ success: true; templates: SalesClientCampaignTemplate[] }>(
        "/sales/leads/imported/whatsapp-templates",
        { params: { accountId } },
      );
      return response.data.templates;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to load approved WhatsApp templates."));
    }
  },
  async whatsappCampaignAccounts() {
    try {
      const response = await api.get<{ success: true; accounts: SalesClientWhatsAppAccount[] }>(
        "/sales/leads/imported/whatsapp-accounts",
      );
      return response.data.accounts;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to load connected WhatsApp Business accounts."));
    }
  },
  async createClientCampaign(input: {
    leadIds: string[];
    channel: "EMAIL" | "WHATSAPP";
    name?: string;
    subject?: string;
    body?: string;
    cc?: string[];
    bcc?: string[];
    scheduledAt?: string | null;
    attachments?: Array<{ filename: string; contentType: string; contentBase64: string }>;
    accountId?: string;
    templateName?: string;
    templateLanguage?: string;
    templateVariables?: string[];
    confirmWhatsAppOptIn?: boolean;
    confirmContactPermission?: boolean;
  }) {
    try {
      const response = await api.post<{
        success: true;
        campaign: {
          _id: string;
          name: string;
          channel: "EMAIL" | "WHATSAPP";
          status: SalesClientCampaign["status"];
          scheduledAt: string | null;
          total: number;
          queued: number;
          skipped: number;
        };
      }>("/sales/leads/imported/campaigns", input);
      return response.data.campaign;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to start the client communication campaign."));
    }
  },
  async clientCampaigns() {
    try {
      const response = await api.get<{ success: true; campaigns: SalesClientCampaign[] }>("/sales/leads/imported/campaigns");
      return response.data.campaigns;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to load Client Lists campaign history."));
    }
  },
  async clientCampaignRecipients(campaignId: string, page = 1) {
    try {
      const response = await api.get<{
        success: true;
        recipients: SalesClientCampaignRecipient[];
        page: number;
        totalPages: number;
        total: number;
      }>(`/sales/leads/imported/campaigns/${campaignId}/recipients`, { params: { page } });
      return response.data;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to load campaign recipients."));
    }
  },
  async retryClientCampaign(campaignId: string) {
    try {
      const response = await api.post<{ success: true; retryCount: number; message: string }>(
        `/sales/leads/imported/campaigns/${campaignId}/retry`,
      );
      return response.data;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to retry failed campaign messages."));
    }
  },
  async updateLead(leadId: string, input: UpdateSalesLeadInput) {
    const response = await api.patch<{ success: true; lead: SalesLead }>(`/sales/leads/${leadId}`, input);
    return response.data.lead;
  },
  async archiveLead(leadId: string, archived: boolean) {
    const response = await api.patch<{ success: true; lead: SalesLead & { archivedAt: string | null } }>(`/sales/leads/${leadId}/archive`, { archived });
    return response.data.lead;
  },
  async requestLeadDeletionOtp(leadIds: string[], deleteAll: boolean) {
    try {
      const response = await api.post<{ email: string; message: string; leadCount: number }>(
        "/sales/leads/deletion-otp",
        { leadIds, deleteAll },
      );
      return response.data;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to send the Sales lead deletion code."));
    }
  },
  async requestAllImportedLeadDeletionOtp() {
    try {
      const response = await api.post<{ email: string; message: string; leadCount: number }>(
        "/sales/leads/deletion-otp",
        { allImported: true },
      );
      return response.data;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to send the Client Lists deletion code."));
    }
  },
  async deleteLeads(leadIds: string[], options: { deleteAll?: boolean; otp?: string } = {}) {
    try {
      const response = await api.delete<{ deletedCount: number; message: string }>(
        "/sales/leads",
        { data: { leadIds, ...options } },
      );
      return response.data;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to delete the selected Sales leads."));
    }
  },
  async deleteAllImportedLeads(otp: string) {
    try {
      const response = await api.delete<{ deletedCount: number; message: string }>(
        "/sales/leads",
        { data: { allImported: true, otp } },
      );
      return response.data;
    } catch (error) {
      throw new Error(salesRequestError(error, "Unable to delete all saved Client Lists leads."));
    }
  },
  async assignLead(leadId: string, ownerId: string) {
    const response = await api.post<{ success: true; lead: SalesLead }>(`/sales/leads/${leadId}/assign`, { ownerId, reason: "Assigned from Sales workspace" });
    return response.data.lead;
  },
};