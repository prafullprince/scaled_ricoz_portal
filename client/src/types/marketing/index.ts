export type MarketingScope = "OWN" | "TEAM" | "DEPARTMENT";
export type MarketingCampaignStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";
import type { TaskPriorityValue } from "@/lib/task-priority";

export type MarketingChannel =
  "GOOGLE" | "META" | "EMAIL" | "WHATSAPP" | "LINKEDIN" | "ORGANIC" | "OTHER";
export type MarketingCampaignCategory =
  | "STRATEGY_PLANNING"
  | "PERFORMANCE_MARKETING"
  | "SEO_ORGANIC_GROWTH"
  | "CONTENT_MARKETING"
  | "SOCIAL_MEDIA"
  | "CREATIVE_BRAND"
  | "EMAIL_LIFECYCLE"
  | "EVENTS_PARTNERSHIPS"
  | "LEAD_GENERATION"
  | "WEBSITE_CONVERSION"
  | "ANALYTICS_REPORTING"
  | "RETENTION_ADVOCACY";
export type MarketingContentType =
  | "BLOG" | "SOCIAL_POST" | "EMAIL" | "VIDEO" | "WEBINAR" | "LANDING_PAGE" | "OTHER";
export type MarketingContentStatus =
  | "IDEA" | "IN_PRODUCTION" | "INTERNAL_REVIEW" | "CHANGES_REQUESTED"
  | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "ANALYZED";
export type MarketingPerson = {
  _id: string;
  name: string;
  email: string;
  roles: string[];
};
export type MarketingCampaign = {
  _id: string;
  name: string;
  objective: string;
  category: MarketingCampaignCategory | null;
  audience: string;
  channels: MarketingChannel[];
  status: MarketingCampaignStatus;
  budget: number;
  spend: number;
  leads: number;
  conversions: number;
  revenue: number;
  targetLeads: number;
  targetConversions: number;
  attributedLeads: number;
  attributedConversions: number;
  attributedRevenue: number;
  startDate: string;
  endDate: string;
  ownerId: MarketingPerson;
  teamMemberIds: MarketingPerson[] | string[];
  submittedBy?: MarketingPerson | null;
  reviewedBy?: MarketingPerson | null;
  approvalNote?: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
};
export type MarketingContent = {
  _id: string;
  title: string;
  brief: string;
  type: MarketingContentType;
  channel: MarketingChannel;
  status: MarketingContentStatus;
  campaignId?: { _id: string; name: string } | string | null;
  ownerId: MarketingPerson;
  assignedTo: MarketingPerson;
  scheduledAt?: string | null;
  assetUrl?: string;
  publishedUrl?: string;
  approvalNote?: string;
  reviewedBy?: MarketingPerson | null;
  reviewedAt?: string | null;
  impressions: number;
  clicks: number;
  conversions: number;
  createdAt: string;
  updatedAt: string;
};
export type MarketingTask = {
  _id: string;
  title: string;
  description: string;
  deadline: string;
  priority: string;
  status: "PENDING" | "DONE";
  workflowStage: string;
  effectiveStatus: "PENDING" | "DONE" | "OVERDUE";
  assignedTo?: MarketingPerson | null;
};
export type MarketingBlog = {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  details: string;
  published: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type PublicMarketingBlog = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  details: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type MarketingTeamMember = {
  user: MarketingPerson;
  level: string;
  employmentType: string;
  reportsTo: string | null;
  assignable: boolean;
  activeTasks: number;
};
export type MarketingDashboard = {
  actorId: string;
  scope: MarketingScope;
  level: string | null;
  employmentType: string | null;
  actorRole: "CEO" | "ADMIN" | null;
  metrics: {
    activeCampaigns: number;
    totalLeads: number;
    conversions: number;
    roi: number;
    budgetUtilization: number;
    budget: number;
    spend: number;
    revenue: number;
    pendingTasks: number;
    pendingApprovals: number;
  };
  channelPerformance: Array<{
    channel: string;
    leads: number;
    spend: number;
    revenue: number;
  }>;
  campaigns: MarketingCampaign[];
  campaignApprovals: MarketingCampaign[];
  tasks: MarketingTask[];
  approvals: MarketingTask[];
  team: MarketingTeamMember[];
};
export type CreateMarketingCampaignInput = {
  name: string;
  objective: string;
  category: MarketingCampaignCategory;
  audience: string;
  channels: MarketingChannel[];
  budget: number;
  targetLeads: number;
  targetConversions: number;
  startDate: string;
  endDate: string;
  teamMemberIds: string[];
};
export type CreateMarketingContentInput = {
  title: string;
  brief: string;
  type: MarketingContentType;
  channel: MarketingChannel;
  campaignId?: string;
  assigneeId?: string;
  scheduledAt?: string | null;
  assetUrl?: string;
};
export type MarketingSalesOwner = { _id: string; name: string; level: string };
export type MarketingLeadHandoffInput = {
  name: string;
  company?: string;
  email?: string;
  phone: string;
  source: import("@/types/sales").SalesLeadSource;
  serviceInterest?: string;
  notes?: string;
  campaignId?: string;
  salesOwnerId: string;
  consent: true;
};
export type MarketingSocialProvider = "LINKEDIN" | "FACEBOOK" | "INSTAGRAM" | "WHATSAPP";
export type MarketingSocialAccount = {
  _id: string;
  provider: MarketingSocialProvider;
  providerAccountId: string;
  name: string;
  avatarUrl: string;
  tokenExpiresAt: string | null;
  scopes: string[];
  pageId: string;
  businessAccountId: string;
  status: "CONNECTED" | "ERROR" | "DISCONNECTED";
  lastError: string;
  createdAt: string;
};
export type MarketingSocialPost = {
  _id: string;
  provider: MarketingSocialProvider;
  accountId: MarketingSocialAccount | string;
  text: string;
  mediaUrl: string;
  postUrl: string;
  source: "RICOZ" | "PLATFORM";
  status: "DRAFT" | "PUBLISHED" | "FAILED";
  externalPostId: string;
  error: string;
  publishedAt: string | null;
  createdAt: string;
};
export type MarketingSocialConversation = {
  _id: string;
  accountId: MarketingSocialAccount | string;
  provider: MarketingSocialProvider;
  externalConversationId: string;
  participantId: string;
  participantName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};
export type MarketingSocialMessage = {
  _id: string;
  conversationId: string;
  externalMessageId: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  sentAt: string;
  deliveryStatus: "RECEIVED" | "SENT" | "FAILED";
};
export type CreateMarketingTaskInput = {
  title: string;
  description: string;
  assignedToIds: string[];
  priority: TaskPriorityValue;
  deadline: string;
};
export type SaveMarketingBlogInput = Pick<
  MarketingBlog,
  "title" | "description" | "details" | "published"
>;
