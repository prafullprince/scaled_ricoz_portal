import { Router } from "express";
import { auth, requirePermission, requireRole } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { getPerformance } from "./performance.controller.js";

const router = Router();
router.get("/", auth, requireRole(UserRole.INTERN, UserRole.EMPLOYEE), requirePermission(Permission.INTERN_TASK_READ), getPerformance, errorHandler);
export default router;
