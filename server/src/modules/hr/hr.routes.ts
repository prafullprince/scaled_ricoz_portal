import { Router } from "express";
import { auth, requirePermission, requireRole } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { generateHrAiReport, getHrDashboard, listAssignedHrCompanies, reviewHrLeave } from "./hr.controller.js";
import {
  createPayrollAdjustment,
  downloadHrPayslip,
  downloadMyPayslip,
  generatePayslip,
  getEmployeeFinance,
  listFinanceEmployees,
  listMyPayslips,
  saveSalaryStructure,
} from "./hr-finance.controller.js";
import { hrAiReportSchema, reviewHrLeaveSchema } from "./hr.validation.js";
import {
  employeeFinanceParamsSchema,
  payrollAdjustmentSchema,
  payslipParamsSchema,
  payslipGenerationSchema,
  salaryStructureSchema,
} from "./hr-finance.validation.js";
import {
  createHrDocument,
  discardHrDocument,
  downloadHrDocument,
  downloadMyHrDocument,
  listHrDocuments,
  listMyHrDocuments,
  publishHrDocument,
} from "./hr-documents.controller.js";
import { createHrDocumentSchema, hrDocumentIdParamsSchema } from "./hr-documents.validation.js";
import {
  createEmployeePayout,
  getMyPayoutMethod,
  handleRazorpayPayoutWebhook,
  listEmployeePayouts,
  listMyPayouts,
  setMyPayoutMethod,
} from "./hr-payout.controller.js";
import { createHrPayoutSchema, payoutEmployeeParamsSchema, setPayoutMethodSchema } from "./hr-payout.validation.js";

const router = Router();
const hrRoles = [UserRole.CEO, UserRole.ADMIN, UserRole.HR, UserRole.HR_HEAD, UserRole.HR_MANAGER];

router.get("/companies", auth, listAssignedHrCompanies, errorHandler);
router.get("/dashboard", auth, requireRole(...hrRoles), requirePermission(Permission.HR_DASHBOARD_VIEW), getHrDashboard, errorHandler);
router.get("/documents/me", auth, listMyHrDocuments, errorHandler);
router.get("/documents/me/:documentId/file", auth, validateRequest(hrDocumentIdParamsSchema), downloadMyHrDocument, errorHandler);
router.get("/documents", auth, requireRole(...hrRoles), requirePermission(Permission.HR_DOCUMENT_VIEW), listHrDocuments, errorHandler);
router.post("/documents", auth, requireRole(...hrRoles), requirePermission(Permission.HR_DOCUMENT_MANAGE), validateRequest(createHrDocumentSchema), createHrDocument, errorHandler);
router.patch("/documents/:documentId/publish", auth, requireRole(...hrRoles), requirePermission(Permission.HR_DOCUMENT_MANAGE), validateRequest(hrDocumentIdParamsSchema), publishHrDocument, errorHandler);
router.delete("/documents/:documentId", auth, requireRole(...hrRoles), requirePermission(Permission.HR_DOCUMENT_MANAGE), validateRequest(hrDocumentIdParamsSchema), discardHrDocument, errorHandler);
router.get("/documents/:documentId/file", auth, requireRole(...hrRoles), requirePermission(Permission.HR_DOCUMENT_VIEW), validateRequest(hrDocumentIdParamsSchema), downloadHrDocument, errorHandler);
router.get("/finance/me/payslips", auth, listMyPayslips, errorHandler);
router.get("/finance/me/payslips/:payslipId/file", auth, validateRequest(payslipParamsSchema), downloadMyPayslip, errorHandler);
router.get("/finance/me/payout-method", auth, getMyPayoutMethod, errorHandler);
router.put("/finance/me/payout-method", auth, validateRequest(setPayoutMethodSchema), setMyPayoutMethod, errorHandler);
router.get("/finance/me/payouts", auth, listMyPayouts, errorHandler);
router.post("/finance/payouts/webhook", handleRazorpayPayoutWebhook, errorHandler);
router.get("/finance/employees", auth, requireRole(...hrRoles), requirePermission(Permission.HR_FINANCE_VIEW), listFinanceEmployees, errorHandler);
router.get("/finance/employees/:employeeId", auth, requireRole(...hrRoles), requirePermission(Permission.HR_FINANCE_VIEW), validateRequest(employeeFinanceParamsSchema), getEmployeeFinance, errorHandler);
router.get("/finance/employees/:employeeId/payouts", auth, requireRole(...hrRoles), requirePermission(Permission.HR_FINANCE_VIEW), validateRequest(payoutEmployeeParamsSchema), listEmployeePayouts, errorHandler);
router.post("/finance/employees/:employeeId/payouts", auth, requireRole(...hrRoles), requirePermission(Permission.HR_PAYOUT_MANAGE), validateRequest(createHrPayoutSchema), createEmployeePayout, errorHandler);
router.put("/finance/employees/:employeeId/structure", auth, requireRole(...hrRoles), requirePermission(Permission.HR_FINANCE_MANAGE), validateRequest(salaryStructureSchema), saveSalaryStructure, errorHandler);
router.post("/finance/employees/:employeeId/adjustments", auth, requireRole(...hrRoles), requirePermission(Permission.HR_FINANCE_MANAGE), validateRequest(payrollAdjustmentSchema), createPayrollAdjustment, errorHandler);
router.post("/finance/employees/:employeeId/payslips/generate", auth, requireRole(...hrRoles), requirePermission(Permission.HR_FINANCE_MANAGE), validateRequest(payslipGenerationSchema), generatePayslip, errorHandler);
router.get("/finance/payslips/:payslipId/file", auth, requireRole(...hrRoles), requirePermission(Permission.HR_FINANCE_VIEW), validateRequest(payslipParamsSchema), downloadHrPayslip, errorHandler);
router.patch("/leave/:requestId", auth, requireRole(...hrRoles), requirePermission(Permission.HR_APPROVAL_MANAGE), validateRequest(reviewHrLeaveSchema), reviewHrLeave, errorHandler);
router.post("/ai-report", auth, requireRole(...hrRoles), requirePermission(Permission.HR_AI_USE), validateRequest(hrAiReportSchema), generateHrAiReport, errorHandler);

export default router;