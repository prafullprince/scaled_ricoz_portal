import type { IUser } from "../../models/user.models.js";
import { EmployeeProfile, InternProfile, User } from "../../models/index.js";
import { UserRole } from "../auth/authorization.js";

/** Removes expired work roles while preserving the account's other roles. */
export async function expireWorkRoles(user: IUser) {
  const now = new Date();
  const [internProfile, employeeProfile] = await Promise.all([
    user.roles.includes(UserRole.INTERN) ? InternProfile.findOne({ userId: user._id }) : null,
    user.roles.includes(UserRole.EMPLOYEE) ? EmployeeProfile.findOne({ userId: user._id }) : null,
  ]);
  const expiredIntern = Boolean(internProfile?.endDate && internProfile.endDate <= now);
  const expiredEmployee = Boolean(employeeProfile?.endDate && employeeProfile.endDate <= now);
  if (!expiredIntern && !expiredEmployee) return user;

  const roles = user.roles.filter((role) => !(expiredIntern && role === UserRole.INTERN) && !(expiredEmployee && role === UserRole.EMPLOYEE));
  if (!roles.includes(UserRole.USER)) roles.push(UserRole.USER);
  user.roles = Array.from(new Set(roles));
  await User.updateOne({ _id: user._id }, { $set: { roles: user.roles } });
  return user;
}

export async function expireAllWorkRoles() {
  const now = new Date();
  const [expiredInterns, expiredEmployees] = await Promise.all([
    InternProfile.find({ endDate: { $lte: now } }).select("userId"),
    EmployeeProfile.find({ endDate: { $lte: now } }).select("userId"),
  ]);

  await Promise.all([
    ...expiredInterns.map((profile) => removeExpiredRole(profile.userId, UserRole.INTERN)),
    ...expiredEmployees.map((profile) => removeExpiredRole(profile.userId, UserRole.EMPLOYEE)),
  ]);
}

async function removeExpiredRole(userId: IUser["_id"], role: UserRole) {
  const user = await User.findById(userId);
  if (!user) return;
  user.roles = Array.from(new Set([...user.roles.filter((value) => value !== role), UserRole.USER]));
  await user.save();
}