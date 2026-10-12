
import { Router } from "express";
import { loginRateLimiter, otpRateLimiter, registerRateLimiter } from "../../middleware/rate_limiter.middleware.js";
import { changePasswordSchema, loginSchema, registerSchema, requestPasswordResetSchema, resetPasswordSchema, updateProfileSchema, verifyEmailSchema } from "./auth.validation.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import {
  changePassword,
  currentUser,
  listSessions,
  login,
  logout,
  logoutAll,
  refresh,
  requestPasswordReset,
  register,
  resetPassword,
  revokeSession,
  sendOtp,
  updateProfile,
} from "./auth.controller.js";
import { auth, requirePermission } from "../../middleware/auth.middleware.js";
import { Permission } from "./authorization.js";

const router = Router();

router.post(
  "/send_otp",
  otpRateLimiter,
  validateRequest(verifyEmailSchema),
  sendOtp,
  errorHandler,
);
router.post(
  "/forgot-password",
  otpRateLimiter,
  validateRequest(requestPasswordResetSchema),
  requestPasswordReset,
  errorHandler,
);
router.post(
  "/reset-password",
  otpRateLimiter,
  validateRequest(resetPasswordSchema),
  resetPassword,
  errorHandler,
);
router.post(
  "/signup",
  registerRateLimiter,
  validateRequest(registerSchema),
  register,
  errorHandler,
);
router.post(
  "/login",
  loginRateLimiter,
  validateRequest(loginSchema),
  login,
  errorHandler,
);
router.post("/refresh", refresh, errorHandler);
router.post("/logout", logout, errorHandler);
router.post("/logout-all", auth, logoutAll, errorHandler);
router.get("/me", auth, currentUser, errorHandler);
router.patch(
  "/profile",
  auth,
  requirePermission(Permission.PROFILE_UPDATE),
  validateRequest(updateProfileSchema),
  updateProfile,
  errorHandler,
);
router.post(
  "/change-password",
  auth,
  loginRateLimiter,
  validateRequest(changePasswordSchema),
  changePassword,
  errorHandler,
);
router.get("/sessions", auth, listSessions, errorHandler);
router.delete("/sessions/:id", auth, revokeSession, errorHandler);

export default router;
