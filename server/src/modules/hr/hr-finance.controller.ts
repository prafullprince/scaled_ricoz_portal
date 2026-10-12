import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  Company,
  EmployeeSalaryProfile,
  OrganizationAssignment,
  OrganizationLevel,
  PayrollAdjustment,
  Payslip,
  User,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { currentScope } from "../company/company.context.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { requestRoles } from "../organization/organization.roles.js";
import { hrOperationalAccess } from "./hr.controller.js";
import type {
  payrollAdjustmentSchema,
  payslipGenerationSchema,
  salaryStructureSchema,
} from "./hr-finance.validation.js";
import {
  calculateMonthlyPayslip,
  renderPayslipPdf,
  salaryStructureForPayPeriod,
} from "./hr-finance.payslip.js";

const maximumPayslipSize = 10 * 1024 * 1024;
const workerRoles = [UserRole.EMPLOYEE, UserRole.INTERN];

function workerRoleFromRoles(roles: readonly string[]) {
  if (roles.includes(UserRole.INTERN)) return UserRole.INTERN;
  if (roles.includes(UserRole.EMPLOYEE)) return UserRole.EMPLOYEE;
  return null;
}

function workerRoleFromAssignment(assignment: {
  employmentType?: string | null;
  roleKeys?: readonly string[];
} | null | undefined) {
  if (!assignment) return null;
  if (assignment.employmentType === UserRole.INTERN || assignment.roleKeys?.includes(UserRole.INTERN)) {
    return UserRole.INTERN;
  }
  if (assignment.employmentType === UserRole.EMPLOYEE || assignment.roleKeys?.includes(UserRole.EMPLOYEE)) {
    return UserRole.EMPLOYEE;
  }
  return null;
}

function financeRoleFromAssignment(
  assignment: {
    level?: string;
    department?: string;
    employmentType?: string | null;
    roleKeys?: readonly string[];
  } | null | undefined,
  accountRole: string | null,
) {
  if (!assignment) return accountRole;
  if (assignment.level === OrganizationLevel.CEO) return UserRole.CEO;
  if (assignment.level === OrganizationLevel.HR) return UserRole.HR;
  if (assignment.level === OrganizationLevel.HEAD) {
    return assignment.roleKeys?.find((role) => role.endsWith("_HEAD"))
      ?? (assignment.department ? `${assignment.department}_HEAD` : UserRole.HEAD);
  }
  if (assignment.level === OrganizationLevel.MANAGER) {
    return assignment.roleKeys?.find((role) => role.endsWith("_MANAGER"))
      ?? (assignment.department ? `${assignment.department}_MANAGER` : UserRole.MANAGER);
  }
  if (assignment.level === OrganizationLevel.MEMBER) {
    return workerRoleFromAssignment(assignment) ?? accountRole ?? OrganizationLevel.MEMBER;
  }
  return workerRoleFromAssignment(assignment)
    ?? accountRole
    ?? assignment.roleKeys?.find((role) => !role.startsWith("custom:"))
    ?? assignment.level
    ?? null;
}

function homeCompanyFilter() {
  const scope = currentScope();
  if (!scope) throw new ApiError(500, "An active company scope is required");
  return scope.isDefault ? { $in: [null, scope.companyId] } : scope.companyId;
}

export async function authorizeFinanceManager(req: Request) {
  const access = await hrOperationalAccess(req.authUser!._id, requestRoles(req));
  if (!access.executive && access.assignment.department !== "HR") {
    throw new ApiError(403, "HR finance access is required");
  }
}

async function authorizeSelfService(req: Request) {
  if (!requestRoles(req).some((role) => workerRoles.includes(role))) {
    throw new ApiError(403, "Employee payslip access is required");
  }
  const placement = await OrganizationAssignment.findOne({
    userId: req.authUser!._id,
    active: true,
  }).select("_id").lean();
  if (!placement) throw new ApiError(403, "An active company assignment is required");
}

