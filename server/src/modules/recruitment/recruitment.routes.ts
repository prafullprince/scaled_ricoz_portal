import { Router, type NextFunction, type Request, type Response } from "express";
import { otpRateLimiter } from "../../middleware/rate_limiter.middleware.js";
import { auth } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { hasPermission, Permission, UserRole } from "../auth/authorization.js";
import { isHrStructureAdmin, isSystemHrStructureAdmin } from "../organization/organization.controller.js";
import { isOrganizationExecutive } from "../organization/organization.access.js";
import { requestRoles } from "../organization/organization.roles.js";
import { OpportunityType } from "../../models/opportunity.models.js";
import { OrganizationAssignment, OrganizationLevel } from "../../models/organization.models.js";
import { openOfferDocument } from "./offer.link.js";
import { requireRecruitmentAccess } from "./recruitment-access.middleware.js";
import {
  deleteOfferCandidates,
  importOfferCandidates,
  requestOfferCandidateDeletionOtp,
} from "./bulk-offer.controller.js";
import {
  candidateDeletionSchema,
  candidateDeletionTargetSchema,
  offerCandidateCsvSchema,
} from "./bulk-offer.validation.js";
import {
  applicationSchema,
  createApplicationAssignmentSchema,
  candidateImportSchema,
  candidateSourceImportSchema,
  archiveCandidateListEntrySchema,
  candidateListDeletionSchema,
  candidateListDeletionTargetSchema,
  updateCandidateListEntriesSchema,
  createDirectApplicationSchema,
  opportunitySchema,
  managerOnboardSchema,
  reviewSchema,
  roleGrantSchema,
  statusSchema,
  submitApplicationAssignmentSchema,
  updateCandidateListEntrySchema,
  updateOpportunitySchema,
} from "./recruitment.validation.js";
import { generateOfferSchema, offerLetterProfileSchema, sendOfferSchema } from "./offer.validation.js";
import {
  createInterviewRoundSchema,
  createPipelineTaskSchema,
  pipelineAssignmentSchema,
  pipelineAssessmentCreateSchema,
  pipelineAssessmentListSchema,
  pipelineAssessmentParamsSchema,
  pipelineAssessmentResultSchema,
  pipelineFinalSelectionSchema,
  pipelineListSchema,
  pipelineManagerDecisionSchema,
  pipelineOnboardingSchema,
  pipelinePreJoiningSchema,
  pipelineScreeningSchema,
  pipelineTaskParamsSchema,
  pipelineTransitionSchema,
  pipelineWaiverSchema,
  updateInterviewRoundSchema,
} from "./recruitment-pipeline.validation.js";
import {
  addRecruitmentInterviewRound,
  assignRecruitmentPipeline,
  completeRecruitmentTask,
  confirmRecruitmentTask,
  createRecruitmentAssessment,
  createRecruitmentTask,
  decideRecruitmentManagerApproval,
  listRecruitmentPipeline,
  listRecruitmentPipelineStaff,
  listRecruitmentAssessments,
  downloadRecruitmentAssessmentSubmission,
  moveRecruitmentPipelineStage,
  recordAssessmentWaiver,
  recordInterviewWaiver,
  updateAssessmentResult,
  updateRecruitmentFinalSelection,
  updateRecruitmentInterviewRound,
  updateRecruitmentOnboarding,
  updateRecruitmentPreJoining,
  updateRecruitmentScreening,
} from "./recruitment-pipeline.controller.js";
import {
  createCandidateCommunicationCampaign,
  listCandidateCampaignRecipients,
  listCandidateCommunicationCampaigns,
  listCandidateWhatsAppAccounts,
  listCandidateWhatsAppTemplates,
  retryCandidateCommunicationCampaign,
} from "./recruitment-campaign.controller.js";
import {
  createSalesClientCampaignSchema,
  listSalesClientCampaignRecipientsSchema,
  retrySalesClientCampaignSchema,
} from "../sales/sales.client-campaign.validation.js";
import {
  acceptApplication,
  acceptCandidateOffer,
  applyToOpportunity,
  changeOpportunityStatus,
  createApplicationAssignment,
  createDirectApplication,
  deleteAllCandidateListEntries,
  importCandidateListEntries,
  listCandidateListEntries,
  updateCandidateListEntry,
  updateCandidateListEntries,
  archiveCandidateListEntry,
  requestCandidateListDeletionOtp,
  createOpportunity,
  declineApplication,
  declineCandidateOffer,
  downloadResume,
  downloadApplicationAssignmentSubmission,
  downloadMyApplicationAssignmentSubmission,
  generateOfferForApplication,
  getOffer,
  getPublicOpportunity,
  grantRole,
  listAdminApplications,
  listAdminApplicationSummary,
  listAdminOpportunities,
  listApplicationAssignments,
  listMyApplicationAssignments,
  listMyApplications,
  listMyOffers,
  onboardTeamMember,
  listPublicOpportunities,
  previewOffer,
  reviewApplicationAssignment,
  sendOffer,
  getOfferLetterProfile,
  saveOfferLetterProfile,
  submitApplicationAssignment,
  shortlistApplication,
  updateOpportunity,
} from "./recruitment.controller.js";

