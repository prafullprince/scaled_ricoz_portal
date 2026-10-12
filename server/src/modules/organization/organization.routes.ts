import { Router, type RequestHandler } from "express";
import {
  auth,
  requirePermission,
  requireRole,
} from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { hasPermission, Permission, UserRole } from "../auth/authorization.js";
import { isOrganizationExecutive } from "./organization.access.js";
import { requestRoles } from "./organization.roles.js";
import { isHrStructureAdmin } from "./organization.controller.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import {
  assignOrganizationSchema,
  createOrganizationRoleSchema,
  confirmOrganizationRemovalSchema,
  deleteOrganizationRoleSchema,
  reportingOptionsSchema,
  requestOrganizationRemovalSchema,
  updateOrganizationRoleSchema,
} from "./organization.validation.js";
import {
  assignOrganization,
  createOrganizationRoleTemplate,
  createOrganizationRole,
  confirmOrganizationRemoval,
  deleteOrganizationRole,
  getOrganizationProfile,
  listOrganization,
  listOrganizationUsers,
  listReportingOptions,
  listOrganizationRoles,
  requestOrganizationRemoval,
  updateOrganizationRole,
} from "./organization.controller.js";

const router = Router();
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
export const organizationManager = (...allowedRoles: UserRole[]): RequestHandler => async (req, res, next) => {
  try {
    if (!req.authUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const roles = requestRoles(req);
    if (isOrganizationExecutive(roles) || await isHrStructureAdmin(req.authUser._id, roles)) return next();
    const hasRole = allowedRoles.some((role) => roles.includes(role));
    if (hasRole && (hasPermission({ roles: (req.companyPermissionRoles ?? roles) as UserRole[] }, Permission.EMPLOYEE_INTERNAL_ACCESS) || req.companyPermissions?.includes(Permission.EMPLOYEE_INTERNAL_ACCESS))) return next();
    return res.status(403).json({ success: false, message: "Forbidden" });
  } catch (error) { next(error); }
};
router.get("/roles", auth, organizationManager(UserRole.ADMIN, UserRole.CEO), listOrganizationRoles, errorHandler);
router.post("/roles/templates", auth, organizationManager(UserRole.ADMIN, UserRole.CEO), validateRequest(createOrganizationRoleSchema), createOrganizationRoleTemplate, errorHandler);
router.post("/roles", auth, organizationManager(UserRole.ADMIN, UserRole.CEO), validateRequest(createOrganizationRoleSchema), createOrganizationRole, errorHandler);
router.put("/roles/:roleSlug", auth, organizationManager(UserRole.ADMIN, UserRole.CEO), validateRequest(updateOrganizationRoleSchema), updateOrganizationRole, errorHandler);
router.delete("/roles/:roleSlug", auth, organizationManager(UserRole.ADMIN, UserRole.CEO), validateRequest(deleteOrganizationRoleSchema), deleteOrganizationRole, errorHandler);
router.get(
  "/profiles/:userId",
  auth,
  organizationManager(UserRole.ADMIN, UserRole.CEO, ...headRoles, ...managerRoles),
  getOrganizationProfile,
  errorHandler,
);
router.get(
  "/",
  auth,
  organizationManager(
    UserRole.ADMIN,
    UserRole.CEO,
    UserRole.HEAD,
    ...managerRoles,
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
  ),
  listOrganization,
  errorHandler,
);
router.get(
  "/users",
  auth,
  organizationManager(
    UserRole.ADMIN,
    UserRole.CEO,
    UserRole.HEAD,
    ...managerRoles,
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
  ),
  listOrganizationUsers,
  errorHandler,
);
router.get(
  "/reporting-options",
  auth,
  organizationManager(
    UserRole.ADMIN,
    UserRole.CEO,
    UserRole.HEAD,
    ...managerRoles,
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
  ),
  validateRequest(reportingOptionsSchema),
  listReportingOptions,
  errorHandler,
);
router.post(
  "/assign",
  auth,
  organizationManager(
    UserRole.ADMIN,
    UserRole.CEO,
    UserRole.HEAD,
    ...managerRoles,
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
  ),
  validateRequest(assignOrganizationSchema),
  assignOrganization,
  errorHandler,
);
router.post(
  "/remove/request",
  auth,
  organizationManager(UserRole.ADMIN, UserRole.CEO, ...headRoles, ...managerRoles),
  validateRequest(requestOrganizationRemovalSchema),
  requestOrganizationRemoval,
  errorHandler,
);
router.post(
  "/remove/confirm",
  auth,
  organizationManager(UserRole.ADMIN, UserRole.CEO, ...headRoles, ...managerRoles),
  validateRequest(confirmOrganizationRemovalSchema),
  confirmOrganizationRemoval,
  errorHandler,
);
export default router;
