import { Router } from "express";
import { auth, requirePermission, requireRole } from "../../middleware/auth.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { createPlanner, streamPlannerResponse, listPlannerHistory, deletePlannerHistory } from "./planner.controller.js";
import { plannerChat, streamPlannerChat, plannerConversations, deletePlannerConversation } from "./planner.controller.js";

const router = Router();
router.get("/chat", auth, requirePermission(Permission.PROFILE_READ), plannerConversations, errorHandler);
router.post("/chat/stream", auth, requirePermission(Permission.PROFILE_READ), streamPlannerChat);
router.post("/chat", auth, requirePermission(Permission.PROFILE_READ), plannerChat, errorHandler);
router.delete("/chat/:sessionId", auth, requirePermission(Permission.PROFILE_READ), deletePlannerConversation, errorHandler);
const leadershipRoles = Object.values(UserRole).filter((role) => role === UserRole.HEAD || role === UserRole.MANAGER || role.endsWith("_HEAD") || role.endsWith("_MANAGER"));
export const personalWorkspaceRoles = [UserRole.INTERN, UserRole.EMPLOYEE, UserRole.INVESTOR, UserRole.HR, UserRole.CFO, UserRole.CEO, UserRole.ADMIN, ...leadershipRoles];
router.get("/history", auth, requireRole(...personalWorkspaceRoles), listPlannerHistory);
router.delete("/history/:id", auth, requireRole(...personalWorkspaceRoles), deletePlannerHistory);

router.post(
  "/generate",
  auth,
  requireRole(...personalWorkspaceRoles),
  requirePermission(Permission.INTERN_TASK_READ),
  createPlanner,
  errorHandler,
);
router.post(
  "/generate/stream",
  auth,
  requireRole(...personalWorkspaceRoles),
  requirePermission(Permission.INTERN_TASK_READ),
  streamPlannerResponse,
);

export default router;
