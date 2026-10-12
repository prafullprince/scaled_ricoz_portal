import type { NextFunction, Request, Response } from "express";
import otpGenerator from "otp-generator";
import { CostPlan, OTP, ResourcePlan, RevenueForecast } from "../../models/index.js";
import { OtpPurpose } from "../../models/otp.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { sendEmail } from "../../utils/email.utils.js";
import { otpMatches, otpStorageValue } from "../../utils/otp.utils.js";
import { hashToken } from "../../utils/tokens.js";
import { buildRevenueProjection, mergeRevenueStreamsPreservingExisting } from "./revenue-projections.js";
import type { RevenueStreamDeletionTarget, RevenueStreamInput } from "./finance.validation.js";
import { buildResourcePlan } from "./resource-planning.js";
import type { PlannedResourceInput } from "./resource-planning.validation.js";
import { buildCostPlan } from "./cost-planning.js";
import type { PlannedCostCategoryInput } from "./cost-planning.validation.js";
import { buildFinancialSummary } from "./financial-summary.js";
import { buildAiForecastFromInputs } from "./ai-forecast.js";

const REVENUE_DELETION_OTP_TTL_MINUTES = 10;
const MAX_REVENUE_DELETION_OTP_ATTEMPTS = 5;
const REVENUE_STREAMS_OTP_THRESHOLD = 5;

function fiscalYearStart(req: Request) {
  const value = Number(req.params.fiscalYearStart);
  if (!Number.isInteger(value) || value < 2000 || value > 2100) {
    throw new ApiError(400, "Fiscal year must start between 2000 and 2100");
  }
  return value;
}

function generateOtp() {
  return otpGenerator.generate(6, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
    digits: true,
  });
}

async function resolveRevenueDeletionTarget(
  req: Request,
  year: number,
  requested: RevenueStreamDeletionTarget,
) {
  const forecast = await RevenueForecast.findOne({ fiscalYearStart: year }).lean();
  if (!forecast) throw new ApiError(404, "No revenue forecast exists for this fiscal year");

  const existingIds = forecast.streams.map((stream) => stream.streamId);
  const deleteAll = requested.deleteAll === true;
  const streamIds = deleteAll ? existingIds : requested.streamIds ?? [];
  if (!streamIds.length) throw new ApiError(400, "There are no revenue streams to delete");
  const existingIdSet = new Set(existingIds);
  const missingIds = streamIds.filter((streamId) => !existingIdSet.has(streamId));
  if (missingIds.length) {
    throw new ApiError(409, "Some selected revenue streams no longer exist. Refresh the forecast and try again");
  }

  const companyId = String(req.company?._id ?? req.authUser!.companyId ?? "");
  const contextHash = hashToken(JSON.stringify({
    action: "DELETE_REVENUE_STREAMS",
    companyId,
    userId: String(req.authUser!._id),
    fiscalYearStart: year,
    deleteAll,
    streamIds: [...streamIds].sort(),
  }));
  return { streamIds, deleteAll, contextHash };
}

function serializeForecast(fiscalYear: number, streams: RevenueStreamInput[]) {
  return {
    fiscalYearStart: fiscalYear,
    ...buildRevenueProjection(streams),
  };
}

export async function getRevenueForecast(req: Request, res: Response, next: NextFunction) {
  try {
    const year = fiscalYearStart(req);
    const forecast = await RevenueForecast.findOne({ fiscalYearStart: year }).lean();
    return res.json({
      success: true,
      forecast: serializeForecast(year, forecast?.streams ?? []),
      updatedAt: forecast?.updatedAt ?? null,
    });
  } catch (error) {
    next(error);
  }
}

