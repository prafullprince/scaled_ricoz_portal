import { Router } from "express";
import { otpRateLimiter } from "../../middleware/rate_limiter.middleware.js";
import { auth } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission } from "../auth/authorization.js";
import { archiveSalesLead, assignSalesLead, bulkUpdateImportedSalesLeads, completeSalesTask, createSalesLead, createSalesTask, deleteSalesLeads, getSalesAccess, getSalesDashboard, importSalesLeads, listImportedSalesLeads, listSalesLeads, requestSalesLeadDeletionOtp, updateSalesLead } from "./sales.controller.js";
import { requireSalesPermission } from "./sales.authorization.js";
import { archiveSalesLeadSchema, assignSalesLeadSchema, bulkUpdateImportedSalesLeadsSchema, createSalesLeadSchema, createSalesTaskSchema, importSalesLeadsSchema, salesLeadDeletionSchema, salesLeadDeletionTargetSchema, updateSalesLeadSchema } from "./sales.validation.js";
import { addSalesActivity, completeSalesActivity, getSalesReports, rescheduleSalesActivity } from "./sales.controller.js";
import { createSalesActivitySchema, listSalesLeadsSchema, rescheduleSalesActivitySchema } from "./sales.validation.js";
import { listSalesPipelines, saveSalesPipeline } from "./sales.controller.js";
import { saveSalesPipelineSchema } from "./sales.validation.js";
import { commentSalesAccountability, createSalesAccountability, listAccountabilityLeads, listSalesAccountability, reportSalesAccountability, reviewSalesAccountability } from "./sales-accountability.controller.js";
import { commentSalesAccountabilitySchema, createSalesAccountabilitySchema, reportSalesAccountabilitySchema, reviewSalesAccountabilitySchema } from "./sales-accountability.validation.js";
import { chatSalesAssistant, getSalesAssistantOverviewRoute } from "./sales-assistant.controller.js";
import { createClientCommunicationCampaign, listClientCampaignRecipients, listClientCommunicationCampaigns, listClientWhatsAppAccounts, listClientWhatsAppTemplates, retryClientCommunicationCampaign } from "./sales.client-campaign.controller.js";
import { createSalesClientCampaignSchema, listSalesClientCampaignRecipientsSchema, retrySalesClientCampaignSchema } from "./sales.client-campaign.validation.js";
import { receiveEmailCampaignStatus } from "./sales.client-campaign.webhook.controller.js";

const router = Router();
router.get("/accountability/tasks", auth, listSalesAccountability, errorHandler);
router.get("/accountability/leads", auth, listAccountabilityLeads, errorHandler);
router.post("/accountability/tasks", auth, validateRequest(createSalesAccountabilitySchema), createSalesAccountability, errorHandler);
router.post("/accountability/tasks/:id/reports", auth, validateRequest(reportSalesAccountabilitySchema), reportSalesAccountability, errorHandler);
router.patch("/accountability/tasks/:id/review", auth, validateRequest(reviewSalesAccountabilitySchema), reviewSalesAccountability, errorHandler);
router.post("/accountability/tasks/:id/comments", auth, validateRequest(commentSalesAccountabilitySchema), commentSalesAccountability, errorHandler);
router.get("/pipelines", auth, requireSalesPermission(Permission.SALES_LEAD_VIEW), listSalesPipelines, errorHandler);
router.put("/pipelines/:key", auth, requireSalesPermission(Permission.SALES_DEAL_UPDATE), validateRequest(saveSalesPipelineSchema), saveSalesPipeline, errorHandler);

router.get(
  "/access",
  auth,
  requireSalesPermission(Permission.SALES_DASHBOARD_VIEW),
  getSalesAccess,
  errorHandler,
);
router.get("/assistant/overview", auth, requireSalesPermission(Permission.SALES_DASHBOARD_VIEW), getSalesAssistantOverviewRoute, errorHandler);
router.post("/assistant/chat", auth, requireSalesPermission(Permission.SALES_DASHBOARD_VIEW), chatSalesAssistant, errorHandler);

