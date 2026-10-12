import { Router } from "express";
import { auth, requirePermission, requireRole } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import {
  approveInvestorVerification,
  getMyInvestorVerification,
  listInvestorVerificationQueue,
  rejectInvestorVerification,
  submitInvestorVerification,
} from "./investor.controller.js";
import { rejectInvestorVerificationSchema, submitInvestorVerificationSchema } from "./investor.validation.js";

const router = Router();

router.get(
  "/verification",
  auth,
  requireRole(UserRole.INVESTOR),
  requirePermission(Permission.INVESTOR_VERIFICATION_READ),
  getMyInvestorVerification,
  errorHandler,
);
router.post(
  "/verification",
  auth,
  requireRole(UserRole.INVESTOR),
  requirePermission(Permission.INVESTOR_VERIFICATION_SUBMIT),
  validateRequest(submitInvestorVerificationSchema),
  submitInvestorVerification,
  errorHandler,
);
router.get(
  "/verification/queue",
  auth,
  requireRole(UserRole.ADMIN),
  requirePermission(Permission.INVESTOR_VERIFICATION_READ),
  listInvestorVerificationQueue,
  errorHandler,
);
router.post(
  "/verification/:userId/approve",
  auth,
  requireRole(UserRole.ADMIN),
  requirePermission(Permission.INVESTOR_VERIFICATION_UPDATE),
  approveInvestorVerification,
  errorHandler,
);
router.post(
  "/verification/:userId/reject",
  auth,
  requireRole(UserRole.ADMIN),
  requirePermission(Permission.INVESTOR_VERIFICATION_UPDATE),
  validateRequest(rejectInvestorVerificationSchema),
  rejectInvestorVerification,
  errorHandler,
);

export default router;
