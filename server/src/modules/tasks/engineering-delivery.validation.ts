import { z } from "zod";

const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier");
const webUrl = z.string().trim().max(500).url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Use an http or https URL");
const githubUrl = webUrl.refine((value) => URL.canParse(value) && new URL(value).hostname.toLowerCase() === "github.com", "Use a github.com repository URL");
const links = {
  githubUrl: z.union([githubUrl, z.literal("")]).default(""),
  contributionInstructions: z.string().trim().max(4000).default(""),
};
const brief = {
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(4000),
  deadline: z.coerce.date().refine((value) => value > new Date(), "Deadline must be in the future"),
  ...links,
};
export const listEngineeringDeliverySchema = z.object({
  query: z.object({
    department: z.enum(["PRODUCT", "ENGINEERING", "IT"]).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
});
export const createEngineeringDeliverySchema = z.object({
  body: z.object({ ...brief, department: z.enum(["PRODUCT", "ENGINEERING", "IT"]), assigneeId: id }),
});
export const delegateEngineeringDeliverySchema = z.object({
  params: z.object({ id }),
  body: z.object({
    revision: z.number().int().min(0),
    parentId: id.nullable(),
    workItems: z.array(z.object({ ...brief, assigneeId: id })).min(1).max(30),
  }),
});
export const transitionEngineeringDeliverySchema = z.object({
  params: z.object({ id }),
  body: z.object({
    revision: z.number().int().min(0),
    nodeId: id.nullable(),
    action: z.enum(["START", "SUBMIT", "APPROVE", "REQUEST_REWORK"]),
    summary: z.string().trim().min(20).max(4000).optional(),
    note: z.string().trim().min(2).max(500).optional(),
    githubUrl: z.union([githubUrl, z.literal("")]).optional(),
    liveUrl: z.union([webUrl, z.literal("")]).optional(),
  }).superRefine((value, context) => {
    if (value.action === "SUBMIT" && !value.summary) context.addIssue({ code: "custom", path: ["summary"], message: "A delivery summary is required" });
    if (value.action === "SUBMIT" && value.nodeId === null && !value.liveUrl) context.addIssue({ code: "custom", path: ["liveUrl"], message: "The department head must include the live website URL" });
    if (value.action === "REQUEST_REWORK" && !value.note) context.addIssue({ code: "custom", path: ["note"], message: "Explain the requested changes" });
  }),
});
export const reportEngineeringDeliveryProgressSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    revision: z.number().int().min(0),
    nodeId: id,
    progress: z.number().int().min(0).max(100),
    summary: z.string().trim().min(2).max(1000),
  }),
});
export const listEngineeringDeliveryReportsSchema = z.object({
  query: z.object({
    department: z.enum(["PRODUCT", "ENGINEERING", "IT"]).optional(),
    period: z.enum(["WEEK", "MONTH", "YEAR"]).default("MONTH"),
  }),
});
