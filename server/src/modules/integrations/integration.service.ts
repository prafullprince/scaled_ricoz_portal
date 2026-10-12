import { Types } from "mongoose";
import { randomBytes } from "node:crypto";
import { Integration, IntegrationRun, type IntegrationRecord } from "../../models/integration.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { runWithCompany, scopeFor } from "../company/company.context.js";
import { decryptSecret, fetchIntegrationJson } from "./integration.security.js";
import { ingestRecords } from "./integration.ingestion.js";
import { valueAtPath } from "./integration.validation.js";

export async function executeIntegration(
  id: Types.ObjectId,
  trigger: "WEBHOOK" | "MANUAL" | "SCHEDULED",
  payload?: unknown,
) {
  const now = new Date();
  const leaseToken = randomBytes(16).toString("hex");
  const integration = await Integration.findOneAndUpdate(
    { _id: id, enabled: true, lockedUntil: { $lte: now } },
    { $set: { lockedUntil: new Date(now.getTime() + 10 * 60_000), leaseToken } },
    { returnDocument: "after" },
  ).select("+encryptedCredential +cursor").lean();
  if (!integration) throw new ApiError(409, "Connector is paused, already importing, or unavailable in this company");
  try {
    let cursor: string | undefined;
    let data = payload;
    if (trigger !== "WEBHOOK") {
      if (integration.mode !== "API") throw new ApiError(400, "Webhook connectors receive data; they cannot fetch it");
      const headers: Record<string, string> = {};
      if (integration.authType !== "NONE") {
        if (!integration.encryptedCredential) throw new ApiError(400, "Configure provider credentials before syncing");
        const credential = decryptSecret(integration.encryptedCredential);
        if (integration.authType === "BEARER") headers.Authorization = `Bearer ${credential}`;
        else headers[integration.authHeader] = credential;
      }
      const url = new URL(integration.endpoint);
      if (integration.cursorParam && integration.cursor) url.searchParams.set(integration.cursorParam, integration.cursor);
      data = await fetchIntegrationJson(url.toString(), headers);
      if (integration.nextCursorPath) {
        const value = valueAtPath(data, integration.nextCursorPath);
        if (value !== null && value !== undefined && typeof value !== "string" && typeof value !== "number") throw new ApiError(400, "Next cursor must be a string or number");
        cursor = value === null || value === undefined ? "" : String(value);
        if (cursor.length > 2000) throw new ApiError(400, "Next cursor exceeds 2000 characters");
      }
    }
    const result = await ingestRecords(integration, data);
    const status = result.failed ? result.imported || result.duplicates ? "PARTIAL" : "FAILED" : "SUCCESS";
    const run = await IntegrationRun.create({
      integrationId: id, trigger, status,
      imported: result.imported, duplicates: result.duplicates, failed: result.failed, issues: result.errors,
    });
    await Integration.updateOne({ _id: id, leaseToken }, { $set: {
      lastSyncAt: new Date(), lastStatus: status,
      nextSyncAt: new Date(Date.now() + integration.intervalMinutes * 60_000),
      ...(cursor !== undefined && !result.failed ? { cursor } : {}),
    } });
    return run.toObject();
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Import failed; check connector configuration and provider availability";
    await IntegrationRun.create({ integrationId: id, trigger, status: "FAILED", failed: 1, issues: [{ index: -1, message }] });
    await Integration.updateOne({ _id: id, leaseToken }, { $set: { lastStatus: "FAILED", lastSyncAt: new Date(), nextSyncAt: new Date(Date.now() + integration.intervalMinutes * 60_000) } });
    throw error;
  } finally {
    await Integration.updateOne({ _id: id, leaseToken }, { $set: { lockedUntil: new Date(0), leaseToken: "" } });
  }
}

export async function syncDueIntegrations() {
  const due = await runWithCompany(null, () => Integration.find({
    enabled: true, mode: "API", nextSyncAt: { $lte: new Date() }, lockedUntil: { $lte: new Date() },
  }).select("_id companyId").limit(20).lean());
  for (const integration of due) {
    try {
      await runWithCompany(scopeFor(integration.companyId), () => executeIntegration(integration._id, "SCHEDULED"));
    } catch (error) {
      console.error("Scheduled integration sync failed", { integrationId: integration._id, message: error instanceof ApiError ? error.message : "Import failed" });
    }
  }
}

export function publicIntegration(record: IntegrationRecord) {
  const {
    encryptedCredential: _credential, encryptedWebhookSecret: _secret, cursor: _cursor, leaseToken: _lease,
    ...publicRecord
  } = record;
  return publicRecord;
}
