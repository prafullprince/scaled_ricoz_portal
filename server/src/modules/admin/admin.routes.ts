import { Router } from "express";
import {
  auth,
  requirePermission,
  requireSystemAdmin,
} from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission } from "../auth/authorization.js";
import { assignHrCompany, designateHr, listHrCandidates, listPromotableUsers, listSystemHr, promoteUser, removeHrCompany, removeHrDesignation, setHrActive } from "./admin.controller.js";
import { designateHrSchema, hrCompanyParamSchema, hrCompanySchema, hrUserParamSchema, promoteUserSchema, updateHrStatusSchema } from "./admin.validation.js";
import { listFeatureCatalog, updateHrCompanyPermissions } from "./admin.controller.js";
import { hrCompanyPermissionsSchema } from "./admin.validation.js";
import { userAccessDetails, updateAccountRoles } from "./admin.controller.js";
import { updateAccountRolesSchema } from "./admin.validation.js";
import { governanceOverview } from "./admin.controller.js";
import { isOrganizationExecutive } from "../organization/organization.access.js";
import { isHrStructureAdmin } from "../organization/organization.controller.js";
import { requestRoles } from "../organization/organization.roles.js";
import { assignOnboardingRole, listOnboardingUsers, reviewOnboardingUser } from "./admin.controller.js";
import { assignOnboardingRoleSchema, reviewOnboardingSchema } from "./admin.validation.js";

const router = Router();
const adminOnly = [
  auth,
  requireSystemAdmin,
  requirePermission(Permission.EMPLOYEE_INTERNAL_ACCESS),
];
const onboardingReviewer = async (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  try {
    const roles = requestRoles(req);
    if (isOrganizationExecutive(roles) || (req.authUser && await isHrStructureAdmin(req.authUser._id, roles))) return next();
    return res.status(403).json({ success: false, message: "Only CEO, Admin, or authorized HR can review onboarding" });
  } catch (error) { next(error); }
};

router.get("/users", ...adminOnly, listPromotableUsers, errorHandler);
router.get("/onboarding", auth, onboardingReviewer, listOnboardingUsers, errorHandler);
router.patch("/onboarding/:userId/review", auth, onboardingReviewer, validateRequest(reviewOnboardingSchema), reviewOnboardingUser, errorHandler);
router.patch("/onboarding/:userId/role", auth, onboardingReviewer, validateRequest(assignOnboardingRoleSchema), assignOnboardingRole, errorHandler);
router.get("/features", ...adminOnly, listFeatureCatalog);
router.get("/overview", ...adminOnly, governanceOverview, errorHandler);
router.get("/users/:userId/access", ...adminOnly, validateRequest(hrUserParamSchema), userAccessDetails, errorHandler);
router.patch("/users/:userId/roles", ...adminOnly, validateRequest(updateAccountRolesSchema), updateAccountRoles, errorHandler);
router.patch("/hr/:userId/companies/:companyId/permissions", ...adminOnly, validateRequest(hrCompanyPermissionsSchema), updateHrCompanyPermissions, errorHandler);
router.get("/hr", ...adminOnly, listSystemHr, errorHandler);
router.get("/hr/candidates", ...adminOnly, listHrCandidates, errorHandler);
router.post("/hr", ...adminOnly, validateRequest(designateHrSchema), designateHr, errorHandler);
router.patch("/hr/:userId", ...adminOnly, validateRequest(updateHrStatusSchema), setHrActive, errorHandler);
router.post("/hr/:userId/companies", ...adminOnly, validateRequest(hrCompanySchema), assignHrCompany, errorHandler);
router.delete("/hr/:userId/companies/:companyId", ...adminOnly, validateRequest(hrCompanyParamSchema), removeHrCompany, errorHandler);
router.delete("/hr/:userId", ...adminOnly, validateRequest(hrUserParamSchema), removeHrDesignation, errorHandler);
router.post(
  "/users/promote",
  ...adminOnly,
  validateRequest(promoteUserSchema),
  promoteUser,
  errorHandler,
);

export default router;
