import { Router } from "express";
import { z } from "zod";
import { auth, requireSystemAdmin } from "../../middleware/auth.middleware.js";
import { otpRateLimiter } from "../../middleware/rate_limiter.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { companyOverview, confirmCompanyOrganizationRemoval, createCompany, createCompanyCategory, currentCompany, listCompanies, listCompanyCategories, listInvestorCompanyAccess, requestCompanyOrganizationRemoval, requireCompanyCreator, requireGroupExecutive, setCompanyOrganizationParent, updateCompany, updateInvestorCompanyAccess } from "./company.controller.js";

const companyBody = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  industry: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
});
const createCategorySchema = z.object({ body: z.object({ name: z.string().trim().min(2).max(80) }) });

const createCompanySchema = z.object({ body: companyBody });
const companyIdSchema = z.object({ params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid company id") }) });
const updateCompanySchema = z.object({
  body: companyBody,
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid company id") }),
});
const companyOrganizationParentSchema = z.object({
  body: z.object({
    parentCompanyId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid parent company id"),
    anchorUserId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid anchor user id"),
  }),
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid company id") }),
});
const companyOrganizationRemovalRequestSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid company id") }),
});
const companyOrganizationRemovalConfirmSchema = z.object({
  body: z.object({
    otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit verification code"),
  }),
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid company id") }),
});
const investorCompanyAccessSchema = z.object({
  body: z.object({
    companyIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, "Invalid company id")).max(500).refine((ids) => new Set(ids).size === ids.length, "Company ids must be unique"),
  }),
  params: z.object({ investorId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid investor id") }),
});
const router = Router();

router.get("/current", auth, currentCompany);
router.get("/investor-access", auth, requireSystemAdmin, listInvestorCompanyAccess);
router.put("/investor-access/:investorId", auth, requireSystemAdmin, validateRequest(investorCompanyAccessSchema), updateInvestorCompanyAccess);
router.get("/categories", auth, listCompanyCategories);
router.post("/categories", auth, requireCompanyCreator, validateRequest(createCategorySchema), createCompanyCategory);
router.get("/", auth, listCompanies);
router.get("/:id/overview", auth, requireSystemAdmin, validateRequest(companyIdSchema), companyOverview);
router.post("/", auth, requireCompanyCreator, validateRequest(createCompanySchema), createCompany);
router.post("/:id/organization-parent/remove/request", auth, requireGroupExecutive, otpRateLimiter, validateRequest(companyOrganizationRemovalRequestSchema), requestCompanyOrganizationRemoval);
router.post("/:id/organization-parent/remove/confirm", auth, requireGroupExecutive, otpRateLimiter, validateRequest(companyOrganizationRemovalConfirmSchema), confirmCompanyOrganizationRemoval);
router.patch("/:id/organization-parent", auth, requireGroupExecutive, validateRequest(companyOrganizationParentSchema), setCompanyOrganizationParent);
router.patch("/:id", auth, requireSystemAdmin, validateRequest(updateCompanySchema), updateCompany);

router.use(errorHandler);

export default router;
