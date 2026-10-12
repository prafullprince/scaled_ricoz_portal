import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  EmployeeProfile,
  InternProfile,
  OrganizationAssignment,
  OrganizationDepartment,
  Task,
  TaskDailyReport,
  TaskStatus,
  TaskWorkflowAction,
  TaskWorkflowStage,
  User,
} from "../../models/index.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { managedUserIds } from "../organization/organization.controller.js";
import { resolveOrganizationAccess, contributionScopeFilter, isOrganizationExecutive } from "../organization/organization.access.js";
import { hasCompanyFeatureGrant, requestRoles } from "../organization/organization.roles.js";
import { completedTaskReports } from "./task-progress.js";
import { Permission } from "../auth/authorization.js";

type TaskView = {
  _id: unknown;
  title: string;
  description: string;
  deadline: Date;
  assignedTo: unknown;
  assignedBy: unknown;
  status: TaskStatus;
  workflowStage: string;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  effectiveStatus: "PENDING" | "DONE" | "DELAYED";
};

function effectiveStatus(task: { status: TaskStatus; deadline: Date }) {
  return task.status === TaskStatus.PENDING &&
    new Date(task.deadline).getTime() < Date.now()
    ? "DELAYED"
    : task.status;
}

function toTaskView(task: any): TaskView {
  const value = task.toObject ? task.toObject() : task;
  return { ...value, effectiveStatus: effectiveStatus(value) };
}

function isAssignable(user: { roles: string[] }) {
  return (
    user.roles.includes(UserRole.INTERN) ||
    user.roles.includes(UserRole.EMPLOYEE)
  );
}

