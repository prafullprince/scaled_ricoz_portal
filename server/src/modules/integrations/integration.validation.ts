import { z } from "zod";
import { catalogProvider, candidateFields, leadFields } from "./integration.catalog.js";
import { apiEndpoint } from "./integration.security.js";

const id = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid record ID");
export const fieldPath = z.string().max(200).refine((value) =>
  !value || (/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(value) && !value.split(".").some((part) => ["__proto__", "prototype", "constructor"].includes(part))),
  "Use a safe dotted JSON field path",
);
export const integrationInput = z.object({
  name: z.string().trim().min(2).max(100),
  kind: z.enum(["CANDIDATE", "LEAD"]),
  provider: z.string().max(100),
  enabled: z.boolean().default(false),
  mode: z.enum(["WEBHOOK", "API"]),
  endpoint: z.string().trim().max(2000).default(""),
  authType: z.enum(["NONE", "BEARER", "API_KEY"]).default("NONE"),
  authHeader: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/).refine((value) =>
    !["host", "connection", "content-length", "transfer-encoding", "cookie", "accept-encoding"].includes(value.toLowerCase()), "This header is reserved",
  ).default("X-API-Key"),
  credential: z.string().max(4096).refine((value) => !/[\r\n]/.test(value), "Credentials cannot contain newlines").optional(),
  recordsPath: fieldPath.default(""),
  fieldMapping: z.record(z.string(), fieldPath),
  opportunityId: id.nullable().default(null),
  ownerId: id,
  intervalMinutes: z.number().int().min(5).max(1440).default(15),
  cursorParam: z.string().regex(/^[a-zA-Z0-9_-]*$/).max(80).default(""),
  nextCursorPath: fieldPath.default(""),
}).superRefine((input, ctx) => {
  if (!catalogProvider(input.provider, input.kind)) ctx.addIssue({ code: "custom", path: ["provider"], message: "Select a provider for this connector type" });
  if (input.mode === "API") {
    try { apiEndpoint(input.endpoint); }
    catch { ctx.addIssue({ code: "custom", path: ["endpoint"], message: "Enter a public HTTPS endpoint without embedded credentials" }); }
  }
  const fields: readonly string[] = input.kind === "CANDIDATE" ? candidateFields : leadFields;
  for (const key of Object.keys(input.fieldMapping)) {
    if (!fields.includes(key)) ctx.addIssue({ code: "custom", path: ["fieldMapping", key], message: "Unknown destination field" });
  }
  for (const key of ["externalId", "name", input.kind === "CANDIDATE" ? "email" : "phone"]) {
    if (!input.fieldMapping[key]) ctx.addIssue({ code: "custom", path: ["fieldMapping", key], message: `${key} mapping is required` });
  }
  if (input.kind === "CANDIDATE" && !input.opportunityId) ctx.addIssue({ code: "custom", path: ["opportunityId"], message: "A destination opportunity is required" });
  if (Boolean(input.cursorParam) !== Boolean(input.nextCursorPath)) ctx.addIssue({ code: "custom", path: ["cursorParam"], message: "Configure both cursor parameter and next-cursor path" });
});

export type IntegrationInput = z.infer<typeof integrationInput>;
export const createIntegrationSchema = z.object({ body: integrationInput });
export const updateIntegrationSchema = z.object({ params: z.object({ id }), body: integrationInput });
export const integrationIdSchema = z.object({ params: z.object({ id }) });

const optionalText = (max: number) => z.string().trim().max(max).optional();
const link = z.string().url().max(2000).refine((value) => {
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
}, "Use an HTTP(S) link").optional();
const baseRecord = {
  externalId: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(200)),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: optionalText(30),
};
export const candidateRecord = z.object({
  ...baseRecord,
  address: optionalText(300),
  coverLetter: optionalText(5000),
  resumeUrl: link, portfolioUrl: link, linkedInUrl: link, githubUrl: link,
  currentCompany: optionalText(160),
  experienceYears: z.coerce.number().min(0).max(60).optional(),
  experienceSummary: optionalText(5000),
  skills: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  education: optionalText(3000),
  screeningAnswers: z.array(z.object({ question: z.string().max(500), answer: z.string().max(2000) })).max(30).optional(),
  appliedAt: z.coerce.date().optional(),
});
export const leadRecord = z.object({
  ...baseRecord,
  email: baseRecord.email.optional(),
  phone: z.string().trim().min(7).max(30),
  company: optionalText(160), serviceInterest: optionalText(160), notes: optionalText(4000),
  expectedValue: z.coerce.number().min(0).max(1e12).optional(),
  currency: z.string().regex(/^[a-zA-Z]{3}$/).transform((value) => value.toUpperCase()).optional(),
});

export function valueAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  if (!fieldPath.safeParse(path).success) throw new Error("Invalid mapping path");
  let current = value;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
export function mappedRecord(value: unknown, mapping: Record<string, string>) {
  const mapped: Record<string, unknown> = {};
  for (const [field, path] of Object.entries(mapping)) {
    if (!path) continue;
    const entry = valueAtPath(value, path);
    if (entry !== undefined && entry !== null && entry !== "") mapped[field] = entry;
  }
  return mapped;
}
