import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  MarketingCampaign,
  MarketingCampaignStatus,
  MarketingContent,
  MarketingContentStatus,
  OrganizationAssignment,
  OrganizationDepartment,
  OrganizationLevel,
  SalesLead,
  SalesLeadPriority,
  Task,
  TaskStatus,
  TaskWorkflowStage,
} from "../../models/index.js";
import { SalesPipeline } from "../../models/salesPipeline.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { UserRole } from "../auth/authorization.js";
import { managedUserIds } from "../organization/organization.controller.js";
import type { MarketingAccessScope } from "./marketing.authorization.js";
import { requestRoles } from "../organization/organization.roles.js";
import { defaultPipeline, pipelineDestination } from "../sales/sales.pipeline.js";

type MarketingAccess = {
  assignment?: { reportsTo?: unknown };
  level: OrganizationLevel | null;
  employmentType: string | null;
  scope: MarketingAccessScope;
};

async function visibleUserIds(
  access: MarketingAccess,
  actorId: Types.ObjectId,
) {
  if (access.scope === "OWN") return [actorId];
  if (access.scope === "TEAM")
    return (await managedUserIds(actorId, false)) ?? [actorId];
  return undefined;
}

function assignable(
  access: MarketingAccess,
  actorId: Types.ObjectId,
  assignment: { level: OrganizationLevel; reportsTo?: unknown },
) {
  if (!access.level) return true;
  const direct = String(assignment.reportsTo ?? "") === String(actorId);
  if (access.level === OrganizationLevel.HEAD)
    return direct && assignment.level === OrganizationLevel.MANAGER;
  if (access.level === OrganizationLevel.MANAGER)
    return direct && assignment.level === OrganizationLevel.MEMBER;
  return false;
}

async function assertAssignable(
  access: MarketingAccess,
  actorId: Types.ObjectId,
  userId: string,
) {
  if (!Types.ObjectId.isValid(userId))
    throw new ApiError(400, "Invalid assignee id");
  const assignment = await OrganizationAssignment.findOne({
    userId,
    department: OrganizationDepartment.MARKETING,
    active: true,
  })
    .select("level reportsTo")
    .lean();
  if (!assignment || !assignable(access, actorId, assignment))
    throw new ApiError(
      403,
      "Select a direct report in your Marketing hierarchy",
    );
}

const campaignFilter = async (
  access: MarketingAccess,
  actorId: Types.ObjectId,
) => {
  const ids = await visibleUserIds(access, actorId);
  return ids
    ? { $or: [{ ownerId: { $in: ids } }, { teamMemberIds: { $in: ids } }] }
    : {};
};

const contentFilter = async (
  access: MarketingAccess,
  actorId: Types.ObjectId,
) => {
  const ids = await visibleUserIds(access, actorId);
  if (!ids) return {};
  const visibleIds = [...new Set([String(actorId), ...ids.map(String)])].map(
    (id) => new Types.ObjectId(id),
  );
  return {
    $or: [
      { ownerId: { $in: visibleIds } },
      { assignedTo: { $in: visibleIds } },
    ],
  };
};