export async function listTaskAssignees(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const executive = isOrganizationExecutive(requestRoles(_req)) || hasCompanyFeatureGrant(_req, Permission.TASK_ASSIGN);
    const managedIds = executive
      ? (await OrganizationAssignment.find({ active: true }).select("userId").lean()).map((assignment) => assignment.userId)
      : await managedUserIds(_req.authUser!._id, false);
    const users = await User.find({
      ...(!executive ? { roles: { $in: [UserRole.INTERN, UserRole.EMPLOYEE] } } : {}),
      status: "ACTIVE",
      ...(managedIds ? { _id: { $in: managedIds } } : {}),
    } as any)
      .select("name email roles")
      .sort({ name: 1 })
      .lean();
    const access = await resolveOrganizationAccess(_req.authUser!._id, requestRoles(_req), hasCompanyFeatureGrant(_req, Permission.TASK_ASSIGN));
    const taskHistory = await Task.find({
      ...contributionScopeFilter(access),
      assignedTo: { $in: users.map((user) => user._id) },
    })
      .select("title status deadline assignedTo createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const historyByUser = new Map<string, typeof taskHistory>();
    for (const task of taskHistory) {
      const key = String(task.assignedTo);
      historyByUser.set(key, [...(historyByUser.get(key) ?? []), task]);
    }
    const userIds = users.map((user) => user._id);
    const [internProfiles, employeeProfiles] = await Promise.all([
      InternProfile.find({ userId: { $in: userIds } })
        .select("userId initialRole currentRole")
        .lean(),
      EmployeeProfile.find({ userId: { $in: userIds } })
        .select("userId initialRole currentRole")
        .lean(),
    ]);
    const roleByUser = new Map<
      string,
      { initialRole: string | null; currentRole: string | null }
    >();
    for (const profile of [...internProfiles, ...employeeProfiles]) {
      roleByUser.set(String(profile.userId), {
        initialRole: profile.initialRole ?? null,
        currentRole: profile.currentRole ?? null,
      });
    }
    return res.json({
      success: true,
      assignees: users.map((user) => {
        const history = historyByUser.get(String(user._id)) ?? [];
        const currentTask =
          history.find((task) => task.status === TaskStatus.PENDING) ?? null;
        const role = roleByUser.get(String(user._id)) ?? {
          initialRole: null,
          currentRole: null,
        };
        return {
          ...user,
          initialRole: role.initialRole,
          currentRole: role.currentRole,
          activeTaskCount: history.filter((task) => task.status === TaskStatus.PENDING).length,
          totalTaskCount: history.length,
          completedTaskCount: history.filter(
            (task) => task.status === TaskStatus.DONE,
          ).length,
          currentTask: currentTask
            ? {
                _id: currentTask._id,
                title: currentTask.title,
                deadline: currentTask.deadline,
              }
            : null,
          available: true,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
}

export async function createTask(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const assignee = await User.findOne({ _id: new Types.ObjectId(req.body.assignedTo), status: UserStatus.ACTIVE })
      .select("name email roles")
      .lean();
    const executive = isOrganizationExecutive(requestRoles(req)) || hasCompanyFeatureGrant(req, Permission.TASK_ASSIGN);
    if (!assignee || (!executive && !isAssignable(assignee)))
      throw new ApiError(400, "Select an active intern or employee");
    const managedIds = await managedUserIds(
      req.authUser!._id,
      executive,
    );
    if (
      managedIds &&
      !managedIds.some((id) => String(id) === String(assignee._id))
    )
      throw new ApiError(
        403,
        "You can only assign tasks to people in your reporting structure",
      );
    const assignment = await OrganizationAssignment.findOne({ userId: assignee._id, active: true }).lean();
    if (!assignment) throw new ApiError(400, "The assignee needs an active department assignment");
    const task = await Task.create({
      ...req.body,
      department: assignment.department,
      assignedTo: assignee._id,
      assignedBy: req.authUser!._id,
      createdBy: req.authUser!._id,
    });
    return res
      .status(201)
      .json({
        success: true,
        task: toTaskView(await task.populate("assignedTo", "name email roles")),
      });
  } catch (error) {
    next(error);
  }
}

export async function listMyTasks(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const isLeader = requestRoles(req).some((role) => role === UserRole.HEAD || role === UserRole.MANAGER || role.endsWith("_HEAD") || role.endsWith("_MANAGER"));
    const filter = isLeader
      ? { $or: [{ assignedTo: req.authUser!._id }, { currentOwner: req.authUser!._id }] }
      : { assignedTo: req.authUser!._id };
    const tasks = await Task.find({ ...filter, salesAccountability: null })
      .populate("productId", "title deletedAt")
      .populate("assignedBy", "name email")
      .populate("workflowHistory.actorId", "name email roles")
      .populate("workflowHistory.recipientId", "name email roles")
      .sort({ status: 1, deadline: 1 })
      .lean();
    return res.json({ success: true, tasks: tasks.map(toTaskView) });
  } catch (error) {
    next(error);
  }
}

export async function listAdminTasks(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const assigneeIds = search
      ? (
          await User.find({
            $or: [
              { name: new RegExp(search, "i") },
              { email: new RegExp(search, "i") },
            ],
          })
            .select("_id")
            .lean()
        ).map((user) => user._id)
      : undefined;
    const access = await resolveOrganizationAccess(req.authUser!._id, requestRoles(req), hasCompanyFeatureGrant(req, Permission.TASK_ASSIGN));
    const filter: Record<string, unknown> = contributionScopeFilter(access);
    if (assigneeIds) filter.$and = [{ assignedTo: { $in: assigneeIds } }];
    if (req.query.status === "DONE") filter.status = TaskStatus.DONE;
    if (req.query.status === "PENDING") filter.status = TaskStatus.PENDING;
    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email roles")
      .populate("assignedBy", "name email")
      .sort({ deadline: 1 })
      .lean();
    return res.json({ success: true, tasks: tasks.map(toTaskView) });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) throw new ApiError(404, "Task not found");
    if (task.salesAccountability || task.parentTaskId || task.productId || ![TaskWorkflowStage.ASSIGNED, TaskWorkflowStage.SUBMITTED, TaskWorkflowStage.COMPLETED].includes(task.workflowStage))
      throw new ApiError(409, "Workflow tasks must use the review process");
    task.status = req.body.status as TaskStatus;
    task.completedAt = task.status === TaskStatus.DONE ? new Date() : null;
    task.workflowStage = task.status === TaskStatus.DONE ? TaskWorkflowStage.COMPLETED : TaskWorkflowStage.ASSIGNED;
    task.workflowHistory.push({ action: task.status === TaskStatus.DONE ? TaskWorkflowAction.ACCEPTED : TaskWorkflowAction.ENHANCEMENT_REQUESTED, actorId: req.authUser!._id, recipientId: task.assignedTo ?? null, createdAt: new Date() });
    await task.save();
    return res.json({ success: true, task: toTaskView(task) });
  } catch (error) {
    next(error);
  }
}

export async function updateMyTaskStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const task = await Task.findOne({
      _id: String(req.params.id),
      assignedTo: req.authUser!._id,
    } as any);
    if (!task) throw new ApiError(404, "Task not found");
    if (task.salesAccountability) throw new ApiError(409, "Submit evidence through Sales accountability");
    if (task.workflowStage !== TaskWorkflowStage.ASSIGNED)
      throw new ApiError(409, "Only assigned workflow tasks can be submitted");
    const submittedAt = new Date();
    task.status = TaskStatus.PENDING;
    task.completedAt = null;
    task.workflowStage = TaskWorkflowStage.SUBMITTED;
    if (!task.parentTaskId) task.currentOwner = task.assignedBy;
    task.submission = {
      description: req.body.submissionDescription,
      ...(req.body.githubUrl ? { githubUrl: req.body.githubUrl } : {}),
      ...(req.body.liveUrl ? { liveUrl: req.body.liveUrl } : {}),
      submittedAt,
    };
    task.workflowHistory.push({
      action: TaskWorkflowAction.MEMBER_SUBMITTED,
      actorId: req.authUser!._id,
      recipientId: task.assignedBy,
      note: req.body.submissionDescription,
      createdAt: submittedAt,
    });
    await task.save();
    if (task.parentTaskId) {
      const parent = await Task.findById(task.parentTaskId);
      const routedManager = parent?.workflowHistory.find(
        (event) => event.action === TaskWorkflowAction.ROUTED_TO_MANAGER,
      );
      const routedHead = parent?.workflowHistory.find(
        (event) => event.action === TaskWorkflowAction.ROUTED_TO_HEAD,
      );
      const reviewOwner = routedManager?.recipientId ?? routedHead?.recipientId ?? parent?.currentOwner ?? task.assignedBy;
      const reviewStage = routedManager
        ? TaskWorkflowStage.MANAGER_REVIEW
        : routedHead
          ? TaskWorkflowStage.HEAD_REVIEW
          : TaskWorkflowStage.CEO_REVIEW;
      await Task.updateOne(
        { _id: task.parentTaskId },
        {
          $set: {
            workflowStage: reviewStage,
            currentOwner: reviewOwner,
          },
          $push: {
            workflowHistory: {
              action: TaskWorkflowAction.MEMBER_SUBMITTED,
              actorId: req.authUser!._id,
              recipientId: task.assignedBy,
              note: `${task.title} is ready for ${reviewStage === TaskWorkflowStage.MANAGER_REVIEW ? "Manager" : reviewStage === TaskWorkflowStage.HEAD_REVIEW ? "Head" : "CEO"} review`,
              createdAt: submittedAt,
            },
          },
        },
      );
    }
    return res.json({ success: true, task: toTaskView(task) });
  } catch (error) {
    next(error);
  }
}

