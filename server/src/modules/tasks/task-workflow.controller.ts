import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  Conversation,
  ConversationType,
  OrganizationAssignment,
  OrganizationLevel,
  Task,
  TaskStatus,
  TaskWorkflowAction,
  TaskWorkflowStage,
  User,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { publishChatEvent } from "../chat/chat.infrastructure.js";
import { isOrganizationExecutive, resolveOrganizationAccess, workflowScopeFilter, contributionScopeFilter, requestedDepartmentFilter } from "../organization/organization.access.js";
import { hasCompanyFeatureGrant, requestRoles } from "../organization/organization.roles.js";

export function canManageCompanyWorkflow(req: Request) {
  return isOrganizationExecutive(requestRoles(req)) || hasCompanyFeatureGrant(req, Permission.TASK_ASSIGN);
}

const headRoles = [
  UserRole.HEAD,
  UserRole.PRODUCT_HEAD,
  UserRole.MARKETING_HEAD,
  UserRole.FINANCE_HEAD,
  UserRole.SALES_HEAD,
  UserRole.PROJECTS_HEAD,
  UserRole.SUPPORT_HEAD,
  UserRole.HR_HEAD,
  UserRole.DESIGN_HEAD,
  UserRole.ENGINEERING_HEAD,
  UserRole.IT_HEAD,
];
const managerRoles = [
  UserRole.MANAGER,
  UserRole.PRODUCT_MANAGER,
  UserRole.MARKETING_MANAGER,
  UserRole.FINANCE_MANAGER,
  UserRole.SALES_MANAGER,
  UserRole.PROJECTS_MANAGER,
  UserRole.SUPPORT_MANAGER,
  UserRole.HR_MANAGER,
  UserRole.DESIGN_MANAGER,
  UserRole.ENGINEERING_MANAGER,
  UserRole.IT_MANAGER,
];

const populateWorkflowTask = (query: any) => query
  .populate("productId", "title deletedAt")
  .populate("createdBy", "name email roles")
  .populate("currentOwner", "name email roles")
  .populate("assignedTo", "name email roles")
  .populate("assignedBy", "name email roles")
  .populate("workflowHistory.actorId", "name email roles")
  .populate("workflowHistory.recipientId", "name email roles");

export async function findActiveDepartmentHead(department: string, headId?: string) {
  if (headId && !Types.ObjectId.isValid(headId)) throw new ApiError(400, "Invalid department head");
  const assignments = await OrganizationAssignment.find({
    ...(headId ? { userId: headId } : {}),
    level: OrganizationLevel.HEAD,
    department,
    active: true,
  } as any)
    .populate({
      path: "userId",
      select: "_id name email roles status",
      match: { status: "ACTIVE" },
    })
    .sort({ createdAt: -1 }) as Array<{ userId: Types.ObjectId | null }>;

  const activeHeads = assignments.filter((assignment) => assignment.userId);
  if (activeHeads.length > 1) throw new ApiError(409, "Select the responsible department head");
  return activeHeads[0] ?? null;
}

function hasAnyRole(roles: UserRole[], expected: UserRole[]) {
  return expected.some((role) => roles.includes(role));
}

async function requireWorkflowTask(id: string, req?: Request) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid task id");
  const task = await Task.findById(id);
  if (!task || task.parentTaskId) throw new ApiError(404, "Workflow task not found");
  if (task.salesAccountability) throw new ApiError(409, "Use the Sales accountability workflow for this task");
  if (req) {
    const access = await resolveOrganizationAccess(req.authUser!._id, requestRoles(req), hasCompanyFeatureGrant(req, Permission.TASK_ASSIGN));
    if (!access.executive && (task.department !== access.assignment.department || String(task.currentOwner) !== String(req.authUser!._id))) throw new ApiError(403, "This task is outside your department or action queue");
    if (!access.executive) {
      const requiredLevel = [TaskWorkflowStage.HEAD_PLANNING, TaskWorkflowStage.HEAD_REVIEW].includes(task.workflowStage) ? OrganizationLevel.HEAD : OrganizationLevel.MANAGER;
      if (access.assignment.level !== requiredLevel) throw new ApiError(403, "Your hierarchy level cannot perform this action");
    }
  }
  return task;
}

