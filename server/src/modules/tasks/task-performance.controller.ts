import type { NextFunction, Request, Response } from "express";
import { OrganizationAssignment, OrganizationLevel, Task, TaskDailyReport, TaskWorkflowStage } from "../../models/index.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { resolveOrganizationAccess, workflowScopeFilter, contributionScopeFilter, requestedDepartmentFilter } from "../organization/organization.access.js";
import { hasCompanyFeatureGrant, requestRoles } from "../organization/organization.roles.js";
import { taskProgressPercent } from "./task-progress.js";

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

function hasAnyRole(roles: UserRole[], expected: UserRole[]) {
  return expected.some((role) => roles.includes(role));
}

export async function getHierarchyPerformance(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actorId = String(req.authUser!._id);
    const roles = requestRoles(req);
    const access = await resolveOrganizationAccess(req.authUser!._id, roles, hasCompanyFeatureGrant(req, Permission.TASK_REPORT_READ));
    const departmentFilter = requestedDepartmentFilter(access, req.query.department);
    const assignments = await OrganizationAssignment.find({ active: true, ...departmentFilter, ...(access.executive ? {} : { department: access.assignment.department, userId: { $in: access.userIds } }) })
      .populate("userId", "name email roles")
      .lean() as any[];
    const childrenByOwner = new Map<string, any[]>();
    for (const assignment of assignments) {
      const ownerId = assignment.reportsTo ? String(assignment.reportsTo) : "";
      childrenByOwner.set(ownerId, [...(childrenByOwner.get(ownerId) ?? []), assignment]);
    }
    const descendants = (rootId: string) => {
      const result: any[] = [];
      const visited = new Set([rootId]);
      const queue = [...(childrenByOwner.get(rootId) ?? [])];
      while (queue.length) {
        const item = queue.shift()!;
        const userId = String(item.userId?._id ?? item.userId);
        if (visited.has(userId)) continue;
        visited.add(userId);
        result.push(item);
        queue.push(...(childrenByOwner.get(String(item.userId?._id ?? item.userId)) ?? []));
      }
      return result;
    };

    let scope = "Team performance";
    let groups: Array<{ key: string; label: string; subtitle: string; userIds: string[]; profileUserId?: string }> = [];
    if (!access.executive && access.assignment.level === OrganizationLevel.MANAGER) {
      groups = (childrenByOwner.get(actorId) ?? [])
        .filter((item) => item.level === OrganizationLevel.MEMBER && item.userId)
        .map((item) => ({
          key: String(item.userId._id),
          label: item.userId.name,
          subtitle: item.userId.roles.join(" · "),
          userIds: [String(item.userId._id)],
          profileUserId: String(item.userId._id),
        }));
    } else if (!access.executive && access.assignment.level === OrganizationLevel.HEAD) {
      scope = "Manager performance";
      groups = (childrenByOwner.get(actorId) ?? [])
        .filter((item) => item.level === OrganizationLevel.MANAGER && item.userId)
        .map((item) => ({
          key: String(item.userId._id),
          label: item.userId.name,
          subtitle: `${item.department} manager`,
          profileUserId: String(item.userId._id),
          userIds: descendants(String(item.userId._id))
            .filter((child) => child.level === OrganizationLevel.MEMBER)
            .map((child) => String(child.userId?._id ?? child.userId)),
        }));
    } else if (roles.includes(UserRole.ADMIN) || roles.includes(UserRole.HR)) {
      scope = "Department head performance";
      groups = assignments
        .filter((item) => item.level === OrganizationLevel.HEAD && item.userId)
        .map((item) => ({
          key: String(item.userId._id),
          label: item.userId.name,
          subtitle: `${item.department} department`,
          profileUserId: String(item.userId._id),
          userIds: descendants(String(item.userId._id))
            .filter((child) => child.level === OrganizationLevel.MEMBER)
            .map((child) => String(child.userId?._id ?? child.userId)),
        }));
    } else if (roles.includes(UserRole.CEO)) {
      scope = "Department leaderboard";
      const departments = [...new Set(assignments.filter((item) => item.level !== OrganizationLevel.CEO).map((item) => String(item.department)))];
      groups = departments.map((department) => {
        const departmentAssignments = assignments.filter((item) => String(item.department) === department);
        const head = departmentAssignments.find((item) => item.level === OrganizationLevel.HEAD);
        return {
          key: department,
          label: department.toLowerCase().replace(/(^|_)(\w)/g, (_, prefix, letter) => `${prefix ? " " : ""}${letter.toUpperCase()}`),
          subtitle: head?.userId?.name ? `Led by ${head.userId.name}` : "Head not assigned",
          ...(head?.userId?._id ? { profileUserId: String(head.userId._id) } : {}),
          userIds: departmentAssignments
            .filter((item) => item.level === OrganizationLevel.MEMBER)
            .map((item) => String(item.userId?._id ?? item.userId)),
        };
      });
    }

    const allUserIds = [...new Set(groups.flatMap((group) => group.userIds))];
    const tasks = await Task.find({ ...contributionScopeFilter(access), ...departmentFilter, assignedTo: { $in: allUserIds } } as any)
      .select("assignedTo status workflowStage deadline completedAt submission.submittedAt")
      .lean();
    const leaderboard = groups.map((group) => {
      const groupTasks = tasks.filter((task) => group.userIds.includes(String(task.assignedTo)));
      const delivered = groupTasks.filter((task) => Boolean(task.submission?.submittedAt));
      const accepted = groupTasks.filter((task) => task.workflowStage === TaskWorkflowStage.COMPLETED);
      const overdue = groupTasks.filter((task) => task.workflowStage === TaskWorkflowStage.ASSIGNED && new Date(task.deadline).getTime() < Date.now());
      const onTime = delivered.filter((task) => {
        const deliveredAt = task.submission?.submittedAt ?? task.completedAt;
        return deliveredAt && new Date(deliveredAt).getTime() <= new Date(task.deadline).getTime();
      });
      const completionRate = groupTasks.length ? Math.round(delivered.length / groupTasks.length * 100) : 0;
      const onTimeRate = delivered.length ? Math.round(onTime.length / delivered.length * 100) : 0;
      const acceptanceRate = groupTasks.length ? Math.round(accepted.length / groupTasks.length * 100) : 0;
      return {
        key: group.key,
        label: group.label,
        subtitle: group.subtitle,
        profileUserId: group.profileUserId ?? null,
        total: groupTasks.length,
        delivered: delivered.length,
        accepted: accepted.length,
        overdue: overdue.length,
        completionRate,
        onTimeRate,
        score: Math.round(completionRate * 0.45 + onTimeRate * 0.35 + acceptanceRate * 0.2),
      };
    }).sort((left, right) => right.score - left.score || right.delivered - left.delivered);

    return res.json({ success: true, scope, leaderboard });
  } catch (error) {
    next(error);
  }
}

