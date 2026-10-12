import { Schema, model, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";
import type { IntegrationKind } from "../modules/integrations/integration.catalog.js";

export interface IntegrationRecord {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  name: string;
  kind: IntegrationKind;
  provider: string;
  enabled: boolean;
  mode: "WEBHOOK" | "API";
  endpoint: string;
  authType: "NONE" | "BEARER" | "API_KEY";
  authHeader: string;
  encryptedCredential: string;
  credentialConfigured: boolean;
  encryptedWebhookSecret: string;
  recordsPath: string;
  fieldMapping: Record<string, string>;
  opportunityId: Types.ObjectId | null;
  ownerId: Types.ObjectId;
  createdBy: Types.ObjectId;
  intervalMinutes: number;
  cursorParam: string;
  nextCursorPath: string;
  cursor: string;
  nextSyncAt: Date;
  lockedUntil: Date;
  leaseToken: string;
  lastSyncAt: Date | null;
  lastStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = new Schema<IntegrationRecord>({
  name: { type: String, required: true, maxlength: 100 },
  kind: { type: String, enum: ["CANDIDATE", "LEAD"], required: true },
  provider: { type: String, required: true },
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ["WEBHOOK", "API"], required: true },
  endpoint: { type: String, default: "" },
  authType: { type: String, enum: ["NONE", "BEARER", "API_KEY"], default: "NONE" },
  authHeader: { type: String, default: "X-API-Key" },
  encryptedCredential: { type: String, default: "", select: false },
  credentialConfigured: { type: Boolean, default: false },
  encryptedWebhookSecret: { type: String, required: true, select: false },
  recordsPath: { type: String, default: "" },
  fieldMapping: { type: Schema.Types.Mixed, required: true },
  opportunityId: { type: Schema.Types.ObjectId, ref: "Opportunity", default: null },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  intervalMinutes: { type: Number, min: 5, max: 1440, default: 15 },
  cursorParam: { type: String, default: "" },
  nextCursorPath: { type: String, default: "" },
  cursor: { type: String, default: "", select: false },
  nextSyncAt: { type: Date, default: Date.now },
  lockedUntil: { type: Date, default: () => new Date(0) },
  leaseToken: { type: String, default: "", select: false },
  lastSyncAt: { type: Date, default: null },
  lastStatus: { type: String, default: "NOT_SYNCED" },
}, { timestamps: true });
integrationSchema.plugin(companyScoped);
integrationSchema.index({ companyId: 1, enabled: 1, nextSyncAt: 1 });
export const Integration = model<IntegrationRecord>("Integration", integrationSchema);

export interface IntegrationRunRecord {
  integrationId: Types.ObjectId;
  trigger: string;
  status: string;
  imported: number;
  duplicates: number;
  failed: number;
  issues: Array<{ index: number; message: string }>;
  finishedAt: Date;
}
const runSchema = new Schema<IntegrationRunRecord>({
  integrationId: { type: Schema.Types.ObjectId, ref: "Integration", required: true, index: true },
  trigger: { type: String, enum: ["WEBHOOK", "MANUAL", "SCHEDULED"], required: true },
  status: { type: String, enum: ["SUCCESS", "PARTIAL", "FAILED"], required: true },
  imported: { type: Number, default: 0 },
  duplicates: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  issues: { type: [{ index: Number, message: String }], default: [] },
  finishedAt: { type: Date, default: Date.now },
});
runSchema.plugin(companyScoped);
runSchema.index({ integrationId: 1, finishedAt: -1 });
export const IntegrationRun = model<IntegrationRunRecord>("IntegrationRun", runSchema);