const router = Router();
const managerRoles = [UserRole.MANAGER, UserRole.PRODUCT_MANAGER, UserRole.MARKETING_MANAGER, UserRole.FINANCE_MANAGER, UserRole.SALES_MANAGER, UserRole.PROJECTS_MANAGER, UserRole.SUPPORT_MANAGER, UserRole.HR_MANAGER, UserRole.DESIGN_MANAGER, UserRole.ENGINEERING_MANAGER, UserRole.IT_MANAGER];
const memberOnboardingRoles = [...managerRoles, UserRole.HR_HEAD, UserRole.HEAD];
const requireRecruitmentApprover = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.authUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const roles = requestRoles(req);
    const permission = Permission.RECRUITMENT_REVIEW;
    const canReview = req.companyPermissions?.includes(permission)
      || hasPermission({ roles: (req.companyPermissionRoles ?? roles) as UserRole[] }, permission)
      || isOrganizationExecutive(roles)
      || isOrganizationExecutive(req.authUser.roles)
      || await isHrStructureAdmin(req.authUser._id, roles);
    const isAssignedManager = await OrganizationAssignment.exists({
      userId: req.authUser._id,
      level: OrganizationLevel.MANAGER,
      active: true,
    });
    if (!canReview && !isAssignedManager) {
      return res.status(403).json({ success: false, message: "Only the assigned hiring manager or HR leadership can approve this recruitment decision" });
    }
    next();
  } catch (error) {
    next(error);
  }
};
const requireOnboardingPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = requestRoles(req);
    if (!req.authUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const hasDepartmentLeadershipRole = roles.some((role) => role === UserRole.HEAD || role === UserRole.MANAGER || role.endsWith("_HEAD") || role.endsWith("_MANAGER"));
    const companyHr = await isSystemHrStructureAdmin(req.authUser._id) || (roles.includes(UserRole.HR) && !hasDepartmentLeadershipRole && await isHrStructureAdmin(req.authUser._id, roles));
    const allowedRole = isOrganizationExecutive(roles) || memberOnboardingRoles.some((role) => roles.includes(role));
    if (!allowedRole && !companyHr) return res.status(403).json({ success: false, message: "Forbidden" });
    if (companyHr) return next();
    const rolePermission = hasPermission({ roles: (req.companyPermissionRoles ?? roles) as UserRole[] }, Permission.TASK_ASSIGN);
    const grantedPermission = req.companyPermissions?.includes(Permission.TASK_ASSIGN) ?? false;
    if (!rolePermission && !grantedPermission) return res.status(403).json({ success: false, message: "Forbidden" });
    next();
  } catch (error) { next(error); }
};
router.post(
  "/manager/team-members",
  auth,
  requireOnboardingPermission,
  validateRequest(managerOnboardSchema),
  onboardTeamMember,
);
router.get("/opportunities", listPublicOpportunities);
router.get("/offer-document", openOfferDocument);
router.get("/opportunities/:id", getPublicOpportunity);
router.post(
  "/opportunities/:id/apply",
  auth,
  validateRequest(applicationSchema),
  applyToOpportunity,
);
router.get("/me/applications", auth, listMyApplications);
router.get("/me/assignments", auth, listMyApplicationAssignments);
router.patch(
  "/me/assignments/:id/submission",
  auth,
  validateRequest(submitApplicationAssignmentSchema),
  submitApplicationAssignment,
);
router.get("/me/assignments/:id/submission-file", auth, downloadMyApplicationAssignmentSubmission);
router.get(
  "/admin/opportunities",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  listAdminOpportunities,
);
router.post(
  "/admin/opportunities",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(opportunitySchema),
  createOpportunity,
);
router.patch(
  "/admin/opportunities/:id",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(updateOpportunitySchema),
  updateOpportunity,
);
router.post(
  "/admin/opportunities/:id/status",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(statusSchema),
  changeOpportunityStatus,
);
router.get(
  "/admin/applications/summary",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  listAdminApplicationSummary,
);
router.get(
  "/admin/applications",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  listAdminApplications,
);
router.post(
  "/admin/applications/import",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(candidateImportSchema),
  createDirectApplication,
);
router.post(
  "/admin/candidate-lists/import",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(candidateSourceImportSchema),
  importCandidateListEntries,
);
router.get(
  "/admin/candidate-lists",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  listCandidateListEntries,
);
router.get(
  "/admin/candidate-lists/whatsapp-accounts",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  listCandidateWhatsAppAccounts,
);
router.get(
  "/admin/candidate-lists/whatsapp-templates",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  listCandidateWhatsAppTemplates,
);
router.get(
  "/admin/candidate-lists/campaigns",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  listCandidateCommunicationCampaigns,
);
router.get(
  "/admin/candidate-lists/campaigns/:campaignId/recipients",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(listSalesClientCampaignRecipientsSchema),
  listCandidateCampaignRecipients,
);
router.post(
  "/admin/candidate-lists/campaigns",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(createSalesClientCampaignSchema),
  createCandidateCommunicationCampaign,
);
router.post(
  "/admin/candidate-lists/campaigns/:campaignId/retry",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(retrySalesClientCampaignSchema),
  retryCandidateCommunicationCampaign,
);
router.post(
  "/admin/candidate-lists/deletion-otp",
  otpRateLimiter,
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(candidateListDeletionTargetSchema),
  requestCandidateListDeletionOtp,
);
router.delete(
  "/admin/candidate-lists",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(candidateListDeletionSchema),
  deleteAllCandidateListEntries,
);
router.patch(
  "/admin/candidate-lists/bulk-update",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(updateCandidateListEntriesSchema),
  updateCandidateListEntries,
);
router.patch(
  "/admin/candidate-lists/:entryId",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(updateCandidateListEntrySchema),
  updateCandidateListEntry,
);
router.patch(
  "/admin/candidate-lists/:entryId/archive",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(archiveCandidateListEntrySchema),
  archiveCandidateListEntry,
);
router.post(
  "/admin/applications/direct",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(createDirectApplicationSchema),
  createDirectApplication,
);
router.get(
  "/admin/pipeline",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineListSchema),
  listRecruitmentPipeline,
);
router.get(
  "/admin/pipeline/staff",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  listRecruitmentPipelineStaff,
);
router.post(
  "/admin/pipeline/offer/import",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(offerCandidateCsvSchema),
  importOfferCandidates,
  errorHandler,
);
router.post(
  "/admin/pipeline/candidates/deletion-otp",
  otpRateLimiter,
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(candidateDeletionTargetSchema),
  requestOfferCandidateDeletionOtp,
  errorHandler,
);
router.delete(
  "/admin/pipeline/candidates",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(candidateDeletionSchema),
  deleteOfferCandidates,
  errorHandler,
);
router.patch(
  "/admin/pipeline/:pipelineId/stage",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineTransitionSchema),
  moveRecruitmentPipelineStage,
);
router.patch(
  "/admin/pipeline/:pipelineId/assignment",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineAssignmentSchema),
  assignRecruitmentPipeline,
);
router.patch(
  "/admin/pipeline/:pipelineId/screening",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineScreeningSchema),
  updateRecruitmentScreening,
);
router.post(
  "/admin/pipeline/:pipelineId/tasks",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(createPipelineTaskSchema),
  createRecruitmentTask,
);
router.patch(
  "/admin/pipeline/:pipelineId/tasks/:taskId/complete",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineTaskParamsSchema),
  completeRecruitmentTask,
);
router.patch(
  "/admin/pipeline/:pipelineId/tasks/:taskId/confirm",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineTaskParamsSchema),
  confirmRecruitmentTask,
);
router.post(
  "/admin/pipeline/:pipelineId/interviews",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(createInterviewRoundSchema),
  addRecruitmentInterviewRound,
);
router.patch(
  "/admin/pipeline/:pipelineId/interviews/:roundId",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(updateInterviewRoundSchema),
  updateRecruitmentInterviewRound,
);
router.patch(
  "/admin/pipeline/:pipelineId/final-selection",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineFinalSelectionSchema),
  updateRecruitmentFinalSelection,
);
router.patch(
  "/admin/pipeline/:pipelineId/pre-joining",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelinePreJoiningSchema),
  updateRecruitmentPreJoining,
);
router.patch(
  "/admin/pipeline/:pipelineId/onboarding",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineOnboardingSchema),
  updateRecruitmentOnboarding,
);
router.patch(
  "/admin/pipeline/:pipelineId/approval",
  auth,
  requireRecruitmentApprover,
  validateRequest(pipelineManagerDecisionSchema),
  decideRecruitmentManagerApproval,
);
router.get(
  "/admin/pipeline/:pipelineId/assessments",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineAssessmentListSchema),
  listRecruitmentAssessments,
);
router.post(
  "/admin/pipeline/:pipelineId/assessments",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineAssessmentCreateSchema),
  createRecruitmentAssessment,
);
router.get(
  "/admin/pipeline/:pipelineId/assessments/:assessmentId/submission-file",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineAssessmentParamsSchema),
  downloadRecruitmentAssessmentSubmission,
);
router.patch(
  "/admin/pipeline/:pipelineId/assessments/:assessmentId",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineAssessmentResultSchema),
  updateAssessmentResult,
);
router.post(
  "/admin/pipeline/:pipelineId/assessment-waiver",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineWaiverSchema),
  recordAssessmentWaiver,
);
router.post(
  "/admin/pipeline/:pipelineId/interview-waiver",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(pipelineWaiverSchema),
  recordInterviewWaiver,
);
router.get(
  "/admin/applications/:id/assignments",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  listApplicationAssignments,
);
router.post(
  "/admin/applications/:id/assignments",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(createApplicationAssignmentSchema),
  createApplicationAssignment,
);
router.get(
  "/admin/applications/:id/assignments/:assignmentId/submission-file",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  downloadApplicationAssignmentSubmission,
);
router.post(
  "/admin/applications/:id/assignments/:assignmentId/review",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  reviewApplicationAssignment,
);
router.get(
  "/admin/applications/:id/resume",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  downloadResume,
);
router.post(
  "/admin/applications/:id/shortlist",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  shortlistApplication,
);
router.post(
  "/admin/applications/:id/accept",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  acceptApplication,
);
router.post(
  "/admin/applications/:id/decline",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_REVIEW),
  validateRequest(reviewSchema),
  declineApplication,
);
router.post(
  "/admin/applications/:id/make-intern",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(roleGrantSchema),
  (req, res, next) => grantRole(req, res, next, OpportunityType.INTERNSHIP),
);
router.post(
  "/admin/applications/:id/make-employee",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(roleGrantSchema),
  (req, res, next) => grantRole(req, res, next, OpportunityType.JOB),
);
router.post(
  "/admin/applications/:id/offer",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(generateOfferSchema),
  generateOfferForApplication,
);
router.get(
  "/admin/offer-letter-profile",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  getOfferLetterProfile,
);
router.put(
  "/admin/offer-letter-profile",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(offerLetterProfileSchema),
  saveOfferLetterProfile,
);
router.post(
  "/admin/offers",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(generateOfferSchema),
  generateOfferForApplication,
);
router.get(
  "/admin/applications/:id/offers",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  listMyOffers,
);
router.get(
  "/admin/offers/:id",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  getOffer,
);
router.get(
  "/admin/offers/:id/preview",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  previewOffer,
);
router.post(
  "/admin/offers/:id/send",
  auth,
  requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN),
  validateRequest(sendOfferSchema),
  sendOffer,
);
router.get("/me/offers", auth, listMyOffers);
router.get("/offers/:id", auth, getOffer);
router.get("/offers/:id/preview", auth, previewOffer);
router.post("/offers/:id/accept", auth, acceptCandidateOffer);
router.post("/offers/:id/decline", auth, declineCandidateOffer);
router.use(errorHandler);
export default router;
