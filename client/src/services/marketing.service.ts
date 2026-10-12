import type {
  CreateMarketingCampaignInput,
  CreateMarketingContentInput,
  CreateMarketingTaskInput,
  MarketingCampaign,
  MarketingBlog,
  MarketingContent,
  MarketingDashboard,
  MarketingLeadHandoffInput,
  MarketingSalesOwner,
  MarketingSocialAccount,
  MarketingSocialConversation,
  MarketingSocialMessage,
  MarketingSocialPost,
  SaveMarketingBlogInput,
} from "@/types/marketing";
import type { SalesLead } from "@/types/sales";
import api from "./axios";

export const MarketingService = {
  async blogs() {
    const response = await api.get<{ success: true; blogs: MarketingBlog[] }>(
      "/marketing/blogs",
    );
    return response.data.blogs;
  },
  async createBlog(input: SaveMarketingBlogInput, thumbnail: File) {
    const form = marketingBlogForm(input, thumbnail);
    const response = await api.post<{ success: true; blog: MarketingBlog }>(
      "/marketing/blogs",
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data.blog;
  },
  async updateBlog(
    blogId: string,
    input: SaveMarketingBlogInput,
    thumbnail?: File,
  ) {
    const form = marketingBlogForm(input, thumbnail);
    const response = await api.patch<{ success: true; blog: MarketingBlog }>(
      `/marketing/blogs/${blogId}`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data.blog;
  },
  async dashboard() {
    const response = await api.get<{
      success: true;
      dashboard: MarketingDashboard;
    }>("/marketing/dashboard");
    return response.data.dashboard;
  },
  async createCampaign(input: CreateMarketingCampaignInput) {
    const response = await api.post<{
      success: true;
      campaign: MarketingCampaign;
    }>("/marketing/campaigns", input);
    return response.data.campaign;
  },
  async updateCampaign(
    campaignId: string,
    input: Partial<
      Pick<
        MarketingCampaign,
        | "objective"
        | "category"
        | "audience"
        | "channels"
        | "budget"
        | "targetLeads"
        | "targetConversions"
        | "startDate"
        | "endDate"
        | "teamMemberIds"
        | "status"
        | "spend"
        | "leads"
        | "conversions"
        | "revenue"
      >
    >,
  ) {
    const response = await api.patch<{
      success: true;
      campaign: MarketingCampaign;
    }>(`/marketing/campaigns/${campaignId}`, input);
    return response.data.campaign;
  },
  async submitCampaign(campaignId: string) {
    const response = await api.patch<{
      success: true;
      campaign: MarketingCampaign;
    }>(`/marketing/campaigns/${campaignId}/submit`);
    return response.data.campaign;
  },
  async reviewCampaign(
    campaignId: string,
    input: { decision: "APPROVE" | "CHANGES_REQUESTED"; note?: string },
  ) {
    const response = await api.patch<{
      success: true;
      campaign: MarketingCampaign;
    }>(`/marketing/campaigns/${campaignId}/review`, input);
    return response.data.campaign;
  },
  async createTask(input: CreateMarketingTaskInput) {
    const response = await api.post("/marketing/tasks", input);
    return response.data.tasks;
  },
  async completeTask(taskId: string) {
    const response = await api.patch(`/marketing/tasks/${taskId}/complete`);
    return response.data.task;
  },
  async content() {
    const response = await api.get<{ success: true; content: MarketingContent[] }>("/marketing/content");
    return response.data.content;
  },
  async createContent(input: CreateMarketingContentInput) {
    const response = await api.post<{ success: true; content: MarketingContent }>("/marketing/content", input);
    return response.data.content;
  },
  async updateContent(contentId: string, input: Partial<MarketingContent>) {
    const response = await api.patch<{ success: true; content: MarketingContent }>(`/marketing/content/${contentId}`, input);
    return response.data.content;
  },
  async salesOwners() {
    const response = await api.get<{ success: true; salesOwners: MarketingSalesOwner[] }>("/marketing/leads/sales-owners");
    return response.data.salesOwners;
  },
  async handoffLead(input: MarketingLeadHandoffInput) {
    const response = await api.post<{ success: true; lead: SalesLead }>("/marketing/leads/handoff", input);
    return response.data.lead;
  },
  async socialAccounts() {
    const response = await api.get<{ success: true; accounts: MarketingSocialAccount[] }>("/marketing/social/accounts");
    return response.data.accounts;
  },
  async startSocialConnection(provider: "linkedin" | "meta" | "whatsapp") {
    const response = await api.post<{ success: true; authorizationUrl: string }>(`/marketing/social/connect/${provider}`);
    return response.data.authorizationUrl;
  },
  async disconnectSocialAccount(accountId: string) {
    const response = await api.delete<{ success: true }>(`/marketing/social/accounts/${accountId}`);
    return response.data;
  },
  async socialPosts() {
    const response = await api.get<{ success: true; posts: MarketingSocialPost[]; syncWarnings: string[] }>("/marketing/social/posts");
    return { posts: response.data.posts, syncWarnings: response.data.syncWarnings };
  },
  async createSocialPost(input: { accountId: string; text: string; mediaUrl?: string; publishNow: boolean }) {
    const response = await api.post<{ success: true; post: MarketingSocialPost }>("/marketing/social/posts", input);
    return response.data.post;
  },
  async socialInbox() {
    const response = await api.get<{ success: true; conversations: MarketingSocialConversation[]; messages: MarketingSocialMessage[] }>("/marketing/social/inbox");
    return response.data;
  },
  async markSocialRead(conversationId: string) {
    await api.patch(`/marketing/social/inbox/${conversationId}/read`);
  },
  async replyToSocialConversation(conversationId: string, text: string) {
    const response = await api.post(`/marketing/social/inbox/${conversationId}/reply`, { text });
    return response.data.message as MarketingSocialMessage;
  },
  async socialLeads() {
    const response = await api.get<{ success: true; leads: Array<{ _id: string; name: string; company?: string; source: string; sourceDetail?: string; status: string; ownerId?: { name: string } | null; createdAt: string }> }>("/marketing/social/leads");
    return response.data.leads;
  },
};

function marketingBlogForm(input: SaveMarketingBlogInput, thumbnail?: File) {
  const form = new FormData();
  form.append("title", input.title);
  form.append("description", input.description);
  form.append("details", input.details);
  form.append("published", String(input.published));
  if (thumbnail) form.append("thumbnail", thumbnail);
  return form;
}
