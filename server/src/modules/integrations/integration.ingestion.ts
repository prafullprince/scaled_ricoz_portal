import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import {
  Application, ApplicationSource, ApplicationStatus, Opportunity, OrganizationAssignment,
  OrganizationDepartment, RecruitmentPipeline, RecruitmentPipelineStage, SalesLead,
  SalesLeadSource, SalesLeadStatus, User,
} from "../../models/index.js";
import type { IntegrationRecord } from "../../models/integration.models.js";
import { SalesPipeline } from "../../models/salesPipeline.models.js";
import { defaultPipeline, pipelineDestination } from "../sales/sales.pipeline.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { currentScope, isDefaultCompany } from "../company/company.context.js";
import { isDesignatedHr } from "../company/company.service.js";
import { catalogProvider } from "./integration.catalog.js";
import { candidateRecord, leadRecord, mappedRecord, valueAtPath } from "./integration.validation.js";

export function integrationRecords(payload: unknown, recordsPath: string): unknown[] {
  const value = valueAtPath(payload, recordsPath);
  const records = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : null;
  if (!records || records.length > 100) throw new ApiError(400, "Payload must contain an object or an array of at most 100 records. Check records path.");
  return records;
}

export async function validateDestination(integration: Pick<IntegrationRecord, "kind" | "ownerId" | "opportunityId">) {
  const owner = await User.findOne({ _id: integration.ownerId, status: UserStatus.ACTIVE }).select("roles companyId").lean();
  if (!owner) throw new ApiError(400, "Destination owner must be active");
  const scope = currentScope();
  if (!scope) throw new ApiError(403, "Integration imports require a company scope");
  const assignment = await OrganizationAssignment.exists({
    userId: integration.ownerId, active: true,
    ...(integration.kind === "LEAD" ? { department: OrganizationDepartment.SALES } : {}),
  });
  if (integration.kind === "LEAD" && !assignment) throw new ApiError(400, "Select an active Sales department owner in this company");
  if (integration.kind === "CANDIDATE") {
    if (!await Opportunity.exists({ _id: integration.opportunityId })) throw new ApiError(400, "Choose an opportunity in this company");
    const hr = await OrganizationAssignment.exists({
      userId: integration.ownerId, department: OrganizationDepartment.HR, active: true,
    });
    const isCompanyExecutive = owner.roles.some((role) => [UserRole.ADMIN, UserRole.CEO].includes(role))
      && (isDefaultCompany(owner.companyId) || String(owner.companyId) === String(scope.companyId));
    const designatedHr = isDefaultCompany(owner.companyId) && await isDesignatedHr(integration.ownerId);
    if (!hr && !isCompanyExecutive && !designatedHr) throw new ApiError(400, "Choose a company HR recruiter or executive as candidate owner");
  }
}

function duplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
function sourceFor(name: string): SalesLeadSource {
  if (/linkedin/i.test(name)) return SalesLeadSource.LINKEDIN;
  if (/instagram/i.test(name)) return SalesLeadSource.INSTAGRAM;
  if (/facebook|meta/i.test(name)) return SalesLeadSource.META;
  if (/google|seo/i.test(name)) return SalesLeadSource.GOOGLE;
  if (/form|chat/i.test(name)) return SalesLeadSource.WEBSITE;
  if (/email|outreach/i.test(name)) return SalesLeadSource.EMAIL;
  if (/call/i.test(name)) return SalesLeadSource.COLD_CALLING;
  return SalesLeadSource.OTHER;
}