export async function getHierarchyProgress(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actorId = req.authUser!._id;
    const access = await resolveOrganizationAccess(actorId, requestRoles(req), hasCompanyFeatureGrant(req, Permission.TASK_REPORT_READ));
    const departmentFilter = requestedDepartmentFilter(access, req.query.department);
    const parentFilter = { parentTaskId: null, ...workflowScopeFilter(access, actorId), ...departmentFilter };

    const parents = await Task.find(parentFilter)
      .select("title department workflowStage status completedAt deadline")
      .sort({ createdAt: -1 })
      .lean();
    const parentIds = parents.map((task) => task._id);
    const subtasks = await Task.find({ parentTaskId: { $in: parentIds }, ...contributionScopeFilter(access), ...departmentFilter })
      .select("title assignedTo parentTaskId workflowStage status completedAt submission.submittedAt")
      .populate("assignedTo", "name email roles")
      .lean() as any[];
    const reports = await TaskDailyReport.find({
      taskId: { $in: subtasks.map((task) => task._id) },
    })
      .sort({ reportDate: -1, updatedAt: -1 })
      .lean();
    const latestReportByTask = new Map<string, (typeof reports)[number]>();
    for (const report of reports) {
      const taskId = String(report.taskId);
      if (!latestReportByTask.has(taskId)) latestReportByTask.set(taskId, report);
    }

    const packages = parents.map((parent) => {
      const workItems = subtasks
        .filter((task) => String(task.parentTaskId) === String(parent._id))
        .map((task) => {
          const report = latestReportByTask.get(String(task._id));
          const accepted = taskProgressPercent(task) === 100;
          const submitted = task.workflowStage === TaskWorkflowStage.SUBMITTED;
          const progress = taskProgressPercent(task, report?.progress);
          return {
            taskId: task._id,
            title: task.title,
            assignee: task.assignedTo,
            progress: accepted || submitted ? 100 : progress,
            report: report
              ? {
                  summary: report.summary,
                  progress: accepted || submitted ? 100 : report.progress,
                  reportDate: report.reportDate,
                  updatedAt: report.updatedAt,
                }
              : null,
            stage: task.workflowStage,
            submitted,
            accepted,
          };
        });
      const progress = workItems.length
        ? Math.round(workItems.reduce((sum, item) => sum + item.progress, 0) / workItems.length)
        : 0;
      const parentProgress = taskProgressPercent(parent, progress);
      return {
        taskId: parent._id,
        title: parent.title,
        department: parent.department,
        stage: parent.workflowStage,
        deadline: parent.deadline,
        progress: parentProgress,
        totalWorkItems: workItems.length,
        reportedWorkItems: workItems.filter((item) => item.report).length,
        submittedWorkItems: workItems.filter((item) => item.submitted).length,
        acceptedWorkItems: workItems.filter((item) => item.accepted).length,
        workItems,
      };
    });
    return res.json({ success: true, packages });
  } catch (error) {
    next(error);
  }
}
