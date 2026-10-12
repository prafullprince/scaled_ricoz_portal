import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { auth, requirePermission, requireRole } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { getOrCreateInvestorProfile } from "../verification/profile.service.js";
import { analyticsQuerySchema } from "./analytics.validation.js";
import { revenueForecastParamsSchema } from "../finance/finance.validation.js";
import { getInvestorFinancialPlan } from "../finance/investor-financial-plan.controller.js";
import { InvestorCompanyAccess } from "../../models/index.js";
import {
  createInvestorForecastChatSession,
  deleteInvestorForecastChatSession,
  getInvestorForecastChatSession,
  listInvestorForecastChatSessions,
  requireVerifiedInvestorCompanyAccess,
  streamInvestorForecastChat,
} from "./investor-forecast-chat.controller.js";
import {
  createInvestorForecastChatSessionSchema,
  investorForecastChatMessageSchema,
  investorForecastChatSessionParamsSchema,
} from "./investor-forecast-chat.validation.js";
import {
  getActiveCustomers,
  getArr,
  getCac,
  getCashBurn,
  getCollectionRate,
  getDso,
  getGrr,
  getInvoiceVolume,
  getLtv,
  getMrr,
  getOutstandingRevenue,
  getOverview,
  getRevenueGrowth,
  getRunway,
  getTotalRevenue,
} from "./analytics.controller.js";

const router = Router();

// Internal staff (EMPLOYEE/ADMIN) bypass investor verification; investors themselves must be verified.
const requireVerifiedInvestor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = req.authUser?.roles ?? [];
    if (roles.includes(UserRole.EMPLOYEE) || roles.includes(UserRole.ADMIN)) {
      return next();
    }
    const profile = await getOrCreateInvestorProfile(req.authUser!._id);
    if (!profile.isVerified) {
      return res.status(403).json({ success: false, message: "Your investor account is not yet verified" });
    }
    if (!req.company || !(await InvestorCompanyAccess.exists({
      investorId: req.authUser!._id,
      companyId: req.company._id,
      active: true,
    }))) {
      return res.status(403).json({ success: false, message: "Your investor account does not have access to this company" });
    }
    return next();
  } catch (error) {
    next(error);
  }
};

const guard = [
  auth,
  requireRole(UserRole.INVESTOR, UserRole.EMPLOYEE, UserRole.ADMIN),
  requirePermission(Permission.INVESTOR_ANALYTICS_READ),
  requireVerifiedInvestor,
  validateRequest(analyticsQuerySchema),
];

router.get("/investor/overview", ...guard, getOverview, errorHandler);
const forecastChatGuard = [
  auth,
  requireRole(UserRole.INVESTOR),
  requirePermission(Permission.INVESTOR_ANALYTICS_READ),
  requireVerifiedInvestorCompanyAccess,
];
router.get("/investor/forecast-chat/sessions", ...forecastChatGuard, listInvestorForecastChatSessions, errorHandler);
router.post(
  "/investor/forecast-chat/sessions",
  ...forecastChatGuard,
  validateRequest(createInvestorForecastChatSessionSchema),
  createInvestorForecastChatSession,
  errorHandler,
);
router.delete(
  "/investor/forecast-chat/sessions/:sessionId",
  ...forecastChatGuard,
  validateRequest(investorForecastChatSessionParamsSchema),
  deleteInvestorForecastChatSession,
  errorHandler,
);
router.get(
  "/investor/forecast-chat/sessions/:sessionId",
  ...forecastChatGuard,
  validateRequest(investorForecastChatSessionParamsSchema),
  getInvestorForecastChatSession,
  errorHandler,
);
router.post(
  "/investor/forecast-chat/sessions/:sessionId/messages",
  ...forecastChatGuard,
  validateRequest(investorForecastChatMessageSchema),
  streamInvestorForecastChat,
  errorHandler,
);
router.get(
  "/investor/financial-plan/:fiscalYearStart",
  auth,
  requireRole(UserRole.INVESTOR, UserRole.EMPLOYEE, UserRole.ADMIN),
  requirePermission(Permission.INVESTOR_ANALYTICS_READ),
  requireVerifiedInvestor,
  validateRequest(revenueForecastParamsSchema),
  getInvestorFinancialPlan,
  errorHandler,
);
router.get("/investor/arr", ...guard, getArr, errorHandler);
router.get("/investor/mrr", ...guard, getMrr, errorHandler);
router.get("/investor/total-revenue", ...guard, getTotalRevenue, errorHandler);
router.get("/investor/revenue-growth", ...guard, getRevenueGrowth, errorHandler);
router.get("/investor/active-customers", ...guard, getActiveCustomers, errorHandler);
router.get("/investor/invoice-volume", ...guard, getInvoiceVolume, errorHandler);
router.get("/investor/collection-rate", ...guard, getCollectionRate, errorHandler);
router.get("/investor/outstanding-revenue", ...guard, getOutstandingRevenue, errorHandler);
router.get("/investor/grr", ...guard, getGrr, errorHandler);
router.get("/investor/cac", ...guard, getCac, errorHandler);
router.get("/investor/ltv", ...guard, getLtv, errorHandler);
router.get("/investor/cash-burn", ...guard, getCashBurn, errorHandler);
router.get("/investor/runway", ...guard, getRunway, errorHandler);
router.get("/ar/dso", ...guard, getDso, errorHandler);

export default router;
