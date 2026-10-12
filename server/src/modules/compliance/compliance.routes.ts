import { Router } from "express";
import rateLimit from "express-rate-limit";
import { auth, requirePermission } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission } from "../auth/authorization.js";
import {
  acknowledgePolicy,
  archiveRequirement,
  createCategory,
  createIssue,
  createPolicy,
  createRequirement,
  createRisk,
  decideRequirement,
  downloadEvidence,
  getCalendar,
  getComplianceAccess,
  getDashboard,
  getNotificationRules,
  getReports,
  getRequirement,
  listAuditEvents,
  listCategories,
  listEvidence,
  listIssues,
  listNotifications,
  listPolicies,
  listRequirements,
  listRisks,
  markNotificationRead,
  publishPolicy,
  reviewRequirement,
  replaceNotificationRules,
  submitRequirement,
  updateIssue,
  updateRequirement,
  uploadEvidence,
  verifyEvidence,
} from "./compliance.controller.js";
import {
  acknowledgePolicySchema,
  approvalDecisionSchema,
  categorySchema,
  complianceCalendarSchema,
  complianceListSchema,
  createIssueSchema,
  createPolicySchema,
  createRequirementSchema,
  createRiskSchema,
  evidenceIdSchema,
  evidenceListSchema,
  evidenceMetadataSchema,
  issueListSchema,
  notificationIdSchema,
  notificationRulesSchema,
  policyIdSchema,
  policyListSchema,
  requirementIdSchema,
  riskListSchema,
  updateIssueSchema,
  updateRequirementSchema,
  verifyEvidenceSchema,
} from "./compliance.validation.js";

const router = Router();
const evidenceUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many evidence uploads. Try again later." },
});
const view = [auth, requirePermission(Permission.COMPLIANCE_VIEW)];

router.get("/access", auth, getComplianceAccess, errorHandler);
router.get("/dashboard", ...view, getDashboard, errorHandler);
router.get("/calendar", ...view, validateRequest(complianceCalendarSchema), getCalendar, errorHandler);
router.get("/categories", ...view, listCategories, errorHandler);
router.post("/categories", auth, requirePermission(Permission.COMPLIANCE_MANAGE_SETTINGS), validateRequest(categorySchema), createCategory, errorHandler);

router.get("/requirements", ...view, validateRequest(complianceListSchema), listRequirements, errorHandler);
router.post("/requirements", auth, requirePermission(Permission.COMPLIANCE_CREATE), validateRequest(createRequirementSchema), createRequirement, errorHandler);
router.get("/requirements/:requirementId", ...view, validateRequest(requirementIdSchema), getRequirement, errorHandler);
router.patch("/requirements/:requirementId", auth, requirePermission(Permission.COMPLIANCE_UPDATE), validateRequest(updateRequirementSchema), updateRequirement, errorHandler);
router.delete("/requirements/:requirementId", auth, requirePermission(Permission.COMPLIANCE_DELETE), validateRequest(requirementIdSchema), archiveRequirement, errorHandler);
router.post("/requirements/:requirementId/submit", auth, requirePermission(Permission.COMPLIANCE_UPDATE), validateRequest(requirementIdSchema), submitRequirement, errorHandler);
router.post("/requirements/:requirementId/review", auth, validateRequest(approvalDecisionSchema), reviewRequirement, errorHandler);
router.post("/requirements/:requirementId/approve", auth, requirePermission(Permission.COMPLIANCE_APPROVE), validateRequest(approvalDecisionSchema), decideRequirement, errorHandler);

router.get("/evidence", ...view, validateRequest(evidenceListSchema), listEvidence, errorHandler);
router.post("/evidence", auth, evidenceUploadLimiter, validateRequest(evidenceMetadataSchema), uploadEvidence, errorHandler);
router.get("/evidence/:evidenceId/download", auth, validateRequest(evidenceIdSchema), downloadEvidence, errorHandler);
router.post("/evidence/:evidenceId/verify", auth, validateRequest(verifyEvidenceSchema), verifyEvidence, errorHandler);

router.get("/risks", ...view, validateRequest(riskListSchema), listRisks, errorHandler);
router.post("/risks", auth, requirePermission(Permission.COMPLIANCE_MANAGE_RISKS), validateRequest(createRiskSchema), createRisk, errorHandler);
router.get("/issues", ...view, validateRequest(issueListSchema), listIssues, errorHandler);
router.post("/issues", ...view, validateRequest(createIssueSchema), createIssue, errorHandler);
router.patch("/issues/:issueId", auth, requirePermission(Permission.COMPLIANCE_UPDATE), validateRequest(updateIssueSchema), updateIssue, errorHandler);

router.get("/policies", ...view, validateRequest(policyListSchema), listPolicies, errorHandler);
router.post("/policies", auth, requirePermission(Permission.COMPLIANCE_MANAGE_POLICIES), validateRequest(createPolicySchema), createPolicy, errorHandler);
router.post("/policies/:policyId/publish", auth, requirePermission(Permission.COMPLIANCE_APPROVE), validateRequest(policyIdSchema), publishPolicy, errorHandler);
router.post("/policies/:policyId/acknowledge", ...view, validateRequest(acknowledgePolicySchema), acknowledgePolicy, errorHandler);

router.get("/notifications", auth, listNotifications, errorHandler);
router.patch("/notifications/:notificationId/read", auth, validateRequest(notificationIdSchema), markNotificationRead, errorHandler);
router.get("/settings/reminder-rules", auth, requirePermission(Permission.COMPLIANCE_MANAGE_SETTINGS), getNotificationRules, errorHandler);
router.put("/settings/reminder-rules", auth, requirePermission(Permission.COMPLIANCE_MANAGE_SETTINGS), validateRequest(notificationRulesSchema), replaceNotificationRules, errorHandler);
router.get("/audit-logs", auth, requirePermission(Permission.COMPLIANCE_AUDIT), listAuditEvents, errorHandler);
router.get("/reports", ...view, validateRequest(complianceListSchema), getReports, errorHandler);

export default router;