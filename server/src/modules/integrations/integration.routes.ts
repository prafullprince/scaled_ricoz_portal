import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { auth } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Integration, IntegrationRun } from "../../models/integration.models.js";
import { Opportunity, OpportunityStatus, OrganizationAssignment, User } from "../../models/index.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { requestRoles } from "../organization/organization.roles.js";
import { resolveSalesAccess } from "../sales/sales.authorization.js";
import { restrictTaskCompanyReads } from "../tasks/task-company-access.js";
import { runWithCompany, scopeFor } from "../company/company.context.js";
import { isDesignatedHr } from "../company/company.service.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { candidateFields, integrationCatalog, leadCategories, leadFields } from "./integration.catalog.js";
import { decryptSecret, encryptSecret, verifyWebhookSignature } from "./integration.security.js";
import { createIntegrationSchema, integrationIdSchema, updateIntegrationSchema, type IntegrationInput } from "./integration.validation.js";
import { executeIntegration, publicIntegration } from "./integration.service.js";
import { validateDestination } from "./integration.ingestion.js";
import { integrationKindsForAccess, narrowIntegrationKinds } from "./integration.access.js";

const router = Router();
type RawRequest = Request & { rawBody?: Buffer };

router.post("/webhooks/:id", rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false }), async (req: RawRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw new ApiError(401, "Webhook authentication failed");
    const integration = await runWithCompany(null, () =>
      Integration.findOne({ _id: id, enabled: true, mode: "WEBHOOK" }).select("+encryptedWebhookSecret").lean(),
    );
    if (!integration || !req.rawBody || !verifyWebhookSignature(
      decryptSecret(integration.encryptedWebhookSecret),
      req.get("X-Ricoz-Timestamp") ?? "", req.get("X-Ricoz-Signature") ?? "", req.rawBody,
    )) throw new ApiError(401, "Webhook authentication failed");
    const result = await runWithCompany(scopeFor(integration.companyId), () =>
      executeIntegration(integration._id, "WEBHOOK", req.body),
    );
    res.status(result.failed ? 207 : 200).json({ success: result.failed === 0, result });
  } catch (error) { next(error); }
}, errorHandler);

async function requireIntegrationManager(req: Request, res: Response, next: NextFunction) {
  const roles = requestRoles(req);
  const executive = roles.some((role) => [UserRole.ADMIN, UserRole.CEO].includes(role));
  const assignment = executive
    ? await OrganizationAssignment.findOne({ userId: req.authUser!._id, active: true }).select("department").lean()
    : null;
  const salesAccess = roles.some((role) => [UserRole.ADMIN, UserRole.CEO, UserRole.HR].includes(role))
    ? null
    : await resolveSalesAccess(String(req.authUser!._id), roles, req.companyPermissions);
  const kinds = integrationKindsForAccess(roles, Boolean(salesAccess?.designation), assignment?.department);
  if (!kinds.length) return next(new ApiError(403, "Only company Admin, CEO, HR, or Sales department members can manage integrations"));
  res.locals.integrationKinds = kinds;
  return next();
}
router.use(auth, requireIntegrationManager, restrictTaskCompanyReads);

function requestIntegrationKinds(req: Request, res: Response) {
  const kinds = narrowIntegrationKinds(res.locals.integrationKinds as Array<"CANDIDATE" | "LEAD">, req.query.kind);
  if (!kinds) throw new ApiError(404, "Integration not found in this company");
  return kinds;
}

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kinds = requestIntegrationKinds(req, res);
    const connectors = await Integration.find({ kind: { $in: kinds } }).sort({ createdAt: -1 }).lean();
    res.json({ connectors: connectors.map(publicIntegration) });
  } catch (error) { next(error); }
}, errorHandler);

router.get("/catalog", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kinds = requestIntegrationKinds(req, res);
    const assignments = await OrganizationAssignment.find({ active: true }).select("userId department level").lean();
    const currentActorHr = await isDesignatedHr(req.authUser!._id);
    const ids = [...new Set([...assignments.map((assignment) => String(assignment.userId)), String(req.authUser!._id)])];
    const [users, opportunities] = await Promise.all([
      User.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) }, status: UserStatus.ACTIVE }).select("_id name roles").sort({ name: 1 }).lean(),
      Opportunity.find({ status: { $nin: [OpportunityStatus.CLOSED, OpportunityStatus.ARCHIVED] } }).select("_id title type").sort({ createdAt: -1 }).lean(),
    ]);
    res.json({
      providers: integrationCatalog.filter((provider) => kinds.includes(provider.kind)),
      categories: kinds.includes("LEAD") ? leadCategories.map(([id, name, examples]) => ({ id, name, examples })) : [],
      fields: {
        ...(kinds.includes("CANDIDATE") ? { CANDIDATE: candidateFields } : {}),
        ...(kinds.includes("LEAD") ? { LEAD: leadFields } : {}),
      },
      opportunities: kinds.includes("CANDIDATE") ? opportunities : [],
      owners: users.map((user) => ({
        id: String(user._id), name: user.name,
        department: assignments.find((assignment) => String(assignment.userId) === String(user._id))?.department
          ?? (String(user._id) === String(req.authUser!._id) && currentActorHr ? "HR" : null),
        executive: user.roles.includes(UserRole.ADMIN) || user.roles.includes(UserRole.CEO),
      })).filter((owner) => (
        (kinds.includes("CANDIDATE") && (owner.department === "HR" || owner.executive))
        || (kinds.includes("LEAD") && owner.department === "SALES")
      )),
      webhookBase: "/api/v1/integrations/webhooks",
      encryptionConfigured: /^[a-f0-9]{64}$/i.test(process.env.INTEGRATIONS_ENCRYPTION_KEY ?? ""),
      notice: "These are configurable JSON API/webhook adapters, not built-in partner integrations. Use an authorized provider API or a permitted middleware service. Provider approval, scopes and licensing may be required. No scraping or password-based portal login.",
    });
  } catch (error) { next(error); }
}, errorHandler);

