import { LeaveRequest, LeaveStatus, OrganizationAssignment } from "../../models/index.js";
import { LeavePolicy } from "../../models/leave-policy.models.js";
import type { Types } from "mongoose";

export function countLeaveDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.toISOString().slice(0, 10) !== startDate || end.toISOString().slice(0, 10) !== endDate) return NaN;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export async function departmentLeaveBalances(userId: Types.ObjectId, year = new Date().getUTCFullYear()) {
  const assignmentQuery = OrganizationAssignment.findOne({ userId, active: true }).select("department");
  const assignment = await assignmentQuery.lean();
  if (!assignment) return null;
  const policyQuery = LeavePolicy.findOne({ department: assignment.department });
  const policy = await policyQuery.lean();
  if (!policy) return null;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const requestsQuery = LeaveRequest.find({ userId, status: { $in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] }, startDate: { $lte: end }, endDate: { $gte: start } });
  const requests = await requestsQuery.lean();
  const used = { earned: 0, sick: 0, casual: 0 };
  for (const request of requests) {
    const key = request.type.toLowerCase() as keyof typeof used;
    used[key] += countLeaveDays(request.startDate > start ? request.startDate : start, request.endDate < end ? request.endDate : end);
  }
  return { earned: Math.max(0, policy.earned - used.earned), earnedTotal: policy.earned, sick: Math.max(0, policy.sick - used.sick), sickTotal: policy.sick, casual: Math.max(0, policy.casual - used.casual), casualTotal: policy.casual };
}