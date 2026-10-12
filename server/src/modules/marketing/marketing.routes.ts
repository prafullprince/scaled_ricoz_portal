import { Router } from "express";
import { auth } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission } from "../auth/authorization.js";
import { completeMarketingTask, createMarketingCampaign, createMarketingContent, createMarketingTask, getMarketingContent, getMarketingDashboard, handoffMarketingLeadToSales, listMarketingSalesOwners, reviewMarketingCampaign, submitMarketingCampaign, updateMarketingCampaign, updateMarketingContent } from "./marketing.controller.js";
import { requireMarketingPermission } from "./marketing.authorization.js";
import { createMarketingCampaignSchema, createMarketingContentSchema, createMarketingTaskSchema, handoffMarketingLeadSchema, reviewMarketingCampaignSchema, updateMarketingCampaignSchema, updateMarketingContentSchema } from "./marketing.validation.js";
import { createMarketingBlog, getMarketingBlogs, getPublishedMarketingBlogs, updateMarketingBlog } from "./marketing.blogs.controller.js";
import { createMarketingBlogSchema, updateMarketingBlogSchema } from "./marketing.blogs.validation.js";
import {
  completeSocialOAuth,
  createSocialPost,
  disconnectSocialAccount,
  getSocialAccounts,
  getSocialInbox,
  getSocialLeads,
  getSocialPosts,
  markSocialConversationRead,
  receiveMetaWebhook,
  replyToSocialConversation,
  startSocialOAuth,
  verifyMetaWebhook,
} from "./marketing.social.controller.js";
import { createSocialPostSchema, sendSocialReplySchema, socialConnectSchema } from "./marketing.social.validation.js";

const router = Router();
router.get("/blogs/published", getPublishedMarketingBlogs, errorHandler);
router.get("/blogs", auth, requireMarketingPermission(Permission.MARKETING_BLOG_MANAGE), getMarketingBlogs, errorHandler);
router.post("/blogs", auth, requireMarketingPermission(Permission.MARKETING_BLOG_MANAGE), validateRequest(createMarketingBlogSchema), createMarketingBlog, errorHandler);
router.patch("/blogs/:blogId", auth, requireMarketingPermission(Permission.MARKETING_BLOG_MANAGE), validateRequest(updateMarketingBlogSchema), updateMarketingBlog, errorHandler);
router.get("/social/oauth/callback/:provider", completeSocialOAuth, errorHandler);
router.get("/social/webhook/meta", verifyMetaWebhook, errorHandler);
router.post("/social/webhook/meta", receiveMetaWebhook, errorHandler);
router.get("/social/accounts", auth, requireMarketingPermission(Permission.MARKETING_SOCIAL_MANAGE), getSocialAccounts, errorHandler);
router.post("/social/connect/:provider", auth, requireMarketingPermission(Permission.MARKETING_SOCIAL_MANAGE), validateRequest(socialConnectSchema), startSocialOAuth, errorHandler);
router.delete("/social/accounts/:accountId", auth, requireMarketingPermission(Permission.MARKETING_SOCIAL_MANAGE), disconnectSocialAccount, errorHandler);
router.get("/social/posts", auth, requireMarketingPermission(Permission.MARKETING_SOCIAL_MANAGE), getSocialPosts, errorHandler);
router.post("/social/posts", auth, requireMarketingPermission(Permission.MARKETING_SOCIAL_MANAGE), validateRequest(createSocialPostSchema), createSocialPost, errorHandler);
router.get("/social/inbox", auth, requireMarketingPermission(Permission.MARKETING_SOCIAL_MANAGE), getSocialInbox, errorHandler);
router.patch("/social/inbox/:conversationId/read", auth, requireMarketingPermission(Permission.MARKETING_SOCIAL_MANAGE), markSocialConversationRead, errorHandler);
router.post("/social/inbox/:conversationId/reply", auth, requireMarketingPermission(Permission.MARKETING_SOCIAL_MANAGE), validateRequest(sendSocialReplySchema), replyToSocialConversation, errorHandler);
router.get("/social/leads", auth, requireMarketingPermission(Permission.MARKETING_SOCIAL_MANAGE), getSocialLeads, errorHandler);
router.get("/dashboard", auth, requireMarketingPermission(Permission.MARKETING_DASHBOARD_VIEW), getMarketingDashboard, errorHandler);
router.post("/campaigns", auth, requireMarketingPermission(Permission.MARKETING_CAMPAIGN_CREATE), validateRequest(createMarketingCampaignSchema), createMarketingCampaign, errorHandler);
router.patch("/campaigns/:campaignId", auth, requireMarketingPermission(Permission.MARKETING_CAMPAIGN_UPDATE), validateRequest(updateMarketingCampaignSchema), updateMarketingCampaign, errorHandler);
router.patch("/campaigns/:campaignId/submit", auth, requireMarketingPermission(Permission.MARKETING_CAMPAIGN_UPDATE), submitMarketingCampaign, errorHandler);
router.patch("/campaigns/:campaignId/review", auth, requireMarketingPermission(Permission.MARKETING_APPROVAL_MANAGE), validateRequest(reviewMarketingCampaignSchema), reviewMarketingCampaign, errorHandler);
router.get("/content", auth, requireMarketingPermission(Permission.MARKETING_DASHBOARD_VIEW), getMarketingContent, errorHandler);
router.post("/content", auth, requireMarketingPermission(Permission.MARKETING_CONTENT_MANAGE), validateRequest(createMarketingContentSchema), createMarketingContent, errorHandler);
router.patch("/content/:contentId", auth, requireMarketingPermission(Permission.MARKETING_CONTENT_MANAGE), validateRequest(updateMarketingContentSchema), updateMarketingContent, errorHandler);
router.get("/leads/sales-owners", auth, requireMarketingPermission(Permission.MARKETING_LEAD_HANDOFF), listMarketingSalesOwners, errorHandler);
router.post("/leads/handoff", auth, requireMarketingPermission(Permission.MARKETING_LEAD_HANDOFF), validateRequest(handoffMarketingLeadSchema), handoffMarketingLeadToSales, errorHandler);
router.post("/tasks", auth, requireMarketingPermission(Permission.MARKETING_TASK_ASSIGN), validateRequest(createMarketingTaskSchema), createMarketingTask, errorHandler);
router.patch("/tasks/:taskId/complete", auth, requireMarketingPermission(Permission.MARKETING_TASK_UPDATE), completeMarketingTask, errorHandler);
export default router;
