import { Router } from "express";
import {
  auth,
  requirePermission,
  requireRole,
} from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { createLeaveSchema, leavePolicySchema } from "./leave.validation.js";
import { createLeave, listLeave, listLeavePolicies, saveLeavePolicy, getLeaveAllowance } from "./leave.controller.js";

const router = Router();
router.get("/policies", auth, requireRole(UserRole.CEO, UserRole.ADMIN, UserRole.HR_HEAD), listLeavePolicies, errorHandler);
router.put("/policies", auth, requireRole(UserRole.CEO, UserRole.ADMIN, UserRole.HR_HEAD), validateRequest(leavePolicySchema), saveLeavePolicy, errorHandler);
router.get("/allowance", auth, getLeaveAllowance, errorHandler);
const selfServiceGuard = [auth, requirePermission(Permission.LEAVE_REQUEST)];
router.get(
  "/",
  auth,
  requirePermission(Permission.LEAVE_REQUEST),
  listLeave,
  errorHandler,
);
router.post(
  "/",
  ...selfServiceGuard,
  validateRequest(createLeaveSchema),
  createLeave,
  errorHandler,
);
export default router;
