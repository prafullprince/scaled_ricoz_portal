import { Router } from "express";
import { auth, requirePermission, requireRole } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { getMyInternRole, updateMyInternRole } from "./intern.controller.js";
import { updateInternRoleSchema } from "./intern.validation.js";
import { getInternDashboard } from "./intern.dashboard.controller.js";

const router = Router();

router.get("/dashboard", auth, requireRole(UserRole.INTERN), requirePermission(Permission.INTERN_READ), getInternDashboard, errorHandler);

router.get(
  "/role",
  auth,
  requireRole(UserRole.INTERN),
  requirePermission(Permission.INTERN_READ),
  getMyInternRole,
  errorHandler,
);
router.patch(
  "/role",
  auth,
  requireRole(UserRole.INTERN),
  requirePermission(Permission.PROFILE_UPDATE),
  validateRequest(updateInternRoleSchema),
  updateMyInternRole,
  errorHandler,
);
export default router;