export async function createWorkflowTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await Task.create({
      ...req.body,
      assignedBy: req.authUser!._id,
      createdBy: req.authUser!._id,
      workflowStage: TaskWorkflowStage.ADMIN_REVIEW,
      workflowHistory: [{ action: TaskWorkflowAction.CREATED, actorId: req.authUser!._id }],
    });
    return res.status(201).json({ success: true, task: await populateWorkflowTask(Task.findById(task._id)) });
  } catch (error) {
    next(error);
  }
}

export async function listWorkflowTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await resolveOrganizationAccess(req.authUser!._id, requestRoles(req), hasCompanyFeatureGrant(req, Permission.TASK_ASSIGN));
    const departmentFilter = requestedDepartmentFilter(access, req.query.department);
    const filter = { parentTaskId: null, salesAccountability: null, ...workflowScopeFilter(access, req.authUser!._id), ...departmentFilter };

    const tasks = await populateWorkflowTask(Task.find(filter).sort({ createdAt: -1 })).lean();
    const parentIds = tasks.map((task: { _id: Types.ObjectId }) => task._id);
    const subtasks = await populateWorkflowTask(Task.find({ parentTaskId: { $in: parentIds }, ...contributionScopeFilter(access), ...departmentFilter }).sort({ deadline: 1 })).lean();
    return res.json({ success: true, tasks, subtasks });
  } catch (error) {
    next(error);
  }
}

export async function listWorkflowCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await requireWorkflowTask(String(req.params.id), req);
    const executive = canManageCompanyWorkflow(req);
    let assignmentFilter: Record<string, unknown>;
    let seniorCandidates: Array<Record<string, unknown>> = [];
    if (task.workflowStage === TaskWorkflowStage.ADMIN_REVIEW && executive) {
      assignmentFilter = { active: true };
    } else if (task.workflowStage === TaskWorkflowStage.HEAD_PLANNING && (executive || String(task.currentOwner) === String(req.authUser!._id))) {
      assignmentFilter = { level: OrganizationLevel.MANAGER, department: task.department, reportsTo: task.currentOwner, active: true };
    } else if (
      [TaskWorkflowStage.MANAGER_PLANNING, TaskWorkflowStage.DELEGATED, TaskWorkflowStage.MANAGER_REVIEW].includes(task.workflowStage) &&
      (executive || String(task.currentOwner) === String(req.authUser!._id))
    ) {
      assignmentFilter = { level: OrganizationLevel.MEMBER, department: task.department, reportsTo: task.currentOwner, active: true };
    } else {
      throw new ApiError(403, "Candidates are not available for this task stage");
    }
    const selectingMembers = assignmentFilter.level === OrganizationLevel.MEMBER;
    const assignments = await OrganizationAssignment.find(assignmentFilter)
      .populate({
        path: "userId",
        select: "name email roles",
        match: selectingMembers
          ? { status: "ACTIVE", roles: { $in: [UserRole.INTERN, UserRole.EMPLOYEE] } }
          : { status: "ACTIVE" },
      })
      .sort({ department: 1 })
      .lean();
    let candidates = assignments.flatMap((assignment) => assignment.userId ? [{ ...(assignment.userId as any), department: assignment.department, level: assignment.level }] : []);
    if (task.workflowStage === TaskWorkflowStage.HEAD_PLANNING && !candidates.length) {
      const members = await OrganizationAssignment.find({
        level: OrganizationLevel.MEMBER,
        department: task.department,
        reportsTo: task.currentOwner,
        active: true,
      } as any)
        .populate({ path: "userId", select: "name email roles", match: { status: "ACTIVE", roles: { $in: [UserRole.INTERN, UserRole.EMPLOYEE] } } })
        .sort({ department: 1 })
        .lean();
      candidates = members.flatMap((assignment) => assignment.userId ? [{ ...(assignment.userId as any), department: assignment.department, level: assignment.level }] : []);
    }
    if (
      [TaskWorkflowStage.HEAD_PLANNING, TaskWorkflowStage.MANAGER_PLANNING].includes(task.workflowStage) &&
      candidates.length === 0
    ) {
      const seniors = await OrganizationAssignment.find({
        active: true,
        userId: { $ne: task.currentOwner },
        ...(task.workflowStage === TaskWorkflowStage.HEAD_PLANNING
          ? { level: OrganizationLevel.CEO }
          : { $or: [
              { level: OrganizationLevel.CEO },
              { level: OrganizationLevel.HEAD, department: task.department },
            ] }),
      } as any)
        .populate({ path: "userId", select: "name email roles", match: { status: "ACTIVE" } })
        .sort({ level: 1 })
        .lean();
      seniorCandidates = seniors.flatMap((assignment) => assignment.userId ? [{ ...(assignment.userId as any), department: assignment.department, level: assignment.level }] : []);
    }
    return res.json({ success: true, candidates, seniorCandidates });
  } catch (error) {
    next(error);
  }
}