export async function getMarketingDashboard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.marketingAccess as MarketingAccess;
    const actorId = req.authUser!._id;
    const ids = await visibleUserIds(access, actorId);
    const [campaigns, tasks, approvals, assignments] = await Promise.all([
      MarketingCampaign.find(await campaignFilter(access, actorId))
        .populate("ownerId", "name email roles")
        .populate("teamMemberIds", "name email roles")
        .populate("submittedBy reviewedBy", "name email roles")
        .sort({ startDate: -1 })
        .lean(),
      Task.find({
        department: OrganizationDepartment.MARKETING,
        ...(ids ? { assignedTo: { $in: ids } } : {}),
      })
        .select(
          "title description deadline priority assignedTo assignedBy status workflowStage currentOwner",
        )
        .populate("assignedTo", "name email roles")
        .sort({ status: 1, deadline: 1 })
        .limit(150)
        .lean(),
      Task.find({
        department: OrganizationDepartment.MARKETING,
        currentOwner: actorId,
        workflowStage: {
          $in: [
            TaskWorkflowStage.MANAGER_REVIEW,
            TaskWorkflowStage.HEAD_REVIEW,
            TaskWorkflowStage.ADMIN_FINAL_REVIEW,
            TaskWorkflowStage.CEO_REVIEW,
          ],
        },
      })
        .select(
          "title description deadline priority assignedTo status workflowStage",
        )
        .populate("assignedTo", "name email roles")
        .sort({ deadline: 1 })
        .lean(),
      access.scope === "OWN"
        ? Promise.resolve([])
        : OrganizationAssignment.find({
            department: OrganizationDepartment.MARKETING,
            active: true,
            ...(ids ? { userId: { $in: ids } } : {}),
          })
            .select("userId level employmentType reportsTo")
            .populate("userId", "name email roles")
            .sort({ level: 1 })
            .lean(),
    ]);
    const attributedLeads = campaigns.length
      ? await SalesLead.find({
          campaignId: { $in: campaigns.map((campaign) => campaign._id) },
        })
          .select("campaignId status expectedValue")
          .lean()
      : [];
    const attributionByCampaign = new Map<
      string,
      { leads: number; conversions: number; revenue: number }
    >();
    for (const lead of attributedLeads) {
      const key = String(lead.campaignId);
      const current = attributionByCampaign.get(key) ?? {
        leads: 0,
        conversions: 0,
        revenue: 0,
      };
      current.leads += 1;
      if (lead.status === "WON") {
        current.conversions += 1;
        current.revenue += lead.expectedValue;
      }
      attributionByCampaign.set(key, current);
    }
    const campaignViews = campaigns.map((campaign) => ({
      ...campaign,
      category: campaign.category ?? null,
      audience: campaign.audience ?? "",
      targetLeads: campaign.targetLeads ?? 0,
      targetConversions: campaign.targetConversions ?? 0,
      attributedLeads: attributionByCampaign.get(String(campaign._id))?.leads ?? 0,
      attributedConversions: attributionByCampaign.get(String(campaign._id))?.conversions ?? 0,
      attributedRevenue: attributionByCampaign.get(String(campaign._id))?.revenue ?? 0,
    }));
    const metricCampaigns = campaignViews.map((campaign) => ({
      ...campaign,
      leads: campaign.attributedLeads || campaign.leads,
      conversions: campaign.attributedLeads
        ? campaign.attributedConversions
        : campaign.conversions,
      revenue: campaign.attributedLeads
        ? campaign.attributedRevenue
        : campaign.revenue,
    }));
    const now = Date.now();
    const taskViews = tasks.map((task) => ({
      ...task,
      effectiveStatus:
        task.status === TaskStatus.PENDING && +new Date(task.deadline) < now
          ? "OVERDUE"
          : task.status,
    }));
    const activeCampaigns = campaigns.filter(
      (campaign) => campaign.status === MarketingCampaignStatus.ACTIVE,
    );
    const campaignApprovals =
      access.level === OrganizationLevel.MANAGER
        ? []
        : campaigns.filter(
            (campaign) =>
              campaign.status === MarketingCampaignStatus.PENDING_APPROVAL &&
              (access.level !== OrganizationLevel.HEAD ||
                String(campaign.submittedBy) !== String(actorId)),
          );
    const spend = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
    const revenue = metricCampaigns.reduce(
      (sum, campaign) => sum + campaign.revenue,
      0,
    );
    const budget = campaigns.reduce(
      (sum, campaign) => sum + campaign.budget,
      0,
    );
    const channelMap = new Map<
      string,
      { leads: number; spend: number; revenue: number }
    >();
    for (const campaign of metricCampaigns)
      for (const channel of campaign.channels) {
        const current = channelMap.get(channel) ?? {
          leads: 0,
          spend: 0,
          revenue: 0,
        };
        const divisor = Math.max(1, campaign.channels.length);
        channelMap.set(channel, {
          leads: current.leads + Math.round(campaign.leads / divisor),
          spend: current.spend + Math.round(campaign.spend / divisor),
          revenue: current.revenue + Math.round(campaign.revenue / divisor),
        });
      }
    return res.json({
      success: true,
      dashboard: {
        actorId,
        scope: access.scope,
        level: access.level,
        employmentType: access.employmentType,
        actorRole: requestRoles(req).includes(UserRole.CEO)
          ? "CEO"
          : requestRoles(req).includes(UserRole.ADMIN)
            ? "ADMIN"
            : null,
        metrics: {
          activeCampaigns: activeCampaigns.length,
          totalLeads: metricCampaigns.reduce((sum, item) => sum + item.leads, 0),
          conversions: metricCampaigns.reduce(
            (sum, item) => sum + item.conversions,
            0,
          ),
          roi: spend ? Math.round((revenue / spend) * 10) / 10 : 0,
          budgetUtilization: budget ? Math.round((spend / budget) * 100) : 0,
          budget,
          spend,
          revenue,
          pendingTasks: taskViews.filter(
            (task) => task.status === TaskStatus.PENDING,
          ).length,
          pendingApprovals:
            approvals.length + campaignApprovals.length,
        },
        channelPerformance: [...channelMap.entries()].map(
          ([channel, values]) => ({ channel, ...values }),
        ),
        campaigns: campaignViews,
        tasks: taskViews,
        approvals,
        campaignApprovals,
        team: assignments.map((assignment: any) => ({
          user: assignment.userId,
          level: assignment.level,
          employmentType:
            assignment.employmentType ??
            (assignment.userId?.roles?.includes("INTERN")
              ? "INTERN"
              : "EMPLOYEE"),
          reportsTo: assignment.reportsTo,
          assignable:
            String(assignment.userId?._id ?? assignment.userId) !==
              String(actorId) && assignable(access, actorId, assignment),
          activeTasks: taskViews.filter(
            (task: any) =>
              String(task.assignedTo?._id ?? task.assignedTo) ===
                String(assignment.userId?._id ?? assignment.userId) &&
              task.status === TaskStatus.PENDING,
          ).length,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMarketingContent(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const access = res.locals.marketingAccess as MarketingAccess;
      const content = await MarketingContent.find(
        await contentFilter(access, req.authUser!._id),
      )
        .populate("ownerId assignedTo", "name email roles")
        .populate("campaignId", "name")
        .sort({ scheduledAt: 1, updatedAt: -1 })
        .limit(500)
        .lean();
      return res.json({ success: true, content });
    } catch (error) {
      next(error);
    }
  }

  export async function createMarketingContent(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const access = res.locals.marketingAccess as MarketingAccess;
      const actorId = req.authUser!._id;
      const assigneeId = String(req.body.assigneeId ?? actorId);
      if (assigneeId !== String(actorId))
        await assertAssignable(access, actorId, assigneeId);
      let campaignId: Types.ObjectId | null = null;
      if (req.body.campaignId) {
        const campaign = await MarketingCampaign.findOne({
          _id: req.body.campaignId,
          ...(await campaignFilter(access, actorId)),
        }).select("_id");
        if (!campaign) throw new ApiError(404, "Marketing campaign not found");
        campaignId = campaign._id;
      }
      const content = await MarketingContent.create({
        title: req.body.title,
        brief: req.body.brief,
        type: req.body.type,
        channel: req.body.channel,
        campaignId,
        ownerId: actorId,
        assignedTo: assigneeId,
        scheduledAt: req.body.scheduledAt ?? null,
        assetUrl: req.body.assetUrl ?? "",
      });
      await content.populate([
        { path: "ownerId assignedTo", select: "name email roles" },
        { path: "campaignId", select: "name" },
      ]);
      return res.status(201).json({ success: true, content });
    } catch (error) {
      next(error);
    }
  }

  export async function updateMarketingContent(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const access = res.locals.marketingAccess as MarketingAccess;
      const actorId = req.authUser!._id;
      const contentId = String(req.params.contentId);
      if (!Types.ObjectId.isValid(contentId))
        throw new ApiError(400, "Invalid content id");
      const content = await MarketingContent.findOne({
        _id: contentId,
        ...(await contentFilter(access, actorId)),
      });
      if (!content) throw new ApiError(404, "Marketing content not found");
      const roles = requestRoles(req);
      const executive = roles.includes(UserRole.ADMIN) || roles.includes(UserRole.CEO);
      const canManageTeam = executive || access.scope === "DEPARTMENT" ||
        access.level === OrganizationLevel.HEAD ||
        access.level === OrganizationLevel.MANAGER;
      if (!canManageTeam && String(content.assignedTo) !== String(actorId))
        throw new ApiError(403, "You can only update content assigned to you");
      if (req.body.status && req.body.status !== content.status) {
        const transitions: Record<MarketingContentStatus, MarketingContentStatus[]> = {
          [MarketingContentStatus.IDEA]: [MarketingContentStatus.IN_PRODUCTION],
          [MarketingContentStatus.IN_PRODUCTION]: [MarketingContentStatus.INTERNAL_REVIEW],
          [MarketingContentStatus.INTERNAL_REVIEW]: [MarketingContentStatus.APPROVED, MarketingContentStatus.CHANGES_REQUESTED],
          [MarketingContentStatus.CHANGES_REQUESTED]: [MarketingContentStatus.IN_PRODUCTION],
          [MarketingContentStatus.APPROVED]: [MarketingContentStatus.SCHEDULED],
          [MarketingContentStatus.SCHEDULED]: [MarketingContentStatus.PUBLISHED],
          [MarketingContentStatus.PUBLISHED]: [MarketingContentStatus.ANALYZED],
          [MarketingContentStatus.ANALYZED]: [],
        };
        if (!transitions[content.status].includes(req.body.status))
          throw new ApiError(409, "This content workflow transition is not allowed");
        if (
          [MarketingContentStatus.APPROVED, MarketingContentStatus.CHANGES_REQUESTED].includes(req.body.status) &&
          (!canManageTeam || (!executive && String(content.assignedTo) === String(actorId)))
        )
          throw new ApiError(403, "Content reviews require an independent Marketing manager or executive");
        if (
          req.body.status === MarketingContentStatus.SCHEDULED &&
          !(req.body.scheduledAt ?? content.scheduledAt)
        )
          throw new ApiError(400, "Set a publishing date before scheduling content");
        if (
          req.body.status === MarketingContentStatus.PUBLISHED &&
          !(req.body.publishedUrl ?? content.publishedUrl)
        )
          throw new ApiError(400, "Add the published URL before marking content as published");
        content.status = req.body.status;
        if (
          [MarketingContentStatus.APPROVED, MarketingContentStatus.CHANGES_REQUESTED].includes(req.body.status)
        ) {
          content.reviewedBy = actorId;
          content.reviewedAt = new Date();
        }
      }
      if (
        (req.body.impressions !== undefined ||
          req.body.clicks !== undefined ||
          req.body.conversions !== undefined) &&
        ![MarketingContentStatus.PUBLISHED, MarketingContentStatus.ANALYZED].includes(content.status)
      )
        throw new ApiError(409, "Content performance can only be recorded after publication");
      content.set({
        ...(req.body.title !== undefined ? { title: req.body.title } : {}),
        ...(req.body.brief !== undefined ? { brief: req.body.brief } : {}),
        ...(req.body.scheduledAt !== undefined ? { scheduledAt: req.body.scheduledAt } : {}),
        ...(req.body.assetUrl !== undefined ? { assetUrl: req.body.assetUrl } : {}),
        ...(req.body.publishedUrl !== undefined ? { publishedUrl: req.body.publishedUrl } : {}),
        ...(req.body.approvalNote !== undefined ? { approvalNote: req.body.approvalNote } : {}),
        ...(req.body.impressions !== undefined ? { impressions: req.body.impressions } : {}),
        ...(req.body.clicks !== undefined ? { clicks: req.body.clicks } : {}),
        ...(req.body.conversions !== undefined ? { conversions: req.body.conversions } : {}),
      });
      await content.save();
      await content.populate([
        { path: "ownerId assignedTo", select: "name email roles" },
        { path: "campaignId", select: "name" },
      ]);
      return res.json({ success: true, content });
    } catch (error) {
      next(error);
    }
  }

  export async function listMarketingSalesOwners(
    _req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const assignments = await OrganizationAssignment.find({
        department: OrganizationDepartment.SALES,
        active: true,
        level: { $in: [OrganizationLevel.HEAD, OrganizationLevel.MANAGER] },
      })
        .select("userId level")
        .populate("userId", "name")
        .sort({ level: 1 })
        .lean();
      const salesOwners = assignments.flatMap((assignment) => {
        const user = assignment.userId as unknown as { _id: Types.ObjectId; name: string } | null;
        return user ? [{ _id: user._id, name: user.name, level: assignment.level }] : [];
      });
      return res.json({ success: true, salesOwners });
    } catch (error) {
      next(error);
    }
  }

  export async function handoffMarketingLeadToSales(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const access = res.locals.marketingAccess as MarketingAccess;
      const actorId = req.authUser!._id;
      const salesOwnerId = String(req.body.salesOwnerId);
      const salesAssignment = await OrganizationAssignment.findOne({
        userId: salesOwnerId,
        department: OrganizationDepartment.SALES,
        active: true,
        level: { $in: [OrganizationLevel.HEAD, OrganizationLevel.MANAGER] },
      }).select("userId");
      if (!salesAssignment)
        throw new ApiError(400, "Select an active Sales Head or Sales Manager");
      let campaign = null;
      if (req.body.campaignId) {
        campaign = await MarketingCampaign.findOne({
          _id: req.body.campaignId,
          ...(await campaignFilter(access, actorId)),
        }).select("name status");
        if (!campaign) throw new ApiError(404, "Marketing campaign not found");
        if (campaign.status === MarketingCampaignStatus.CANCELLED)
          throw new ApiError(409, "Leads cannot be attributed to a cancelled campaign");
      }
      const duplicateConditions = [
        { phone: req.body.phone },
        ...(req.body.email ? [{ email: String(req.body.email).toLowerCase() }] : []),
      ];
      if (await SalesLead.exists({ $or: duplicateConditions }))
        throw new ApiError(409, "A matching contact already exists in the Sales CRM; update that lead instead");
      const pipelineDefinition = await SalesPipeline.findOne({ key: "Sales" }).lean();
      const destination = pipelineDestination(pipelineDefinition ?? defaultPipeline());
      const lead = await SalesLead.create({
        name: req.body.name,
        company: req.body.company,
        email: req.body.email || undefined,
        phone: req.body.phone,
        source: req.body.source,
        sourceCategory: "MARKETING",
        sourceDetail: campaign ? campaign.name : "Marketing handoff",
        campaignId: campaign?._id ?? null,
        marketingConsentAt: new Date(),
        serviceInterest: req.body.serviceInterest,
        notes: req.body.notes,
        priority: SalesLeadPriority.MEDIUM,
        expectedValue: 0,
        currency: "INR",
        ...destination,
        ownerId: salesOwnerId,
        assignedBy: actorId,
        createdBy: actorId,
        department: OrganizationDepartment.SALES,
        assignmentHistory: [{
          assignedBy: actorId,
          previousOwner: null,
          newOwner: salesOwnerId,
          reason: campaign ? `Marketing handoff: ${campaign.name}` : "Marketing lead handoff",
          timestamp: new Date(),
        }],
      });
      await lead.populate("ownerId", "name email roles");
      return res.status(201).json({ success: true, lead });
    } catch (error) {
      next(error);
    }
}

export async function createMarketingCampaign(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.marketingAccess as MarketingAccess;
    const actorId = req.authUser!._id;
    await Promise.all(
      req.body.teamMemberIds.map((id: string) =>
        assertAssignable(access, actorId, id),
      ),
    );
    const campaign = await MarketingCampaign.create({
      ...req.body,
      ownerId: actorId,
      createdBy: actorId,
    });
    await campaign.populate("ownerId teamMemberIds", "name email roles");
    return res.status(201).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
}

export async function updateMarketingCampaign(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.marketingAccess as MarketingAccess;
    const campaignId = String(req.params.campaignId);
    if (!Types.ObjectId.isValid(campaignId))
      throw new ApiError(400, "Invalid campaign id");
    const campaign = await MarketingCampaign.findOne({
      _id: campaignId,
      ...(await campaignFilter(access, req.authUser!._id)),
    });
    if (!campaign) throw new ApiError(404, "Marketing campaign not found");
    const planFields = [
      "objective",
      "channels",
      "budget",
      "startDate",
      "endDate",
      "teamMemberIds",
    ];
    if (planFields.some((field) => req.body[field] !== undefined)) {
      if (
        ![
          MarketingCampaignStatus.DRAFT,
          MarketingCampaignStatus.CHANGES_REQUESTED,
        ].includes(campaign.status)
      )
        throw new ApiError(
          409,
          "Only draft or returned campaign plans can be edited",
        );
      if (req.body.teamMemberIds)
        await Promise.all(
          req.body.teamMemberIds.map((id: string) =>
            assertAssignable(access, req.authUser!._id, id),
          ),
        );
      const startDate = req.body.startDate ?? campaign.startDate;
      const endDate = req.body.endDate ?? campaign.endDate;
      if (endDate < startDate)
        throw new ApiError(
          400,
          "Campaign end date must be on or after start date",
        );
    }
    const resultFields = ["spend", "leads", "conversions", "revenue"];
    if (
      resultFields.some((field) => req.body[field] !== undefined) &&
      ![
        MarketingCampaignStatus.APPROVED,
        MarketingCampaignStatus.ACTIVE,
        MarketingCampaignStatus.PAUSED,
        MarketingCampaignStatus.COMPLETED,
      ].includes(campaign.status)
    )
      throw new ApiError(
        409,
        "Campaign results can only be recorded after approval",
      );
    if (req.body.status) {
      const transitions: Partial<
        Record<MarketingCampaignStatus, MarketingCampaignStatus[]>
      > = {
        [MarketingCampaignStatus.APPROVED]: [
          MarketingCampaignStatus.ACTIVE,
          MarketingCampaignStatus.CANCELLED,
        ],
        [MarketingCampaignStatus.ACTIVE]: [
          MarketingCampaignStatus.PAUSED,
          MarketingCampaignStatus.COMPLETED,
          MarketingCampaignStatus.CANCELLED,
        ],
        [MarketingCampaignStatus.PAUSED]: [
          MarketingCampaignStatus.ACTIVE,
          MarketingCampaignStatus.COMPLETED,
          MarketingCampaignStatus.CANCELLED,
        ],
      };
      if (!transitions[campaign.status]?.includes(req.body.status))
        throw new ApiError(
          409,
          "This campaign status transition is not allowed",
        );
    }
    campaign.set(req.body);
    await campaign.save();
    return res.json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
}

export async function submitMarketingCampaign(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.marketingAccess as MarketingAccess;
    const campaignId = String(req.params.campaignId);
    if (!Types.ObjectId.isValid(campaignId))
      throw new ApiError(400, "Invalid campaign id");
    const campaign = await MarketingCampaign.findOne({
      _id: campaignId,
      ...(await campaignFilter(access, req.authUser!._id)),
    });
    if (!campaign) throw new ApiError(404, "Marketing campaign not found");
    if (
      ![
        MarketingCampaignStatus.DRAFT,
        MarketingCampaignStatus.CHANGES_REQUESTED,
      ].includes(campaign.status)
    )
      throw new ApiError(
        409,
        "Only draft or returned campaigns can be submitted",
      );
    campaign.status = MarketingCampaignStatus.PENDING_APPROVAL;
    campaign.submittedBy = req.authUser!._id;
    campaign.submittedAt = new Date();
    campaign.reviewedBy = null;
    campaign.reviewedAt = null;
    await campaign.save();
    return res.json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
}

export async function reviewMarketingCampaign(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.marketingAccess as MarketingAccess;
    const campaignId = String(req.params.campaignId);
    if (!Types.ObjectId.isValid(campaignId))
      throw new ApiError(400, "Invalid campaign id");
    const campaign = await MarketingCampaign.findOne({
      _id: campaignId,
      ...(await campaignFilter(access, req.authUser!._id)),
    });
    if (!campaign) throw new ApiError(404, "Marketing campaign not found");
    if (campaign.status !== MarketingCampaignStatus.PENDING_APPROVAL)
      throw new ApiError(409, "Campaign is not awaiting approval");
    const executive = requestRoles(req).some(
      (role) => role === UserRole.ADMIN || role === UserRole.CEO,
    );
    if (!executive && access.level !== OrganizationLevel.HEAD)
      throw new ApiError(
        403,
        "Only the Marketing Head, Admin, or CEO can review campaigns",
      );
    if (
      String(campaign.submittedBy) === String(req.authUser!._id) &&
      !executive
    )
      throw new ApiError(403, "Campaign plans require an independent reviewer");
    campaign.status =
      req.body.decision === "APPROVE"
        ? MarketingCampaignStatus.APPROVED
        : MarketingCampaignStatus.CHANGES_REQUESTED;
    campaign.approvalNote = req.body.note ?? "";
    campaign.reviewedBy = req.authUser!._id;
    campaign.reviewedAt = new Date();
    await campaign.save();
    return res.json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
}

export async function createMarketingTask(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.marketingAccess as MarketingAccess;
    const actorId = req.authUser!._id;
    const assignedToIds = [
      ...new Set<string>(req.body.assignedToIds.map(String)),
    ];
    await Promise.all(
      assignedToIds.map((id) => assertAssignable(access, actorId, id)),
    );
    const tasks = await Task.create(
      assignedToIds.map((assignedTo) => ({
        title: req.body.title,
        description: req.body.description,
        deadline: req.body.deadline,
        priority: req.body.priority,
        assignedTo,
        assignedBy: actorId,
        createdBy: actorId,
        currentOwner: assignedTo,
        department: OrganizationDepartment.MARKETING,
        workflowStage: TaskWorkflowStage.ASSIGNED,
        status: TaskStatus.PENDING,
      })),
    );
    await Task.populate(tasks, {
      path: "assignedTo",
      select: "name email roles",
    });
    return res.status(201).json({ success: true, tasks });
  } catch (error) {
    next(error);
  }
}

export async function completeMarketingTask(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.marketingAccess as MarketingAccess;
    const taskId = String(req.params.taskId);
    if (!Types.ObjectId.isValid(taskId))
      throw new ApiError(400, "Invalid task id");
    const ids = await visibleUserIds(access, req.authUser!._id);
    const task = await Task.findOne({
      _id: taskId,
      department: OrganizationDepartment.MARKETING,
      ...(ids ? { assignedTo: { $in: ids } } : {}),
    });
    if (!task) throw new ApiError(404, "Marketing task not found");
    task.status = TaskStatus.DONE;
    task.completedAt = new Date();
    await task.save();
    return res.json({ success: true, task });
  } catch (error) {
    next(error);
  }
}
