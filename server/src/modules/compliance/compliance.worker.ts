import { Queue, Worker, type Job } from "bullmq";
import {
  ComplianceAuditEvent,
  ComplianceEvidence,
  ComplianceEvidenceStatus,
  ComplianceNotification,
  ComplianceNotificationRecipient,
  ComplianceNotificationRule,
  ComplianceRequirement,
  ComplianceRequirementStatus,
  Company,
  OrganizationAssignment,
  OrganizationLevel,
  OrganizationRoleDefinition,
  User,
} from "../../models/index.js";
import { Permission, UserRole, UserStatus } from "../auth/authorization.js";
import { createRedisConnection } from "../chat/chat.infrastructure.js";
import { runWithCompany, scopeFor } from "../company/company.context.js";

const queueName = "compliance-deadline-scan";
const bullmqPrefix = process.env.BULLMQ_PREFIX ?? "{bull}";
const dayMilliseconds = 24 * 60 * 60 * 1000;
const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * dayMilliseconds);

function dayWindow(date: Date) {
  const start = startOfUtcDay(date);
  return { $gte: start, $lt: addDays(start, 1) };
}

async function resolveRecipients(
  requirement: { ownerId?: unknown; reviewerId?: unknown; departmentId?: string | null },
  recipients: ComplianceNotificationRecipient[],
) {
  const ids = new Set<string>();
  if (recipients.includes(ComplianceNotificationRecipient.OWNER) && requirement.ownerId) ids.add(String(requirement.ownerId));
  if (recipients.includes(ComplianceNotificationRecipient.REVIEWER) && requirement.reviewerId) ids.add(String(requirement.reviewerId));
  if (!requirement.departmentId) return [...ids];

  if (recipients.includes(ComplianceNotificationRecipient.DEPARTMENT_HEAD)) {
    const heads = await OrganizationAssignment.find({ department: requirement.departmentId, level: OrganizationLevel.HEAD, active: true } as any).select("userId").lean();
    heads.forEach((head) => ids.add(String(head.userId)));
  }

  if (recipients.includes(ComplianceNotificationRecipient.COMPLIANCE_MANAGERS)) {
    const customRoles = await OrganizationRoleDefinition.find({ permissions: Permission.COMPLIANCE_AUDIT }).select("key").lean();
    const customKeys = customRoles.map((role) => role.key);
    const managers = await OrganizationAssignment.find({
      department: requirement.departmentId,
      active: true,
      $or: [
        { level: OrganizationLevel.HEAD },
        ...(customKeys.length ? [{ roleKeys: { $in: customKeys } }] : []),
      ],
    } as any).select("userId").lean();
    managers.forEach((manager) => ids.add(String(manager.userId)));
  }

  if (recipients.includes(ComplianceNotificationRecipient.EXECUTIVES)) {
    const executives = await OrganizationAssignment.find({
      active: true,
      $or: [
        { level: OrganizationLevel.CEO },
        { roleKeys: { $in: [UserRole.CEO, UserRole.ADMIN] } },
      ],
    }).select("userId").lean();
    executives.forEach((executive) => ids.add(String(executive.userId)));
    const admins = await User.find({ roles: UserRole.ADMIN, status: UserStatus.ACTIVE }).select("_id").lean();
    admins.forEach((admin) => ids.add(String(admin._id)));
  }
  return [...ids];
}

