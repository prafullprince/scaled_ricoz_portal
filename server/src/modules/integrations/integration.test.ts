import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { createHmac } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { Application, ApplicationSource, SalesLead } from "../../models/index.js";
import { Integration, IntegrationRun, type IntegrationRecord } from "../../models/integration.models.js";
import { companyCondition, currentScope, runWithCompany, scopeFor, setDefaultCompanyId } from "../company/company.context.js";
import { decryptSecret, encryptSecret, publicIPv4, verifyWebhookSignature, apiEndpoint } from "./integration.security.js";
import { catalogProvider, candidateProviders, formProviders, leadCategories } from "./integration.catalog.js";
import { integrationInput, mappedRecord, candidateRecord, leadRecord } from "./integration.validation.js";
import { ingestRecords, integrationRecords } from "./integration.ingestion.js";
import { executeIntegration, publicIntegration } from "./integration.service.js";
import { canReadTaskCompany } from "../tasks/task-company-access.js";
import { integrationKindsForAccess, narrowIntegrationKinds } from "./integration.access.js";

const defaultId = new Types.ObjectId();
const companyId = new Types.ObjectId();
const ownerId = new Types.ObjectId();
const opportunityId = new Types.ObjectId();
setDefaultCompanyId(defaultId);
afterEach(() => mock.restoreAll());

function config(kind: "CANDIDATE" | "LEAD" = "CANDIDATE"): IntegrationRecord {
  return {
    _id: new Types.ObjectId(), companyId, name: "Test", kind,
    provider: kind === "CANDIDATE" ? "internshala" : "lead-database:apollo",
    enabled: true, mode: "WEBHOOK", endpoint: "", authType: "NONE", authHeader: "X-API-Key",
    encryptedCredential: "", credentialConfigured: false, encryptedWebhookSecret: "encrypted",
    recordsPath: "", fieldMapping: { externalId: "id", name: "name", email: "email", phone: "phone", skills: "skills", resumeUrl: "resume" },
    opportunityId: kind === "CANDIDATE" ? opportunityId : null, ownerId, createdBy: ownerId,
    intervalMinutes: 15, cursorParam: "", nextCursorPath: "", cursor: "",
    nextSyncAt: new Date(), lockedUntil: new Date(0), leaseToken: "", lastSyncAt: null, lastStatus: "NOT_SYNCED",
    createdAt: new Date(), updatedAt: new Date(),
  };
}

test("catalog contains all ten hiring providers and all sixteen lead categories", () => {
  assert.equal(candidateProviders.length, 10);
  assert.equal(leadCategories.length, 16);
  assert.equal(formProviders.length, 3);
  assert.equal(catalogProvider("internshala", "CANDIDATE")?.name, "Internshala");
  assert.equal(catalogProvider("lead-database:apollo", "LEAD")?.name, "Apollo");
  assert.equal(catalogProvider("google-forms", "CANDIDATE")?.category, "Form platform");
  assert.equal(catalogProvider("zoho-forms", "LEAD")?.category, "Form platform");
  assert.equal(catalogProvider("third-party-form", "CANDIDATE")?.name, "Third-party form");
  assert.equal(catalogProvider("internshala", "LEAD"), undefined);
});

test("integration access is limited by department while executives retain both destinations", () => {
  assert.deepEqual(integrationKindsForAccess(["HR"], false), ["CANDIDATE"]);
  assert.deepEqual(integrationKindsForAccess(["SALES_MANAGER"], true), ["LEAD"]);
  assert.deepEqual(integrationKindsForAccess(["SALES_MANAGER"], false), []);
  assert.deepEqual(integrationKindsForAccess(["ADMIN"], false), ["CANDIDATE", "LEAD"]);
  assert.deepEqual(integrationKindsForAccess(["CEO"], false), ["CANDIDATE", "LEAD"]);
  assert.deepEqual(integrationKindsForAccess(["CEO"], false, "HR"), ["CANDIDATE"]);
  assert.deepEqual(integrationKindsForAccess(["ADMIN"], false, "SALES"), ["LEAD"]);
});

test("integration requests can narrow but cannot expand their allowed connector kinds", () => {
  assert.deepEqual(narrowIntegrationKinds(["CANDIDATE", "LEAD"], "CANDIDATE"), ["CANDIDATE"]);
  assert.deepEqual(narrowIntegrationKinds(["LEAD"], "LEAD"), ["LEAD"]);
  assert.equal(narrowIntegrationKinds(["CANDIDATE"], "LEAD"), null);
  assert.equal(narrowIntegrationKinds(["CANDIDATE"], "INVALID"), null);
});

