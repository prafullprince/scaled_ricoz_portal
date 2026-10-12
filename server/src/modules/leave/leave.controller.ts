import type { NextFunction, Request, Response } from "express";
import {
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  WorkspaceData,
} from "../../models/index.js";
import { UserRole } from "../auth/authorization.js";
import { LeavePolicy } from "../../models/leave-policy.models.js";
import { countLeaveDays, departmentLeaveBalances } from "./leave-policy.service.js";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../utils/apiError.utils.js";
import { requestRoles } from "../organization/organization.roles.js";

function view(request: any) {
  return {
    id: String(request._id),
    type: request.type,
    startDate: request.startDate,
    endDate: request.endDate,
    days: request.days,
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
  };
}

export async function listLeave(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const isAdmin = requestRoles(req).includes(UserRole.ADMIN) && req.query.scope !== "self";
    const requests = await LeaveRequest.find(
      isAdmin ? {} : { userId: req.authUser!._id },
    )
      .sort({ createdAt: -1 })
      .lean();
    const workspace = isAdmin
      ? null
      : await WorkspaceData.findOne({ userId: req.authUser!._id }).lean();
    return res.json({
      success: true,
      leave: {
        requests: requests.map(view),
        balances: workspace?.leaveBalances ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createLeave(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const days = countLeaveDays(req.body.startDate, req.body.endDate);
    if (!Number.isFinite(days) || days < 1 || req.body.startDate.slice(0, 4) !== req.body.endDate.slice(0, 4))
      return res
        .status(400)
        .json({
          success: false,
          message: "Use valid dates in the same calendar year, with end date on or after start date",
        });
    const token = randomUUID();
    let workspace;
    try {
      workspace = await WorkspaceData.findOneAndUpdate({ userId: req.authUser!._id, $or: [{ leaveLockToken: null }, { leaveLockUntil: { $lte: new Date() } }] }, { $set: { leaveLockToken: token, leaveLockUntil: new Date(Date.now() + 60000) } }, { upsert: true, new: true, maxTimeMS: 10000 });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ApiError(409, "Another leave request is being submitted. Please retry shortly.");
      throw error;
    }
    try {
    const overlapping = await LeaveRequest.exists({
      userId: req.authUser!._id,
      status: { $in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      startDate: { $lte: req.body.endDate },
      endDate: { $gte: req.body.startDate },
    });
    if (overlapping)
      throw new ApiError(409, "This leave overlaps an existing request");
    const balances = await departmentLeaveBalances(req.authUser!._id, Number(req.body.startDate.slice(0, 4))) ?? workspace?.leaveBalances;
    const balanceKey =
      req.body.type === "EARNED"
        ? "earned"
        : req.body.type === "SICK"
          ? "sick"
          : "casual";
    const available = balances?.[balanceKey] ?? null;
    if (available !== null && days > available)
      throw new ApiError(400, `Only ${available} ${req.body.type.toLowerCase()} leave day${available === 1 ? "" : "s"} remaining`);
    const lease = await WorkspaceData.updateOne({ userId: req.authUser!._id, leaveLockToken: token, leaveLockUntil: { $gt: new Date() } }, { $set: { leaveLockUntil: new Date(Date.now() + 60000) } });
    if (!lease.matchedCount) throw new ApiError(409, "Submission expired. Please retry.");
    const request = await LeaveRequest.create({
      userId: req.authUser!._id,
      type: req.body.type as LeaveType,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      days,
      reason: req.body.reason,
    });
    return res.status(201).json({ success: true, request: view(request) });
    } finally {
      await WorkspaceData.updateOne({ userId: req.authUser!._id, leaveLockToken: token }, { $set: { leaveLockToken: null, leaveLockUntil: null } });
    }
  } catch (error) {
    next(error);
  }
}

export async function listLeavePolicies(_req: Request, res: Response, next: NextFunction) {
  try { return res.json({ success: true, policies: await LeavePolicy.find().sort({ department: 1 }).lean() }); } catch (error) { next(error); }
}

export async function saveLeavePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const { department, earned, sick, casual } = req.body;
    const policy = await LeavePolicy.findOneAndUpdate({ department }, { $set: { earned, sick, casual, updatedBy: req.authUser!._id } }, { new: true, upsert: true, runValidators: true });
    return res.json({ success: true, policy });
  } catch (error) { next(error); }
}

export async function getLeaveAllowance(req: Request, res: Response, next: NextFunction) {
  try {
    const balances = await departmentLeaveBalances(req.authUser!._id);
    return res.json({ success: true, balances });
  } catch (error) { next(error); }
}