function objectIdParam(value: string | string[] | undefined, label: string) {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || !Types.ObjectId.isValid(id)) throw new ApiError(404, `${label} not found`);
  return new Types.ObjectId(id);
}

export async function findEmployee(employeeId: string | string[] | undefined) {
  const id = objectIdParam(employeeId, "Employee");
  const placement = await OrganizationAssignment.findOne({ userId: id, active: true })
    .select("department employmentType roleKeys")
    .lean();
  const user = await User.findOne({
    _id: id,
    status: UserStatus.ACTIVE,
    $or: [
      { companyId: homeCompanyFilter(), roles: { $in: workerRoles } },
      ...(placement ? [{ _id: id }] : []),
    ],
  }).select("name email roles status").lean();
  const role = user && financeRoleFromAssignment(placement, workerRoleFromRoles(user.roles));
  if (!user || !role) throw new ApiError(404, "Employee not found");
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role,
    department: placement?.department ?? null,
  };
}

function payslipMetadata(payslip: {
  _id: Types.ObjectId;
  payPeriod: string;
  currency: string;
  fileName: string;
  fileSize: number;
  publishedAt: Date;
}) {
  return {
    id: String(payslip._id),
    payPeriod: payslip.payPeriod,
    currency: payslip.currency,
    fileName: payslip.fileName,
    fileSize: payslip.fileSize,
    publishedAt: payslip.publishedAt,
  };
}

function sendPayslipFile(res: Response, file: { fileName: string; fileData?: Buffer }) {
  if (!Buffer.isBuffer(file.fileData) || !file.fileData.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new ApiError(404, "Payslip PDF file not found or invalid");
  }
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    "Content-Type": "application/pdf",
    "X-Content-Type-Options": "nosniff",
  });
  return res.send(file.fileData);
}

export async function listFinanceEmployees(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeFinanceManager(req);
    const assignments = await OrganizationAssignment.find({ active: true })
      .select("userId department level employmentType roleKeys")
      .lean();
    const assignmentByUser = new Map(assignments.map((item) => [String(item.userId), item]));
    const assignedUserIds = [...assignmentByUser.keys()];
    const users = await User.find({
      status: UserStatus.ACTIVE,
      $or: [
        { companyId: homeCompanyFilter(), roles: { $in: workerRoles } },
        { _id: { $in: assignedUserIds } },
      ],
    }).select("name email roles").sort({ name: 1 }).lean();
    const financeUsers = users.flatMap((user) => {
      const role = financeRoleFromAssignment(
        assignmentByUser.get(String(user._id)),
        workerRoleFromRoles(user.roles),
      );
      return role ? [{ user, role }] : [];
    });
    const employeeIds = financeUsers.map(({ user }) => user._id);
    const profiles = employeeIds.length
      ? await EmployeeSalaryProfile.find({ employeeId: { $in: employeeIds } })
        .select("employeeId effectiveFrom currency components")
        .lean()
      : [];
    const profileByUser = new Map(profiles.map((profile) => [String(profile.employeeId), profile]));
    return res.json({
      success: true,
      employees: financeUsers.map(({ user, role }) => {
        const placement = assignmentByUser.get(String(user._id));
        const profile = profileByUser.get(String(user._id));
        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role,
          department: placement?.department ?? null,
          salaryStructure: profile ? {
            effectiveFrom: profile.effectiveFrom,
            currency: profile.currency,
            components: profile.components,
          } : null,
        };
      }),
    });
  } catch (error) { next(error); }
}

