import { Router } from "express";
import { auth, requirePermission } from "../../middleware/auth.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission } from "../auth/authorization.js";
import {
  declineRequestSchema,
  requestSchema,
  serviceSchema,
  serviceStatusSchema,
  updateServiceSchema,
} from "./services.validation.js";
import {
  acceptRequest,
  changeServiceStatus,
  completeRequest,
  createRequest,
  createService,
  declineRequest,
  getCustomerRequest,
  getPublicService,
  listAdminRequests,
  listAdminServices,
  listCustomerProjects,
  listCustomerRequests,
  listPublicServices,
  updateService,
} from "./services.controller.js";
const router = Router();
router.get("/", listPublicServices);
router.post(
  "/:id/requests",
  auth,
  validateRequest(requestSchema),
  createRequest,
);
router.get(
  "/admin/list",
  auth,
  requirePermission(Permission.SERVICE_ADMIN),
  listAdminServices,
);
router.post(
  "/admin",
  auth,
  requirePermission(Permission.SERVICE_ADMIN),
  validateRequest(serviceSchema),
  createService,
);
router.patch(
  "/admin/:id",
  auth,
  requirePermission(Permission.SERVICE_ADMIN),
  validateRequest(updateServiceSchema),
  updateService,
);
router.post(
  "/admin/:id/status",
  auth,
  requirePermission(Permission.SERVICE_ADMIN),
  validateRequest(serviceStatusSchema),
  changeServiceStatus,
);
router.get(
  "/customer/requests",
  auth,
  requirePermission(Permission.CUSTOMER_SERVICE_READ),
  listCustomerRequests,
);
router.get(
  "/customer/requests/:id",
  auth,
  requirePermission(Permission.CUSTOMER_SERVICE_READ),
  getCustomerRequest,
);
router.get(
  "/customer/projects",
  auth,
  requirePermission(Permission.CUSTOMER_SERVICE_READ),
  listCustomerProjects,
);
router.get(
  "/admin/requests",
  auth,
  requirePermission(Permission.SERVICE_REVIEW),
  listAdminRequests,
);
router.post(
  "/admin/requests/:id/accept",
  auth,
  requirePermission(Permission.SERVICE_REVIEW),
  acceptRequest,
);
router.post(
  "/admin/requests/:id/decline",
  auth,
  requirePermission(Permission.SERVICE_REVIEW),
  validateRequest(declineRequestSchema),
  declineRequest,
);
router.post(
  "/admin/requests/:id/done",
  auth,
  requirePermission(Permission.SERVICE_REVIEW),
  completeRequest,
);
router.get("/:slug", getPublicService);
export default router;
