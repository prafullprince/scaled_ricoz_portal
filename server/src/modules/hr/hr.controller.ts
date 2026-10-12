import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  Attendance,
  AttendanceStatus,
  Company,
  EmployeeProfile,
  LeaveRequest,
  LeaveStatus,
  Opportunity,
  OpportunityStatus,
  OrganizationAssignment,
  SystemRoleAssignment,
  Task,
  TaskStatus,
  User,
} from "../../models/index.js";
import { SYSTEM_ROLE_HR, SYSTEM_ROLE_TYPE } from "../../models/organization-control.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { UserStatus } from "../auth/authorization.js";
import { runWithCompany } from "../company/company.context.js";
import { streamAssistant } from "../assistant/assistant.service.js";
import { resolveOrganizationAccess, type OrganizationAccess } from "../organization/organization.access.js";
import { requestRoles } from "../organization/organization.roles.js";

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

export async function listAssignedHrCompanies(req: Request, res: Response, next: NextFunction) {
  try {
    const hrId = req.authUser!._id;
    const designation = await SystemRoleAssignment.exists({ userId: hrId, roleType: SYSTEM_ROLE_TYPE, systemRole: SYSTEM_ROLE_HR, active: true });
    if (!designation) throw new ApiError(403, "An active system HR designation is required");
    const companies = await runWithCompany(null, async () =>
      await Company.find({ active: true }).select("name slug description industry").sort({ name: 1 }).lean(),
    );
    const companyViews = companies.map((company) => ({
      id: String(company._id),
      name: company.name,
      slug: company.slug,
      description: company.description ?? "",
      industry: company.industry ?? "",
    }));
    return res.json({ success: true, companies: companyViews, assignedCompanyCount: companyViews.length, maxCompanies: companyViews.length });
  } catch (error) { next(error); }
}

export async function hrOperationalAccess(actorId: Types.ObjectId, roles: readonly string[]) {
  const access = await resolveOrganizationAccess(actorId, roles);
  if (access.executive) return access;
  if (access.assignment.department !== "HR" || !["HR", "HEAD", "MANAGER"].includes(access.assignment.level)) throw new ApiError(403, "HR leadership access required");
  const assignments = await OrganizationAssignment.find({ active: true }).select("userId").lean();
  return { ...access, userIds: assignments.map((assignment) => assignment.userId) };
}