async function createReminder(
  requirement: any,
  rule: any,
  kind: "DUE" | "RENEWAL" | "EVIDENCE_EXPIRY",
  dueDate: Date,
  itemId?: string,
) {
  const recipients = await resolveRecipients(requirement, rule.recipients);
  const todayKey = startOfUtcDay(dueDate).toISOString().slice(0, 10);
  const days = rule.daysBeforeDue;
  const dueText = days > 1 ? `in ${days} days` : days === 1 ? "tomorrow" : days === 0 ? "today" : `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  const subject = kind === "EVIDENCE_EXPIRY" ? "Evidence expires" : kind === "RENEWAL" ? "Renewal due" : "Requirement due";
  for (const recipientId of recipients) {
    const dedupeKey = `${kind}:${itemId ?? requirement._id}:${rule._id}:${recipientId}:${todayKey}`;
    await ComplianceNotification.updateOne(
      { dedupeKey },
      { $setOnInsert: {
        recipientId,
        requirementId: requirement._id,
        dedupeKey,
        title: `${subject} ${dueText}`,
        message: `${requirement.title} is ${dueText}. Review the assigned compliance item.`,
        dueDate,
      } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
}

async function scanCompany() {
  const now = new Date();
  const today = startOfUtcDay(now);
  const rules = await ComplianceNotificationRule.find({ active: true }).sort({ daysBeforeDue: -1 }).lean();
  for (const rule of rules) {
    const dueWindow = dayWindow(addDays(today, rule.daysBeforeDue));
    const dueCursor = ComplianceRequirement.find({
      archivedAt: null,
      dueDate: dueWindow,
      status: { $nin: [ComplianceRequirementStatus.COMPLIANT, ComplianceRequirementStatus.WAIVED, ComplianceRequirementStatus.NOT_APPLICABLE] },
    }).cursor();
    for await (const requirement of dueCursor) await createReminder(requirement, rule, "DUE", requirement.dueDate!);

    const renewalCursor = ComplianceRequirement.find({
      archivedAt: null,
      renewalDate: dueWindow,
      status: { $nin: [ComplianceRequirementStatus.WAIVED, ComplianceRequirementStatus.NOT_APPLICABLE] },
    }).cursor();
    for await (const requirement of renewalCursor) await createReminder(requirement, rule, "RENEWAL", requirement.renewalDate!);

    const expiringCursor = ComplianceEvidence.find({
      expiryDate: dueWindow,
      verificationStatus: { $ne: ComplianceEvidenceStatus.EXPIRED },
    }).cursor();
    for await (const evidence of expiringCursor) {
      const requirement = await ComplianceRequirement.findOne({ _id: evidence.requirementId, archivedAt: null }).lean();
      if (requirement) await createReminder(requirement, rule, "EVIDENCE_EXPIRY", evidence.expiryDate!, String(evidence._id));
    }
  }

  const expiredEvidence = await ComplianceEvidence.find({
    expiryDate: { $lt: today },
    verificationStatus: { $in: [ComplianceEvidenceStatus.PENDING, ComplianceEvidenceStatus.VERIFIED] },
  }).cursor();
  for await (const evidence of expiredEvidence) {
    evidence.verificationStatus = ComplianceEvidenceStatus.EXPIRED;
    await evidence.save();
    await ComplianceAuditEvent.create({
      actorId: null,
      actorType: "SYSTEM",
      action: "EVIDENCE_EXPIRED",
      entityType: "EVIDENCE",
      entityId: evidence._id,
      metadata: { expiryDate: evidence.expiryDate, worker: queueName },
    });
  }

  const expiredRequirements = await ComplianceRequirement.find({
    archivedAt: null,
    status: ComplianceRequirementStatus.COMPLIANT,
    renewalDate: { $lt: today },
  }).cursor();
  for await (const requirement of expiredRequirements) {
    requirement.status = ComplianceRequirementStatus.EXPIRED;
    await requirement.save();
    await ComplianceAuditEvent.create({
      actorId: null,
      actorType: "SYSTEM",
      action: "REQUIREMENT_EXPIRED",
      entityType: "REQUIREMENT",
      entityId: requirement._id,
      previousValue: { status: ComplianceRequirementStatus.COMPLIANT },
      newValue: { status: ComplianceRequirementStatus.EXPIRED },
      metadata: { renewalDate: requirement.renewalDate, worker: queueName },
    });
  }
}

async function scanAllCompanies(_job: Job) {
  const companies = await Company.find({ active: true }).select("_id").lean();
  for (const company of companies) {
    await runWithCompany(scopeFor(company._id), scanCompany);
  }
}

export async function startComplianceWorker() {
  const queue = new Queue(queueName, {
    connection: createRedisConnection(),
    prefix: bullmqPrefix,
    defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 30_000 }, removeOnComplete: 100, removeOnFail: 1000 },
  });
  await queue.upsertJobScheduler("compliance-hourly-sweep", { every: 60 * 60 * 1000 }, { name: "hourly-sweep", data: {} });
  const worker = new Worker(queueName, scanAllCompanies, {
    connection: createRedisConnection(),
    prefix: bullmqPrefix,
    concurrency: 1,
  });
  worker.on("failed", (job, error) => console.error("Compliance reminder job failed", job?.id, error));
  return { queue, worker };
}