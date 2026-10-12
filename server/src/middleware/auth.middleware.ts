import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { IUserPayload } from "../types/http/index.js";
import { User } from "../models/index.js";
import { hasPermission, normalizeRoles, UserStatus, type Permission, UserRole } from "../modules/auth/authorization.js";
import { expireWorkRoles } from "../modules/recruitment/role-expiry.service.js";
import { isOrganizationExecutive } from "../modules/organization/organization.access.js";
import { runWithCompany } from "../modules/company/company.context.js";
import { resolveUserCompany } from "../modules/company/company.service.js";
import { companyPermissionMatchesRoleGate, resolveCompanyRoleContext } from "../modules/organization/organization.roles.js";

// Auth Middleware
export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Header is missing",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token is missing",
      });
    }

    // verify token
    const decode = jwt.verify(token, process.env.JWT_ACCESS_SECRET!);
    if (!decode) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const payload = decode as IUserPayload;
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(403).json({ success: false, message: "Account is not authorized" });
    }
    const isVerified = Boolean(user.emailVerifiedAt ?? user.emailVerified);
    const isActive = !user.status || user.status === UserStatus.ACTIVE;
    if (!isActive || !isVerified) {
      return res.status(403).json({ success: false, message: "Account is not authorized" });
    }
    user.roles = normalizeRoles(user.roles);
    await expireWorkRoles(user);
    if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
    if (!user.status) user.status = UserStatus.ACTIVE;
    req.user = payload;
    req.authUser = user;
    const { scope, company } = await resolveUserCompany(user, req.headers["x-company-id"]);
    req.company = company;
    const roleContext = await runWithCompany(scope, () => resolveCompanyRoleContext(String(user._id), user.roles, user.companyId ? String(user.companyId) : null));
    req.companyRoles = roleContext.roles;
    req.companyPermissions = roleContext.permissions;
    req.companyPermissionRoles = roleContext.permissionRoles;
    runWithCompany(scope, next);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
};

export const requireSystemAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.authUser?.roles.includes(UserRole.ADMIN)) {
    return res.status(403).json({ success: false, message: "System administrator access is required" });
  }
  next();
};

export const requireRole = (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const effectiveRoles = req.companyRoles ?? req.authUser?.roles ?? [];
    if (!req.authUser || (!isOrganizationExecutive(effectiveRoles) && !roles.some((role) => effectiveRoles.includes(role)) && !companyPermissionMatchesRoleGate(req, roles))) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };

export const requirePermission = (permission: Permission) =>
  (req: Request, res: Response, next: NextFunction) => {
    const effectiveRoles = req.companyRoles ?? req.authUser?.roles ?? [];
    if (!req.authUser || (!hasPermission({ roles: (req.companyPermissionRoles ?? effectiveRoles) as UserRole[] }, permission) && !req.companyPermissions?.includes(permission))) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
