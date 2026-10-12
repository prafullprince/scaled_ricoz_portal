import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { OrganizationAssignment, OrganizationDepartment, OrganizationLevel, SalesLead, SalesLeadStatus, Task, TaskStatus, TaskWorkflowAction, TaskWorkflowStage, User } from "../../models/index.js";
import type { ITask } from "../../models/task.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { Permission, UserStatus } from "../auth/authorization.js";
import { hasCompanyFeatureGrant, requestRoles } from "../organization/organization.roles.js";
import { isOrganizationExecutive } from "../organization/organization.access.js";
import { resolveSalesAccess } from "./sales.authorization.js";
import { crmTargetValue, salesCustomerKey, salesTargetProgress } from "./sales-accountability.js";
import { listSalesLeadsSchema } from "./sales.validation.js";

type AccountabilityAccess = {
  executive: boolean;
  level: "HEAD" | "MANAGER" | "MEMBER" | null;
  userIds: Types.ObjectId[] | null;
  canCreate: boolean;
  canUpdate: boolean;
};

async function accessFor(req: Request): Promise<AccountabilityAccess> {
  const roles = requestRoles(req);
  if (isOrganizationExecutive(roles) || hasCompanyFeatureGrant(req, Permission.TASK_ASSIGN))
    return { executive: true, level: null, userIds: null, canCreate: true, canUpdate: true };
  const access = await resolveSalesAccess(String(req.authUser!._id), roles, req.companyPermissions);
  if (!access || !access.permissions.has(Permission.SALES_TASK_VIEW))
    throw new ApiError(403, "Sales task access is required");
  const assignment = await OrganizationAssignment.findOne({ userId: req.authUser!._id, department: OrganizationDepartment.SALES, active: true }).select("level").lean();
  if (!assignment) throw new ApiError(403, "An active Sales assignment is required");
  const level = assignment.level === OrganizationLevel.HEAD ? "HEAD" : assignment.level === OrganizationLevel.MANAGER ? "MANAGER" : "MEMBER";
  const reports = level === "MANAGER"
    ? await OrganizationAssignment.find({ department: OrganizationDepartment.SALES, reportsTo: req.authUser!._id, level: OrganizationLevel.MEMBER, active: true }).select("userId").lean()
    : [];
  return {
    executive: false, level,
    userIds: level === "HEAD" ? null : [req.authUser!._id, ...reports.map((report) => report.userId)],
    canCreate: level !== "MEMBER" && access.permissions.has(Permission.SALES_TASK_CREATE) && access.permissions.has(Permission.SALES_TASK_ASSIGN),
    canUpdate: access.permissions.has(Permission.SALES_TASK_UPDATE),
  };
}

async function findTask(id: string, access: AccountabilityAccess) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid Sales task id");
  const task = await Task.findOne({
    _id: id, department: "SALES", salesAccountability: { $ne: null },
    ...(access.userIds ? { assignedTo: { $in: access.userIds } } : {}),
  });
  if (!task) throw new ApiError(404, "Sales target or task not found in your scope");
  return task;
}

async function treeTasks(task: ITask) {
  const tasks = [task];
  let ids = [task._id];
  for (let depth = 0; ids.length; depth++) {
    if (depth >= 3) throw new ApiError(409, "Sales delegation exceeds the supported hierarchy");
    const children = await Task.find({ parentTaskId: { $in: ids }, department: "SALES", salesAccountability: { $ne: null } });
    tasks.push(...children);
    if (tasks.length > 1000) throw new ApiError(409, "This Sales target has too many child tasks");
    ids = children.map((child) => child._id);
  }
  return tasks;
}