export async function getTaskReport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const canViewOtherUsers = requestRoles(req).some((role) => role === UserRole.ADMIN || role === UserRole.CEO || role === UserRole.HR);
    const userId =
      canViewOtherUsers && req.query.userId
        ? String(req.query.userId)
        : String(req.authUser!._id);
    if (!Types.ObjectId.isValid(userId))
      throw new ApiError(400, "Invalid user id");
    const tasks = await Task.find({ assignedTo: userId })
      .populate("assignedTo", "name email roles")
      .sort({ deadline: -1 })
      .lean();
    const views = tasks.map(toTaskView);
    const summary = {
      total: views.length,
      pending: views.filter((task) => task.effectiveStatus === "PENDING")
        .length,
      done: views.filter((task) => task.effectiveStatus === "DONE").length,
      delayed: views.filter((task) => task.effectiveStatus === "DELAYED")
        .length,
      onTime: views.filter(
        (task) =>
          task.effectiveStatus === "DONE" &&
          task.completedAt &&
          new Date(task.completedAt).getTime() <=
            new Date(task.deadline).getTime(),
      ).length,
    };
    const dailyReports = completedTaskReports(await TaskDailyReport.find({ userId })
      .sort({ reportDate: -1, updatedAt: -1 })
      .lean(), views);
    return res.json({ success: true, summary, tasks: views, dailyReports });
  } catch (error) {
    next(error);
  }
}

