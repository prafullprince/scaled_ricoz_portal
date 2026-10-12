import rateLimit from "express-rate-limit";

/** Applies to login — protects against credential brute-forcing */
export const loginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." },
});

/** Applies to OTP request/resend/reset — protects against email/SMS spam & OTP brute force */
export const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, //5 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many OTP requests. Please try again later." },
});

/** Applies broadly to registration */
export const registerRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many accounts created from this IP. Try again later." },
});