router.post("/leads/imported/campaigns/email-status", receiveEmailCampaignStatus, errorHandler);
router.get("/leads", auth, requireSalesPermission(Permission.SALES_LEAD_VIEW), validateRequest(listSalesLeadsSchema), listSalesLeads, errorHandler);
router.get("/leads/imported", auth, requireSalesPermission(Permission.SALES_LEAD_VIEW), listImportedSalesLeads, errorHandler);
router.patch("/leads/imported/bulk-update", auth, requireSalesPermission(Permission.SALES_LEAD_UPDATE), validateRequest(bulkUpdateImportedSalesLeadsSchema), bulkUpdateImportedSalesLeads, errorHandler);
router.get("/leads/imported/whatsapp-accounts", auth, requireSalesPermission(Permission.SALES_LEAD_UPDATE), listClientWhatsAppAccounts, errorHandler);
router.get("/leads/imported/whatsapp-templates", auth, requireSalesPermission(Permission.SALES_LEAD_UPDATE), listClientWhatsAppTemplates, errorHandler);
router.get("/leads/imported/campaigns", auth, requireSalesPermission(Permission.SALES_LEAD_VIEW), listClientCommunicationCampaigns, errorHandler);
router.get("/leads/imported/campaigns/:campaignId/recipients", auth, requireSalesPermission(Permission.SALES_LEAD_VIEW), validateRequest(listSalesClientCampaignRecipientsSchema), listClientCampaignRecipients, errorHandler);
router.post("/leads/imported/campaigns", auth, requireSalesPermission(Permission.SALES_LEAD_UPDATE), validateRequest(createSalesClientCampaignSchema), createClientCommunicationCampaign, errorHandler);
router.post("/leads/imported/campaigns/:campaignId/retry", auth, requireSalesPermission(Permission.SALES_LEAD_UPDATE), validateRequest(retrySalesClientCampaignSchema), retryClientCommunicationCampaign, errorHandler);
router.get("/reports", auth, requireSalesPermission(Permission.SALES_REPORT_VIEW), getSalesReports, errorHandler);
router.post("/leads/:leadId/activities", auth, requireSalesPermission(Permission.SALES_ACTIVITY_CREATE), validateRequest(createSalesActivitySchema), addSalesActivity, errorHandler);
router.patch("/leads/:leadId/activities/:activityId/complete", auth, requireSalesPermission(Permission.SALES_ACTIVITY_CREATE), completeSalesActivity, errorHandler);
router.patch("/leads/:leadId/activities/:activityId/reschedule", auth, requireSalesPermission(Permission.SALES_ACTIVITY_CREATE), validateRequest(rescheduleSalesActivitySchema), rescheduleSalesActivity, errorHandler);
router.post("/leads", auth, requireSalesPermission(Permission.SALES_LEAD_CREATE), validateRequest(createSalesLeadSchema), createSalesLead, errorHandler);
router.post("/leads/import", auth, requireSalesPermission(Permission.SALES_LEAD_CREATE), validateRequest(importSalesLeadsSchema), importSalesLeads, errorHandler);
router.post("/leads/deletion-otp", otpRateLimiter, auth, requireSalesPermission(Permission.SALES_LEAD_UPDATE), validateRequest(salesLeadDeletionTargetSchema), requestSalesLeadDeletionOtp, errorHandler);
router.delete("/leads", auth, requireSalesPermission(Permission.SALES_LEAD_UPDATE), validateRequest(salesLeadDeletionSchema), deleteSalesLeads, errorHandler);
router.patch("/leads/:leadId/archive", auth, requireSalesPermission(Permission.SALES_LEAD_UPDATE), validateRequest(archiveSalesLeadSchema), archiveSalesLead, errorHandler);
router.patch("/leads/:leadId", auth, requireSalesPermission(Permission.SALES_LEAD_UPDATE), validateRequest(updateSalesLeadSchema), updateSalesLead, errorHandler);
router.post("/leads/:leadId/assign", auth, requireSalesPermission(Permission.SALES_LEAD_ASSIGN), validateRequest(assignSalesLeadSchema), assignSalesLead, errorHandler);

router.patch(
  "/tasks/:taskId/complete",
  auth,
  requireSalesPermission(Permission.SALES_TASK_UPDATE),
  completeSalesTask,
  errorHandler,
);
router.post("/tasks", auth, requireSalesPermission(Permission.SALES_TASK_CREATE), validateRequest(createSalesTaskSchema), createSalesTask, errorHandler);

router.get(
  "/dashboard",
  auth,
  requireSalesPermission(Permission.SALES_DASHBOARD_VIEW),
  getSalesDashboard,
  errorHandler,
);

export default router;