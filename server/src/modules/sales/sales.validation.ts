import { z } from "zod";
import { TaskPriority } from "../../models/task.models.js";

const leadSource = z.enum(["GOOGLE", "META", "INSTAGRAM", "LINKEDIN", "WEBSITE", "REFERRAL", "EMAIL", "YOUTUBE", "COLD_CALLING", "OTHER"]);
const leadPriority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const leadStatus = z.enum(["NEW", "QUALIFIED", "CONTACTED", "REQUIREMENT", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]);
const salesLeadFilterProperties = [
  "Touched Records", "Untouched Records", "Record Action", "Related Record Action",
  "Activities", "Notes", "Pipelines", "Pipeline Sub-Pipeline", "Pipeline Amount",
  "Pipeline Stage", "Pipeline Closing Date", "Pipeline Record Owner", "Alternative Mob Number",
  "Client Name", "Client Owner", "Company Name", "Company address", "Created By",
  "Created Time", "Description", "Email", "Email Opt Out", "Feedback 1", "Feedback 2",
  "Feedback 3", "First Name", "Full address", "Last Activity Time", "Last Name",
  "Lead Source", "Modified By", "Modified Time", "Phone", "Ref",
  "Team Leader call feedback", "Unsubscribed Mode", "Unsubscribed Time",
] as const;
const salesLeadFilterOperator = z.enum([
  "contains", "does not contain", "is", "is not", "starts with", "ends with",
  "greater than", "less than", "before", "after", "is empty", "is not empty",
]);
const salesLeadFilterSchema = z.object({
  property: z.enum(salesLeadFilterProperties),
  operator: salesLeadFilterOperator,
  value: z.string().trim().max(160).default(""),
}).superRefine((filter, context) => {
  const booleanProperty = ["Touched Records", "Untouched Records"].includes(filter.property);
  const numericProperty = filter.property === "Pipeline Amount";
  const dateProperty = ["Pipeline Closing Date", "Created Time", "Last Activity Time", "Modified Time", "Unsubscribed Time"].includes(filter.property);
  const allowedOperators = booleanProperty
    ? ["is", "is not"]
    : numericProperty
      ? ["is", "is not", "greater than", "less than", "is empty", "is not empty"]
      : dateProperty
        ? ["is", "is not", "before", "after", "is empty", "is not empty"]
        : ["contains", "does not contain", "is", "is not", "starts with", "ends with", "is empty", "is not empty"];
  if (!allowedOperators.includes(filter.operator)) {
    context.addIssue({ code: "custom", path: ["operator"], message: "This operator is not supported for this property" });
    return;
  }
  if (filter.operator === "is empty" || filter.operator === "is not empty") return;
  if (!filter.value) {
    context.addIssue({ code: "custom", path: ["value"], message: "A filter value is required" });
  } else if (booleanProperty && !["Yes", "No"].includes(filter.value)) {
    context.addIssue({ code: "custom", path: ["value"], message: "Choose Yes or No" });
  } else if (numericProperty && !Number.isFinite(Number(filter.value))) {
    context.addIssue({ code: "custom", path: ["value"], message: "Enter a valid number" });
  } else if (dateProperty) {
    const parsedDate = new Date(`${filter.value}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filter.value) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== filter.value) {
      context.addIssue({ code: "custom", path: ["value"], message: "Choose a valid date" });
    }
  }
});
export type SalesLeadFilter = z.infer<typeof salesLeadFilterSchema>;

const salesLeadFiltersQuery = z.string().max(12000).optional().transform((serialized, context) => {
  if (!serialized) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    context.addIssue({ code: "custom", message: "Filters must be valid JSON" });
    return z.NEVER;
  }
  const validated = z.array(salesLeadFilterSchema).max(37).safeParse(parsed);
  if (!validated.success) {
    for (const issue of validated.error.issues) {
      context.addIssue({ code: "custom", path: issue.path, message: issue.message });
    }
    return z.NEVER;
  }
  if (new Set(validated.data.map((filter) => filter.property)).size !== validated.data.length) {
    context.addIssue({ code: "custom", message: "Only one filter per property is allowed" });
    return z.NEVER;
  }
  return validated.data;
});

export const saveSalesPipelineSchema = z.object({ body: z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(""),
  archived: z.boolean().default(false),
  revision: z.number().int().min(0),
  stages: z.array(z.object({
    key: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    name: z.string().trim().min(1).max(80),
    status: leadStatus,
    probability: z.number().int().min(0).max(100),
    archived: z.boolean().default(false),
  })).min(3).max(30),
}).superRefine((value, context) => {
  const active = value.stages.filter((stage) => !stage.archived);
  if (new Set(value.stages.map((stage) => stage.key)).size !== value.stages.length)
    context.addIssue({ code: "custom", message: "Stage IDs must be unique" });
  if (new Set(active.map((stage) => stage.name.toLowerCase())).size !== active.length)
    context.addIssue({ code: "custom", message: "Active stage names must be unique" });
  if (!active.some((stage) => !["WON", "LOST"].includes(stage.status)))
    context.addIssue({ code: "custom", message: "Keep at least one open stage" });
  for (const status of ["WON", "LOST"]) {
    if (active.filter((stage) => stage.status === status).length !== 1)
      context.addIssue({ code: "custom", message: `Keep exactly one active ${status} stage` });
  }
  if (value.stages.some((stage) => (stage.status === "WON" && stage.probability !== 100) || (stage.status === "LOST" && stage.probability !== 0)))
    context.addIssue({ code: "custom", message: "Won probability must be 100 and lost probability 0" });
}) });

const crmFields = {
  qualification: z.object({
    need: z.string().trim().min(1).max(1000),
    budget: z.string().trim().min(1).max(1000),
    authority: z.string().trim().min(1).max(1000),
    timeline: z.string().trim().min(1).max(1000),
  }).optional(),
  meetingNotes: z.string().trim().max(2000).optional(),
  stageId: z.string().trim().min(1).max(80).optional(),
  pipeline: z.string().trim().min(1).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseAt: z.iso.datetime().nullable().optional(),
  lostReason: z.string().trim().max(1000).optional(),
};

export const listSalesLeadsSchema = z.object({ query: z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(160).optional(),
  status: leadStatus.optional(),
  pipeline: z.string().trim().max(80).optional(),
  stageId: z.string().trim().min(1).max(80).optional(),
  board: z.enum(["true"]).optional(),
  ownerId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  followUp: z.enum(["OVERDUE", "SCHEDULED"]).optional(),
  activities: z.enum(["PENDING"]).optional(),
  filters: salesLeadFiltersQuery,
}) });

export const createSalesActivitySchema = z.object({ body: z.object({
  kind: z.enum(["NOTE", "CALL", "EMAIL", "MEETING", "FOLLOW_UP"]),
  text: z.string().trim().min(1).max(4000),
  dueAt: z.iso.datetime().nullable().optional(),
}).refine((value) => value.kind !== "FOLLOW_UP" || Boolean(value.dueAt), "A follow-up needs a due date") });

export const rescheduleSalesActivitySchema = z.object({ body: z.object({
  dueAt: z.iso.datetime(),
}) });

export const createSalesLeadSchema = z.object({
  body: z.object({
    ...crmFields,
    name: z.string().trim().min(2).max(160),
    company: z.string().trim().max(160).optional(),
    email: z.email().optional().or(z.literal("")),
    phone: z.string().trim().min(7).max(30),
    source: leadSource,
    serviceInterest: z.string().trim().max(160).optional(),
    priority: leadPriority.default("MEDIUM"),
    expectedValue: z.number().int().min(0).default(0),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("INR"),
    ownerId: z.string().optional(),
    nextFollowUpAt: z.iso.datetime().optional(),
    notes: z.string().trim().max(4000).optional(),
  }),
});

export const importSalesLeadsSchema = z.object({
  body: z.object({
    rows: z.array(z.object({
      sheet: z.string().trim().min(1).max(100),
      rowNumber: z.number().int().min(2).max(100000),
      values: z.record(z.string().trim().min(1).max(100), z.string().max(2000)).superRefine((values, context) => {
        if (Object.keys(values).length > 50) {
          context.addIssue({ code: "custom", message: "A row cannot contain more than 50 columns" });
        }
      }),
      sourceValues: z.record(z.string().trim().min(1).max(100), z.string().max(2000)).superRefine((values, context) => {
        if (Object.keys(values).length > 50) {
          context.addIssue({ code: "custom", message: "A source row cannot contain more than 50 columns" });
        }
      }).optional(),
    })).min(1).max(5000),
  }),
});

export const bulkUpdateImportedSalesLeadsSchema = z.object({
  body: z.object({
    leadIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(5000),
    field: z.enum([
      "Client Name", "Company Name", "Phone", "Email", "Lead Source", "Notes", "Service Interest",
      "Ref", "Email Opt Out", "Full address", "Company address", "Feedback 1", "Feedback 2",
      "Feedback 3", "Alternative Mob Number", "Team Leader call feedback", "Unsubscribed Mode",
      "Unsubscribed Time",
    ]),
    value: z.string().trim().max(4000),
  }).superRefine((body, context) => {
    if (new Set(body.leadIds).size !== body.leadIds.length) {
      context.addIssue({ code: "custom", path: ["leadIds"], message: "Selected clients must be unique" });
    }
    const value = body.value;
    const issue = (message: string) => context.addIssue({ code: "custom", path: ["value"], message });
    if (body.field === "Client Name" && (value.length < 2 || value.length > 160)) {
      issue("Client name must be between 2 and 160 characters");
    }
    if (body.field === "Company Name" && value.length > 160) issue("Company name cannot exceed 160 characters");
    if (body.field === "Email" && value && (!z.email().safeParse(value).success || value.length > 254)) {
      issue("Enter a valid email address up to 254 characters");
    }
    if (body.field === "Phone" && (value.length < 7 || value.length > 30 || value.replace(/\D/g, "").length < 7)) {
      issue("Phone must be 7 to 30 characters and contain at least 7 digits");
    }
    if (body.field === "Lead Source" && value.length > 80) issue("Lead source cannot exceed 80 characters");
    if (body.field === "Notes" && value.length > 4000) issue("Notes cannot exceed 4,000 characters");
    if (body.field === "Service Interest" && value.length > 160) issue("Service interest cannot exceed 160 characters");
  }),
});

export const assignSalesLeadSchema = z.object({
  body: z.object({
    ownerId: z.string().min(1),
    reason: z.string().trim().max(500).optional(),
    nextFollowUpAt: z.iso.datetime().optional(),
  }),
});

export const updateSalesLeadSchema = z.object({
  body: z.object({
    ...crmFields,
    name: z.string().trim().min(2).max(160).optional(),
    company: z.string().trim().max(160).optional(),
    email: z.email().optional().or(z.literal("")),
    phone: z.string().trim().min(7).max(30).optional(),
    status: leadStatus.optional(),
    priority: leadPriority.optional(),
    serviceInterest: z.string().trim().max(160).optional(),
    expectedValue: z.number().int().min(0).optional(),
    nextFollowUpAt: z.iso.datetime().nullable().optional(),
    notes: z.string().trim().max(4000).optional(),
  }).refine((value) => Object.keys(value).length > 0, "Provide at least one field"),
});

export const archiveSalesLeadSchema = z.object({
  body: z.object({ archived: z.boolean() }),
});

const salesLeadDeletionFields = {
  leadIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(5000).optional(),
  deleteAll: z.boolean().optional(),
  allImported: z.literal(true).optional(),
};

function validateSalesLeadDeletion(
  value: { leadIds?: string[] | undefined; deleteAll?: boolean | undefined; allImported?: true | undefined },
  context: z.RefinementCtx,
) {
  if (value.allImported && value.leadIds) {
    context.addIssue({ code: "custom", path: ["leadIds"], message: "Do not provide lead IDs when deleting all imported Client Lists leads" });
  } else if (!value.allImported && !value.leadIds?.length) {
    context.addIssue({ code: "custom", path: ["leadIds"], message: "Select leads or request deletion of all imported Client Lists leads" });
  } else if (value.leadIds && new Set(value.leadIds).size !== value.leadIds.length) {
    context.addIssue({ code: "custom", path: ["leadIds"], message: "Lead IDs must be unique" });
  }
}

export const salesLeadDeletionTargetSchema = z.object({
  body: z.object(salesLeadDeletionFields).superRefine(validateSalesLeadDeletion),
});

export const salesLeadDeletionSchema = z.object({
  body: z.object({
    ...salesLeadDeletionFields,
    otp: z.string().regex(/^\d{6}$/).optional(),
  }).superRefine(validateSalesLeadDeletion),
});

export const createSalesTaskSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(2).max(4000),
    assignedTo: z.string().optional(),
    assignedToIds: z.array(z.string().trim().min(1)).min(1).max(50).optional(),
    priority: z.enum(TaskPriority).default(TaskPriority.P2),
    deadline: z.coerce.date().refine((date) => date > new Date(), "Deadline must be in the future"),
  }).refine((value) => Boolean(value.assignedTo || value.assignedToIds?.length), "Select at least one assignee"),
});