test("credentials are authenticated-encrypted and never present in public connector data", () => {
  const previous = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "1".repeat(64);
  try {
    const encrypted = encryptSecret("private-token");
    assert.equal(encrypted.includes("private-token"), false);
    assert.equal(decryptSecret(encrypted), "private-token");
    assert.throws(() => decryptSecret(`${encrypted.slice(0, -2)}00`));
    const connector = publicIntegration(config());
    assert.equal("encryptedWebhookSecret" in connector, false);
    assert.equal("encryptedCredential" in connector, false);
    assert.equal("cursor" in connector, false);
    assert.equal("leaseToken" in connector, false);
  } finally {
    if (previous === undefined) delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
    else process.env.INTEGRATIONS_ENCRYPTION_KEY = previous;
  }
});

test("webhook signatures reject tampering, stale timestamps, and malformed signatures", () => {
  const secret = "test-secret";
  const timestamp = "1791549000";
  const body = Buffer.from('{"id":"1"}');
  const signature = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
  const now = Number(timestamp) * 1000;
  assert.equal(verifyWebhookSignature(secret, timestamp, signature, body, now), true);
  assert.equal(verifyWebhookSignature(secret, timestamp, signature, Buffer.from("{}"), now), false);
  assert.equal(verifyWebhookSignature(secret, timestamp, signature, body, now + 301_000), false);
  assert.equal(verifyWebhookSignature(secret, timestamp, "bad", body, now), false);
});

test("API endpoint guards block private addresses, cleartext and embedded secrets", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "999.0.0.1"]) assert.equal(publicIPv4(address), false);
  assert.equal(publicIPv4("8.8.8.8"), true);
  for (const endpoint of ["http://api.example.com", "https://localhost", "https://10.0.0.1", "https://user:password@example.com", "https://api.example.com?api_key=secret", "https://api.example.com:8443"]) assert.throws(() => apiEndpoint(endpoint));
  assert.equal(apiEndpoint("https://api.example.com/applicants").hostname, "api.example.com");
});

test("safe dotted field mapping preserves profile arrays and rejects prototype paths", () => {
  const mapped = mappedRecord({ application: { id: 42, candidate: { name: "Candidate", email: "candidate@example.com", skills: ["React"] } } }, {
    externalId: "application.id", name: "application.candidate.name", email: "application.candidate.email", skills: "application.candidate.skills",
  });
  assert.equal(candidateRecord.parse(mapped).externalId, "42");
  assert.deepEqual(candidateRecord.parse(mapped).skills, ["React"]);
  assert.throws(() => mappedRecord({}, { externalId: "__proto__.id" }));
  assert.throws(() => integrationRecords({ data: [] }, "wrong.path"));
  assert.throws(() => integrationRecords(Array.from({ length: 101 }, () => ({})), ""));
  assert.equal(leadRecord.safeParse({ externalId: "1", name: "Lead", phone: "" }).success, false);
});

test("connector validation requires a stable ID, destination and appropriate provider", () => {
  const valid = { ...config(), ownerId: String(ownerId), opportunityId: String(opportunityId) };
  assert.equal(integrationInput.safeParse(valid).success, true);
  assert.equal(integrationInput.safeParse({ ...valid, fieldMapping: { name: "name", email: "email" } }).success, false);
  assert.equal(integrationInput.safeParse({ ...valid, opportunityId: null }).success, false);
  assert.equal(integrationInput.safeParse({ ...valid, cursorParam: "cursor" }).success, false);
  assert.equal(integrationInput.safeParse({ ...valid, authHeader: "Host" }).success, false);
});

test("company executive access cannot use another company's connector scope", () => {
  for (const role of ["CEO", "ADMIN", "HR"]) {
    assert.equal(canReadTaskCompany([role], [role], String(companyId), String(defaultId), String(defaultId)), false);
  }
  assert.deepEqual(companyCondition(scopeFor(companyId)), { companyId });
});

test("imported application allows missing source address, normal applications still require it", async () => {
  const external = new Application({ userId: ownerId, opportunityId, source: ApplicationSource.EXTERNAL, address: "" });
  await external.validate();
  const website = new Application({ userId: ownerId, opportunityId, source: ApplicationSource.WEBSITE, address: "" });
  await assert.rejects(website.validate(), /address/);
});

