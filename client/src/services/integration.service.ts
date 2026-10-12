import api from "./axios";

export type IntegrationKind = "CANDIDATE" | "LEAD";
export type IntegrationConfig = {
  name: string;
  kind: IntegrationKind;
  provider: string;
  enabled: boolean;
  mode: "WEBHOOK" | "API";
  endpoint: string;
  authType: "NONE" | "BEARER" | "API_KEY";
  authHeader: string;
  credential?: string;
  recordsPath: string;
  fieldMapping: Record<string, string>;
  opportunityId: string | null;
  ownerId: string;
  intervalMinutes: number;
  cursorParam: string;
  nextCursorPath: string;
};
export type Connector = IntegrationConfig & {
  _id: string;
  credentialConfigured: boolean;
  lastSyncAt: string | null;
  lastStatus: string;
};
export type IntegrationRun = {
  _id: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  trigger: string;
  imported: number;
  duplicates: number;
  failed: number;
  issues: Array<{ index: number; message: string }>;
  finishedAt: string;
};
export type IntegrationCatalog = {
  providers: Array<{ id: string; name: string; kind: IntegrationKind; category: string }>;
  categories: Array<{ id: string; name: string; examples: string[] }>;
  fields: Partial<Record<IntegrationKind, string[]>>;
  opportunities: Array<{ _id: string; title: string; type: string }>;
  owners: Array<{ id: string; name: string; department: string | null; executive: boolean }>;
  webhookBase: string;
  notice: string;
  encryptionConfigured: boolean;
};

export const IntegrationService = {
  async list(kind?: IntegrationKind, signal?: AbortSignal) {
    return (await api.get<{ connectors: Connector[] }>("/integrations", { params: kind ? { kind } : undefined, signal })).data.connectors;
  },
  async catalog(kind?: IntegrationKind, signal?: AbortSignal) {
    return (await api.get<IntegrationCatalog>("/integrations/catalog", { params: kind ? { kind } : undefined, signal })).data;
  },
  async save(input: IntegrationConfig, id?: string, scope?: IntegrationKind) {
    const response = id
      ? await api.put<{ connector: Connector; webhookSecret?: string }>(`/integrations/${id}`, input, { params: scope ? { kind: scope } : undefined })
      : await api.post<{ connector: Connector; webhookSecret?: string }>("/integrations", input, { params: scope ? { kind: scope } : undefined });
    return response.data;
  },
  async sync(id: string, scope?: IntegrationKind) {
    return (await api.post<{ success: boolean; result: IntegrationRun }>(`/integrations/${id}/sync`, {}, { timeout: 120_000, params: scope ? { kind: scope } : undefined })).data.result;
  },
  async history(id: string, signal?: AbortSignal, scope?: IntegrationKind) {
    return (await api.get<{ runs: IntegrationRun[] }>(`/integrations/${id}/runs`, { signal, params: scope ? { kind: scope } : undefined })).data.runs;
  },
  async rotateSecret(id: string, scope?: IntegrationKind) {
    return (await api.post<{ webhookSecret: string }>(`/integrations/${id}/rotate-secret`, {}, { params: scope ? { kind: scope } : undefined })).data.webhookSecret;
  },
};
