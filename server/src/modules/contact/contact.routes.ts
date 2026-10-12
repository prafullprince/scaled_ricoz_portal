import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { auth, requireRole } from "../../middleware/auth.middleware.js";
import { UserRole } from "../auth/authorization.js";
import { submitContact } from "./contact.controller.js";
import { contactSchema } from "./contact.validation.js";
import { getHelpOptions, saveHelpOptions } from "./help-options.controller.js";
import { helpOptionsSchema } from "./help-options.validation.js";

const router = Router();
const contactRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { success: false, message: "Too many contact requests. Please try again later." } });
router.post("/", contactRateLimiter, validateRequest(contactSchema), submitContact);
router.get("/help-options", auth, getHelpOptions, errorHandler);
router.put(
  "/help-options",
  auth,
  requireRole(UserRole.CEO, UserRole.ADMIN),
  validateRequest(helpOptionsSchema),
  saveHelpOptions,
  errorHandler,
);
export default router;