async function saveIntegration(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as IntegrationInput;
    if (!requestIntegrationKinds(req, res).includes(input.kind)) {
      throw new ApiError(404, "Connector not found in this company");
    }
    const id = req.params.id ? String(req.params.id) : undefined;
    const existing = id ? await Integration.findById(id).select("+encryptedCredential +encryptedWebhookSecret").lean() : null;
    if (id && !existing) throw new ApiError(404, "Connector not found in this company");
    if (existing && (existing.provider !== input.provider || existing.kind !== input.kind)) throw new ApiError(400, "Create a new connector to change the provider or destination type");
    if (existing && existing.lockedUntil > new Date()) throw new ApiError(409, "Wait for the current import before editing this connector");
    await validateDestination({
      kind: input.kind, ownerId: new Types.ObjectId(input.ownerId),
      opportunityId: input.opportunityId ? new Types.ObjectId(input.opportunityId) : null,
    });
    if (input.mode === "API" && input.authType !== "NONE" && !input.credential && !existing?.credentialConfigured) {
      throw new ApiError(400, "An API credential is required for this authentication method");
    }
    const { credential, ...config } = input;
    const webhookSecret = existing ? undefined : randomBytes(32).toString("hex");
    const secrets = {
      ...(credential ? { encryptedCredential: encryptSecret(credential), credentialConfigured: true } : {}),
      ...(input.authType === "NONE" ? { encryptedCredential: "", credentialConfigured: false } : {}),
      ...(webhookSecret ? { encryptedWebhookSecret: encryptSecret(webhookSecret) } : {}),
    };
    const connector = existing
      ? await Integration.findOneAndUpdate(
        { _id: existing._id, lockedUntil: { $lte: new Date() } },
        { $set: { ...config, ...secrets, cursor: "", nextSyncAt: new Date() } },
        { returnDocument: "after", runValidators: true },
      ).lean()
      : (await Integration.create({ ...config, ...secrets, createdBy: req.authUser!._id })).toObject();
    if (!connector) throw new ApiError(409, "Connector changed during editing. Refresh and retry.");
    res.status(existing ? 200 : 201).json({ connector: publicIntegration(connector), ...(webhookSecret ? { webhookSecret } : {}) });
  } catch (error) { next(error); }
}
router.post("/", validateRequest(createIntegrationSchema), saveIntegration, errorHandler);
router.put("/:id", validateRequest(updateIntegrationSchema), saveIntegration, errorHandler);
async function requireVisibleConnector(req: Request, res: Response, next: NextFunction) {
  const connector = await Integration.findById(String(req.params.id)).select("kind").lean();
  if (!connector || !requestIntegrationKinds(req, res).includes(connector.kind)) {
    return next(new ApiError(404, "Connector not found in this company"));
  }
  return next();
}
router.post("/:id/sync", validateRequest(integrationIdSchema), requireVisibleConnector, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await executeIntegration(new Types.ObjectId(String(req.params.id)), "MANUAL");
    res.status(result.failed ? 207 : 200).json({ success: result.failed === 0, result });
  } catch (error) { next(error); }
}, errorHandler);
router.get("/:id/runs", validateRequest(integrationIdSchema), requireVisibleConnector, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = new Types.ObjectId(String(req.params.id));
    if (!await Integration.exists({ _id: id })) throw new ApiError(404, "Connector not found in this company");
    const runs = await IntegrationRun.find({ integrationId: id }).sort({ finishedAt: -1 }).limit(20).lean();
    res.json({ runs });
  } catch (error) { next(error); }
}, errorHandler);
router.post("/:id/rotate-secret", validateRequest(integrationIdSchema), requireVisibleConnector, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhookSecret = randomBytes(32).toString("hex");
    const connector = await Integration.findOneAndUpdate(
      { _id: new Types.ObjectId(String(req.params.id)), lockedUntil: { $lte: new Date() } },
      { $set: { encryptedWebhookSecret: encryptSecret(webhookSecret) } },
      { returnDocument: "after" },
    ).lean();
    if (!connector) throw new ApiError(409, "Connector is importing or not found");
    res.json({ webhookSecret });
  } catch (error) { next(error); }
}, errorHandler);
router.use(errorHandler);
export default router;