async function achievedFor(task: ITask, tree: ITask[], verified = true): Promise<number> {
  const details = task.salesAccountability!;
  if (details.metric === "REVENUE" || details.metric === "CUSTOMERS") {
    const leadIds = [...new Set(tree.flatMap((item) => item.salesAccountability?.leadIds.map(String) ?? []))];
    const start = details.periodStart ?? task.createdAt;
    const leads = await SalesLead.find({ _id: { $in: leadIds.map((id) => new Types.ObjectId(id)) }, department: OrganizationDepartment.SALES }).select("status currency closedAt expectedValue company email phone").lean();
    const existing = details.metric === "CUSTOMERS"
      ? await SalesLead.find({ department: OrganizationDepartment.SALES, status: SalesLeadStatus.WON, $or: [{ closedAt: { $lt: start } }, { closedAt: null }] }).select("company email phone").lean()
      : [];
    return crmTargetValue(details.metric, details.currency, start, task.deadline, leads, new Set(existing.map(salesCustomerKey)));
  }
  const children = tree.filter((item) => String(item.parentTaskId) === String(task._id));
  if (!children.length) return verified && details.state !== "ACCEPTED" ? 0 : details.achieved;
  const values = await Promise.all(children.map(async (child) => {
    if (verified && !["REVENUE", "CUSTOMERS"].includes(child.salesAccountability!.metric) && child.salesAccountability!.state !== "ACCEPTED") return 0;
    const descendants = await treeTasks(child);
    const achieved = await achievedFor(child, descendants, verified);
    if (details.metric === "STRATEGY")
      return details.target / children.length * salesTargetProgress(child.salesAccountability!.target, achieved) / 100;
    return child.salesAccountability!.metric === details.metric && child.salesAccountability!.unit.toLowerCase() === details.unit.toLowerCase() ? achieved : 0;
  }));
  return values.reduce((sum, value) => sum + value, 0);
}

async function validateLeadLinks(leadIds: string[], assigneeId: string) {
  const assignment = await OrganizationAssignment.findOne({ userId: new Types.ObjectId(assigneeId), department: OrganizationDepartment.SALES, active: true }).select("level").lean();
  if (!assignment) throw new ApiError(400, "Select an active Sales assignee");
  let owners: Types.ObjectId[] | undefined;
  if (assignment.level !== OrganizationLevel.HEAD) {
    const members = assignment.level === OrganizationLevel.MANAGER
      ? await OrganizationAssignment.find({ reportsTo: new Types.ObjectId(assigneeId), department: OrganizationDepartment.SALES, active: true, level: OrganizationLevel.MEMBER }).select("userId").lean()
      : [];
    owners = [new Types.ObjectId(assigneeId), ...members.map((member) => member.userId)];
  }
  if (await SalesLead.countDocuments({ _id: { $in: leadIds.map((id) => new Types.ObjectId(id)) }, department: OrganizationDepartment.SALES, ...(owners ? { ownerId: { $in: owners } } : {}) }) !== new Set(leadIds).size)
    throw new ApiError(403, "Linked leads must belong to the assignee's Sales scope");
}

