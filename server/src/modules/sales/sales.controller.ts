import type { NextFunction, Request, Response } from "express";
import { Error as MongooseError, Types } from "mongoose";
import otpGenerator from "otp-generator";
import { z } from "zod";
import {
  ChatMessage,
  Conversation,
  ConversationType,
  OrganizationAssignment,
  OrganizationDepartment,
  OrganizationLevel,
  OTP,
  OtpPurpose,
  SalesDesignation,
  SalesLead,
  SalesLeadPriority,
  SalesLeadSource,
  SalesLeadStatus,
  Task,
  TaskStatus,
  TaskWorkflowStage,
  User,
} from "../../models/index.js";
import { managedUserIds } from "../organization/organization.controller.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { sendEmail } from "../../utils/email.utils.js";
import { otpMatches, otpStorageValue } from "../../utils/otp.utils.js";
import { hashToken } from "../../utils/tokens.js";
import { Permission } from "../auth/authorization.js";
import { currentScope } from "../company/company.context.js";
import { visibleSalesUserIds, type SalesAccess, type SalesAccessScope } from "./sales.authorization.js";
import { bulkUpdateImportedSalesLeadsSchema, importSalesLeadsSchema, listSalesLeadsSchema, salesLeadDeletionSchema, type SalesLeadFilter } from "./sales.validation.js";
import { SalesPipeline, type ISalesPipeline } from "../../models/salesPipeline.models.js";
import { assertPipelineRevision, assertSalesStageEvidence, defaultPipeline, pipelineDestination } from "./sales.pipeline.js";
import {
  clearActiveGroupCall,
  publishChatEvent,
} from "../chat/chat.infrastructure.js";

const importedLeadFilterFields = new Set([
  "alternativemobnumber", "alternativemobilenumber", "alternativephone",
  "activities", "companyaddress", "companylocation", "description",
  "emailoptout", "feedback1", "feedback2", "feedback3", "firstname",
  "fulladdress", "address", "lastname", "notes", "relatedrecordaction",
  "ref", "reference", "teamleadercallfeedback", "unsubscribedmode",
  "unsubscribedtime",
]);

type ImportedLeadFilterRecord = {
  name: string;
  company?: string;
  email?: string;
  phone: string;
  source: string;
  sourceCategory?: string;
  notes?: string;
  pipeline?: string;
  stageId?: string;
  status: string;
  expectedValue: number;
  expectedCloseAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  activities?: Array<{ text: string; createdAt: Date }>;
  externalPayload?: Record<string, unknown>;
  filterOverrides?: Record<string, string>;
};

function buildImportedLeadFilterValues(
  lead: ImportedLeadFilterRecord,
  names: { owner: string; createdBy: string; modifiedBy: string },
): Record<string, string | number | boolean> {
  const rawFields = Object.fromEntries(
    Object.entries(lead.externalPayload ?? {})
      .map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), String(value)] as const)
      .filter(([key]) => importedLeadFilterFields.has(key)),
  );
  const rawValue = (...keys: string[]) => keys
    .map((key) => rawFields[key.toLowerCase().replace(/[^a-z0-9]/g, "")])
    .find((value) => value !== undefined) ?? "";
  const activities = lead.activities ?? [];
  const lastActivity = [...activities].sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())[0];
  const nameParts = lead.name.trim().split(/\s+/);
  const activityText = activities.map((activity) => activity.text).join(" ");

  const filterValues: Record<string, string | number | boolean> = {
    ...rawFields,
    touchedrecords: activities.length > 0,
    untouchedrecords: activities.length === 0,
    recordaction: "Imported",
    relatedrecordaction: rawValue("related record action"),
    activities: activityText || rawValue("activities"),
    notes: rawValue("notes") || lead.notes || "",
    pipelines: "Client Lists",
    pipelinesubpipeline: "",
    pipelineamount: lead.expectedValue / 100,
    pipelinestage: "Client Lists",
    pipelineclosingdate: lead.expectedCloseAt?.toISOString() ?? "",
    pipelinerecordowner: names.owner,
    alternativemobnumber: rawValue("alternative mob number", "alternative mobile number", "alternative phone"),
    clientname: lead.name,
    clientowner: names.owner,
    companyname: lead.company ?? "",
    companyaddress: rawValue("company address", "company location"),
    createdby: names.createdBy,
    createdtime: lead.createdAt.toISOString(),
    description: rawValue("description") || lead.notes || "",
    email: lead.email ?? "",
    emailoptout: rawValue("email opt out", "email opt-out"),
    feedback1: rawValue("feedback 1"),
    feedback2: rawValue("feedback 2"),
    feedback3: rawValue("feedback 3"),
    firstname: rawValue("first name") || nameParts[0] || "",
    fulladdress: rawValue("full address", "address", "company address"),
    lastactivitytime: lastActivity?.createdAt.toISOString() ?? "",
    lastname: rawValue("last name") || nameParts.slice(1).join(" "),
    leadsource: lead.sourceCategory || lead.source,
    modifiedby: names.modifiedBy,
    modifiedtime: lead.updatedAt.toISOString(),
    phone: lead.phone,
    ref: rawValue("ref", "reference"),
    teamleadercallfeedback: rawValue("team leader call feedback"),
    unsubscribedmode: rawValue("unsubscribed mode"),
    unsubscribedtime: rawValue("unsubscribed time"),
  };
  for (const [key, value] of Object.entries(lead.filterOverrides ?? {})) {
    filterValues[key] = value;
  }
  return filterValues;
}

async function assertVisibleSalesOwner(
  access: SalesAccess,
  actorId: Types.ObjectId,
  ownerId: string,
) {
  if (!Types.ObjectId.isValid(ownerId))
    throw new ApiError(400, "Invalid owner id");
  const visibleUserIds = await visibleSalesUserIds(access, actorId);
  if (visibleUserIds && !visibleUserIds.some((id) => String(id) === ownerId)) {
    throw new ApiError(403, "Owner is outside your Sales scope");
  }
  const assignment = await OrganizationAssignment.exists({
    userId: ownerId,
    department: OrganizationDepartment.SALES,
    active: true,
  });
  if (!assignment)
    throw new ApiError(400, "Select an active Sales team member");
}

function escapeFilterRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

function salesLeadFilterFields(property: string) {
    const external = (keys: string[]) => keys.map((key) => `externalPayload.${key}`);
    switch (property) {
      case "Related Record Action": return ["activities.kind"];
      case "Activities": return ["activities.text"];
      case "Notes": return ["notes", "meetingNotes"];
      case "Pipelines": return ["pipeline"];
      case "Pipeline Sub-Pipeline": return ["stageId"];
      case "Pipeline Amount": return ["expectedValue"];
      case "Pipeline Stage": return ["stageId", "status"];
      case "Pipeline Closing Date": return ["expectedCloseAt"];
      case "Pipeline Record Owner":
      case "Client Owner": return ["ownerId"];
      case "Alternative Mob Number": return external(["Alternative Mob Number", "Alternative Mobile Number", "Alternative Phone"]);
      case "Client Name": return ["name"];
      case "Company Name": return ["company"];
      case "Company address": return external(["Company address", "Company Address", "Company Location"]);
      case "Created By": return ["createdBy"];
      case "Created Time": return ["createdAt"];
      case "Description": return ["notes", "meetingNotes", ...external(["Description"])];
      case "Email": return ["email"];
      case "Email Opt Out": return external(["Email Opt Out", "Email Opt-Out"]);
      case "Feedback 1": return external(["Feedback 1"]);
      case "Feedback 2": return external(["Feedback 2"]);
      case "Feedback 3": return external(["Feedback 3"]);
      case "First Name": return external(["First Name", "Firstname"]);
      case "Full address": return external(["Full address", "Address", "Company address", "Company Address"]);
      case "Last Activity Time": return ["activities.createdAt"];
      case "Last Name": return external(["Last Name", "Lastname"]);
      case "Lead Source": return ["sourceCategory", "source"];
      case "Modified By": return ["createdBy", "assignmentHistory.assignedBy", "activities.actorId"];
      case "Modified Time": return ["updatedAt"];
      case "Phone": return ["phone"];
      case "Ref": return external(["Ref", "Reference"]);
      case "Team Leader call feedback": return external(["Team Leader call feedback"]);
      case "Unsubscribed Mode": return external(["Unsubscribed Mode"]);
      case "Unsubscribed Time": return external(["Unsubscribed Time"]);
      default: return [];
    }
  }