export async function routeTaskToHead(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await requireWorkflowTask(String(req.params.id), req);
    if (task.workflowStage !== TaskWorkflowStage.ADMIN_REVIEW) throw new ApiError(409, "Task is not awaiting admin routing");
    if (req.body.recipientId) {
      if (!canManageCompanyWorkflow(req)) throw new ApiError(403, "Company task management access is required to skip reporting levels");
      const recipient = await OrganizationAssignment.findOne({ userId: req.body.recipientId, department: req.body.department, active: true }).lean();
      if (!recipient || !await User.exists({ _id: recipient.userId, status: "ACTIVE" } as any)) throw new ApiError(400, "Select an active department assignee");
      if (recipient.level === OrganizationLevel.CEO) throw new ApiError(400, "Select a delivery assignee");
      task.department = recipient.department;
      if (recipient.level === OrganizationLevel.MEMBER) {
        await Task.create({ title: task.title, description: task.description, deadline: task.deadline, assignedTo: recipient.userId, assignedBy: req.authUser!._id, createdBy: task.createdBy, currentOwner: recipient.userId, parentTaskId: task._id, productId: task.productId ?? null, department: task.department, workflowStage: TaskWorkflowStage.ASSIGNED, workflowHistory: [{ action: TaskWorkflowAction.DELEGATED, actorId: req.authUser!._id, recipientId: recipient.userId }] });
        task.currentOwner = req.authUser!._id;
        task.workflowStage = TaskWorkflowStage.DELEGATED;
        task.workflowHistory.push({ action: TaskWorkflowAction.DELEGATED, actorId: req.authUser!._id, recipientId: recipient.userId, note: req.body.note, createdAt: new Date() });
      } else {
        task.currentOwner = recipient.userId;
        const head = recipient.level === OrganizationLevel.HEAD;
        task.workflowStage = head ? TaskWorkflowStage.HEAD_PLANNING : TaskWorkflowStage.MANAGER_PLANNING;
        task.workflowHistory.push({ action: head ? TaskWorkflowAction.ROUTED_TO_HEAD : TaskWorkflowAction.ROUTED_TO_MANAGER, actorId: req.authUser!._id, recipientId: recipient.userId, note: req.body.note, createdAt: new Date() });
      }
      await task.save();
      return res.json({ success: true, task: await populateWorkflowTask(Task.findById(task._id)) });
    }
    const head = await findActiveDepartmentHead(req.body.department, req.body.headId);
    if (!head) throw new ApiError(400, "This department does not have an active Head");
    task.department = req.body.department;
    task.currentOwner = head.userId;
    task.workflowStage = TaskWorkflowStage.HEAD_PLANNING;
    task.workflowHistory.push({ action: TaskWorkflowAction.ROUTED_TO_HEAD, actorId: req.authUser!._id, recipientId: head.userId, note: req.body.note, createdAt: new Date() });
    await task.save();
    return res.json({ success: true, task: await populateWorkflowTask(Task.findById(task._id)) });
  } catch (error) {
    next(error);
  }
}

export async function routeTaskToManager(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await requireWorkflowTask(String(req.params.id), req);
    if (task.workflowStage !== TaskWorkflowStage.HEAD_PLANNING) throw new ApiError(409, "Task is not awaiting department planning");
    const manager = await OrganizationAssignment.findOne({ userId: req.body.managerId, level: OrganizationLevel.MANAGER, department: task.department, reportsTo: task.currentOwner, active: true } as any);
    if (!manager) throw new ApiError(400, "Select a manager who reports to you in this department");
    if (!await User.exists({ _id: manager.userId, status: "ACTIVE" } as any)) throw new ApiError(400, "The selected manager is not active");
    task.projectObjective = req.body.projectObjective;
    task.recommendedStack = req.body.recommendedStack;
    task.requirements = req.body.requirements;
    task.finalDeliverables = req.body.finalDeliverables;
    task.learningResources = req.body.learningResources;
    task.currentOwner = manager.userId;
    task.workflowStage = TaskWorkflowStage.MANAGER_PLANNING;
    task.workflowHistory.push({ action: TaskWorkflowAction.ROUTED_TO_MANAGER, actorId: req.authUser!._id, recipientId: manager.userId, createdAt: new Date() });
    await task.save();
    return res.json({ success: true, task: await populateWorkflowTask(Task.findById(task._id)) });
  } catch (error) {
    next(error);
  }
}