export async function getEmployeeFinance(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeFinanceManager(req);
    const employee = await findEmployee(req.params.employeeId);
    const employeeId = new Types.ObjectId(employee.id);
    const [profile, adjustments, payslips] = await Promise.all([
      EmployeeSalaryProfile.findOne({ employeeId }).lean(),
      PayrollAdjustment.find({ employeeId }).sort({ payPeriod: -1, createdAt: -1 }).lean(),
      Payslip.find({ employeeId })
        .select("payPeriod currency fileName fileSize publishedAt")
        .sort({ payPeriod: -1 })
        .lean(),
    ]);
    return res.json({
      success: true,
      employee,
      salaryStructure: profile ? {
        effectiveFrom: profile.effectiveFrom,
        currency: profile.currency,
        components: profile.components,
      } : null,
      revisionHistory: profile?.history.map((revision) => ({
        id: String(revision._id),
        effectiveFrom: revision.effectiveFrom,
        currency: revision.currency,
        components: revision.components,
        reason: revision.reason,
        changedAt: revision.changedAt,
      })) ?? [],
      adjustments: adjustments.map((adjustment) => ({
        id: String(adjustment._id),
        type: adjustment.type,
        label: adjustment.label,
        amount: adjustment.amount,
        currency: adjustment.currency,
        payPeriod: adjustment.payPeriod,
        note: adjustment.note ?? "",
        createdAt: adjustment.createdAt,
      })),
      payslips: payslips.map(payslipMetadata),
    });
  } catch (error) { next(error); }
}

export async function saveSalaryStructure(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeFinanceManager(req);
    const employee = await findEmployee(req.params.employeeId);
    const input = req.body as typeof salaryStructureSchema._output.body;
    const snapshot = {
      effectiveFrom: input.effectiveFrom,
      currency: input.currency,
      components: input.components,
      reason: input.reason ?? "",
      changedBy: req.authUser!._id,
      changedAt: new Date(),
    };
    const profile = await EmployeeSalaryProfile.findOneAndUpdate(
      { employeeId: new Types.ObjectId(employee.id) },
      {
        $set: {
          effectiveFrom: snapshot.effectiveFrom,
          currency: snapshot.currency,
          components: snapshot.components,
        },
        $push: { history: snapshot },
      },
      { new: true, upsert: true, runValidators: true },
    ).lean();
    if (!profile) throw new ApiError(500, "Unable to save the salary structure");
    return res.json({
      success: true,
      salaryStructure: {
        effectiveFrom: profile.effectiveFrom,
        currency: profile.currency,
        components: profile.components,
      },
      revisionHistory: profile.history.map((revision) => ({
        id: String(revision._id),
        effectiveFrom: revision.effectiveFrom,
        currency: revision.currency,
        components: revision.components,
        reason: revision.reason,
        changedAt: revision.changedAt,
      })),
    });
  } catch (error) { next(error); }
}

export async function createPayrollAdjustment(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeFinanceManager(req);
    const employee = await findEmployee(req.params.employeeId);
    const input = req.body as typeof payrollAdjustmentSchema._output.body;
    const salaryProfile = await EmployeeSalaryProfile.findOne({
      employeeId: new Types.ObjectId(employee.id),
    }).select("currency").lean();
    if (!salaryProfile) throw new ApiError(409, "Save a salary structure before adding payroll adjustments");
    if (salaryProfile.currency !== input.currency) {
      throw new ApiError(400, "Payroll adjustments must use the salary structure currency");
    }
    const adjustment = await PayrollAdjustment.create({
      type: input.type,
      label: input.label,
      amount: input.amount,
      currency: input.currency,
      payPeriod: input.payPeriod,
      ...(input.note === undefined ? {} : { note: input.note }),
      employeeId: new Types.ObjectId(employee.id),
      createdBy: req.authUser!._id,
    });
    return res.status(201).json({
      success: true,
      adjustment: {
        id: String(adjustment._id),
        type: adjustment.type,
        label: adjustment.label,
        amount: adjustment.amount,
        currency: adjustment.currency,
        payPeriod: adjustment.payPeriod,
        note: adjustment.note ?? "",
        createdAt: adjustment.createdAt,
      },
    });
  } catch (error) { next(error); }
}