export async function listAccountabilityLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await accessFor(req);
    const { page, pageSize, search } = listSalesLeadsSchema.parse({ query: req.query }).query;
    const escaped = search?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = {
      department: OrganizationDepartment.SALES,
      ...(access.userIds ? { ownerId: { $in: access.userIds } } : {}),
      ...(escaped ? { name: { $regex: escaped, $options: "i" } } : {}),
    };
    const [leads, total] = await Promise.all([
      SalesLead.find(filter).select("name status ownerId currency expectedValue").sort({ _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      SalesLead.countDocuments(filter),
    ]);
    return res.json({ success: true, leads, pagination: { page, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) { next(error); }
}

export async function listSalesAccountability(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await accessFor(req);
    const tasks = await Task.find({
      department: "SALES", salesAccountability: { $ne: null },
      ...(access.userIds ? { assignedTo: { $in: access.userIds } } : {}),
    }).populate("assignedTo", "name").populate("assignedBy", "name").populate("workflowHistory.actorId", "name").populate("salesAccountability.reports.actorId", "name").sort({ deadline: 1 }).limit(1001);
    if (tasks.length > 1000) throw new ApiError(409, "More than 1000 Sales accountability tasks cannot be loaded in a single view");
    const views = await Promise.all(tasks.map(async (task) => {
      const tree = await treeTasks(task);
      const achieved = await achievedFor(task, tree);
      const reportedAchieved = await achievedFor(task, tree, false);
      return {
        ...task.toObject(),
        achieved, progress: salesTargetProgress(task.salesAccountability!.target, achieved),
        reportedProgress: salesTargetProgress(task.salesAccountability!.target, reportedAchieved),
        overdue: task.status !== TaskStatus.DONE && task.deadline < new Date(),
        canDelegate: access.canCreate && (access.executive || String(task.assignedTo?._id) === String(req.authUser!._id)) && task.salesAccountability!.state === "ACTIVE",
        canReport: access.canUpdate && String(task.assignedTo?._id) === String(req.authUser!._id) && ["ACTIVE", "BLOCKED"].includes(task.salesAccountability!.state),
        canReview: access.canUpdate && (access.executive || String(task.assignedBy?._id) === String(req.authUser!._id)) && String(task.assignedTo?._id) !== String(req.authUser!._id) && task.salesAccountability!.state === "REVIEW",
        canComment: access.canUpdate,
      };
    }));
    const candidates = await OrganizationAssignment.find({
      department: OrganizationDepartment.SALES, active: true,
      ...(access.executive ? { level: { $in: [OrganizationLevel.HEAD, OrganizationLevel.MANAGER, OrganizationLevel.MEMBER] } } : { reportsTo: req.authUser!._id, level: access.level === "HEAD" ? OrganizationLevel.MANAGER : OrganizationLevel.MEMBER }),
    }).populate({ path: "userId", select: "name", match: { status: UserStatus.ACTIVE } }).lean();
    return res.json({
      success: true, tasks: views, canCreate: access.executive,
      candidates: candidates.flatMap((candidate) => candidate.userId ? [{ user: candidate.userId, level: candidate.level, reportsTo: candidate.reportsTo }] : []),
    });
  } catch (error) { next(error); }
}

export async function createSalesAccountability(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await accessFor(req);
    if (!access.canCreate) throw new ApiError(403, "You cannot delegate Sales work");
    const parent = req.body.parentTaskId ? await findTask(req.body.parentTaskId, access) : null;
    if (!parent && !access.executive) throw new ApiError(403, "Sales Heads and Managers must delegate within an assigned target");
    if (parent && (!access.executive && String(parent.assignedTo) !== String(req.authUser!._id)))
      throw new ApiError(403, "Only the assigned owner can delegate this target");
    if (parent && (parent.salesAccountability!.state !== "ACTIVE" || req.body.deadline > parent.deadline || (req.body.periodStart && req.body.periodStart < parent.salesAccountability!.periodStart)))
      throw new ApiError(409, "Delegate only active tasks and keep child deadlines within the parent deadline");
    const owner = await OrganizationAssignment.findOne({ userId: req.body.assignedTo, department: OrganizationDepartment.SALES, active: true }).select("level reportsTo").lean();
    if (!owner || !await User.exists({ _id: req.body.assignedTo, status: UserStatus.ACTIVE }))
      throw new ApiError(400, "Select an active Sales assignee");
    if (!parent && (owner.level !== OrganizationLevel.HEAD || req.body.kind !== "TARGET"))
      throw new ApiError(400, "Department targets must be assigned to a Sales Head");
    if (parent) {
      if (!parent.assignedTo) throw new ApiError(409, "The parent target has no assigned owner");
      if (parent.salesAccountability!.kind === "LEAD_LINKED" && req.body.leadIds.some((id: string) => !parent.salesAccountability!.leadIds.some((leadId) => String(leadId) === id)))
        throw new ApiError(400, "Sub-tasks of a lead-linked task must refer to the same lead");
      if (parent.salesAccountability!.metric === "REVENUE" && req.body.metric === "REVENUE" && req.body.currency !== parent.salesAccountability!.currency)
        throw new ApiError(400, "Revenue sub-targets must use the parent target's currency");
      const parentOwner = await OrganizationAssignment.findOne({ userId: parent.assignedTo, department: OrganizationDepartment.SALES, active: true }).select("level").lean();
      const requiredLevel = parentOwner?.level === OrganizationLevel.HEAD ? OrganizationLevel.MANAGER : parentOwner?.level === OrganizationLevel.MANAGER ? OrganizationLevel.MEMBER : null;
      if (!requiredLevel || owner.level !== requiredLevel || String(owner.reportsTo) !== String(parent.assignedTo))
        throw new ApiError(403, "Delegate only to the next level in the target owner's reporting team");
      if (owner.level === OrganizationLevel.MEMBER && req.body.kind === "TARGET")
        throw new ApiError(400, "Employees receive execution or lead-linked tasks, not management targets");
    }
    await validateLeadLinks(req.body.leadIds, req.body.assignedTo);
    const task = await Task.create({
      title: req.body.title, description: req.body.description, priority: req.body.priority, deadline: req.body.deadline,
      parentTaskId: parent?._id ?? null, assignedTo: req.body.assignedTo, assignedBy: req.authUser!._id,
      createdBy: req.authUser!._id, currentOwner: req.body.assignedTo, department: "SALES",
      workflowStage: TaskWorkflowStage.ASSIGNED,
      workflowHistory: [{ action: TaskWorkflowAction.CREATED, actorId: req.authUser!._id, recipientId: req.body.assignedTo }],
      salesAccountability: {
        kind: req.body.kind, metric: req.body.metric, target: req.body.target, unit: req.body.unit ?? "activities", currency: req.body.currency,
        expectedOutcome: req.body.expectedOutcome, leadIds: [...new Set<string>(req.body.leadIds)].map((id) => new Types.ObjectId(id)),
        periodStart: req.body.periodStart ?? parent?.salesAccountability?.periodStart ?? new Date(),
        supervisorIds: parent
          ? [...new Set([String(parent.assignedBy), ...(parent.salesAccountability?.supervisorIds.map(String) ?? [])])].map((id) => new Types.ObjectId(id))
          : [],
      },
    });
    if (parent) {
      const activeParent = await Task.findOneAndUpdate({ _id: parent._id, "salesAccountability.state": "ACTIVE" }, { $inc: { __v: 1 } });
      if (!activeParent) {
        await Task.deleteOne({ _id: task._id });
        throw new ApiError(409, "The parent target moved into review while delegating. Refresh and try again");
      }
    }
    return res.status(201).json({ success: true, task });
  } catch (error) { next(error); }
}

export async function reportSalesAccountability(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await accessFor(req);
    if (!access.canUpdate) throw new ApiError(403, "Sales task update permission is required");
    const task = await findTask(String(req.params.id), access);
    if (String(task.assignedTo) !== String(req.authUser!._id)) throw new ApiError(403, "Only the assigned owner can report progress");
    const details = task.salesAccountability!;
    if (task.workflowHistory.length >= 500) throw new ApiError(409, "This task has reached its activity history limit");
    if (details.state === "ACCEPTED" || details.state === "REVIEW") throw new ApiError(409, "This task is completed or awaiting review");
    if (details.reports.length >= 200) throw new ApiError(409, "This task has reached its 200 report limit");
    const leadIds = req.body.leadIds ?? details.leadIds.map(String);
    if (details.kind === "LEAD_LINKED" && leadIds.length !== 1) throw new ApiError(400, "Keep exactly one linked lead");
    await validateLeadLinks(leadIds, String(task.assignedTo));
    const achieved = ["REVENUE", "CUSTOMERS"].includes(details.metric) ? details.achieved : req.body.achieved;
    const updated = await Task.findOneAndUpdate({
      _id: task._id, "salesAccountability.state": details.state,
      "salesAccountability.reports": { $size: details.reports.length },
      "workflowHistory.499": { $exists: false },
    }, {
      $set: {
        "salesAccountability.state": req.body.state, "salesAccountability.achieved": achieved,
        "salesAccountability.leadIds": [...new Set(leadIds)],
        workflowStage: req.body.state === "REVIEW" ? TaskWorkflowStage.SUBMITTED : TaskWorkflowStage.ASSIGNED,
      },
      $push: {
        "salesAccountability.reports": { actorId: req.authUser!._id, summary: req.body.summary, evidence: req.body.evidence, achieved, createdAt: new Date() },
        workflowHistory: { action: TaskWorkflowAction.REPORT_SUBMITTED, actorId: req.authUser!._id, recipientId: task.assignedBy, note: req.body.summary.slice(0, 500), createdAt: new Date() },
      },
    }, { new: true, runValidators: true });
    if (!updated) throw new ApiError(409, "The task changed while reporting. Refresh and try again");
    return res.json({ success: true, task: updated });
  } catch (error) { next(error); }
}

