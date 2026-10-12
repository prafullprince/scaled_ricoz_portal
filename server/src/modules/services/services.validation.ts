import { z } from "zod";
import { ServiceStatus } from "../../models/service.models.js";
const items = z.array(z.string().trim().min(1)).default([]);
const fields = z.object({ title: z.string().trim().min(2).max(160), slug: z.string().trim().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), shortDescription: z.string().trim().min(10).max(300), description: z.string().trim().min(20), category: z.string().trim().min(2).max(80), techStack: items, deliverables: items, process: items, requirements: items, faqs: z.array(z.object({ question: z.string().trim().min(1), answer: z.string().trim().min(1) })).default([]), pricing: z.string().trim().max(120).optional(), estimatedDelivery: z.string().trim().max(120).optional() });
export const serviceSchema = z.object({ body: fields });
export const updateServiceSchema = z.object({ body: fields.partial() });
export const serviceStatusSchema = z.object({ body: z.object({ status: z.enum(Object.values(ServiceStatus) as [string, ...string[]]) }) });
export const requestSchema = z.object({ body: z.object({ projectTitle: z.string().trim().min(3).max(160), projectDescription: z.string().trim().min(20).max(5000), requirements: items, expectedTimeline: z.string().trim().max(120).optional(), budget: z.string().trim().max(120).optional(), additionalRequirements: z.string().trim().max(3000).optional() }) });
export const declineRequestSchema = z.object({ body: z.object({ reason: z.string().trim().max(1000).optional() }) });