async function ingestCandidate(integration: IntegrationRecord, input: unknown, externalPayload: Record<string, unknown>) {
  const data = candidateRecord.parse(input);
  if (!integration.opportunityId) throw new ApiError(400, "Candidate connector requires a destination opportunity");
  const existingImport = await Application.findOne({ integrationId: integration._id, externalId: data.externalId });
  if (existingImport) {
    await RecruitmentPipeline.findOneAndUpdate(
      { applicationId: existingImport._id },
      { $setOnInsert: {
        applicationId: existingImport._id, opportunityId: integration.opportunityId,
        stage: RecruitmentPipelineStage.NEW_APPLICATION, recruiterId: integration.ownerId,
        createdBy: integration.createdBy,
      } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return false;
  }
  let user = await User.findOne({ email: data.email });
  if (!user) {
    try {
      user = await User.create({
        name: data.name, email: data.email, ...(data.phone ? { phoneNumber: data.phone } : {}),
        password: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
        roles: [UserRole.USER], status: UserStatus.PENDING, emailVerifiedAt: null,
      });
    } catch (error) {
      if (!duplicateKey(error)) throw error;
      user = await User.findOne({ email: data.email });
      if (!user) throw error;
    }
  }
  let application = await Application.findOne({ opportunityId: integration.opportunityId, userId: user._id });
  let imported = false;
  if (!application) {
    try {
      application = await Application.create({
        opportunityId: integration.opportunityId, userId: user._id,
        status: ApplicationStatus.APPLIED, source: ApplicationSource.EXTERNAL,
        sourceDetail: catalogProvider(integration.provider, integration.kind)!.name,
        integrationId: integration._id, externalId: data.externalId, externalPayload,
        ...(data.phone ? { candidatePhone: data.phone } : {}),
        ...(data.coverLetter ? { coverLetter: data.coverLetter } : {}),
        ...(data.resumeUrl ? { resumeUrl: data.resumeUrl } : {}),
        ...(data.portfolioUrl ? { portfolioUrl: data.portfolioUrl } : {}),
        ...(data.linkedInUrl ? { linkedInUrl: data.linkedInUrl } : {}),
        ...(data.githubUrl ? { githubUrl: data.githubUrl } : {}),
        ...(data.currentCompany ? { currentCompany: data.currentCompany } : {}),
        ...(data.experienceYears !== undefined ? { experienceYears: data.experienceYears } : {}),
        ...(data.experienceSummary ? { experienceSummary: data.experienceSummary } : {}),
        ...(data.education ? { education: data.education } : {}),
        ...(data.appliedAt ? { appliedAt: data.appliedAt } : {}),
        createdBy: integration.createdBy,
        address: data.address ?? "", skills: data.skills ?? [], screeningAnswers: data.screeningAnswers ?? [],
      });
      imported = true;
    } catch (error) {
      if (!duplicateKey(error)) throw error;
      application = await Application.findOne({ $or: [
        { opportunityId: integration.opportunityId, userId: user._id },
        { integrationId: integration._id, externalId: data.externalId },
      ] });
      if (!application) throw error;
    }
  }
  await RecruitmentPipeline.findOneAndUpdate(
    { applicationId: application._id },
    { $setOnInsert: {
      applicationId: application._id, opportunityId: integration.opportunityId,
      stage: RecruitmentPipelineStage.NEW_APPLICATION, recruiterId: integration.ownerId,
      createdBy: integration.createdBy,
    } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return imported;
}

async function ingestLead(integration: IntegrationRecord, input: unknown, externalPayload: Record<string, unknown>) {
  const data = leadRecord.parse(input);
  if (await SalesLead.exists({ integrationId: integration._id, externalId: data.externalId })) return false;
  const provider = catalogProvider(integration.provider, integration.kind)!;
  const pipeline = await SalesPipeline.findOne({ key: "Sales" }).lean() ?? defaultPipeline();
  const firstNewStage = pipeline.stages.find((stage) => stage.status === SalesLeadStatus.NEW && !stage.archived);
  if (!firstNewStage) throw new ApiError(409, "The Sales pipeline needs an active New stage");
  try {
    await SalesLead.create({
      name: data.name, phone: data.phone, externalId: data.externalId,
      ...(data.email ? { email: data.email } : {}),
      ...(data.company ? { company: data.company } : {}),
      ...(data.serviceInterest ? { serviceInterest: data.serviceInterest } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      ...(data.expectedValue !== undefined ? { expectedValue: data.expectedValue } : {}),
      ...(data.currency ? { currency: data.currency } : {}),
      ...pipelineDestination(pipeline, firstNewStage.key),
      source: sourceFor(provider.name), sourceCategory: provider.category, sourceDetail: provider.name,
      integrationId: integration._id, externalPayload,
      ownerId: integration.ownerId, assignedBy: integration.createdBy, createdBy: integration.createdBy,
      assignmentHistory: [{ assignedBy: integration.createdBy, newOwner: integration.ownerId, reason: `Imported from ${provider.name}` }],
    });
    return true;
  } catch (error) {
    if (duplicateKey(error)) return false;
    throw error;
  }
}

export async function ingestRecords(integration: IntegrationRecord, payload: unknown) {
  await validateDestination(integration);
  const records = integrationRecords(payload, integration.recordsPath);
  const result = { imported: 0, duplicates: 0, failed: 0, errors: [] as Array<{ index: number; message: string }> };
  for (const [index, record] of records.entries()) {
    try {
      if (!record || typeof record !== "object" || Array.isArray(record)) throw new ApiError(400, "Each record must be a JSON object");
      if (Buffer.byteLength(JSON.stringify(record)) > 32_768) throw new ApiError(400, "Record exceeds 32 KB");
      const mapped = mappedRecord(record, integration.fieldMapping);
      const input = integration.kind === "CANDIDATE" ? candidateRecord.safeParse(mapped) : leadRecord.safeParse(mapped);
      if (!input.success) {
        throw new ApiError(400, input.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ").slice(0, 500));
      }
      const imported = integration.kind === "CANDIDATE"
        ? await ingestCandidate(integration, input.data, record as Record<string, unknown>)
        : await ingestLead(integration, input.data, record as Record<string, unknown>);
      if (imported) result.imported += 1;
      else result.duplicates += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({ index, message: error instanceof ApiError ? error.message : "Record could not be stored. Retry this import." });
      if (!(error instanceof ApiError)) console.error("Integration record import failed", { integrationId: integration._id, index, error });
    }
  }
  return result;
}