export async function delegateTask(req: Request, res: Response, next: NextFunction) {
  const createdConversationIds: Types.ObjectId[] = [];
  const createdSubtaskIds: Types.ObjectId[] = [];
  try {
    const task = await requireWorkflowTask(String(req.params.id), req);
    const directFromHead = task.workflowStage === TaskWorkflowStage.HEAD_PLANNING;
    if (
      ![TaskWorkflowStage.HEAD_PLANNING, TaskWorkflowStage.MANAGER_PLANNING, TaskWorkflowStage.DELEGATED, TaskWorkflowStage.MANAGER_REVIEW].includes(task.workflowStage) ||
      (!canManageCompanyWorkflow(req) && String(task.currentOwner) !== String(req.authUser!._id))
    ) throw new ApiError(403, "Only the assigned manager can add work items to this task");
    if (directFromHead) {
      if (!canManageCompanyWorkflow(req) && !hasAnyRole(requestRoles(req), headRoles))
        throw new ApiError(403, "Only the assigned department Head can directly assign work");
      const activeManager = await OrganizationAssignment.findOne({ level: OrganizationLevel.MANAGER, department: task.department, reportsTo: task.currentOwner, active: true } as any)
        .populate({ path: "userId", match: { status: "ACTIVE" }, select: "_id" });
      if (activeManager?.userId)
        throw new ApiError(409, "Route work through a direct-report Manager while one is active");
    }
    const requestedSubtasks = req.body.subtasks.map((subtask: { assignedTo?: string; assignedToIds?: string[] }) => ({
      ...subtask,
      assignedToIds: Array.from(new Set((subtask.assignedToIds ?? [subtask.assignedTo]).filter(Boolean).map(String))),
    }));
    const assigneeIds = Array.from(new Set<string>(requestedSubtasks.flatMap((subtask: { assignedToIds: string[] }) => subtask.assignedToIds)));
    const assignments = await OrganizationAssignment.find({ userId: { $in: assigneeIds }, ...(canManageCompanyWorkflow(req) ? {} : { level: OrganizationLevel.MEMBER, department: task.department, reportsTo: task.currentOwner }), active: true } as any).lean();
    const validIds = new Set(assignments.map((assignment) => String(assignment.userId)));
    if (assigneeIds.some((id) => !validIds.has(id))) throw new ApiError(400, "Every assignee must be an active member reporting directly to you");
    const users = await User.find({ _id: { $in: assigneeIds }, status: "ACTIVE", roles: { $in: [UserRole.INTERN, UserRole.EMPLOYEE] } } as any).select("_id").lean();
    if (users.length !== assigneeIds.length) throw new ApiError(400, "Subtasks can only be assigned to active interns or employees");
    if (requestedSubtasks.some((subtask: { deadline: Date }) => new Date(subtask.deadline) > task.deadline)) throw new ApiError(400, "Subtask deadlines cannot exceed the parent task deadline");

    const subtaskDocuments: Record<string, unknown>[] = [];
    const conversationNotifications: Array<{ conversationId: Types.ObjectId; memberIds: string[] }> = [];
    for (const subtask of requestedSubtasks) {
      const { assignedToIds, assignedTo: _assignedTo, ...subtaskFields } = subtask;
      const collaborationBatchId = assignedToIds.length > 1 ? new Types.ObjectId() : null;
      let collaborationConversationId: Types.ObjectId | null = null;
      if (collaborationBatchId) {
        const memberIds = [...new Set([String(task.currentOwner), String(req.authUser!._id), ...assignedToIds])];
        const conversation = await Conversation.create({
          type: ConversationType.GROUP,
          name: `${task.title}: ${subtask.title}`.slice(0, 120),
          description: `${task.department ?? "Department"} work assigned by manager: ${subtask.description}`.slice(0, 500),
          createdBy: req.authUser!._id,
          admins: [...new Set([String(task.currentOwner), String(req.authUser!._id)])],
          members: memberIds.map((userId) => ({ userId })),
        });
        collaborationConversationId = conversation._id;
        createdConversationIds.push(conversation._id);
        conversationNotifications.push({ conversationId: conversation._id, memberIds });
      }
      for (const assignedTo of assignedToIds) {
        subtaskDocuments.push({
          ...subtaskFields,
          projectObjective: task.projectObjective,
          assignedTo,
          assignedBy: req.authUser!._id,
          createdBy: task.createdBy,
          currentOwner: assignedTo,
          parentTaskId: task._id,
          productId: task.productId,
          collaborationBatchId,
          collaborationConversationId,
          department: task.department,
          workflowStage: TaskWorkflowStage.ASSIGNED,
          workflowHistory: [{ action: TaskWorkflowAction.DELEGATED, actorId: req.authUser!._id, recipientId: assignedTo }],
        });
      }
    }
    const subtasks = await Task.insertMany(subtaskDocuments);
    createdSubtaskIds.push(
      ...subtasks.map((subtask) => new Types.ObjectId(String(subtask._id))),
    );
    task.workflowStage = TaskWorkflowStage.DELEGATED;
    task.workflowHistory.push({ action: TaskWorkflowAction.DELEGATED, actorId: req.authUser!._id, note: `${subtasks.length} work item${subtasks.length === 1 ? "" : "s"} added`, createdAt: new Date() });
    await task.save();
    await Promise.allSettled(conversationNotifications.map(({ conversationId, memberIds }) => publishChatEvent({ type: "conversation.created", conversationId }, memberIds)));
    return res.status(201).json({ success: true, task, subtasks: await populateWorkflowTask(Task.find({ parentTaskId: task._id })).lean(), conversationIds: createdConversationIds });
  } catch (error) {
    await Promise.all([
      createdSubtaskIds.length ? Task.deleteMany({ _id: { $in: createdSubtaskIds } }) : Promise.resolve(),
      createdConversationIds.length ? Conversation.deleteMany({ _id: { $in: createdConversationIds } }) : Promise.resolve(),
    ]);
    next(error);
  }
}

