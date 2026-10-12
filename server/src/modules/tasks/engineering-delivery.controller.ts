import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { EngineeringDelivery, type EngineeringDeliveryRecord, type DeliveryDepartment } from "../../models/engineering-delivery.models.js";
import { OrganizationAssignment, OrganizationDepartment, OrganizationLevel, User } from "../../models/index.js";
import { Permission, UserRole, UserStatus } from "../auth/authorization.js";
import { hasCompanyFeatureGrant, requestRoles } from "../organization/organization.roles.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { deliveryContributionAnalytics, deliveryProgress, previousProgressForReport, progressReportCanBeUpdated, progressReportsForDisplay, workItemProgress, type DeliveryProgressPeriod } from "./engineering-delivery.progress.js";
import {
  applyDeliveryTransition,
  canDelegateDelivery,
  deliveryActions,
  isDeliveryDepartment,
  isDeliveryHead,
  type DeliveryActor,
  type DeliveryTransition,
} from "./engineering-delivery.workflow.js";

async function resolveActor(req: Request): Promise<DeliveryActor> {
  const roles = requestRoles(req);
  const assignment = await OrganizationAssignment.findOne({ userId: req.authUser!._id, active: true }).lean();
  const level = assignment?.level;
  const deliveryLevel = level === OrganizationLevel.HEAD || level === OrganizationLevel.MANAGER || level === OrganizationLevel.MEMBER ? level : null;
  const roleKeys = new Set<string>(roles);
  if (deliveryLevel && deliveryLevel !== "MEMBER" && !roleKeys.has(deliveryLevel) && !roleKeys.has(`${assignment!.department}_${deliveryLevel}`)) {
    throw new ApiError(403, "The hierarchy assignment requires a matching department role");
  }
  return {
    id: String(req.authUser!._id),
    level: deliveryLevel,
    department: assignment?.department ?? null,
    ceo: roles.includes(UserRole.CEO),
    admin: roles.includes(UserRole.ADMIN),
    authorizedHr: hasCompanyFeatureGrant(req, Permission.TASK_ASSIGN),
  };
}

const organizationDepartment = (department: DeliveryDepartment) =>
  department === "ENGINEERING"
    ? OrganizationDepartment.ENGINEERING
    : department === "IT"
      ? OrganizationDepartment.IT
      : OrganizationDepartment.PRODUCT;

function companyReviewer(actor: DeliveryActor) {
  return actor.ceo || actor.admin || actor.authorizedHr;
}

function departmentFor(actor: DeliveryActor, requested?: string): DeliveryDepartment {
  const department = requested ?? (isDeliveryDepartment(actor.department ?? "") ? actor.department! : "ENGINEERING");
  if (!isDeliveryDepartment(department)) throw new ApiError(400, "Select Product, Engineering, or IT");
  if (!companyReviewer(actor) && (actor.department !== department || !actor.level)) {
    throw new ApiError(403, "An active Product, Engineering, or IT department assignment is required");
  }
  return department;
}

function viewRecord(record: EngineeringDeliveryRecord, actor: DeliveryActor) {
  return {
    ...record,
    progress: deliveryProgress(record),
    actions: deliveryActions(record, actor, null),
    canDelegate: canDelegateDelivery(record, actor, null),
    workItems: record.workItems.map((node) => ({
      ...node,
      progress: workItemProgress(record, node),
      actions: deliveryActions(record, actor, node.id),
      canDelegate: canDelegateDelivery(record, actor, node.id),
    })),
  };
}

