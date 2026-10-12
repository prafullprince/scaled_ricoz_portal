import { email, z } from "zod";

// Email Schema
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid Email Address");

// Password Schema
export const passwordSchema = z
  .string()
  .trim()
  .min(8, "Password must contain 8 characters")
  // .regex(/[a-z]/, "Password must contain lowercase char")
  // .regex(/[A-Z]/, "Password must contain uppercase char")
  // .regex(/[0-9]/, "Password must contain a Number");

// OTP Schema
export const otpSchema = z
  .string()
  .trim()
  .length(6, "Otp must be of 6 chars")
  .regex(/^\d+$/, "OTP must be numeric");

// Register Schema
export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3, "Name must be of at least 3 characters"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
    otp: otpSchema,
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }),
});

// Login Schema
export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
  }),
});

// Verify Email Schema
export const verifyEmailSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const requestPasswordResetSchema = verifyEmailSchema;
export const resetPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: otpSchema,
    newPassword: passwordSchema,
  }),
});

// Update Profile Schema — only fields the user is allowed to self-edit.
export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3, "Name must be of at least 3 characters").optional(),
    phoneNumber: z.string().trim().max(20, "Phone number is too long").optional(),
    about: z.string().trim().max(300, "Bio must be under 300 characters").optional(),
    profile_pic: z.string().trim().url("Must be a valid URL").optional(),
  }),
});

// Change Password Schema
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
  }).refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  }),
});

export type RegisterDto = z.infer<typeof registerSchema>["body"];
export type LoginDto = z.infer<typeof loginSchema>["body"];
export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>["body"];
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>["body"];
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>["body"];
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>["body"];