async function buildHrSnapshot(actorId: Types.ObjectId, access: OrganizationAccess) {
  const userFilter = access.executive ? {} : { userId: { $in: access.userIds } };
  const today = dayKey(new Date());
  const trendDates = Array.from({ length: 5 }, (_, offset) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (4 - offset));
    return dayKey(date);
  });
  const [employees, profiles, assignments, attendance, leaves, openPositions, tasks] = await Promise.all([
    User.find({ status: UserStatus.ACTIVE, roles: { $in: ["EMPLOYEE", "INTERN"] }, ...(access.executive ? {} : { _id: { $in: access.userIds } }) } as any)
      .select("name email roles status createdAt")
      .sort({ name: 1 })
      .lean(),
    EmployeeProfile.find(userFilter).select("userId department currentRole employmentType joiningDate").lean(),
    OrganizationAssignment.find({ active: true, ...userFilter }).select("userId department level reportsTo").lean(),
    Attendance.find({ date: { $in: trendDates }, ...userFilter }).select("userId date status").lean(),
    LeaveRequest.find(userFilter).populate("userId", "name email roles").sort({ createdAt: -1 }).limit(100).lean(),
    Opportunity.countDocuments({ status: OpportunityStatus.PUBLISHED }),
    Task.find({ assignedTo: actorId }).select("title description deadline priority status workflowStage").sort({ status: 1, deadline: 1 }).limit(100).lean(),
  ]);
  const profileByUser = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  const assignmentByUser = new Map(assignments.map((assignment) => [String(assignment.userId), assignment]));
  const presentToday = new Set(attendance.filter((record) => record.date === today && [AttendanceStatus.PRESENT, AttendanceStatus.LATE].includes(record.status)).map((record) => String(record.userId))).size;
  const departmentCounts = new Map<string, number>();
  for (const employee of employees) {
    const assignment = assignmentByUser.get(String(employee._id));
    const profile = profileByUser.get(String(employee._id));
    const department = assignment?.department ?? profile?.department ?? "UNASSIGNED";
    departmentCounts.set(department, (departmentCounts.get(department) ?? 0) + 1);
  }
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      totalEmployees: employees.length,
      presentToday,
      attendanceRate: employees.length ? Math.round((presentToday / employees.length) * 1000) / 10 : 0,
      pendingLeaveRequests: leaves.filter((leave) => leave.status === LeaveStatus.PENDING).length,
      openPositions,
    },
    attendanceTrend: trendDates.map((date) => ({
      date,
      present: new Set(attendance.filter((record) => record.date === date && [AttendanceStatus.PRESENT, AttendanceStatus.LATE].includes(record.status)).map((record) => String(record.userId))).size,
    })),
    departmentHeadcount: [...departmentCounts.entries()].map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count),
    employees: employees.map((employee) => {
      const profile = profileByUser.get(String(employee._id));
      const assignment = assignmentByUser.get(String(employee._id));
      return {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: profile?.currentRole ?? employee.roles.find((role) => !["EMPLOYEE", "INTERN"].includes(role)) ?? employee.roles[0],
        department: assignment?.department ?? profile?.department ?? null,
        employmentType: profile?.employmentType ?? (employee.roles.includes("INTERN" as any) ? "INTERN" : "EMPLOYEE"),
        joiningDate: profile?.joiningDate ?? employee.createdAt,
        status: employee.status,
      };
    }),
    leaveRequests: leaves.map((leave: any) => ({
      id: leave._id,
      employee: leave.userId ? { id: leave.userId._id, name: leave.userId.name, email: leave.userId.email } : null,
      type: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: leave.days,
      reason: leave.reason,
      status: leave.status,
      createdAt: leave.createdAt,
    })),
    tasks: tasks.map((task) => ({ ...task, effectiveStatus: task.status === TaskStatus.PENDING && new Date(task.deadline).getTime() < Date.now() ? "OVERDUE" : task.status })),
  };
}

export async function getHrDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await hrOperationalAccess(req.authUser!._id, requestRoles(req));
    if (!access.executive && access.assignment.department !== "HR") throw new ApiError(403, "HR department access required");
    return res.json({ success: true, dashboard: await buildHrSnapshot(req.authUser!._id, access) });
  } catch (error) { next(error); }
}

export async function reviewHrLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const requestId = String(req.params.requestId);
    if (!Types.ObjectId.isValid(requestId)) throw new ApiError(400, "Invalid leave request id");
    const access = await hrOperationalAccess(req.authUser!._id, requestRoles(req));
    if (!access.executive && access.assignment.department !== "HR") throw new ApiError(403, "HR department access required");
    const leave = await LeaveRequest.findOneAndUpdate(
      { _id: requestId, status: LeaveStatus.PENDING, userId: { $ne: req.authUser!._id, ...(access.executive ? {} : { $in: access.userIds }) } },
      { $set: { status: req.body.decision, reviewedBy: req.authUser!._id, reviewedAt: new Date() } },
      { new: true },
    ).populate("userId", "name email roles");
    if (!leave) throw new ApiError(409, "Only pending leave requests can be reviewed");
    return res.json({ success: true, leave });
  } catch (error) { next(error); }
}

export async function generateHrAiReport(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await hrOperationalAccess(req.authUser!._id, requestRoles(req));
    if (!access.executive && access.assignment.department !== "HR") throw new ApiError(403, "HR department access required");
    let report = "";
    const roles = requestRoles(req).map(String);
    await streamAssistant(
      { userId: String(req.authUser!._id), email: req.authUser!.email, roles, canReadHr: true, hrVisibleUserIds: access.executive ? null : access.userIds.map(String), marketingScope: "NONE", marketingVisibleUserIds: [] },
      { message: req.body.prompt, sessionId: "hr-reports" },
      (text) => { report += text; },
    );
    return res.json({ success: true, report, generatedBy: process.env.OPENAI_API_KEY ? "openai-agents" : "fallback" });
  } catch (error) { next(error); }
}