export async function submitWorkflowReport(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await requireWorkflowTask(String(req.params.id), req);
    const headReport = task.workflowStage === TaskWorkflowStage.HEAD_PLANNING;
    const managerReport = task.workflowStage === TaskWorkflowStage.MANAGER_PLANNING;
    if (
      (!headReport && !managerReport) ||
      (!canManageCompanyWorkflow(req) && String(task.currentOwner) !== String(req.authUser!._id))
    ) throw new ApiError(403, "Only the assigned Head or Manager can submit this report");
    if (!canManageCompanyWorkflow(req) && headReport && !hasAnyRole(requestRoles(req), headRoles))
      throw new ApiError(403, "Only the assigned department Head can submit this report");
    if (!canManageCompanyWorkflow(req) && managerReport && !hasAnyRole(requestRoles(req), managerRoles))
      throw new ApiError(403, "Only the assigned Manager can submit this report");
    if (headReport) {
      const activeManager = await OrganizationAssignment.findOne({ level: OrganizationLevel.MANAGER, department: task.department, reportsTo: task.currentOwner, active: true } as any)
        .populate({ path: "userId", match: { status: "ACTIVE" }, select: "_id" });
      if (activeManager?.userId)
        throw new ApiError(409, "Route work through a direct-report Manager while one is active");
    }
    const activeMember = await OrganizationAssignment.findOne({ level: OrganizationLevel.MEMBER, department: task.department, reportsTo: task.currentOwner, active: true } as any)
      .populate({ path: "userId", match: { status: "ACTIVE", roles: { $in: [UserRole.INTERN, UserRole.EMPLOYEE] } }, select: "_id" });
    if (activeMember?.userId)
      throw new ApiError(409, "Assign work to direct-report team members while any are active");
    const recipient = await OrganizationAssignment.findOne({
      active: true,
      $and: [
        { userId: req.body.recipientId },
        { userId: { $ne: req.authUser!._id } },
      ],
      ...(headReport
        ? { level: OrganizationLevel.CEO }
        : { $or: [
            { level: OrganizationLevel.CEO },
            { level: OrganizationLevel.HEAD, department: task.department },
          ] }),
    } as any).populate({ path: "userId", match: { status: "ACTIVE" }, select: "_id" });
    if (!recipient?.userId) throw new ApiError(400, "Choose an active Head in this department or the company CEO");
    const seniorLevel = recipient.level;
    const seniorId = (recipient.userId as any)._id ?? recipient.userId;
    const now = new Date();
    task.submission = { description: req.body.report, submittedAt: now };
    task.currentOwner = seniorId;
    task.workflowStage = seniorLevel === OrganizationLevel.CEO ? TaskWorkflowStage.CEO_REVIEW : TaskWorkflowStage.HEAD_REVIEW;
    task.workflowHistory.push({
      action: TaskWorkflowAction.REPORT_SUBMITTED,
      actorId: req.authUser!._id,
      recipientId: seniorId,
      note: req.body.report,
      createdAt: now,
    });
    await task.save();
    return res.json({ success: true, task: await populateWorkflowTask(Task.findById(task._id)) });
  } catch (error) {
    next(error);
  }
}