test("candidate and lead ingestion creates actual New pipeline records and deduplicates retries", async () => {
  const storedApplications: Array<Record<string, unknown>> = [];
  const storedLeads: Array<Record<string, unknown>> = [];
  const pipelines: Array<Record<string, unknown>> = [];
  const sourceUserId = new Types.ObjectId();
  mock.method(mongoose.Query.prototype, "exec", async function (this: mongoose.Query<unknown, unknown>) {
    assert.equal(String(currentScope()?.companyId), String(companyId));
    const filter = this.getFilter();
    if (this.model.modelName === "User") {
      return filter.email ? { _id: sourceUserId, name: "Candidate", roles: ["USER"] } : { _id: ownerId, roles: ["HR"], companyId };
    }
    if (["Opportunity", "OrganizationAssignment"].includes(this.model.modelName)) return { _id: opportunityId };
    if (this.model.modelName === "SalesPipeline") return null;
    if (this.model.modelName === "SalesLead") return storedLeads.length ? { _id: storedLeads[0]!._id } : null;
    if (this.model.modelName === "Application") return storedApplications[0] ?? null;
    if (this.model.modelName === "RecruitmentPipeline") {
      const update = this.getUpdate();
      assert.ok(update && !Array.isArray(update) && update.$setOnInsert);
      pipelines.push(update.$setOnInsert);
      return {};
    }
    throw new Error(`Unexpected test query: ${this.model.modelName}`);
  });
  mock.method(Application.collection, "insertOne", async function (document: Record<string, unknown>) {
    storedApplications.push(document);
    return { acknowledged: true, insertedId: document._id };
  });
  mock.method(SalesLead.collection, "insertOne", async function (document: Record<string, unknown>) {
    storedLeads.push(document);
    return { acknowledged: true, insertedId: document._id };
  });
  await runWithCompany(scopeFor(companyId), async () => {
    const candidate = config();
    const payload = { id: "application-1", name: "Candidate", email: "candidate@example.com", skills: ["React"], resume: "https://example.com/resume.pdf" };
    assert.equal((await ingestRecords(candidate, payload)).imported, 1);
    assert.equal((await ingestRecords(candidate, payload)).duplicates, 1);
    assert.equal((await ingestRecords(candidate, { ...payload, email: "changed@example.com" })).duplicates, 1);
    assert.equal(storedApplications.length, 1);
    assert.equal(storedApplications[0]?.source, "EXTERNAL");
    assert.equal(String(storedApplications[0]?.companyId), String(companyId));
    assert.deepEqual(storedApplications[0]?.skills, ["React"]);
    assert.equal(storedApplications[0]?.resumeUrl, payload.resume);
    assert.equal(pipelines[0]?.stage, "NEW_APPLICATION");
    const lead = config("LEAD");
    assert.equal((await ingestRecords(lead, { id: "lead-1", name: "Buyer", phone: "+919876543210" })).imported, 1);
    assert.equal((await ingestRecords(lead, { id: "lead-1", name: "Buyer", phone: "+919876543210" })).duplicates, 1);
    assert.equal(storedLeads.length, 1);
    assert.equal(storedLeads[0]?.status, "NEW");
    assert.equal(storedLeads[0]?.stageId, "NEW");
    assert.equal(String(storedLeads[0]?.ownerId), String(ownerId));
    assert.equal(String(storedLeads[0]?.companyId), String(companyId));
    assert.equal(storedLeads[0]?.sourceCategory, "Lead Database");
    const partial = await ingestRecords(lead, [
      { id: "lead-1", name: "Buyer", phone: "+919876543210" },
      { id: "lead-2", name: "Invalid" },
    ]);
    assert.equal(partial.duplicates, 1);
    assert.equal(partial.failed, 1);
    assert.match(partial.errors[0]?.message ?? "", /phone/);
  });
});

test("webhook import lease is released and partial failures are saved in run history", async () => {
  const connector = config("LEAD");
  const updates: Array<Record<string, unknown>> = [];
  const runs: Array<Record<string, unknown>> = [];
  mock.method(mongoose.Query.prototype, "exec", async function (this: mongoose.Query<unknown, unknown>) {
    assert.equal(String(currentScope()?.companyId), String(companyId));
    if (this.model.modelName === "Integration") {
      const update = this.getUpdate();
      assert.ok(update && !Array.isArray(update));
      updates.push(update);
      return updates.length === 1 ? connector : { acknowledged: true };
    }
    if (this.model.modelName === "User") return { _id: ownerId, roles: ["HR"], companyId };
    if (this.model.modelName === "OrganizationAssignment") return { _id: ownerId };
    throw new Error(`Unexpected query: ${this.model.modelName}`);
  });
  mock.method(IntegrationRun.collection, "insertOne", async function (document: Record<string, unknown>) {
    runs.push(document);
    return { acknowledged: true, insertedId: document._id };
  });
  await runWithCompany(scopeFor(companyId), async () => {
    const run = await executeIntegration(connector._id, "WEBHOOK", { id: "bad-lead", name: "Invalid lead" });
    assert.equal(run.status, "FAILED");
    assert.equal(run.failed, 1);
    assert.equal(run.issues[0]?.index, 0);
    assert.equal(runs.length, 1);
    assert.equal(String(runs[0]?.companyId), String(companyId));
    assert.deepEqual(updates.at(-1)?.$set, { lockedUntil: new Date(0), leaseToken: "" });
  });
});

test("integration model is company stamped and secrets are excluded by default", () => {
  assert.ok(Integration.schema.path("companyId"));
  assert.equal(Integration.schema.path("encryptedCredential").options.select, false);
  assert.equal(Integration.schema.path("encryptedWebhookSecret").options.select, false);
});
