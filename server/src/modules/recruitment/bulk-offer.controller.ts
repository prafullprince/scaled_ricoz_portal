import type { NextFunction, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import otpGenerator from "otp-generator";
import {
  Application,
  ApplicationAssignment,
  ApplicationSource,
  ApplicationStatus,
  DocumentEmailDelivery,
  OfferLetter,
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  OTP,
  OtpPurpose,
  RecruitmentPipeline,
  RecruitmentPipelineStage,
  User,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { sendEmail, sendRecruitmentCandidateInviteEmail } from "../../utils/email.utils.js";
import { hashToken } from "../../utils/tokens.js";
import { otpMatches, otpStorageValue } from "../../utils/otp.utils.js";
import { currentScope } from "../company/company.context.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { OrganizationDepartment } from "../../models/organization.models.js";
import {
  offerCandidateCsvHeaders,
  offerCandidateCsvRowSchema,
} from "./bulk-offer.validation.js";

const maximumCandidatesPerImport = 100;
const deletionOtpThreshold = 5;
const deletionOtpTtlMinutes = 10;
const maximumOtpAttempts = 5;
const sourceLabel = "Bulk offer-stage import";

type CsvCandidate = ReturnType<typeof offerCandidateCsvRowSchema.parse>;

export function parseOfferCandidateCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"' && cell.length === 0 && !closedQuote) {
      quoted = true;
    } else if (character === "," || character === "\n" || character === "\r") {
      row.push(cell.trim());
      cell = "";
      closedQuote = false;
      if (character === ",") continue;
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    } else if (closedQuote && !/\s/.test(character)) {
      throw new ApiError(400, "The CSV contains unexpected characters after a quoted value");
    } else {
      if (!closedQuote) cell += character;
    }
    if (cell.length > 2000) throw new ApiError(400, "CSV cells cannot exceed 2,000 characters");
  }
  if (quoted) throw new ApiError(400, "The CSV contains an unclosed quoted value");
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  if (rows.length < 2) throw new ApiError(400, "The CSV must include a header and at least one candidate row");

  const [header, ...dataRows] = rows;
  if (header?.[0]?.startsWith("\uFEFF")) header[0] = header[0].slice(1);
  if (header?.length !== offerCandidateCsvHeaders.length
    || header.some((field, index) => field !== offerCandidateCsvHeaders[index])) {
    throw new ApiError(400, `CSV headers must match the provided template: ${offerCandidateCsvHeaders.join(", ")}`);
  }
  if (dataRows.length > maximumCandidatesPerImport) {
    throw new ApiError(413, `Import up to ${maximumCandidatesPerImport} candidates at a time`);
  }
  return dataRows.map((values, index) => {
    if (values.length !== offerCandidateCsvHeaders.length) {
      throw new ApiError(400, `CSV row ${index + 2} has ${values.length} columns; expected ${offerCandidateCsvHeaders.length}`);
    }
    return values;
  });
}

async function resolveBulkDeletionTarget(
  req: Request,
  requested: { pipelineIds?: string[]; deleteAll?: boolean },
) {
  const companyId = String(req.company?._id ?? currentScope()?.companyId ?? req.authUser!.companyId ?? "");
  const deleteAll = requested.deleteAll === true;
  const pipelineQuery = deleteAll
    ? RecruitmentPipeline.find()
    : RecruitmentPipeline.find({ _id: { $in: requested.pipelineIds ?? [] } });
  const entries = await pipelineQuery
    .select("_id applicationId")
    .lean();
  if (!entries.length) throw new ApiError(400, "There are no recruitment candidates to delete");
  if (!deleteAll && entries.length !== requested.pipelineIds?.length) {
    throw new ApiError(409, "Some selected candidates no longer exist. Refresh the pipeline and try again");
  }
  const pipelineIds = entries.map((entry) => String(entry._id)).sort();
  return {
    pipelineIds,
    entries,
    deleteAll,
    contextHash: hashToken(JSON.stringify({
      action: "DELETE_RECRUITMENT_CANDIDATES",
      companyId,
      userId: String(req.authUser!._id),
      deleteAll,
      pipelineIds,
    })),
  };
}