export async function saveRevenueForecast(req: Request, res: Response, next: NextFunction) {
  try {
    const year = fiscalYearStart(req);
    const streams = req.body.streams as RevenueStreamInput[];
    const userId = req.authUser!._id;
    const existingForecast = await RevenueForecast.findOne({ fiscalYearStart: year }).select("streams").lean();
    const mergedStreams = mergeRevenueStreamsPreservingExisting(existingForecast?.streams ?? [], streams);
    if (mergedStreams.length > 1_000) {
      throw new ApiError(400, "A forecast can contain at most 1,000 revenue streams");
    }
    const forecast = await RevenueForecast.findOneAndUpdate(
      { fiscalYearStart: year },
      {
        $set: { streams: mergedStreams, updatedBy: userId },
        $setOnInsert: { createdBy: userId },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    if (!forecast) throw new ApiError(500, "Revenue forecast could not be saved");
    return res.json({
      success: true,
      forecast: serializeForecast(year, forecast.streams),
      updatedAt: forecast.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function requestRevenueStreamDeletionOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const year = fiscalYearStart(req);
    const requested = req.body as RevenueStreamDeletionTarget;
    const target = await resolveRevenueDeletionTarget(req, year, requested);
    if (!target.deleteAll && target.streamIds.length <= REVENUE_STREAMS_OTP_THRESHOLD) {
      throw new ApiError(400, "OTP verification is only used when deleting more than five streams or deleting all streams");
    }

    const email = req.authUser!.email;
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + REVENUE_DELETION_OTP_TTL_MINUTES * 60 * 1000);
    await OTP.findOneAndUpdate(
      { email },
      {
        $set: {
          email,
          otpHash: otpStorageValue(otp),
          purpose: OtpPurpose.REVENUE_STREAM_DELETION,
          subjectId: req.authUser!._id,
          contextHash: target.contextHash,
          attempts: 0,
          expiresAt,
        },
      },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    try {
      await sendEmail(email, "Confirm revenue stream deletion", otp);
    } catch (error) {
      await OTP.deleteOne({
        email,
        purpose: OtpPurpose.REVENUE_STREAM_DELETION,
        subjectId: req.authUser!._id,
        contextHash: target.contextHash,
      });
      throw error;
    }

    return res.status(201).json({
      success: true,
      email,
      message: `A verification code was sent to ${email}. It expires in ${REVENUE_DELETION_OTP_TTL_MINUTES} minutes.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteRevenueStreams(req: Request, res: Response, next: NextFunction) {
  try {
    const year = fiscalYearStart(req);
    const requested = req.body as RevenueStreamDeletionTarget & { otp?: string };
    const target = await resolveRevenueDeletionTarget(req, year, requested);
    const requiresOtp = target.deleteAll || target.streamIds.length > REVENUE_STREAMS_OTP_THRESHOLD;

    if (requiresOtp) {
      if (!requested.otp) {
        throw new ApiError(428, "Email verification is required. Request a code before deleting these streams");
      }
      const otpDoc = await OTP.findOne({
        email: req.authUser!.email,
        purpose: OtpPurpose.REVENUE_STREAM_DELETION,
        subjectId: req.authUser!._id,
        contextHash: target.contextHash,
      });
      if (!otpDoc || otpDoc.expiresAt <= new Date()) {
        throw new ApiError(400, "Verification code expired or does not match this deletion. Request a new code");
      }
      if (otpDoc.attempts >= MAX_REVENUE_DELETION_OTP_ATTEMPTS) {
        throw new ApiError(429, "Too many incorrect verification attempts. Request a new code");
      }
      if (!otpMatches(otpDoc.otpHash, requested.otp)) {
        otpDoc.attempts += 1;
        await otpDoc.save();
        throw new ApiError(400, "Incorrect verification code");
      }
      const consumedOtp = await OTP.findOneAndDelete({
        _id: otpDoc._id,
        email: req.authUser!.email,
        purpose: OtpPurpose.REVENUE_STREAM_DELETION,
        subjectId: req.authUser!._id,
        contextHash: target.contextHash,
        otpHash: otpStorageValue(requested.otp),
        attempts: { $lt: MAX_REVENUE_DELETION_OTP_ATTEMPTS },
        expiresAt: { $gt: new Date() },
      });
      if (!consumedOtp) {
        throw new ApiError(400, "Verification code expired or has already been used. Request a new code");
      }
    }

    const update = target.deleteAll
      ? { $set: { streams: [], updatedBy: req.authUser!._id } }
      : {
        $pull: { streams: { streamId: { $in: target.streamIds } } },
        $set: { updatedBy: req.authUser!._id },
      };
    const forecast = await RevenueForecast.findOneAndUpdate(
      { fiscalYearStart: year },
      update,
      { new: true, runValidators: true },
    ).lean();
    if (!forecast) throw new ApiError(404, "Revenue forecast could not be updated");

    const remainingIds = new Set(forecast.streams.map((stream) => stream.streamId));
    const deletedCount = target.streamIds.filter((streamId) => !remainingIds.has(streamId)).length;
    return res.json({
      success: true,
      deletedCount,
      forecast: serializeForecast(year, forecast.streams),
      updatedAt: forecast.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function getResourcePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const year = fiscalYearStart(req);
    const plan = await ResourcePlan.findOne({ fiscalYearStart: year }).lean();
    return res.json({
      success: true,
      plan: buildResourcePlan(year, plan?.resources ?? []),
      updatedAt: plan?.updatedAt ?? null,
    });
  } catch (error) {
    next(error);
  }
}

export async function saveResourcePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const year = fiscalYearStart(req);
    const resources = req.body.resources as PlannedResourceInput[];
    const userId = req.authUser!._id;
    const plan = await ResourcePlan.findOneAndUpdate(
      { fiscalYearStart: year },
      {
        $set: { resources, updatedBy: userId },
        $setOnInsert: { createdBy: userId },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    if (!plan) throw new ApiError(500, "Resource plan could not be saved");
    return res.json({
      success: true,
      plan: buildResourcePlan(year, plan.resources),
      updatedAt: plan.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCostPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const year = fiscalYearStart(req);
    const plan = await CostPlan.findOne({ fiscalYearStart: year }).lean();
    return res.json({
      success: true,
      plan: buildCostPlan(year, plan?.categories ?? []),
      updatedAt: plan?.updatedAt ?? null,
    });
  } catch (error) {
    next(error);
  }
}

export async function saveCostPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const year = fiscalYearStart(req);
    const categories = req.body.categories as PlannedCostCategoryInput[];
    const userId = req.authUser!._id;
    const plan = await CostPlan.findOneAndUpdate(
      { fiscalYearStart: year },
      {
        $set: { categories, updatedBy: userId },
        $setOnInsert: { createdBy: userId },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    if (!plan) throw new ApiError(500, "Cost plan could not be saved");
    return res.json({
      success: true,
      plan: buildCostPlan(year, plan.categories),
      updatedAt: plan.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function getFinancialSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const year = fiscalYearStart(req);
    const [revenue, resources, costs] = await Promise.all([
      RevenueForecast.findOne({ fiscalYearStart: year }).lean(),
      ResourcePlan.findOne({ fiscalYearStart: year }).lean(),
      CostPlan.findOne({ fiscalYearStart: year }).lean(),
    ]);
    const summary = buildFinancialSummary(
      year,
      buildRevenueProjection(revenue?.streams ?? []),
      buildResourcePlan(year, resources?.resources ?? []),
      buildCostPlan(year, costs?.categories ?? []),
    );
    return res.json({ success: true, summary });
  } catch (error) {
    next(error);
  }
}

export async function getAiForecast(req: Request, res: Response, next: NextFunction) {
  try {
    const year = fiscalYearStart(req);
    const [revenue, resources, costs] = await Promise.all([
      RevenueForecast.findOne({ fiscalYearStart: year }).lean(),
      ResourcePlan.findOne({ fiscalYearStart: year }).lean(),
      CostPlan.findOne({ fiscalYearStart: year }).lean(),
    ]);
    const forecast = buildAiForecastFromInputs(
      year,
      revenue?.streams ?? [],
      resources?.resources ?? [],
      costs?.categories ?? [],
    );
    return res.json({ success: true, forecast });
  } catch (error) {
    next(error);
  }
}