export async function getAdminReport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const access = await resolveOrganizationAccess(req.authUser!._id, requestRoles(req), hasCompanyFeatureGrant(req, Permission.TASK_REPORT_READ));
    const requestedDepartment = req.query.department;
    if (requestedDepartment !== undefined && (typeof requestedDepartment !== "string" || (requestedDepartment !== "ALL" && !Object.values(OrganizationDepartment).includes(requestedDepartment as OrganizationDepartment)))) throw new ApiError(400, "Invalid department");
    const allDepartments = requestedDepartment === "ALL";
    if (allDepartments && !access.executive) throw new ApiError(403, "All-department reports are restricted to company-wide task readers");
    const department = allDepartments ? "ALL" : requestedDepartment as OrganizationDepartment | undefined ?? (access.executive ? OrganizationDepartment.PRODUCT : access.assignment.department);
    const taskScope = department === "ALL" ? {} : { department };
    if (!access.executive && department !== access.assignment.department) throw new ApiError(403, "This department is outside your access");
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 10);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new ApiError(400, "Invalid pagination: page must be positive and pageSize must be between 1 and 50");
    const departmentMembers = access.executive
      ? await OrganizationAssignment.find({ active: true, ...taskScope }).select("userId").lean()
      : null;
    const departmentTaskAssignees = access.executive
      ? await Task.distinct("assignedTo", { ...taskScope, assignedTo: { $ne: null } })
      : [];
    let userIds = access.executive
      ? [...new Set([...(departmentMembers ?? []).map((assignment) => String(assignment.userId)), ...departmentTaskAssignees.map(String)])]
      : access.userIds ?? [];
    const reportStatus = req.query.status ?? "ALL";
    if (typeof reportStatus !== "string" || !["ALL", "PENDING", "DONE", "DELAYED", "ON_TIME"].includes(reportStatus)) throw new ApiError(400, "Invalid report status");
    const statusFilter = reportStatus === "DELAYED"
      ? { status: TaskStatus.PENDING, deadline: { $lt: new Date() } }
      : reportStatus === "PENDING"
        ? { status: TaskStatus.PENDING, deadline: { $gte: new Date() } }
        : reportStatus === "ON_TIME"
          ? { status: TaskStatus.DONE, completedAt: { $ne: null }, $expr: { $lte: ["$completedAt", "$deadline"] } }
          : reportStatus === "DONE"
            ? { status: TaskStatus.DONE }
            : {};
    if (reportStatus !== "ALL") {
      userIds = await Task.distinct("assignedTo", { ...taskScope, assignedTo: { $in: userIds }, ...statusFilter });
    }
    const literalSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchingTaskUserIds = search
      ? await Task.distinct("assignedTo", {
          ...contributionScopeFilter(access),
          ...taskScope,
          assignedTo: { $in: userIds },
          $or: [{ title: new RegExp(literalSearch, "i") }, { description: new RegExp(literalSearch, "i") }],
          ...statusFilter,
        })
      : [];
    const userFilter = {
      roles: { $in: [UserRole.INTERN, UserRole.EMPLOYEE] },
      _id: { $in: userIds },
      ...(search
        ? {
            $or: [
              { name: new RegExp(literalSearch, "i") },
              { email: new RegExp(literalSearch, "i") },
              { _id: { $in: matchingTaskUserIds } },
            ],
          }
        : {}),
    };
    const total = await User.countDocuments(userFilter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const users = await User.find(userFilter)
      .select("name email roles")
      .sort({ name: 1, _id: 1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean();
    const tasks = await Task.find({
      ...contributionScopeFilter(access),
      ...taskScope,
      assignedTo: { $in: users.map((user) => user._id) },
    })
      .populate("assignedTo", "name email roles")
      .sort({ deadline: -1 })
      .lean();
    const savedDailyReports = await TaskDailyReport.find({
      userId: { $in: users.map((user) => user._id) },
      taskId: { $in: tasks.map((task) => task._id) },
    })
      .sort({ reportDate: -1, updatedAt: -1 })
      .lean();
    const views = tasks.map(toTaskView);
    const dailyReports = completedTaskReports(savedDailyReports, views);
    const report = users.map((user) => {
      const userTasks = views.filter(
        (task) => String((task.assignedTo as any)?._id) === String(user._id),
      );
      return {
        user,
        summary: {
          total: userTasks.length,
          pending: userTasks.filter(
            (task) => task.effectiveStatus === "PENDING",
          ).length,
          done: userTasks.filter((task) => task.effectiveStatus === "DONE")
            .length,
          delayed: userTasks.filter(
            (task) => task.effectiveStatus === "DELAYED",
          ).length,
          onTime: userTasks.filter(
            (task) =>
              task.effectiveStatus === "DONE" &&
              task.completedAt &&
              new Date(task.completedAt).getTime() <=
                new Date(task.deadline).getTime(),
          ).length,
        },
        tasks: userTasks,
        dailyReports: dailyReports.filter(
          (report) => String(report.userId) === String(user._id),
        ),
      };
    });
    return res.json({ success: true, report, tasks: views, department, pagination: { page: currentPage, pageSize, total, totalPages } });
  } catch (error) {
    next(error);
  }
}

export async function createDailyReport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!Types.ObjectId.isValid(req.body.taskId))
      throw new ApiError(400, "Invalid task id");
    const task = await Task.findById(req.body.taskId).select(
      "assignedTo assignedBy createdBy currentOwner title status workflowStage workflowHistory salesAccountability",
    );
    if (!task)
      throw new ApiError(
        404,
        "Task not found. Refresh your task list and try again.",
      );
    if (String(task.assignedTo) !== String(req.authUser!._id))
      throw new ApiError(
        403,
        "You can only submit a report for your assigned task.",
      );
    if (task.salesAccountability) throw new ApiError(409, "Submit Sales progress and evidence through Sales accountability");
    if (task.status !== TaskStatus.PENDING || task.workflowStage !== TaskWorkflowStage.ASSIGNED)
      throw new ApiError(409, "Reports can only be submitted for active assigned work");
    const reportDate =
      req.body.reportDate ?? new Date().toISOString().slice(0, 10);
    const report = await TaskDailyReport.findOneAndUpdate(
      { taskId: task._id, userId: req.authUser!._id, reportDate },
      { $set: { summary: req.body.summary, progress: req.body.progress } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const { notifyTaskChange } = await import("./task-notification.service.js");
    await notifyTaskChange(task, `Progress reported (${req.body.progress}%)`).catch((error) => console.error("Report notification persistence failed", error));
    return res.status(200).json({ success: true, report });
  } catch (error) {
    next(error);
  }
}