export async function reviewSalesAccountability(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await accessFor(req);
    if (!access.canUpdate) throw new ApiError(403, "Sales task update permission is required");
    const task = await findTask(String(req.params.id), access);
    if ((!access.executive && String(task.assignedBy) !== String(req.authUser!._id)) || String(task.assignedTo) === String(req.authUser!._id))
      throw new ApiError(403, "Only the assigner or CEO-level reviewer can review this task");
    if (task.salesAccountability!.state !== "REVIEW") throw new ApiError(409, "This task has not been submitted for review");
    if (!task.salesAccountability!.reports.at(-1)?.evidence.trim()) throw new ApiError(409, "Submit completion evidence before review");
    if (task.workflowHistory.length >= 500) throw new ApiError(409, "This task has reached its activity history limit");
    const approve = req.body.decision === "APPROVE";
    if (approve) {
      const tree = await treeTasks(task);
      if (tree.slice(1).some((child) => child.status !== TaskStatus.DONE))
        throw new ApiError(409, "Review and complete child tasks before accepting the parent target");
      if (await achievedFor(task, tree, false) < task.salesAccountability!.target)
        throw new ApiError(409, "The expected target has not been achieved");
    }

    const updated = await Task.findOneAndUpdate({ _id: task._id, "salesAccountability.state": "REVIEW", "workflowHistory.499": { $exists: false } }, {
      $set: {
        "salesAccountability.state": approve ? "ACCEPTED" : "ACTIVE",
        status: approve ? TaskStatus.DONE : TaskStatus.PENDING,
        completedAt: approve ? new Date() : null,
        workflowStage: approve ? TaskWorkflowStage.COMPLETED : TaskWorkflowStage.ASSIGNED,
      },
      $push: { workflowHistory: { action: approve ? TaskWorkflowAction.ACCEPTED : TaskWorkflowAction.ENHANCEMENT_REQUESTED, actorId: req.authUser!._id, recipientId: task.assignedTo, note: req.body.note, createdAt: new Date() } },
    }, { new: true, runValidators: true });
    if (!updated) throw new ApiError(409, "The review changed. Refresh and try again");
    return res.json({ success: true, task: updated });
  } catch (error) { next(error); }
}

export async function commentSalesAccountability(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await accessFor(req);
    if (!access.canUpdate) throw new ApiError(403, "Sales task update permission is required");
    const task = await findTask(String(req.params.id), access);
    const updated = await Task.findOneAndUpdate({ _id: task._id, "workflowHistory.499": { $exists: false } }, {
      $push: { workflowHistory: { action: TaskWorkflowAction.COMMENTED, actorId: req.authUser!._id, note: req.body.note, createdAt: new Date() } },
    }, { new: true, runValidators: true });
    if (!updated) throw new ApiError(409, "This task has reached its activity history limit");
    return res.json({ success: true });
  } catch (error) { next(error); }
}