function workflowParticipant(
  task: Awaited<ReturnType<typeof requireWorkflowTask>>,
  action: TaskWorkflowAction,
  field: "actorId" | "recipientId",
) {
  const event = [...task.workflowHistory].reverse().find((item) => item.action === action);
  return event?.[field] ?? null;
}

export async function reviewWorkflowTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await requireWorkflowTask(String(req.params.id), req);
    const executive = canManageCompanyWorkflow(req);
    if (!executive && String(task.currentOwner) !== String(req.authUser!._id))
      throw new ApiError(403, "This task is not in your review queue");

    const decision = req.body.decision as "APPROVE" | "ENHANCEMENT";
    const note = req.body.note as string | undefined;
    const now = new Date();
    if (task.workflowStage === TaskWorkflowStage.MANAGER_REVIEW) {
      if (!executive && !hasAnyRole(requestRoles(req), managerRoles))
        throw new ApiError(403, "Only the assigned manager can review member work");
      if (decision === "ENHANCEMENT") {
        if (!req.body.subtaskId || !Types.ObjectId.isValid(req.body.subtaskId))
          throw new ApiError(400, "Select the work item that needs enhancement");
        const subtask = await Task.findOne({
          _id: req.body.subtaskId,
          parentTaskId: task._id,
          workflowStage: TaskWorkflowStage.SUBMITTED,
        });
        if (!subtask) throw new ApiError(404, "Submitted work item not found");
        const lastSubmissionIndex = task.workflowHistory
          .map((event) => event.action)
          .lastIndexOf(TaskWorkflowAction.MEMBER_SUBMITTED);
        const leadershipNote = task.workflowHistory
          .slice(lastSubmissionIndex + 1)
          .find(
            (event) =>
              event.action === TaskWorkflowAction.ENHANCEMENT_REQUESTED &&
              event.note,
          )?.note;
        const memberNote = [
          leadershipNote ? `Leadership request: ${leadershipNote}` : "",
          note ? `Manager guidance: ${note}` : "",
        ]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 500);
        subtask.status = TaskStatus.PENDING;
        subtask.completedAt = null;
        subtask.workflowStage = TaskWorkflowStage.ASSIGNED;
        subtask.workflowHistory.push({
          action: TaskWorkflowAction.ENHANCEMENT_REQUESTED,
          actorId: req.authUser!._id,
          recipientId: subtask.assignedTo ?? null,
          ...(memberNote ? { note: memberNote } : {}),
          createdAt: now,
        });
        await subtask.save();
        task.workflowStage = TaskWorkflowStage.DELEGATED;
        task.workflowHistory.push({
          action: TaskWorkflowAction.ENHANCEMENT_REQUESTED,
          actorId: req.authUser!._id,
          recipientId: subtask.assignedTo ?? null,
          ...(note ? { note } : {}),
          createdAt: now,
        });
      } else {
        const unsubmitted = await Task.exists({
          parentTaskId: task._id,
          workflowStage: { $ne: TaskWorkflowStage.SUBMITTED },
        });
        if (unsubmitted)
          throw new ApiError(409, "Every work item must be submitted before approval");
        const originalHead = workflowParticipant(task, TaskWorkflowAction.ROUTED_TO_HEAD, "recipientId");
        const headId = originalHead ? (await findActiveDepartmentHead(String(task.department), String(originalHead)))?.userId : null;
        if (originalHead && !headId) throw new ApiError(409, "The routed department Head could not be resolved");
        task.currentOwner = headId ?? task.createdBy;
        task.workflowStage = headId ? TaskWorkflowStage.HEAD_REVIEW : TaskWorkflowStage.CEO_REVIEW;
        task.workflowHistory.push({ action: headId ? TaskWorkflowAction.FORWARDED_TO_HEAD : TaskWorkflowAction.FORWARDED_TO_CEO, actorId: req.authUser!._id, recipientId: task.currentOwner, ...(note ? { note } : {}), createdAt: now });
      }
    } else if (task.workflowStage === TaskWorkflowStage.HEAD_REVIEW) {
      if (!executive && !hasAnyRole(requestRoles(req), headRoles))
        throw new ApiError(403, "Only the assigned department Head can review this task");
      if (decision === "ENHANCEMENT") {
        const managerId = workflowParticipant(task, TaskWorkflowAction.ROUTED_TO_MANAGER, "recipientId");
        if (managerId) {
          task.currentOwner = managerId;
          const hasWorkItems = await Task.exists({ parentTaskId: task._id });
          task.workflowStage = task.submission && !hasWorkItems
            ? TaskWorkflowStage.MANAGER_PLANNING
            : TaskWorkflowStage.MANAGER_REVIEW;
          task.workflowHistory.push({ action: TaskWorkflowAction.ENHANCEMENT_REQUESTED, actorId: req.authUser!._id, recipientId: managerId, ...(note ? { note } : {}), createdAt: now });
        } else {
          if (!req.body.subtaskId || !Types.ObjectId.isValid(req.body.subtaskId))
            throw new ApiError(400, "Select the work item that needs enhancement");
          const subtask = await Task.findOne({ _id: req.body.subtaskId, parentTaskId: task._id, workflowStage: TaskWorkflowStage.SUBMITTED });
          if (!subtask) throw new ApiError(404, "Submitted work item not found");
          subtask.status = TaskStatus.PENDING;
          subtask.completedAt = null;
          subtask.workflowStage = TaskWorkflowStage.ASSIGNED;
          subtask.workflowHistory.push({ action: TaskWorkflowAction.ENHANCEMENT_REQUESTED, actorId: req.authUser!._id, recipientId: subtask.assignedTo ?? null, ...(note ? { note } : {}), createdAt: now });
          await subtask.save();
          const headId = workflowParticipant(task, TaskWorkflowAction.ROUTED_TO_HEAD, "recipientId") ?? req.authUser!._id;
          task.currentOwner = headId;
          task.workflowStage = TaskWorkflowStage.HEAD_PLANNING;
          task.workflowHistory.push({ action: TaskWorkflowAction.ENHANCEMENT_REQUESTED, actorId: req.authUser!._id, recipientId: subtask.assignedTo ?? null, ...(note ? { note } : {}), createdAt: now });
        }
      } else {
        const adminId = workflowParticipant(task, TaskWorkflowAction.ROUTED_TO_HEAD, "actorId");
        if (!adminId) throw new ApiError(409, "The routing Admin could not be resolved");
        task.currentOwner = adminId;
        task.workflowStage = TaskWorkflowStage.ADMIN_FINAL_REVIEW;
        task.workflowHistory.push({ action: TaskWorkflowAction.FORWARDED_TO_ADMIN, actorId: req.authUser!._id, recipientId: adminId, ...(note ? { note } : {}), createdAt: now });
      }
    } else if (task.workflowStage === TaskWorkflowStage.ADMIN_FINAL_REVIEW) {
      if (!executive)
        throw new ApiError(403, "Only the assigned Admin can review this task");
      if (decision === "ENHANCEMENT") {
        const headId = workflowParticipant(task, TaskWorkflowAction.ROUTED_TO_HEAD, "recipientId");
        if (!headId) throw new ApiError(409, "The department Head could not be resolved");
        task.currentOwner = headId;
        task.workflowStage = TaskWorkflowStage.HEAD_REVIEW;
        task.workflowHistory.push({ action: TaskWorkflowAction.ENHANCEMENT_REQUESTED, actorId: req.authUser!._id, recipientId: headId, ...(note ? { note } : {}), createdAt: now });
      } else {
        const ceo = await User.findOne({ roles: UserRole.CEO, status: "ACTIVE" } as any).sort({ _id: 1 }).select("_id");
        if (!ceo) throw new ApiError(409, "An active CEO is required for final approval");
        task.currentOwner = ceo._id;
        task.workflowStage = TaskWorkflowStage.CEO_REVIEW;
        task.workflowHistory.push({ action: TaskWorkflowAction.FORWARDED_TO_CEO, actorId: req.authUser!._id, recipientId: ceo._id, ...(note ? { note } : {}), createdAt: now });
      }
    } else if (task.workflowStage === TaskWorkflowStage.CEO_REVIEW) {
      if (!executive)
        throw new ApiError(403, "Only the CEO who created this brief can review it");
      if (decision === "ENHANCEMENT") {
        const reportSubmitter = workflowParticipant(task, TaskWorkflowAction.REPORT_SUBMITTED, "actorId");
        if (reportSubmitter) {
          const reporter = await OrganizationAssignment.findOne({ userId: reportSubmitter, active: true } as any).select("level").lean();
          if (!reporter || ![OrganizationLevel.HEAD, OrganizationLevel.MANAGER].includes(reporter.level))
            throw new ApiError(409, "The task report owner no longer has an active reporting assignment");
          task.currentOwner = reportSubmitter;
          task.workflowStage = reporter.level === OrganizationLevel.HEAD
            ? TaskWorkflowStage.HEAD_PLANNING
            : TaskWorkflowStage.MANAGER_PLANNING;
          task.workflowHistory.push({ action: TaskWorkflowAction.ENHANCEMENT_REQUESTED, actorId: req.authUser!._id, recipientId: reportSubmitter, ...(note ? { note } : {}), createdAt: now });
          await task.save();
          return res.json({ success: true, task: await populateWorkflowTask(Task.findById(task._id)), subtasks: [] });
        }
        const adminId = workflowParticipant(task, TaskWorkflowAction.ROUTED_TO_HEAD, "actorId") ?? workflowParticipant(task, TaskWorkflowAction.ROUTED_TO_MANAGER, "recipientId") ?? workflowParticipant(task, TaskWorkflowAction.DELEGATED, "actorId");
        if (!adminId) throw new ApiError(409, "The delivery reviewer could not be resolved");
        task.currentOwner = adminId;
        task.workflowStage = workflowParticipant(task, TaskWorkflowAction.ROUTED_TO_HEAD, "actorId") ? TaskWorkflowStage.ADMIN_FINAL_REVIEW : TaskWorkflowStage.MANAGER_REVIEW;
        task.workflowHistory.push({ action: TaskWorkflowAction.ENHANCEMENT_REQUESTED, actorId: req.authUser!._id, recipientId: adminId, ...(note ? { note } : {}), createdAt: now });
      } else {
        task.currentOwner = req.authUser!._id;
        task.workflowStage = TaskWorkflowStage.COMPLETED;
        task.status = TaskStatus.DONE;
        task.completedAt = now;
        task.workflowHistory.push({ action: TaskWorkflowAction.ACCEPTED, actorId: req.authUser!._id, ...(note ? { note } : {}), createdAt: now });
        await Task.updateMany(
          { parentTaskId: task._id },
          { $set: { status: TaskStatus.DONE, workflowStage: TaskWorkflowStage.COMPLETED, completedAt: now } },
        );
      }
    } else {
      throw new ApiError(409, "This task is not awaiting review");
    }
    if ([TaskWorkflowStage.HEAD_REVIEW, TaskWorkflowStage.MANAGER_REVIEW, TaskWorkflowStage.DELEGATED].includes(task.workflowStage) && !await User.exists({ _id: task.currentOwner, status: "ACTIVE", roles: { $in: [UserRole.CEO, UserRole.ADMIN] } } as any)) {
      const recipient = await OrganizationAssignment.findOne({ userId: task.currentOwner, active: true, department: task.department, level: task.workflowStage === TaskWorkflowStage.HEAD_REVIEW ? OrganizationLevel.HEAD : OrganizationLevel.MANAGER } as any)
        .populate({ path: "userId", match: { status: "ACTIVE" }, select: "_id" });
      if (!recipient?.userId) throw new ApiError(409, "The next reviewer no longer has an active assignment in this department");
    }
    await task.save();
    return res.json({
      success: true,
      task: await populateWorkflowTask(Task.findById(task._id)),
      subtasks: await populateWorkflowTask(Task.find({ parentTaskId: task._id }).sort({ deadline: 1 })).lean(),
    });
  } catch (error) {
    next(error);
  }
}