function salesLeadTextCondition(fields: string[], operator: SalesLeadFilter["operator"], value: string) {
    if (operator === "is empty") {
      return { $and: fields.map((field) => ({ $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: "" }] })) };
    }
    if (operator === "is not empty") {
      return { $or: fields.map((field) => ({ [field]: { $exists: true, $nin: ["", null] } })) };
    }
    const escaped = escapeFilterRegex(value);
    const pattern = operator === "is" || operator === "is not"
      ? `^${escaped}$`
      : operator === "starts with"
        ? `^${escaped}`
        : operator === "ends with"
          ? `${escaped}$`
          : escaped;
    const matching = fields.map((field) => ({ [field]: new RegExp(pattern, "i") }));
    if (operator === "does not contain" || operator === "is not") return { $nor: matching };
    return { $or: matching };
  }

function salesLeadDateCondition(field: string, operator: SalesLeadFilter["operator"], value: string) {
    const start = new Date(`${value}T00:00:00.000Z`);
    const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    if (operator === "before") return { [field]: { $lt: start } };
    if (operator === "after") return { [field]: { $gte: nextDay } };
    if (operator === "is not") {
      return { $or: [{ [field]: { $lt: start } }, { [field]: { $gte: nextDay } }] };
    }
    return { [field]: { $gte: start, $lt: nextDay } };
  }

