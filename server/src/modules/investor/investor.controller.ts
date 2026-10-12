import type { NextFunction, Request, Response } from "express";
import { InvestorProfile, User } from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { UserRole, VerificationStatus } from "../auth/authorization.js";
import { getOrCreateInvestorProfile } from "../verification/profile.service.js";
import type { RejectInvestorVerificationDto, SubmitInvestorVerificationDto } from "./investor.validation.js";

interface SafeProfileSource {
  linkedInUrl: string | null;
  verificationStatus: VerificationStatus;
  isVerified: boolean;
  rejectionReason: string | null;
  verifiedAt: Date | null;
  updatedAt: Date;
}

const toSafeProfile = (profile: SafeProfileSource) => ({
  linked_in_url: profile.linkedInUrl,
  status: profile.verificationStatus,
  is_verified: profile.isVerified,
  rejection_reason: profile.rejectionReason,
  verified_at: profile.verifiedAt,
  submitted_at: profile.updatedAt,
});

// my-verification (GET) — investor reads their own status.
export const getMyInvestorVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const profile = await getOrCreateInvestorProfile(req.authUser!._id);
    return res.status(200).json({ success: true, verification: toSafeProfile(profile) });
  } catch (error) {
    next(error);
  }
};

// my-verification (POST) — investor may only submit their LinkedIn URL; every other field is server-controlled.
export const submitInvestorVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: SubmitInvestorVerificationDto = req.body;
    const profile = await getOrCreateInvestorProfile(req.authUser!._id);

    profile.linkedInUrl = input.linkedInUrl;
    profile.verificationStatus = VerificationStatus.PENDING;
    profile.isVerified = false;
    profile.rejectionReason = null;
    profile.verifiedAt = null;
    profile.verifiedBy = null;
    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Submitted for verification",
      verification: toSafeProfile(profile),
    });
  } catch (error) {
    next(error);
  }
};

// queue (GET) — employee-only list of investor submissions awaiting review.
export const listInvestorVerificationQueue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;
    const filter: Record<string, unknown> = {
      verificationStatus:
        status && Object.values(VerificationStatus).includes(status as VerificationStatus)
          ? status
          : VerificationStatus.PENDING,
    };

    const profiles = await InvestorProfile.find(filter)
      .sort({ updatedAt: 1 })
      .populate<{ userId: { _id: string; name: string; email: string } }>("userId", "name email");

    return res.status(200).json({
      success: true,
      submissions: profiles
        .filter((profile) => profile.userId)
        .map((profile) => ({
          user_id: profile.userId._id,
          name: profile.userId.name,
          email: profile.userId.email,
          ...toSafeProfile(profile),
        })),
    });
  } catch (error) {
    next(error);
  }
};

// approve (POST) — employee-only; the client can never set isVerified/verifiedAt/verifiedBy directly.
export const approveInvestorVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser || !targetUser.roles.includes(UserRole.INVESTOR)) {
      throw new ApiError(404, "Investor not found");
    }

    const profile = await getOrCreateInvestorProfile(targetUser._id);
    profile.verificationStatus = VerificationStatus.VERIFIED;
    profile.isVerified = true;
    profile.rejectionReason = null;
    profile.verifiedAt = new Date();
    profile.verifiedBy = req.authUser!._id;
    await profile.save();

    return res.status(200).json({ success: true, message: "Investor verified", verification: toSafeProfile(profile) });
  } catch (error) {
    next(error);
  }
};

// reject (POST) — employee-only.
export const rejectInvestorVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: RejectInvestorVerificationDto = req.body;
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser || !targetUser.roles.includes(UserRole.INVESTOR)) {
      throw new ApiError(404, "Investor not found");
    }

    const profile = await getOrCreateInvestorProfile(targetUser._id);
    profile.verificationStatus = VerificationStatus.REJECTED;
    profile.isVerified = false;
    profile.rejectionReason = input.reason ?? null;
    profile.verifiedAt = null;
    profile.verifiedBy = req.authUser!._id;
    await profile.save();

    return res.status(200).json({ success: true, message: "Investor rejected", verification: toSafeProfile(profile) });
  } catch (error) {
    next(error);
  }
};
