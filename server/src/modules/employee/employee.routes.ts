import { Router } from "express";
import { auth, requirePermission, requireRole } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { getMyEmployeeRole, updateMyEmployeeRole } from "./employee.controller.js";
import { getEmployeeDashboard } from "./employee.dashboard.controller.js";
import { updateEmployeeRoleSchema } from "./employee.validation.js";

const router = Router();

router.get("/dashboard", auth, requireRole(UserRole.EMPLOYEE), requirePermission(Permission.EMPLOYEE_READ), getEmployeeDashboard, errorHandler);

router.get(
  "/role",
  auth,
  requireRole(UserRole.EMPLOYEE),
  requirePermission(Permission.EMPLOYEE_READ),
  getMyEmployeeRole,
  errorHandler,
);
router.patch(
  "/role",
  auth,
  requireRole(UserRole.EMPLOYEE),
  requirePermission(Permission.PROFILE_UPDATE),
  validateRequest(updateEmployeeRoleSchema),
  updateMyEmployeeRole,
  errorHandler,
);

export default router;