async function buildSalesLeadFilterCondition(filter: SalesLeadFilter) {
    if (filter.property === "Touched Records" || filter.property === "Untouched Records") {
      const touched = (filter.property === "Touched Records") === (filter.value === "Yes");
      return { "activities.0": { $exists: filter.operator === "is" ? touched : !touched } };
    }
    if (filter.property === "Record Action") {
      const normalized = filter.value.toLowerCase();
      const partialMatch = filter.operator !== "is" && filter.operator !== "is not";
      const matchesImported = partialMatch
        ? "imported".includes(normalized) || normalized.includes("imported")
        : normalized === "imported";
      const matchesCreated = partialMatch
        ? "created".includes(normalized) || normalized.includes("created")
        : normalized === "created";
      const imported = { externalPayload: { $exists: true } };
      const created = { externalPayload: { $exists: false } };
      if (filter.operator === "is empty") return { $expr: { $eq: [1, 0] } };
      if (filter.operator === "is not empty") return {};
      if (matchesImported && !matchesCreated) return filter.operator === "is not" || filter.operator === "does not contain" ? created : imported;
      if (matchesCreated && !matchesImported) return filter.operator === "is not" || filter.operator === "does not contain" ? imported : created;
      return filter.operator === "is not" || filter.operator === "does not contain" ? {} : { $expr: { $eq: [1, 0] } };
    }
    const fields = salesLeadFilterFields(filter.property);
    if (filter.operator === "is empty" || filter.operator === "is not empty") {
      return salesLeadTextCondition(fields, filter.operator, "");
    }
    if (filter.property === "Pipeline Amount") {
      const amountInMinorUnits = Number(filter.value) * 100;
      if (filter.operator === "greater than") return { expectedValue: { $gt: amountInMinorUnits } };
      if (filter.operator === "less than") return { expectedValue: { $lt: amountInMinorUnits } };
      return filter.operator === "is not" ? { expectedValue: { $ne: amountInMinorUnits } } : { expectedValue: amountInMinorUnits };
    }
    if (["Pipeline Closing Date", "Created Time", "Last Activity Time", "Modified Time"].includes(filter.property)) {
      const field = salesLeadFilterFields(filter.property)[0]!;
      return salesLeadDateCondition(field, filter.operator, filter.value);
    }
    if (filter.property === "Unsubscribed Time") {
      const start = filter.value;
      const nextDay = new Date(`${start}T00:00:00.000Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextDate = nextDay.toISOString().slice(0, 10);
      if (filter.operator === "before") return { $or: fields.map((field) => ({ [field]: { $lt: start } })) };
      if (filter.operator === "after") return { $or: fields.map((field) => ({ [field]: { $gte: nextDate } })) };
      const matching = fields.map((field) => ({ [field]: new RegExp(`^${escapeFilterRegex(start)}`) }));
      return filter.operator === "is not"
        ? { $and: [{ $or: fields.map((field) => ({ [field]: { $exists: true, $nin: ["", null] } })) }, { $nor: matching }] }
        : { $or: matching };
    }
    if (["Pipeline Record Owner", "Client Owner", "Created By", "Modified By"].includes(filter.property)) {
      const escaped = escapeFilterRegex(filter.value);
      const pattern = filter.operator === "is" || filter.operator === "is not"
        ? `^${escaped}$`
        : filter.operator === "starts with"
          ? `^${escaped}`
          : filter.operator === "ends with"
            ? `${escaped}$`
            : escaped;
      const users = await User.find({ $or: [{ name: new RegExp(pattern, "i") }, { email: new RegExp(pattern, "i") }] }).select("_id").lean();
      const ids = users.map((user) => user._id);
      const negative = filter.operator === "is not" || filter.operator === "does not contain";
      return negative
        ? { $nor: fields.map((field) => ({ [field]: { $in: ids } })) }
        : { $or: fields.map((field) => ({ [field]: { $in: ids } })) };
    }
  return salesLeadTextCondition(salesLeadFilterFields(filter.property), filter.operator, filter.value);
}

function canAssignSalesTask(
  access: SalesAccess,
  actorId: Types.ObjectId,
  assignment: { level: OrganizationLevel; reportsTo?: unknown },
) {
  if (!access.designation) return true;
  const directReport = String(assignment.reportsTo ?? "") === String(actorId);
  if (access.designation === SalesDesignation.HEAD)
    return directReport && assignment.level === OrganizationLevel.MANAGER;
  if (access.designation === SalesDesignation.MANAGER)
    return directReport && assignment.level === OrganizationLevel.MEMBER;
  return false;
}

async function assertAssignableSalesTaskOwner(
  access: SalesAccess,
  actorId: Types.ObjectId,
  ownerId: string,
) {
  await assertVisibleSalesOwner(access, actorId, ownerId);
  if (ownerId === String(actorId)) return;
  const assignment = await OrganizationAssignment.findOne({
    userId: ownerId,
    department: OrganizationDepartment.SALES,
    active: true,
  })
    .select("level reportsTo")
    .lean();
  if (!assignment || !canAssignSalesTask(access, actorId, assignment)) {
    throw new ApiError(
      403,
      access.designation === SalesDesignation.HEAD
        ? "Sales Heads can assign tasks only to their Sales Managers"
        : "Sales Managers can assign tasks only to their direct Sales Executives",
    );
  }
}

export function getSalesAccess(_req: Request, res: Response) {
  const access = res.locals.salesAccess as SalesAccess;
  return res.status(200).json({
    success: true,
    access: {
      designation: access.designation,
      employmentType: access.employmentType,
      reportsTo: access.assignment?.reportsTo ?? null,
      scope: access.scope,
      permissions: [...access.permissions].sort(),
    },
  });
}

export async function getSalesDashboard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const actorId = req.authUser!._id;
    const visibleUserIds = await visibleSalesUserIds(access, actorId);
    const taskFilter = {
      department: OrganizationDepartment.SALES,
      ...(visibleUserIds ? { assignedTo: { $in: visibleUserIds } } : {}),
    };
    const [tasks, assignments, leads] = await Promise.all([
      Task.find(taskFilter)
        .select(
          "title description deadline priority assignedTo assignedBy currentOwner status workflowStage completedAt createdAt salesAccountability.kind",
        )
        .populate("assignedTo", "name email roles")
        .populate("assignedBy", "name email roles")
        .populate("currentOwner", "name")
        .sort({ status: 1, deadline: 1 })
        .limit(100)
        .lean(),
      access.scope === "OWN"
        ? Promise.resolve([])
        : OrganizationAssignment.find({
            department: OrganizationDepartment.SALES,
            active: true,
            ...(visibleUserIds ? { userId: { $in: visibleUserIds } } : {}),
          })
            .select("userId level designation employmentType reportsTo")
            .populate("userId", "name email roles")
            .sort({ level: 1, createdAt: 1 })
            .lean(),
      SalesLead.find({
        department: OrganizationDepartment.SALES,
        ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}),
      })
        .select("status expectedValue nextFollowUpAt ownerId")
        .lean(),
    ]);
    const now = Date.now();
    const taskViews = tasks.map((task) => ({
      ...task,
      effectiveStatus:
        task.status === TaskStatus.PENDING &&
        new Date(task.deadline).getTime() < now
          ? "OVERDUE"
          : task.status,
    }));
    const pending = taskViews.filter(
      (task) => task.status === TaskStatus.PENDING,
    );
    const completed = taskViews.filter(
      (task) => task.status === TaskStatus.DONE,
    );
    const overdue = taskViews.filter(
      (task) => task.effectiveStatus === "OVERDUE",
    );
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const dueToday = pending.filter(
      (task) => new Date(task.deadline).toISOString().slice(0, 10) === todayKey,
    );
    const qualifiedStatuses = new Set([
      SalesLeadStatus.QUALIFIED,
      SalesLeadStatus.CONTACTED,
      SalesLeadStatus.REQUIREMENT,
      SalesLeadStatus.PROPOSAL,
      SalesLeadStatus.NEGOTIATION,
      SalesLeadStatus.WON,
    ]);
    const qualifiedLeads = leads.filter((lead) =>
      qualifiedStatuses.has(lead.status),
    );
    const openLeads = leads.filter(
      (lead) =>
        ![SalesLeadStatus.WON, SalesLeadStatus.LOST].includes(lead.status),
    );
    const wonLeads = leads.filter(
      (lead) => lead.status === SalesLeadStatus.WON,
    );
    const closedLeads = leads.filter((lead) =>
      [SalesLeadStatus.WON, SalesLeadStatus.LOST].includes(lead.status),
    );
    const teamUserIds = assignments
      .map((assignment) => assignment.userId)
      .filter((user): user is NonNullable<typeof user> => Boolean(user));
    const teamUsers = await User.find({
      _id: { $in: teamUserIds.map((user: any) => user._id) },
    })
      .select("name email roles")
      .lean();
    const userById = new Map(teamUsers.map((user) => [String(user._id), user]));

    return res.status(200).json({
      success: true,
      dashboard: {
        permissions: [...access.permissions],
        scope: access.scope,
        designation: access.designation,
        employmentType: access.employmentType,
        metrics: {
          totalLeads: leads.length,
          qualifiedLeads: qualifiedLeads.length,
          openDeals: openLeads.length,
          pipelineValue: openLeads.reduce(
            (total, lead) => total + lead.expectedValue,
            0,
          ),
          wonRevenue: wonLeads.reduce(
            (total, lead) => total + lead.expectedValue,
            0,
          ),
          conversionRate: closedLeads.length
            ? Math.round((wonLeads.length / closedLeads.length) * 100)
            : 0,
          pendingTasks: pending.length,
          overdueTasks: overdue.length,
          dueToday: dueToday.length,
          completedTasks: completed.length,
        },
        pipeline: Object.values(SalesLeadStatus).map((stage) => {
          const stageLeads = leads.filter((lead) => lead.status === stage);
          return {
            stage,
            count: stageLeads.length,
            value: stageLeads.reduce(
              (total, lead) => total + lead.expectedValue,
              0,
            ),
          };
        }),
        tasks: taskViews,
        team: assignments.map((assignment) => {
          const userId =
            typeof assignment.userId === "object" &&
            assignment.userId &&
            "_id" in assignment.userId
              ? String(assignment.userId._id)
              : String(assignment.userId);
          const user = userById.get(userId) ?? assignment.userId;
          const memberTasks = taskViews.filter((task) => {
            const assignedTo = task.assignedTo as unknown as {
              _id?: unknown;
            } | null;
            return String(assignedTo?._id ?? task.assignedTo) === userId;
          });
          return {
            user,
            level: assignment.level,
            designation: assignment.designation,
            employmentType: assignment.employmentType,
            reportsTo: assignment.reportsTo,
            assignable:
              String(userId) !== String(actorId) &&
              canAssignSalesTask(access, actorId, assignment),
            activeTasks: memberTasks.filter(
              (task) => task.status === TaskStatus.PENDING,
            ).length,
            completedTasks: memberTasks.filter(
              (task) => task.status === TaskStatus.DONE,
            ).length,
            overdueTasks: memberTasks.filter(
              (task) => task.effectiveStatus === "OVERDUE",
            ).length,
          };
        }),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listSalesLeads(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const visibleUserIds = await visibleSalesUserIds(access, req.authUser!._id);
    const query = listSalesLeadsSchema.parse({ query: req.query }).query;
    const { page, pageSize, search } = query;
    if (query.ownerId && visibleUserIds && !visibleUserIds.some((id) => String(id) === query.ownerId))
      throw new ApiError(403, "Owner is outside your Sales scope");
    const constraints: Record<string, unknown>[] = [];
    if (query.pipeline === "Sales") constraints.push({ $or: [{ pipeline: "Sales" }, { pipeline: { $exists: false } }] });
    if (query.stageId) constraints.push({ $or: [{ stageId: query.stageId }, { stageId: { $exists: false }, status: query.stageId }] });
    constraints.push(...await Promise.all(query.filters.map(buildSalesLeadFilterCondition)));
    constraints.push({ "assignmentHistory.reason": { $ne: "Lead spreadsheet import" } });
    const filter = {
      department: OrganizationDepartment.SALES,
      ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}),
      ...(query.ownerId ? { ownerId: new Types.ObjectId(query.ownerId) } : {}),
      ...(query.status ? { status: query.status as SalesLeadStatus } : {}),
      ...(constraints.length ? { $and: constraints } : {}),
      ...(query.pipeline && query.pipeline !== "Sales" ? { pipeline: query.pipeline } : {}),
      ...(query.followUp ? { nextFollowUpAt: query.followUp === "OVERDUE" ? { $lt: new Date(), $ne: null } : { $ne: null } } : {}),
      ...(query.activities ? { activities: { $elemMatch: { completedAt: null, dueAt: { $ne: null }, kind: { $ne: "STAGE" } } } } : {}),
      ...(search ? { $or: ["name", "company", "email", "phone", "tags"].map((field) => ({ [field]: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })) } : {}),
    };
    const [leads, total, amounts] = await Promise.all([
      SalesLead.find(filter)
        .populate("ownerId", "name email roles")
        .populate("assignedBy", "name email roles")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      SalesLead.countDocuments(filter),
      query.board ? SalesLead.aggregate([{ $match: filter }, { $group: { _id: "$currency", value: { $sum: "$expectedValue" } } }]) : Promise.resolve([]),
    ]);
    return res
      .status(200)
      .json({
        success: true,
        leads,
        amounts,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
  } catch (error) {
    next(error);
  }
}

export async function createSalesLead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const actorId = req.authUser!._id;
    const ownerId = String(req.body.ownerId ?? actorId);
    if (ownerId !== String(actorId)) await assertVisibleSalesOwner(access, actorId, ownerId);
    const pipelineKey = req.body.pipeline || "Sales";
    const definition = await SalesPipeline.findOne({ key: pipelineKey }).lean();
    if (!definition && pipelineKey !== "Sales" && !await SalesLead.exists({ pipeline: pipelineKey })) throw new ApiError(400, "Create this pipeline in pipeline settings first");
    const destination = pipelineDestination(definition ?? defaultPipeline(pipelineKey), req.body.stageId);
    assertSalesStageEvidence(destination, req.body);
    const lead = await SalesLead.create({
      ...req.body,
      ...destination,
      closedAt: destination.status === SalesLeadStatus.WON ? new Date() : null,
      email: req.body.email || undefined,
      ownerId,
      assignedBy: actorId,
      createdBy: actorId,
      lastModifiedBy: actorId,
      department: OrganizationDepartment.SALES,
      assignmentHistory: [
        {
          assignedBy: actorId,
          previousOwner: null,
          newOwner: ownerId,
          reason: "Initial assignment",
          timestamp: new Date(),
        },
      ],
    });
    await lead.populate("ownerId", "name email roles");
    return res.status(201).json({ success: true, lead });
  } catch (error) {
    next(error);
  }
}

function populatedUserName(user: unknown) {
  if (user && typeof user === "object" && "name" in user && typeof user.name === "string") return user.name;
  return "";
}

export async function listImportedSalesLeads(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const visibleUserIds = await visibleSalesUserIds(access, req.authUser!._id);
    const leads = await SalesLead.find({
      department: OrganizationDepartment.SALES,
      "assignmentHistory.reason": "Lead spreadsheet import",
      ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}),
    })
      .setOptions({ includeArchived: true })
      .select("+externalPayload")
      .populate("ownerId", "name")
      .populate("createdBy", "name")
      .populate("lastModifiedBy", "name")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({
      success: true,
      leads: leads.map((lead) => {
        const ownerName = populatedUserName(lead.ownerId);
        const createdByName = populatedUserName(lead.createdBy);
        const modifiedByName = populatedUserName(lead.lastModifiedBy) || ownerName;
        const importSource = [...lead.assignmentHistory].reverse().find((item) => item.reason === "Lead spreadsheet import");
        return {
          _id: String(lead._id),
          sheet: importSource?.sourceSheet,
          row: importSource?.sourceRow,
          name: lead.name,
          company: lead.company,
          email: lead.email,
          phone: lead.phone,
          archivedAt: lead.archivedAt?.toISOString() ?? null,
          filterValues: buildImportedLeadFilterValues(lead, {
            owner: ownerName,
            createdBy: createdByName,
            modifiedBy: modifiedByName,
          }),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
}

export async function bulkUpdateImportedSalesLeads(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const { leadIds, field, value } = bulkUpdateImportedSalesLeadsSchema.parse({ body: req.body }).body;
    const visibleUserIds = await visibleSalesUserIds(access, req.authUser!._id);
    const filter = {
      _id: { $in: leadIds.map((id) => new Types.ObjectId(id)) },
      department: OrganizationDepartment.SALES,
      "assignmentHistory.reason": "Lead spreadsheet import",
      ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}),
    };
    const existing = await SalesLead.find(filter)
      .setOptions({ includeArchived: true })
      .select("_id")
      .lean();
    if (existing.length !== leadIds.length) {
      throw new ApiError(409, "Some selected clients are no longer available in your Sales access scope. Refresh and try again");
    }

    const nativeFieldPaths: Record<string, { path: string; filterOverride?: string }> = {
      "Client Name": { path: "name" },
      "Company Name": { path: "company" },
      Phone: { path: "phone" },
      Email: { path: "email" },
      "Lead Source": { path: "sourceCategory", filterOverride: "leadsource" },
      Notes: { path: "notes", filterOverride: "notes" },
      "Service Interest": { path: "serviceInterest" },
    };
    const nativeTarget = nativeFieldPaths[field];
    const updatePath = nativeTarget?.path
      ?? `filterOverrides.${field.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const updateSet: Record<string, unknown> = {
      [updatePath]: field === "Email" ? value.toLowerCase() : value,
      lastModifiedBy: req.authUser!._id,
    };
    if (nativeTarget?.filterOverride) updateSet[`filterOverrides.${nativeTarget.filterOverride}`] = value;
    const updated = await SalesLead.updateMany(filter, {
      $set: updateSet,
    }, { runValidators: true }).setOptions({ includeArchived: true });
    if (updated.matchedCount !== leadIds.length) {
      throw new ApiError(409, "Not all selected clients were updated. Refresh the list and try again");
    }
    return res.status(200).json({
      success: true,
      updatedCount: updated.matchedCount,
      message: `${updated.matchedCount} selected client${updated.matchedCount === 1 ? "" : "s"} updated.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function importSalesLeads(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { rows } = importSalesLeadsSchema.parse({ body: req.body }).body;
    const actorId = req.authUser!._id;
    const actor = await User.findById(actorId).select("name email").lean();
    const actorName = actor?.name || actor?.email || String(actorId);
    const parsedRows = rows.map((row) => {
      const values = row.values;
      const name = values.name?.trim();
      const phone = values.phone?.trim();
      const email = values.email?.trim().toLowerCase();
      const source = Object.values(SalesLeadSource).includes(values.source as SalesLeadSource)
        ? values.source as SalesLeadSource
        : SalesLeadSource.OTHER;
      const problems: string[] = [];
      if (!name || name.length < 2 || name.length > 160) problems.push("Name must be between 2 and 160 characters");
      if (!phone || phone.length < 7 || phone.length > 30) problems.push("Phone must be between 7 and 30 characters");
      else if (phone.replace(/\D/g, "").length < 7) problems.push("Phone must contain at least 7 digits");
      if (email && !z.string().email().safeParse(email).success) problems.push("Email address is invalid");
      if (values.company && values.company.length > 160) problems.push("Company name cannot exceed 160 characters");
      if (values.sourceCategory && values.sourceCategory.length > 80) problems.push("Lead source label cannot exceed 80 characters");
      if (values.sourceDetail && values.sourceDetail.length > 100) problems.push("Lead source detail cannot exceed 100 characters");
      if (values.serviceInterest && values.serviceInterest.length > 160) problems.push("Service interest cannot exceed 160 characters");
      if (values.notes && values.notes.length > 4000) problems.push("Notes cannot exceed 4,000 characters");
      return {
        ...row,
        name,
        phone,
        email,
        source,
        problems,
      };
    });
    const errors: Array<{ sheet: string; row: number; message: string }> = parsedRows.flatMap((row) =>
      row.problems.map((message) => ({ sheet: row.sheet, row: row.rowNumber, message })),
    );
    const validRows = parsedRows.filter((row) => row.problems.length === 0);
    const emailRows = new Set<string>();
    const phoneRows = new Set<string>();
    const eligibleRows = validRows.filter((row) => {
      const emailKey = row.email?.toLowerCase();
      const phoneKey = row.phone!.replace(/\D/g, "");
      if ((emailKey && emailRows.has(emailKey)) || phoneRows.has(phoneKey)) {
        errors.push({ sheet: row.sheet, row: row.rowNumber, message: "This email or phone is duplicated in the import file" });
        return false;
      }
      if (emailKey) emailRows.add(emailKey);
      phoneRows.add(phoneKey);
      return true;
    });

    const or: Array<Record<string, unknown>> = [
      { phone: { $in: [...new Set(eligibleRows.map((row) => row.phone))] } },
    ];
    const emails = [...new Set(eligibleRows.map((row) => row.email).filter((value): value is string => Boolean(value)))];
    if (emails.length) or.push({ email: { $in: emails } });
    const existing = eligibleRows.length
      ? await SalesLead.find({ department: OrganizationDepartment.SALES, $or: or })
          .setOptions({ includeArchived: true })
          .select("email phone")
          .lean()
      : [];
    const existingEmails = new Set(existing.flatMap((lead) => lead.email ? [lead.email.toLowerCase()] : []));
    const existingPhones = new Set(existing.map((lead) => lead.phone.replace(/\D/g, "")));
    const toCreate = eligibleRows.filter((row) => {
      const duplicate = (row.email && existingEmails.has(row.email.toLowerCase()))
        || existingPhones.has(row.phone!.replace(/\D/g, ""));
      if (duplicate) {
        errors.push({ sheet: row.sheet, row: row.rowNumber, message: "A lead with this email or phone already exists" });
        return false;
      }
      if (row.email) existingEmails.add(row.email.toLowerCase());
      existingPhones.add(row.phone!.replace(/\D/g, ""));
      return true;
    });

    let imported = 0;
    const importedLeads: Array<{
      _id: string;
      sheet: string;
      row: number;
      name: string;
      company?: string;
      email?: string;
      phone: string;
      archivedAt: null;
      filterValues: Record<string, string | number | boolean>;
    }> = [];
    const mappedFields = new Set(["name", "phone", "email", "source", "sourceCategory", "sourceDetail", "company", "serviceInterest", "notes"]);
    const batchSize = 50;
    for (let start = 0; start < toCreate.length; start += batchSize) {
      const settled = await Promise.allSettled(toCreate.slice(start, start + batchSize).map(async (row) => {
        const lead = new SalesLead({
          name: row.name!,
          company: row.values.company?.trim() || undefined,
          email: row.email || undefined,
          phone: row.phone!,
          source: row.source,
          sourceCategory: row.values.sourceCategory?.trim() || undefined,
          sourceDetail: row.values.sourceDetail?.trim() || undefined,
          serviceInterest: row.values.serviceInterest?.trim() || undefined,
          notes: row.values.notes?.trim() || undefined,
          externalPayload: Object.fromEntries(
            [
              ...Object.entries(row.values)
                .filter(([key]) => !mappedFields.has(key))
                .map(([key, value]) => [key, value.slice(0, 2000)] as const),
              ...Object.entries(row.sourceValues ?? {}).map(([key, value]) => [key, value.slice(0, 2000)] as const),
            ],
          ),
          priority: SalesLeadPriority.MEDIUM,
          expectedValue: 0,
          currency: "INR",
          ownerId: actorId,
          assignedBy: actorId,
          lastModifiedBy: actorId,
          createdBy: actorId,
          department: OrganizationDepartment.SALES,
          pipeline: "Client Lists",
          probability: 0,
          assignmentHistory: [{
            assignedBy: actorId,
            previousOwner: null,
            newOwner: actorId,
            reason: "Lead spreadsheet import",
            sourceSheet: row.sheet,
            sourceRow: row.rowNumber,
            timestamp: new Date(),
          }],
        });
        try {
          const saved = await lead.save();
          imported += 1;
          importedLeads.push({
            _id: String(saved._id),
            sheet: row.sheet,
            row: row.rowNumber,
            name: saved.name,
            phone: saved.phone,
            archivedAt: null,
            filterValues: buildImportedLeadFilterValues(saved, {
              owner: actorName,
              createdBy: actorName,
              modifiedBy: actorName,
            }),
            ...(saved.company !== undefined ? { company: saved.company } : {}),
            ...(saved.email !== undefined ? { email: saved.email } : {}),
          });
        } catch (error) {
          if (error instanceof MongooseError.ValidationError) {
            errors.push({ sheet: row.sheet, row: row.rowNumber, message: error.message });
            return;
          }
          if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
            errors.push({ sheet: row.sheet, row: row.rowNumber, message: "A lead with this email or phone was just imported" });
            return;
          }
          throw error;
        }
      }));
      const failure = settled.find((item): item is PromiseRejectedResult => item.status === "rejected");
      if (failure) throw failure.reason;
    }
    return res.status(201).json({
      success: true,
      result: {
        imported,
        leads: importedLeads,
        skipped: errors.length,
        errors,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function assignSalesLead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const actorId = req.authUser!._id;
    const leadId = String(req.params.leadId);
    if (!Types.ObjectId.isValid(leadId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead id" });
    const lead = await SalesLead.findById(leadId);
    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Sales lead not found" });
    const visibleUserIds = await visibleSalesUserIds(access, actorId);
    if (
      visibleUserIds &&
      !visibleUserIds.some((id) => String(id) === String(lead.ownerId))
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const ownerId = String(req.body.ownerId);
    await assertVisibleSalesOwner(access, actorId, ownerId);
    const previousOwner = lead.ownerId;
    lead.ownerId = new Types.ObjectId(ownerId);
    lead.assignedBy = actorId;
    lead.lastModifiedBy = actorId;
    if (req.body.nextFollowUpAt)
      lead.nextFollowUpAt = new Date(req.body.nextFollowUpAt);
    lead.assignmentHistory.push({
      assignedBy: actorId,
      previousOwner,
      newOwner: lead.ownerId,
      reason: req.body.reason,
      timestamp: new Date(),
    });
    await lead.save();
    await lead.populate("ownerId", "name email roles");
    return res.status(200).json({ success: true, lead });
  } catch (error) {
    next(error);
  }
}

export async function updateSalesLead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const actorId = req.authUser!._id;
    const leadId = String(req.params.leadId);
    if (!Types.ObjectId.isValid(leadId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead id" });
    const lead = await SalesLead.findById(leadId);
    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Sales lead not found" });
    const visibleUserIds = await visibleSalesUserIds(access, actorId);
    if (
      visibleUserIds &&
      !visibleUserIds.some((id) => String(id) === String(lead.ownerId))
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const updates = { ...req.body };
    if (updates.pipeline !== undefined || updates.stageId !== undefined || updates.status !== undefined) {
      const key = updates.pipeline ?? lead.pipeline ?? "Sales";
      const definition = await SalesPipeline.findOne({ key }).lean();
      if (!definition && key !== "Sales" && key !== lead.pipeline && !await SalesLead.exists({ pipeline: key })) throw new ApiError(400, "Unknown pipeline");
      const pipeline = definition ?? defaultPipeline(key);
      let stageKey = updates.stageId;
      if (!stageKey && key === lead.pipeline) stageKey = updates.status && updates.status !== lead.status
        ? pipeline.stages.find((stage) => stage.status === updates.status && !stage.archived)?.key
        : lead.stageId ?? lead.status;
      if (updates.status && !stageKey && key === lead.pipeline) throw new ApiError(400, "Choose a configured stage");
      const changed = key !== (lead.pipeline ?? "Sales") || (stageKey ?? pipeline.stages[0]?.key) !== (lead.stageId ?? lead.status);
      if (changed) {
        if (lead.activities.length >= 500) throw new ApiError(409, "This record has reached its 500 activity limit");
        Object.assign(updates, pipelineDestination(pipeline, stageKey));
        if (updates.status === SalesLeadStatus.LOST && !(updates.lostReason ?? lead.lostReason)?.trim()) throw new ApiError(400, "Add a loss reason before closing this deal as lost");
        lead.activities.push({ _id: new Types.ObjectId(), kind: "STAGE", text: `${lead.pipeline ?? "Sales"} / ${lead.stageId ?? lead.status} -> ${key} / ${updates.stageId}`, actorId, createdAt: new Date() });
      } else if (stageKey) {
        const stage = pipeline.stages.find((item) => item.key === stageKey);
        if (!stage) throw new ApiError(400, "Unknown stage");
        updates.status = stage.status;
        updates.stageId = stage.key;
      }
    }
    if ((updates.status ?? lead.status) === SalesLeadStatus.LOST && !(updates.lostReason ?? lead.lostReason)?.trim())
      throw new ApiError(400, "Add a loss reason before closing this deal as lost");
    if ((updates.status && updates.status !== lead.status) || (updates.stageId && updates.stageId !== lead.stageId && ["CONTACT_ATTEMPTED", "DEMO_SCHEDULED", "MEETING_COMPLETED"].includes(updates.stageId))) {
      assertSalesStageEvidence({ status: updates.status ?? lead.status, stageId: updates.stageId ?? lead.stageId }, {
        qualification: updates.qualification ?? lead.qualification, meetingNotes: updates.meetingNotes ?? lead.meetingNotes,
        expectedValue: updates.expectedValue ?? lead.expectedValue, lostReason: updates.lostReason ?? lead.lostReason, activities: lead.activities,
      });
    }
    if (updates.status === SalesLeadStatus.WON && lead.status !== SalesLeadStatus.WON) {
      if ((updates.expectedValue ?? lead.expectedValue) <= 0) throw new ApiError(400, "Record a positive closed deal value before marking it won");
      updates.closedAt = new Date();
    } else if (updates.status && updates.status !== SalesLeadStatus.WON) {
      updates.closedAt = null;
    }
    if ((updates.status ?? lead.status) === SalesLeadStatus.WON) updates.probability = 100;
    if ((updates.status ?? lead.status) === SalesLeadStatus.LOST) updates.probability = 0;
    if (updates.email === "") updates.email = undefined;
    if (updates.nextFollowUpAt)
      updates.nextFollowUpAt = new Date(updates.nextFollowUpAt);
    updates.lastModifiedBy = actorId;
    lead.set(updates);
    await lead.save();
    await lead.populate("ownerId", "name email roles");
    return res.status(200).json({ success: true, lead });
  } catch (error) {
    next(error);
  }
}

export async function archiveSalesLead(req: Request, res: Response, next: NextFunction) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const actorId = req.authUser!._id;
    const leadId = String(req.params.leadId);
    if (!Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({ success: false, message: "Invalid lead id" });
    }
    const visibleUserIds = await visibleSalesUserIds(access, actorId);
    const archived = req.body.archived as boolean;
    const lead = await SalesLead.findOneAndUpdate(
      {
        _id: leadId,
        department: OrganizationDepartment.SALES,
        ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}),
      },
      { $set: { archivedAt: archived ? new Date() : null, archivedBy: archived ? actorId : null, lastModifiedBy: actorId } },
      { new: true, runValidators: true },
    ).setOptions({ includeArchived: true });
    if (!lead) return res.status(404).json({ success: false, message: "Sales lead not found" });
    return res.json({ success: true, lead });
  } catch (error) {
    next(error);
  }
}

const salesLeadDeletionOtpTtlMinutes = 10;
const salesLeadDeletionMaxOtpAttempts = 5;

async function resolveSalesLeadDeletionTarget(
  req: Request,
  access: SalesAccess,
  requested: { leadIds?: string[]; deleteAll?: boolean; allImported?: boolean },
) {
  const requestedLeadIds = [...(requested.leadIds ?? [])].sort();
  const allImported = requested.allImported === true;
  const actorId = req.authUser!._id;
  const visibleUserIds = await visibleSalesUserIds(access, actorId);
  const existingLeads = await SalesLead.find({
    department: OrganizationDepartment.SALES,
    ...(allImported
      ? { "assignmentHistory.reason": "Lead spreadsheet import" }
      : { _id: { $in: requestedLeadIds.map((id) => new Types.ObjectId(id)) } }),
    ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}),
  })
    .setOptions({ includeArchived: true })
    .select("_id")
    .lean();
  const leadIds = allImported
    ? existingLeads.map((lead) => String(lead._id)).sort()
    : requestedLeadIds;
  if (!leadIds.length) throw new ApiError(400, "There are no saved imported Client Lists leads in your Sales access scope");
  if (!allImported && existingLeads.length !== leadIds.length) {
    throw new ApiError(409, "Some selected Sales leads are no longer available. Refresh and try again");
  }
  const deleteAll = requested.deleteAll === true;
  const companyId = String(req.company?._id ?? currentScope()?.companyId ?? req.authUser!.companyId ?? "");
  const contextHash = hashToken(JSON.stringify({
    action: "DELETE_SALES_LEADS",
    companyId,
    userId: String(actorId),
    deleteAll,
    allImported,
    leadIds,
  }));
  return { leadIds, deleteAll, allImported, visibleUserIds, contextHash };
}

export async function requestSalesLeadDeletionOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const requested = req.body as { leadIds?: string[]; deleteAll?: boolean; allImported?: boolean };
    const target = await resolveSalesLeadDeletionTarget(req, access, requested);
    if (!target.allImported && !target.deleteAll && target.leadIds.length <= 5) {
      throw new ApiError(400, "OTP verification is not required for this selection");
    }

    const email = req.authUser!.email;
    const otp = otpGenerator.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
      digits: true,
    });
    await OTP.findOneAndUpdate(
      { email },
      {
        $set: {
          email,
          otpHash: otpStorageValue(otp),
          purpose: OtpPurpose.SALES_LEAD_BULK_DELETION,
          subjectId: req.authUser!._id,
          contextHash: target.contextHash,
          attempts: 0,
          expiresAt: new Date(Date.now() + salesLeadDeletionOtpTtlMinutes * 60 * 1000),
        },
      },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    try {
      await sendEmail(email, "Confirm Sales lead deletion", otp);
    } catch (error) {
      await OTP.deleteOne({
        email,
        purpose: OtpPurpose.SALES_LEAD_BULK_DELETION,
        subjectId: req.authUser!._id,
        contextHash: target.contextHash,
      });
      throw error;
    }
    return res.status(201).json({
      success: true,
      email,
      leadCount: target.leadIds.length,
      message: `A verification code was sent to ${email}. It expires in ${salesLeadDeletionOtpTtlMinutes} minutes.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteSalesLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const requested = req.body as { leadIds?: string[]; deleteAll?: boolean; allImported?: boolean; otp?: string };
    const target = await resolveSalesLeadDeletionTarget(req, access, requested);
    const requiresOtp = target.allImported || target.deleteAll || target.leadIds.length > 5;
    if (requiresOtp) {
      if (!requested.otp) {
        throw new ApiError(428, "Email verification is required for this Sales lead deletion");
      }
      const otpDoc = await OTP.findOne({
        email: req.authUser!.email,
        purpose: OtpPurpose.SALES_LEAD_BULK_DELETION,
        subjectId: req.authUser!._id,
        contextHash: target.contextHash,
      });
      if (!otpDoc || otpDoc.expiresAt <= new Date()) {
        throw new ApiError(400, "Verification code expired or does not match this deletion. Request a new code");
      }
      if (otpDoc.attempts >= salesLeadDeletionMaxOtpAttempts) {
        throw new ApiError(429, "Too many incorrect verification attempts. Request a new code");
      }
      if (!otpMatches(otpDoc.otpHash, requested.otp)) {
        otpDoc.attempts += 1;
        await otpDoc.save();
        throw new ApiError(400, "Incorrect verification code");
      }
      const consumedOtp = await OTP.findOneAndDelete({
        _id: otpDoc._id,
        email: req.authUser!.email,
        purpose: OtpPurpose.SALES_LEAD_BULK_DELETION,
        subjectId: req.authUser!._id,
        contextHash: target.contextHash,
        otpHash: otpStorageValue(requested.otp),
        attempts: { $lt: salesLeadDeletionMaxOtpAttempts },
        expiresAt: { $gt: new Date() },
      });
      if (!consumedOtp) {
        throw new ApiError(400, "Verification code expired or has already been used. Request a new code");
      }
    }

    const ids = target.leadIds.map((id) => new Types.ObjectId(id));
    const deletion = await SalesLead.deleteMany({
      _id: { $in: ids },
      department: OrganizationDepartment.SALES,
      ...(target.visibleUserIds ? { ownerId: { $in: target.visibleUserIds } } : {}),
    });
    if (deletion.deletedCount !== ids.length) {
      throw new ApiError(409, "Some Sales leads changed before deletion completed. Refresh and check the list");
    }
    const unlinkedTasks = await Task.updateMany(
      { "salesAccountability.leadIds": { $in: ids } },
      { $pull: { "salesAccountability.leadIds": { $in: ids } } },
    );
    return res.json({
      success: true,
      deletedCount: deletion.deletedCount,
      unlinkedTaskCount: unlinkedTasks.modifiedCount,
      message: `${deletion.deletedCount} Sales lead${deletion.deletedCount === 1 ? "" : "s"} deleted from CRM and the Sales pipeline.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function listSalesPipelines(req: Request, res: Response, next: NextFunction) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const owners = await visibleSalesUserIds(access, req.authUser!._id);
    const [definitions, legacyKeys] = await Promise.all([
      SalesPipeline.find().sort({ createdAt: 1 }).lean(),
      SalesLead.distinct("pipeline", owners ? { ownerId: { $in: owners } } : {}),
    ]);
    const keys = new Set(["Sales", ...legacyKeys.filter((key): key is string => typeof key === "string" && Boolean(key))]);
    const configured = new Set(definitions.map((pipeline) => pipeline.key));
    const pipelines = [...definitions, ...[...keys].filter((key) => !configured.has(key)).map(defaultPipeline)];
    return res.json({ success: true, pipelines });
  } catch (error) { next(error); }
}

export async function saveSalesPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    if (access.scope !== "DEPARTMENT") throw new ApiError(403, "Only department leadership can manage pipelines");
    const key = String(req.params.key);
    if (!key.trim() || key.length > 80) throw new ApiError(400, "Invalid pipeline key");
    const previous = await SalesPipeline.findOne({ key }).lean();
    const input = { ...req.body, key } as ISalesPipeline;
    if (previous) assertPipelineRevision(previous, input);
    else if (key === "Sales" || await SalesLead.exists({ pipeline: key })) assertPipelineRevision(defaultPipeline(key), input);
    if ((previous?.revision ?? 0) !== input.revision) throw new ApiError(409, "Pipeline changed. Reload settings before saving");
    const pipeline = previous
      ? await SalesPipeline.findOneAndUpdate({ key, revision: input.revision }, { $set: { ...input, revision: input.revision + 1 } }, { new: true, runValidators: true })
      : await SalesPipeline.create({ ...input, revision: 1 });
    if (!pipeline) throw new ApiError(409, "Pipeline changed. Reload settings before saving");
    return res.json({ success: true, pipeline });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return next(new ApiError(409, "Pipeline was created by another user. Reload settings"));
    next(error);
  }
}

export async function getSalesReports(req: Request, res: Response, next: NextFunction) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const visibleUserIds = await visibleSalesUserIds(access, req.authUser!._id);
    const group = (field: string) => ({
      _id: { key: `$${field}`, currency: "$currency" },
      count: { $sum: 1 },
      value: { $sum: "$expectedValue" },
      won: { $sum: { $cond: [{ $eq: ["$status", "WON"] }, 1, 0] } },
      lost: { $sum: { $cond: [{ $eq: ["$status", "LOST"] }, 1, 0] } },
      wonValue: { $sum: { $cond: [{ $eq: ["$status", "WON"] }, "$expectedValue", 0] } },
      openValue: { $sum: { $cond: [{ $in: ["$status", ["WON", "LOST"]] }, 0, "$expectedValue"] } },
      weightedValue: { $sum: { $cond: [{ $in: ["$status", ["WON", "LOST"]] }, 0, { $multiply: ["$expectedValue", { $divide: [{ $ifNull: ["$probability", 10] }, 100] }] }] } },
      overdue: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$nextFollowUpAt", null] }, null] }, { $lt: ["$nextFollowUpAt", new Date()] }, { $not: [{ $in: ["$status", ["WON", "LOST"]] }] }] }, 1, 0] } },
    });
    const [report] = await SalesLead.aggregate([
      { $match: { department: OrganizationDepartment.SALES, ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}) } },
      { $facet: {
        stages: [{ $group: group("status") }, { $sort: { "_id.key": 1 } }],
        sources: [{ $group: group("source") }, { $sort: { count: -1 } }],
        owners: [{ $group: group("ownerId") }, { $lookup: { from: "users", localField: "_id.key", foreignField: "_id", as: "owner" } }, { $set: { name: { $ifNull: [{ $arrayElemAt: ["$owner.name", 0] }, "Deleted owner"] } } }, { $unset: "owner" }, { $sort: { wonValue: -1 } }],
      } },
    ]);
    return res.json({ success: true, report: { ...report, generatedAt: new Date().toISOString(), scope: access.scope } });
  } catch (error) { next(error); }
}

export async function addSalesActivity(req: Request, res: Response, next: NextFunction) {
  try {
    if (!Types.ObjectId.isValid(String(req.params.leadId))) throw new ApiError(400, "Invalid lead id");
    const access = res.locals.salesAccess as SalesAccess;
    const actorId = req.authUser!._id;
    const visibleUserIds = await visibleSalesUserIds(access, actorId);
    const activity = { ...req.body, _id: new Types.ObjectId(), actorId, createdAt: new Date(), completedAt: null };
    const lead = await SalesLead.findOneAndUpdate({
      _id: new Types.ObjectId(String(req.params.leadId)),
      department: OrganizationDepartment.SALES,
      ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}),
      "activities.499": { $exists: false },
    }, { $push: { activities: activity }, $set: { lastModifiedBy: actorId } }, { new: true, runValidators: true }).populate("ownerId", "name email roles");
    if (!lead) throw new ApiError(404, "Lead unavailable or activity limit reached");
    return res.status(201).json({ success: true, lead });
  } catch (error) { next(error); }
}

export async function completeSalesActivity(req: Request, res: Response, next: NextFunction) {
  try {
    if (![req.params.leadId, req.params.activityId].every((id) => Types.ObjectId.isValid(String(id)))) throw new ApiError(400, "Invalid activity id");
    const access = res.locals.salesAccess as SalesAccess;
    const actorId = req.authUser!._id;
    const visibleUserIds = await visibleSalesUserIds(access, actorId);
    const activityId = new Types.ObjectId(String(req.params.activityId));
    const lead = await SalesLead.findOne({
      _id: new Types.ObjectId(String(req.params.leadId)),
      department: OrganizationDepartment.SALES,
      ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}),
      activities: { $elemMatch: { _id: activityId, kind: { $ne: "STAGE" }, completedAt: null } },
    });
    const activity = lead?.activities.find((item) => item._id.equals(activityId));
    if (!lead || !activity || activity.completedAt || activity.kind === "STAGE")
      throw new ApiError(404, "Activity unavailable or already completed");
    const dueAt = activity.dueAt;
    activity.completedAt = new Date();
    lead.lastModifiedBy = actorId;
    if (activity.kind === "FOLLOW_UP" && dueAt && lead.nextFollowUpAt?.getTime() === dueAt.getTime())
      lead.nextFollowUpAt = null;
    await lead.save();
    await lead.populate("ownerId", "name email roles");
    return res.json({ success: true, lead });
  } catch (error) { next(error); }
}

export async function rescheduleSalesActivity(req: Request, res: Response, next: NextFunction) {
  try {
    if (![req.params.leadId, req.params.activityId].every((id) => Types.ObjectId.isValid(String(id))))
      throw new ApiError(400, "Invalid activity id");
    const access = res.locals.salesAccess as SalesAccess;
    const actorId = req.authUser!._id;
    const visibleUserIds = await visibleSalesUserIds(access, actorId);
    const activityId = new Types.ObjectId(String(req.params.activityId));
    const lead = await SalesLead.findOne({
      _id: new Types.ObjectId(String(req.params.leadId)),
      department: OrganizationDepartment.SALES,
      ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}),
      activities: { $elemMatch: { _id: activityId, kind: { $ne: "STAGE" }, completedAt: null } },
    });
    const activity = lead?.activities.find((item) => item._id.equals(activityId));
    if (!lead || !activity) throw new ApiError(404, "Activity unavailable or already completed");
    const previousDueAt = activity.dueAt;
    activity.dueAt = new Date(req.body.dueAt);
    lead.lastModifiedBy = actorId;
    if (activity.kind === "FOLLOW_UP" && previousDueAt && lead.nextFollowUpAt?.getTime() === previousDueAt.getTime())
      lead.nextFollowUpAt = activity.dueAt;
    await lead.save();
    await lead.populate("ownerId", "name email roles");
    return res.json({ success: true, lead });
  } catch (error) { next(error); }
}

export async function completeSalesTask(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const taskId = String(req.params.taskId);
    if (!Types.ObjectId.isValid(taskId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid task id" });
    const task = await Task.findById(taskId);
    if (!task || task.department !== OrganizationDepartment.SALES) {
      return res
        .status(404)
        .json({ success: false, message: "Sales task not found" });
    }
    if (task.salesAccountability) throw new ApiError(409, "Submit evidence and use the Sales target review workflow to complete this task");
    const actorId = String(req.authUser!._id);
    if (access.scope === "OWN" && String(task.assignedTo) !== actorId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (access.scope === "TEAM") {
      const managedIds = await managedUserIds(req.authUser!._id, false);
      if (
        !managedIds?.some(
          (userId) => String(userId) === String(task.assignedTo),
        )
      ) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    }
    task.status = TaskStatus.DONE;
    task.completedAt = new Date();
    await task.save();
    if (task.collaborationBatchId && task.collaborationConversationId) {
      const pendingCollaborators = await Task.countDocuments({
        collaborationBatchId: task.collaborationBatchId,
        status: TaskStatus.PENDING,
      });
      if (pendingCollaborators === 0) {
        const conversationId = task.collaborationConversationId;
        const conversation = await Conversation.findById(conversationId)
          .select("members.userId")
          .lean();
        const recipients =
          conversation?.members.map((member) => String(member.userId)) ?? [];
        await Promise.all([
          ChatMessage.deleteMany({ conversationId }),
          Conversation.deleteOne({ _id: conversationId }),
          clearActiveGroupCall(String(conversationId)),
        ]);
        if (recipients.length) {
          await publishChatEvent(
            { type: "conversation.deleted", conversationId },
            recipients,
          );
        }
      }
    }
    return res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
}

export async function createSalesTask(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let conversationId: Types.ObjectId | null = null;
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const actorId = req.authUser!._id;
    const assignedToIds = [
      ...new Set<string>(
        (req.body.assignedToIds ?? [req.body.assignedTo])
          .filter(Boolean)
          .map(String),
      ),
    ];
    if (
      assignedToIds.some((userId) => userId !== String(actorId)) &&
      !access.permissions.has(Permission.SALES_TASK_ASSIGN)
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You cannot assign work to another user",
        });
    }
    await Promise.all(
      assignedToIds.map((assignedTo) =>
        assertAssignableSalesTaskOwner(access, actorId, assignedTo),
      ),
    );
    const activeAssignees = await User.countDocuments({
      _id: { $in: assignedToIds },
      status: "ACTIVE",
    } as any);
    if (activeAssignees !== assignedToIds.length)
      throw new ApiError(400, "Every assignee must be an active user");

    const collaborationBatchId =
      assignedToIds.length > 1 ? new Types.ObjectId() : null;
    if (collaborationBatchId) {
      const memberIds = [...new Set([String(actorId), ...assignedToIds])];
      const conversation = await Conversation.create({
        type: ConversationType.GROUP,
        name: req.body.title.slice(0, 120),
        description:
          `Sales project assigned by manager: ${req.body.description}`.slice(
            0,
            500,
          ),
        createdBy: actorId,
        admins: [actorId],
        members: memberIds.map((userId) => ({ userId })),
      });
      conversationId = conversation._id;
      await publishChatEvent(
        { type: "conversation.created", conversationId },
        memberIds,
      );
    }

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
        collaborationBatchId,
        collaborationConversationId: conversationId,
        department: OrganizationDepartment.SALES,
        workflowStage: TaskWorkflowStage.ASSIGNED,
        status: TaskStatus.PENDING,
      })),
    );
    await Task.populate(tasks, {
      path: "assignedTo",
      select: "name email roles",
    });
    return res
      .status(201)
      .json({ success: true, task: tasks[0], tasks, conversationId });
  } catch (error) {
    if (conversationId) {
      await Promise.all([
        ChatMessage.deleteMany({ conversationId }),
        Conversation.deleteOne({ _id: conversationId }),
        Task.deleteMany({ collaborationConversationId: conversationId }),
      ]);
    }
    next(error);
  }
}