export async function generatePayslip(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeFinanceManager(req);
    const employee = await findEmployee(req.params.employeeId);
    const input = req.body as typeof payslipGenerationSchema._output.body;
    const scope = currentScope();
    if (!scope) throw new ApiError(500, "An active company scope is required");
    const employeeId = new Types.ObjectId(employee.id);
    const [salaryProfile, adjustments, company] = await Promise.all([
      EmployeeSalaryProfile.findOne({ employeeId }).lean(),
      PayrollAdjustment.find({ employeeId, payPeriod: input.payPeriod })
        .sort({ createdAt: 1 })
        .lean(),
      Company.findById(scope.companyId).select("name").lean(),
    ]);
    if (!salaryProfile) throw new ApiError(409, "Save a salary structure before generating a payslip");
    if (!company) throw new ApiError(404, "Active company not found");

    const salaryStructure = salaryStructureForPayPeriod(salaryProfile, input.payPeriod);
    if (!salaryStructure) {
      throw new ApiError(409, "No salary structure was effective on the first day of this pay period");
    }
    if (adjustments.some((adjustment) => adjustment.currency !== salaryStructure.currency)) {
      throw new ApiError(409, "All adjustments for this pay period must use the active salary structure currency");
    }

    const amounts = calculateMonthlyPayslip(salaryStructure.components, adjustments);
    const fileData = await renderPayslipPdf({
      companyName: company.name,
      employeeName: employee.name,
      employeeEmail: employee.email,
      employeeRole: employee.role,
      department: employee.department,
      payPeriod: input.payPeriod,
      currency: salaryStructure.currency,
      salaryEffectiveFrom: salaryStructure.effectiveFrom,
      ...amounts,
    });
    if (fileData.length > maximumPayslipSize) throw new ApiError(413, "Generated payslip exceeds the 10 MB file limit");

    const safeName = employee.name.normalize("NFKD")
      .replace(/[^\p{L}\p{N}-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "employee";
    const fileName = `payslip-${safeName}-${input.payPeriod}.pdf`;
    const payslip = await Payslip.findOneAndUpdate(
      { employeeId, payPeriod: input.payPeriod },
      {
        $set: {
          currency: salaryStructure.currency,
          fileName,
          fileSize: fileData.length,
          fileData,
          uploadedBy: req.authUser!._id,
          publishedAt: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true },
    ).select("payPeriod currency fileName fileSize publishedAt").lean();
    if (!payslip) throw new ApiError(500, "Unable to generate and publish the payslip");
    return res.status(201).json({ success: true, payslip: payslipMetadata(payslip) });
  } catch (error) { next(error); }
}

export async function downloadHrPayslip(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeFinanceManager(req);
    const payslipId = objectIdParam(req.params.payslipId, "Payslip");
    const payslip = await Payslip.findById(payslipId).select("+fileData").exec();
    if (!payslip) throw new ApiError(404, "Payslip not found");
    return sendPayslipFile(res, payslip);
  } catch (error) { next(error); }
}

export async function listMyPayslips(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeSelfService(req);
    const payslips = await Payslip.find({
      employeeId: req.authUser!._id,
      publishedAt: { $lte: new Date() },
    }).select("payPeriod currency fileName fileSize publishedAt").sort({ payPeriod: -1 }).lean();
    return res.json({ success: true, payslips: payslips.map(payslipMetadata) });
  } catch (error) { next(error); }
}

export async function downloadMyPayslip(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeSelfService(req);
    const payslipId = objectIdParam(req.params.payslipId, "Payslip");
    const payslip = await Payslip.findOne({
      _id: payslipId,
      employeeId: req.authUser!._id,
      publishedAt: { $lte: new Date() },
    }).select("+fileData").exec();
    if (!payslip) throw new ApiError(404, "Payslip not found");
    return sendPayslipFile(res, payslip);
  } catch (error) { next(error); }
}