async function peopleFor(department: DeliveryDepartment, records: EngineeringDeliveryRecord[]) {
  const assignments = await OrganizationAssignment.find({ department: organizationDepartment(department), active: true }).lean();
  const ids = [...new Set([
    ...assignments.map((assignment) => String(assignment.userId)),
    ...records.flatMap((record) => [
      ...(record.headId ? [record.headId] : []),
      record.createdBy,
      ...record.workItems.map((item) => item.assigneeId),
      ...record.history.map((event) => event.actorId),
    ]),
    ...records.flatMap((record) => (record.progressReports ?? []).map((report) => report.actorId)),
  ])];
  const users = await User.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } }).select("_id name status").lean();
  return users.map((user) => {
    const assignment = assignments.find((item) => String(item.userId) === String(user._id));
    return {
      id: String(user._id),
      name: user.name,
      level: assignment?.level ?? null,
      department: assignment?.department ?? null,
      employmentType: assignment?.employmentType ?? null,
      reportsTo: assignment?.reportsTo ? String(assignment.reportsTo) : null,
      active: user.status === "ACTIVE" && Boolean(
        assignment &&
          [OrganizationLevel.HEAD, OrganizationLevel.MANAGER, OrganizationLevel.MEMBER]
            .includes(assignment.level),
      ),
    };
  });
}

async function requireRecord(req: Request, revision: number) {
  const actor = await resolveActor(req);
  const record = await EngineeringDelivery.findById(String(req.params.id)).lean();
  if (!record) throw new ApiError(404, "Delivery package not found");
  departmentFor(actor, record.department);
  if (record.revision !== revision) throw new ApiError(409, "This package changed while you were working. Refresh and try again.");
  if (record.phase === "COMPLETED") throw new ApiError(409, "CEO-approved deliveries are completed and cannot be changed");
  return { actor, record };
}

async function persistRecord(record: EngineeringDeliveryRecord) {
  // Every branch shares this revision, so delegation and approval cannot race the roll-up gate.
  const updated = await EngineeringDelivery.findOneAndUpdate(
    { _id: record._id, revision: record.revision },
    { $set: {
      status: record.status,
      phase: record.phase,
      submission: record.submission,
      workItems: record.workItems,
      history: record.history,
      progressReports: record.progressReports ?? [],
      completedAt: record.completedAt,
    }, $inc: { revision: 1 } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!updated) throw new ApiError(409, "Another person updated this package. Refresh before trying again.");
  return updated;
}

export async function listEngineeringDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await resolveActor(req);
    const query = res.locals.query as { department?: string; page: number; pageSize: number };
    const department = departmentFor(actor, query.department);
    const filter = { department };
    const [packages, total] = await Promise.all([
      EngineeringDelivery.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
      EngineeringDelivery.countDocuments(filter),
    ]);
    return res.json({
      packages: packages.map((record) => viewRecord(record, actor)),
      people: await peopleFor(department, packages),
      access: { ...actor, department, canSelectDepartment: companyReviewer(actor), canCreate: companyReviewer(actor) || actor.level === "HEAD" },
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    });
  } catch (error) { next(error); }
}

export async function createEngineeringDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await resolveActor(req);
    const department = departmentFor(actor, req.body.department);
    if (!companyReviewer(actor) && actor.level !== "HEAD") {
      throw new ApiError(403, "Only department heads or company task administrators can create delivery packages");
    }
    const assignee = await OrganizationAssignment.findOne({
      userId: new Types.ObjectId(req.body.assigneeId),
      department: organizationDepartment(department),
      active: true,
    }).lean();
    if (
      !assignee ||
      ![OrganizationLevel.HEAD, OrganizationLevel.MANAGER, OrganizationLevel.MEMBER]
        .includes(assignee.level) ||
      !await User.exists({ _id: assignee.userId, status: UserStatus.ACTIVE })
    ) {
      throw new ApiError(400, "Select an active person assigned to this department");
    }
    const departmentHeads = await OrganizationAssignment.find({
      department: organizationDepartment(department),
      level: OrganizationLevel.HEAD,
      active: true,
    }).select("userId").lean();
    const activeHeadUsers = await User.find({
      _id: { $in: departmentHeads.map((assignment) => assignment.userId) },
      status: UserStatus.ACTIVE,
    }).select("_id").lean();
    const activeHeadIds = activeHeadUsers.map((user) => String(user._id));
    const preferredHeadId =
      actor.level === "HEAD" && actor.department === department
        ? actor.id
        : null;
    const headId = [
      preferredHeadId,
      ...activeHeadIds,
    ].find((userId) => userId && userId !== String(assignee.userId)) ?? null;
    const now = new Date();
    const workItemId = new Types.ObjectId().toHexString();
    const brief: Record<string, unknown> = { ...req.body };
    delete brief.assigneeId;
    const record = await EngineeringDelivery.create({
      ...brief,
      headId,
      createdBy: actor.id,
      status: "TODO",
      phase: "DELIVERY",
      workItems: [{
        id: workItemId,
        parentId: null,
        kind: assignee.level === OrganizationLevel.HEAD
          ? "HEAD"
          : assignee.level === OrganizationLevel.MANAGER
            ? "MANAGER"
            : "MEMBER",
        assigneeId: String(assignee.userId),
        title: req.body.title,
        description: req.body.description,
        deadline: req.body.deadline,
        status: "TODO",
        progress: 0,
        completedAt: null,
        githubUrl: req.body.githubUrl ?? "",
        contributionInstructions: req.body.contributionInstructions ?? "",
        submission: null,
      }],
      history: [{ nodeId: null, actorId: actor.id, action: "CREATED", note: `Directly assigned to ${String(assignee.userId)}`, createdAt: now }],
    });
    return res.status(201).json({ package: viewRecord(record.toObject(), actor) });
  } catch (error) { next(error); }
}