export async function importOfferCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const { csv, opportunityId } = req.body as { csv: string; opportunityId: string };
    if (Buffer.byteLength(csv, "utf8") > 2_000_000) {
      throw new ApiError(413, "CSV files must be 2 MB or smaller");
    }
    const opportunity = await Opportunity.findById(opportunityId).select("type role title status").lean();
    if (!opportunity || ![OpportunityType.JOB, OpportunityType.INTERNSHIP].includes(opportunity.type)) {
      throw new ApiError(404, "Select a valid job or internship opportunity");
    }
    if ([OpportunityStatus.CLOSED, OpportunityStatus.ARCHIVED].includes(opportunity.status)) {
      throw new ApiError(409, "Candidates cannot be imported into a closed or archived opportunity");
    }

    const rows = parseOfferCandidateCsv(csv);
    const emailsInCsv = new Set<string>();
    const validated: Array<{ rowNumber: number; value: CsvCandidate | null; error: string | null }> = rows.map((values, index) => {
      const raw = Object.fromEntries(offerCandidateCsvHeaders.map((header, column) => [header, values[column] ?? ""]));
      const parsed = offerCandidateCsvRowSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          rowNumber: index + 2,
          value: null,
          error: parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`).join("; "),
        };
      }
      if (emailsInCsv.has(parsed.data.email)) {
        return { rowNumber: index + 2, value: null, error: "Email is duplicated within this CSV file" };
      }
      emailsInCsv.add(parsed.data.email);
      if (opportunity.type === OpportunityType.JOB && (
        !parsed.data.annualCtc?.trim()
        || !parsed.data.monthlyGrossSalary?.trim()
        || !parsed.data.salaryStructureReference?.trim()
      )) {
        return {
          rowNumber: index + 2,
          value: null,
          error: "Job candidates require annualCtc, monthlyGrossSalary, and salaryStructureReference",
        };
      }
      return { rowNumber: index + 2, value: parsed.data, error: null };
    });

    const imported: Array<{ row: number; name: string; email: string; pipelineId: string; accountCreated: boolean; inviteSent: boolean | null }> = [];
    const errors: Array<{ row: number; email: string; message: string }> = [];
    const actorId = req.authUser!._id;
    const now = new Date();

    for (const result of validated) {
      if (!result.value) {
        errors.push({ row: result.rowNumber, email: rows[result.rowNumber - 2]?.[1] ?? "", message: result.error ?? "Invalid row" });
        continue;
      }

      const input = result.value;
      let createdUserId: typeof actorId | null = null;
      let applicationId: typeof actorId | null = null;
      try {
        let user = await User.findOne({ email: input.email });
        if (user && user.roles.some((role) => [UserRole.CUSTOMER, UserRole.INVESTOR, UserRole.ADMIN].includes(role))) {
          throw new ApiError(409, "This email belongs to an account that cannot be a recruitment candidate");
        }
        if (user && await Application.exists({ opportunityId: opportunity._id, userId: user._id })) {
          throw new ApiError(409, "This candidate already has an application for this opportunity");
        }

        let accountCreated = false;
        if (!user) {
          user = await User.create({
            name: input.name,
            email: input.email,
            phoneNumber: input.phoneNumber,
            password: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
            profile_pic: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(input.name)}`,
            roles: [UserRole.USER],
            status: UserStatus.PENDING,
            emailVerifiedAt: null,
            emailVerified: false,
          });
          createdUserId = user._id;
          accountCreated = true;
        }

        const application = await Application.create({
          opportunityId: opportunity._id,
          userId: user._id,
          status: ApplicationStatus.UNDER_REVIEW,
          source: ApplicationSource.EXTERNAL,
          sourceDetail: sourceLabel,
          createdBy: actorId,
          address: input.address,
          candidatePhone: input.phoneNumber,
          appliedAt: now,
          reviewedAt: now,
          reviewedBy: actorId,
          skills: [],
          screeningAnswers: [],
        });
        applicationId = application._id;

        const selectedRole = opportunity.type === OpportunityType.JOB ? "EMPLOYEE" : "INTERN";
        const entry = await RecruitmentPipeline.create({
          applicationId: application._id,
          opportunityId: opportunity._id,
          stage: RecruitmentPipelineStage.OFFER,
          recruiterId: actorId,
          managerId: null,
          hiringManagerId: null,
          importedDirectlyToOffer: true,
          finalSelection: {
            selectedRole,
            department: input.department as OrganizationDepartment,
            compensationAmount: input.compensationAmount,
            compensationFrequency: input.compensationFrequency,
            annualCtc: input.annualCtc || null,
            monthlyGrossSalary: input.monthlyGrossSalary || null,
            salaryStructureReference: input.salaryStructureReference ?? "",
            currency: input.currency,
            joiningDate: input.joiningDate,
            employmentEndDate: input.employmentEndDate,
            probationPeriod: input.probationPeriod,
            workingHours: input.workingHours,
            acceptanceDeadline: input.acceptanceDeadline,
            benefits: input.benefits ?? "",
            hiringManagerApproved: false,
            approvalNote: "",
          },
          history: [{
            from: RecruitmentPipelineStage.NEW_APPLICATION,
            to: RecruitmentPipelineStage.OFFER,
            actorId,
            note: "Imported directly into Offer stage",
            changedAt: now,
          }],
          createdBy: actorId,
        });

        let inviteSent: boolean | null = null;
        if (accountCreated) {
          try {
            await sendRecruitmentCandidateInviteEmail(user.email, user.name);
            inviteSent = true;
          } catch (error) {
            inviteSent = false;
            console.error("Bulk-import candidate invite email delivery failed", {
              userId: String(user._id),
              message: error instanceof Error ? error.message : "Unknown email delivery error",
            });
          }
        }
        imported.push({
          row: result.rowNumber,
          name: input.name,
          email: input.email,
          pipelineId: String(entry._id),
          accountCreated,
          inviteSent,
        });
      } catch (error) {
        if (applicationId) {
          await Promise.all([
            RecruitmentPipeline.deleteOne({ applicationId }),
            Application.deleteOne({ _id: applicationId }),
          ]);
        }
        if (createdUserId) await User.deleteOne({ _id: createdUserId });
        if (!(error instanceof ApiError) && (error as { code?: number })?.code !== 11000) {
          throw error;
        }
        errors.push({
          row: result.rowNumber,
          email: input.email,
          message: error instanceof ApiError
            ? error.message
            : "Candidate account or application already exists; refresh the pipeline and retry if appropriate",
        });
      }
    }

    return res.status(imported.length ? 201 : 200).json({
      success: errors.length === 0,
      imported,
      errors,
      message: `${imported.length} candidate${imported.length === 1 ? "" : "s"} imported to Offer; ${errors.length} row${errors.length === 1 ? "" : "s"} need attention.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function requestOfferCandidateDeletionOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const requested = req.body as { pipelineIds?: string[]; deleteAll?: boolean };
    const target = await resolveBulkDeletionTarget(req, requested);
    if (!target.deleteAll && target.pipelineIds.length <= deletionOtpThreshold) {
      throw new ApiError(400, "OTP verification is only required when deleting more than five candidates or deleting all candidates");
    }

    const email = req.authUser!.email;
    const otp = otpGenerator.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
      digits: true,
    });
    const expiresAt = new Date(Date.now() + deletionOtpTtlMinutes * 60 * 1000);
    await OTP.findOneAndUpdate(
      { email },
      {
        $set: {
          email,
          otpHash: otpStorageValue(otp),
          purpose: OtpPurpose.CANDIDATE_BULK_DELETION,
          subjectId: req.authUser!._id,
          contextHash: target.contextHash,
          attempts: 0,
          expiresAt,
        },
      },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    try {
      await sendEmail(email, "Confirm bulk candidate deletion", otp);
    } catch (error) {
      await OTP.deleteOne({
        email,
        purpose: OtpPurpose.CANDIDATE_BULK_DELETION,
        subjectId: req.authUser!._id,
        contextHash: target.contextHash,
      });
      throw error;
    }
    return res.status(201).json({
      success: true,
      email,
      candidateCount: target.pipelineIds.length,
      message: `A verification code was sent to ${email}. It expires in ${deletionOtpTtlMinutes} minutes.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteOfferCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const requested = req.body as { pipelineIds?: string[]; deleteAll?: boolean; otp?: string };
    const target = await resolveBulkDeletionTarget(req, requested);
    const entries = target.entries;
    const requiresOtp = target.deleteAll || target.pipelineIds.length > deletionOtpThreshold;
    if (requiresOtp) {
      if (!requested.otp) throw new ApiError(428, "Email verification is required to delete all candidates or more than five candidates");
      const otpDoc = await OTP.findOne({
        email: req.authUser!.email,
        purpose: OtpPurpose.CANDIDATE_BULK_DELETION,
        subjectId: req.authUser!._id,
        contextHash: target.contextHash,
      });
      if (!otpDoc || otpDoc.expiresAt <= new Date()) {
        throw new ApiError(400, "Verification code expired or does not match this deletion. Request a new code");
      }
      if (otpDoc.attempts >= maximumOtpAttempts) {
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
        purpose: OtpPurpose.CANDIDATE_BULK_DELETION,
        subjectId: req.authUser!._id,
        contextHash: target.contextHash,
        otpHash: otpStorageValue(requested.otp),
        attempts: { $lt: maximumOtpAttempts },
        expiresAt: { $gt: new Date() },
      });
      if (!consumedOtp) {
        throw new ApiError(400, "Verification code expired or has already been used. Request a new code");
      }
    }

    const applicationIds = entries.map((entry) => entry.applicationId);
    const offers = await OfferLetter.find({ applicationId: { $in: applicationIds } }).select("_id").lean();
    const offerIds = offers.map((offer) => offer._id);
    await Promise.all([
      DocumentEmailDelivery.deleteMany({ documentType: "OFFER_LETTER", documentId: { $in: offerIds } }),
      OfferLetter.deleteMany({ applicationId: { $in: applicationIds } }),
      ApplicationAssignment.deleteMany({ applicationId: { $in: applicationIds } }),
      Application.deleteMany({ _id: { $in: applicationIds } }),
      RecruitmentPipeline.deleteMany({ _id: { $in: target.pipelineIds } }),
    ]);
    return res.json({
      success: true,
      deletedCount: entries.length,
      message: `${entries.length} candidate${entries.length === 1 ? "" : "s"} removed from the recruitment pipeline. Candidate accounts and other applications were kept.`,
    });
  } catch (error) {
    next(error);
  }
}
