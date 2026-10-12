import { hashToken } from "./tokens.js";

export const otpStorageValue = (otp: string) =>
  process.env.NODE_ENV === "production" ? hashToken(otp) : otp;

export const otpMatches = (storedOtp: string, providedOtp: string) =>
  storedOtp === otpStorageValue(providedOtp);
