import { Router } from "express";
import { otpRateLimiter } from "../../middleware/rate_limiter.middleware.js";
import { auth, requirePermission, requireRole } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { deleteRevenueStreams, getAiForecast, getCostPlan, getFinancialSummary, getResourcePlan, getRevenueForecast, requestRevenueStreamDeletionOtp, saveCostPlan, saveResourcePlan, saveRevenueForecast } from "./finance.controller.js";
import { deleteRevenueStreamsSchema, requestRevenueStreamDeletionOtpSchema, revenueForecastParamsSchema, saveRevenueForecastSchema } from "./finance.validation.js";
import { resourcePlanParamsSchema, saveResourcePlanSchema } from "./resource-planning.validation.js";
import { costPlanParamsSchema, saveCostPlanSchema } from "./cost-planning.validation.js";

const router = Router();
const financeRoles = [
  UserRole.ADMIN,
  UserRole.CEO,
  UserRole.CFO,
  UserRole.FINANCE_HEAD,
  UserRole.FINANCE_MANAGER,
];

router.get(
  "/revenue-projections/:fiscalYearStart",
  auth,
  requireRole(...financeRoles),
  requirePermission(Permission.FINANCE_FORECAST_VIEW),
  validateRequest(revenueForecastParamsSchema),
  getRevenueForecast,
  errorHandler,
);
router.put(
  "/revenue-projections/:fiscalYearStart",
  auth,
  requireRole(...financeRoles),
  requirePermission(Permission.FINANCE_FORECAST_MANAGE),
  validateRequest(saveRevenueForecastSchema),
  saveRevenueForecast,
  errorHandler,
);
router.post(
  "/revenue-projections/:fiscalYearStart/deletion-otp",
  otpRateLimiter,
  auth,
  requireRole(...financeRoles),
  requirePermission(Permission.FINANCE_FORECAST_MANAGE),
  validateRequest(requestRevenueStreamDeletionOtpSchema),
  requestRevenueStreamDeletionOtp,
  errorHandler,
);
router.delete(
  "/revenue-projections/:fiscalYearStart/streams",
  auth,
  requireRole(...financeRoles),
  requirePermission(Permission.FINANCE_FORECAST_MANAGE),
  validateRequest(deleteRevenueStreamsSchema),
  deleteRevenueStreams,
  errorHandler,
);
router.get(
  "/resource-planning/:fiscalYearStart",
  auth,
  requireRole(...financeRoles),
  requirePermission(Permission.FINANCE_FORECAST_VIEW),
  validateRequest(resourcePlanParamsSchema),
  getResourcePlan,
  errorHandler,
);
router.put(
  "/resource-planning/:fiscalYearStart",
  auth,
  requireRole(...financeRoles),
  requirePermission(Permission.FINANCE_FORECAST_MANAGE),
  validateRequest(saveResourcePlanSchema),
  saveResourcePlan,
  errorHandler,
);
router.get(
  "/cost-planning/:fiscalYearStart",
  auth,
  requireRole(...financeRoles),
  requirePermission(Permission.FINANCE_FORECAST_VIEW),
  validateRequest(costPlanParamsSchema),
  getCostPlan,
  errorHandler,
);
router.put(
  "/cost-planning/:fiscalYearStart",
  auth,
  requireRole(...financeRoles),
  requirePermission(Permission.FINANCE_FORECAST_MANAGE),
  validateRequest(saveCostPlanSchema),
  saveCostPlan,
  errorHandler,
);
router.get(
  "/financial-summary/:fiscalYearStart",
  auth,
  requireRole(...financeRoles),
  requirePermission(Permission.FINANCE_FORECAST_VIEW),
  validateRequest(revenueForecastParamsSchema),
  getFinancialSummary,
  errorHandler,
);
router.get(
  "/ai-forecast/:fiscalYearStart",
  auth,
  requireRole(...financeRoles),
  requirePermission(Permission.FINANCE_FORECAST_VIEW),
  validateRequest(revenueForecastParamsSchema),
  getAiForecast,
  errorHandler,
);

export default router;