type WorkInput = { title: string; description: string; deadline: Date; assigneeId: string; githubUrl: string; contributionInstructions: string };

export async function delegateEngineeringDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const { actor, record } = await requireRecord(req, req.body.revision);
    const parentId = req.body.parentId as string | null;
    if (!canDelegateDelivery(record, actor, parentId)) throw new ApiError(403, "Only the assigned head or manager can delegate from their delivery branch");
    const workItems = req.body.workItems as WorkInput[];
    if (record.workItems.length + workItems.length > 300) throw new ApiError(400, "A delivery package supports up to 300 work items. Split larger deliveries into separate packages.");
    const parent = parentId ? record.workItems.find((item) => item.id === parentId)! : null;
    const ids = [...new Set(workItems.map((item) => item.assigneeId))];
    const userIds = ids.map((id) => new Types.ObjectId(id));
    const assignments = await OrganizationAssignment.find({ userId: { $in: userIds }, active: true, department: organizationDepartment(record.department) }).lean();
    const activeUsers = await User.find({ _id: { $in: userIds }, status: UserStatus.ACTIVE }).select("_id").lean();
    const activeIds = new Set(activeUsers.map((user) => String(user._id)));
    const now = new Date();
    for (const input of workItems) {
      const assignment = assignments.find((item) => String(item.userId) === input.assigneeId);
      if (!assignment || !activeIds.has(input.assigneeId)) throw new ApiError(400, "Every assignee must be active in this department");
      if (parent) {
        if (assignment.level !== OrganizationLevel.MEMBER || String(assignment.reportsTo) !== actor.id) throw new ApiError(400, "Managers can only delegate to their direct-report interns or employees");
      } else if (!companyReviewer(actor) &&
        assignment.level !== OrganizationLevel.MEMBER &&
        !(assignment.level === OrganizationLevel.MANAGER && String(assignment.reportsTo) === record.headId)
      ) {
        throw new ApiError(400, "Choose a direct-report manager or a department intern/employee");
      }
      if (assignment.level === OrganizationLevel.MEMBER && !["INTERN", "EMPLOYEE"].includes(assignment.employmentType ?? "")) throw new ApiError(400, "Work items require an intern or employee employment assignment");
      if (input.deadline > (parent?.deadline ?? record.deadline)) throw new ApiError(400, "A work item deadline cannot exceed its parent deadline");
      const id = new Types.ObjectId().toHexString();
      record.workItems.push({
        ...input,
        id,
        parentId,
        kind: assignment.level === OrganizationLevel.HEAD
          ? "HEAD"
          : assignment.level === OrganizationLevel.MANAGER
            ? "MANAGER"
            : "MEMBER",
        githubUrl: input.githubUrl || parent?.githubUrl || record.githubUrl,
        contributionInstructions: input.contributionInstructions || parent?.contributionInstructions || record.contributionInstructions,
        status: "TODO",
        progress: 0,
        completedAt: null,
        submission: null,
      });
      record.history.push({ nodeId: id, actorId: actor.id, action: "ASSIGNED", note: input.title, createdAt: now });
    }

    if (parent) parent.status = "IN_PROGRESS";
    record.status = "IN_PROGRESS";
    const updated = await persistRecord(record);
    return res.status(201).json({ package: viewRecord(updated, actor) });
  } catch (error) { next(error); }
}

export async function reportEngineeringDeliveryProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const { actor, record } = await requireRecord(req, req.body.revision);
    const node = record.workItems.find((item) => item.id === req.body.nodeId);
    if (!node || !progressReportCanBeUpdated(record, actor, node)) {
      throw new ApiError(403, "Only the assigned person can report progress on their open task. Manager branches with delegated work use the average of their child tasks.");
    }
    const now = new Date();
    const reportDate = now.toISOString().slice(0, 10);
    record.progressReports ??= [];
    const existing = record.progressReports.find((report) =>
      report.nodeId === node.id && report.actorId === actor.id && report.reportDate === reportDate,
    );
    const previousProgress = existing?.previousProgress
      ?? previousProgressForReport(record.progressReports, node.id, actor.id, reportDate);
    const progress = Number(req.body.progress);
    const summary = String(req.body.summary).trim();
    node.progress = progress;
    if (existing) {
      existing.progress = progress;
      existing.summary = summary;
      existing.updatedAt = now;
    } else {
      record.progressReports.push({
        nodeId: node.id,
        actorId: actor.id,
        reportDate,
        progress,
        previousProgress,
        summary,
        createdAt: now,
        updatedAt: now,
      });
    }
    record.history.push({ nodeId: node.id, actorId: actor.id, action: "PROGRESS_UPDATED", note: `${progress}% · ${summary}`, createdAt: now });
    const updated = await persistRecord(record);
    return res.json({ package: viewRecord(updated, actor) });
  } catch (error) { next(error); }
}

export async function listEngineeringDeliveryReports(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await resolveActor(req);
    const roles = requestRoles(req);
    const hrReportsOnly = roles.includes(UserRole.HR) && hasCompanyFeatureGrant(req, Permission.TASK_REPORT_READ);
    const canViewAll = actor.ceo || actor.admin || actor.authorizedHr || hrReportsOnly;
    const query = res.locals.query as { department?: string; period: DeliveryProgressPeriod };
    const requested = query.department ?? (isDeliveryDepartment(actor.department ?? "") ? actor.department! : undefined);
    if (!requested && !canViewAll) throw new ApiError(403, "An active Product, Engineering, or IT assignment is required to view delivery reports");
    if (!requested && hrReportsOnly) throw new ApiError(400, "Select Product, Engineering, or IT to view reports");
    const department = requested ?? "ENGINEERING";
    if (!isDeliveryDepartment(department)) throw new ApiError(400, "Select Product, Engineering, or IT");
    if (!canViewAll && actor.department !== department) throw new ApiError(403, "Delivery reports are restricted to your assigned department");

    const records = await EngineeringDelivery.find({ department }).sort({ createdAt: -1, _id: -1 }).lean();
    const visibleRecords = records;
    const people = await peopleFor(department, visibleRecords);
    const analytics = deliveryContributionAnalytics(visibleRecords, people, query.period);
    return res.json({
      packages: visibleRecords.map((record) => ({
        ...viewRecord(record, actor),
        progressReports: progressReportsForDisplay(record),
      })),
      people,
      access: { ...actor, department, canSelectDepartment: canViewAll, canViewLeaderboard: actor.ceo || actor.admin },
      analytics,
    });
  } catch (error) { next(error); }
}

export async function transitionEngineeringDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const { actor, record } = await requireRecord(req, req.body.revision);
    applyDeliveryTransition(record, actor, req.body as DeliveryTransition);
    const updated = await persistRecord(record);
    return res.json({ package: viewRecord(updated, actor) });
  } catch (error) { next(error); }
}
