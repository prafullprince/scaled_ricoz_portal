import type { NextFunction, Request, Response } from "express";
import { hasPermission, type Permission, UserRole } from "../auth/authorization.js";
import { isHrStructureAdmin } from "../organization/organization.controller.js";
import { isOrganizationExecutive } from "../organization/organization.access.js";
import { requestRoles } from "../organization/organization.roles.js";

export const requireRecruitmentAccess = (permission: Permission) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) return res.status(401).json({ success: false, message: "Unauthorized" });
      const roles = requestRoles(req);
      const granted = req.companyPermissions?.includes(permission) ?? false;
      const roleGranted = hasPermission(
        { roles: (req.companyPermissionRoles ?? roles) as UserRole[] },
        permission,
      );
      const companyHr = await isHrStructureAdmin(req.authUser._id, roles);
      const executive =
        isOrganizationExecutive(roles) ||
        isOrganizationExecutive(req.authUser.roles);
      if (!executive && !roleGranted && !granted && !companyHr)
        return res.status(403).json({ success: false, message: "Forbidden" });
      next();
    } catch (error) {
      next(error);
    }
  };
