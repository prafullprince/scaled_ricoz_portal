import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { randomBytes } from "node:crypto";
import otpGenerator from "otp-generator";
import type { IApplicationAssignment } from "../../models/applicationAssignment.models.js";
import bcrypt from "bcryptjs";
import { Application, ApplicationAssignment, ApplicationAssignmentStatus, ApplicationSource, ApplicationStatus, Company, EmployeeProfile, InternProfile, OfferLetter, OfferLetterStatus, OfferType, Opportunity, OpportunityStatus, OpportunityType, OrganizationAssignment, OrganizationLevel, OTP, OtpPurpose, RecruitmentCandidateListEntry, RecruitmentPipeline, RecruitmentPipelineStage, User } from "../../models/index.js";
import { UserRole, UserStatus, VerificationStatus } from "../auth/authorization.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { otpMatches, otpStorageValue } from "../../utils/otp.utils.js";
import { hashToken } from "../../utils/tokens.js";
import type { CandidateImportInput, DirectCandidateInput, OpportunityInput } from "./recruitment.validation.js";
import { candidateImportSchema, candidateListEntryFields } from "./recruitment.validation.js";
import { createOfferDocument, markOfferGenerated, sendOfferByEmail, acceptOfferByCandidate, declineOfferByCandidate, offerSendingTerms } from "./offer.service.js";
import { OrganizationDepartment } from "../../models/organization.models.js";
import { currentScope, runWithCompany, scopeFor } from "../company/company.context.js";
import { sendEmail, sendRecruitmentCandidateInviteEmail, sendWelcomeEmail } from "../../utils/email.utils.js";
import { requestRoles } from "../organization/organization.roles.js";
import { isHrStructureAdmin, isSystemHrStructureAdmin } from "../organization/organization.controller.js";

const publicFilter = { status: OpportunityStatus.PUBLISHED };

function getResumeFile(req: Request) {
  const uploaded = req.files?.resumePdf ?? req.files?.resume;
  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  if (!file) return null;
  if (file.mimetype !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    throw new ApiError(400, "Resume must be a PDF file");
  }
  if (!file.data.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    throw new ApiError(400, "Resume is not a valid PDF file");
  }
  return file;
}

function safeApplication(application: any) {
  const value = application.toObject ? application.toObject() : application;
  delete value.resumePdf;
  return value;
}

function safeOffer(offer: any) {
  const value = offer?.toObject ? offer.toObject() : { ...offer };
  delete value.pdfBuffer;
  return value;
}

export async function listPublicOpportunities(req: Request, res: Response, next: NextFunction) {
  try {
    const filter: Record<string, unknown> = { ...publicFilter };
    if (typeof req.query.type === "string") filter.type = req.query.type.toUpperCase();
    if (typeof req.query.workMode === "string") filter.workMode = req.query.workMode.toUpperCase();
    if (typeof req.query.employmentType === "string") filter.employmentType = req.query.employmentType.toUpperCase();
    if (typeof req.query.category === "string") filter.category = req.query.category;
    const andFilters: Record<string, unknown>[] = [];
    const addSearch = (value: unknown, fields: string[]) => {
      if (typeof value !== "string" || !value.trim()) return;
      const literal = value.trim().slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      andFilters.push({
        $or: fields.map((field) => ({ [field]: new RegExp(literal, "i") })),
      });
    };
    addSearch(req.query.search, ["title", "role", "category", "techStack", "description"]);
    addSearch(req.query.profile, ["title", "role", "category", "techStack"]);
    if (typeof req.query.location === "string" && req.query.location.trim()) {
      const literal = req.query.location.trim().slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.location = new RegExp(literal, "i");
    }
    if (req.query.internshipsInCity === "true") {
      if (filter.type === OpportunityType.JOB) filter._id = null;
      else filter.type = OpportunityType.INTERNSHIP;
    }
    if (req.query.workFromHome === "true") filter.workMode = "REMOTE";
    if (req.query.partTime === "true") filter.employmentType = "PART_TIME";
    if (typeof req.query.minStipend === "string") {
      const minimum = Number(req.query.minStipend);
      if (Number.isFinite(minimum) && minimum > 0) {
        if (filter.type === OpportunityType.JOB) filter._id = null;
        else {
          filter.type = OpportunityType.INTERNSHIP;
          filter.fixedPayMin = { $gte: minimum };
        }
      }
    }
    if (andFilters.length) filter.$and = andFilters;
    const paginated = typeof req.query.page === "string";
    const pageValue = paginated ? Number(req.query.page) : 1;
    const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
    const requestedLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : 20;
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(50, Math.max(1, requestedLimit))
      : 20;
    const result = await runWithCompany(null, async () => {
      const activeCompanyIds = await Company.find({ active: true }).distinct("_id");
      filter.companyId = { $in: activeCompanyIds };
      const query = Opportunity.find(filter)
        .populate({ path: "companyId", select: "name slug active description industry category", match: { active: true } })
        .sort({ publishedAt: -1, createdAt: -1 });
      if (!paginated) {
        if (typeof req.query.limit === "string") query.limit(limit);
        const opportunities = await query.lean();
        return { opportunities: opportunities.filter((item) => item.companyId) };
      }
      const total = await Opportunity.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);
      const currentPage = Math.min(page, Math.max(1, totalPages));
      const opportunities = await query.skip((currentPage - 1) * limit).limit(limit).lean();
      return {
        opportunities: opportunities.filter((item) => item.companyId),
        pagination: { page: currentPage, limit, total, totalPages },
      };
    });
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, ...result });
  } catch (error) { next(error); }
}

export async function getPublicOpportunity(req: Request, res: Response, next: NextFunction) {
  try {
    const opportunity = await runWithCompany(null, () => Opportunity.findOne({ _id: req.params.id, ...publicFilter } as any)
      .populate({ path: "companyId", select: "name slug active description industry category", match: { active: true } })
      .lean());
    if (!opportunity || !opportunity.companyId) throw new ApiError(404, "Opportunity not found");
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, opportunity });
  } catch (error) { next(error); }
}

export async function createOpportunity(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as OpportunityInput;
    const opportunity = await Opportunity.create({
      ...input,
      role: input.role ?? input.title,
      category: input.category ?? input.techStack[0] ?? (input.type === OpportunityType.JOB ? "Job" : "Internship"),
      createdBy: req.authUser!._id,
      status: OpportunityStatus.DRAFT,
    } as any);
    return res.status(201).json({ success: true, opportunity });
  } catch (error) { next(error); }
}

export async function listAdminOpportunities(_req: Request, res: Response, next: NextFunction) {
  try { return res.json({ success: true, opportunities: await Opportunity.find().sort({ createdAt: -1 }).lean() }); }
  catch (error) { next(error); }
}

type RecruitmentApplicationInput =
  Pick<DirectCandidateInput, "opportunityId" | "name" | "email" | "phoneNumber">
  & Partial<Omit<DirectCandidateInput, "opportunityId" | "name" | "email" | "phoneNumber">>;

async function createCandidateApplication(input: RecruitmentApplicationInput, req: Request) {
  let createdUserId: Types.ObjectId | null = null;
  const opportunity = await Opportunity.findById(input.opportunityId);
  if (!opportunity) throw new ApiError(404, "Opportunity not found in the selected company");
  if (input.sourcePlatform && [OpportunityStatus.CLOSED, OpportunityStatus.ARCHIVED].includes(opportunity.status)) {
    throw new ApiError(409, "This opportunity is closed and cannot receive imported candidates");
  }
  const resume = getResumeFile(req);
  if (resume && resume.size > 10 * 1024 * 1024) {
    throw new ApiError(413, "Resume files must be 10 MB or smaller");
  }

  let user = await User.findOne({ email: input.email });
  if (user && user.status !== UserStatus.ACTIVE) {
    const existingUserId = user._id;
    const existingImport = input.sourcePlatform
      ? await Application.exists({ userId: existingUserId, source: ApplicationSource.EXTERNAL, sourceDetail: input.sourcePlatform })
      : await runWithCompany(null, () => Application.exists({
        userId: existingUserId,
        source: ApplicationSource.DIRECT,
        ...(input.sourceDetail ? { sourceDetail: input.sourceDetail } : {}),
      }));
    if (!existingImport || user.emailVerifiedAt) {
      throw new ApiError(409, "An account with this email is not active yet");
    }
  }
  if (user && user.roles.some((role) => [UserRole.CUSTOMER, UserRole.INVESTOR, UserRole.ADMIN].includes(role))) {
    throw new ApiError(409, "This account cannot be added as a recruitment candidate");
  }
  if (user && await Application.exists({ opportunityId: opportunity._id, userId: user._id })) {
    throw new ApiError(409, "This candidate already has an application for the selected opportunity");
  }

  let accountCreated = false;
  if (!user) {
    try {
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
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ApiError(409, "An account with this email was created concurrently. Refresh and try again.");
      }
      throw error;
    }
  }

  let application;
  try {
    application = await Application.create({
      opportunityId: opportunity._id,
      userId: user._id,
      status: ApplicationStatus.APPLIED,
      source: input.sourcePlatform ? ApplicationSource.EXTERNAL : ApplicationSource.DIRECT,
      ...(input.sourcePlatform ? { sourceDetail: input.sourcePlatform } : {}),
      createdBy: req.authUser!._id,
      address: input.address ?? "",
      candidatePhone: input.phoneNumber,
      appliedAt: new Date(),
      ...(input.coverLetter ? { coverLetter: input.coverLetter } : {}),
      ...(input.portfolioUrl ? { portfolioUrl: input.portfolioUrl } : {}),
      ...(input.linkedInUrl ? { linkedInUrl: input.linkedInUrl } : {}),
      ...(input.githubUrl ? { githubUrl: input.githubUrl } : {}),
      ...(input.currentCompany ? { currentCompany: input.currentCompany } : {}),
      ...(input.experienceYears !== undefined ? { experienceYears: input.experienceYears } : {}),
      ...(input.experienceSummary ? { experienceSummary: input.experienceSummary } : {}),
      skills: input.skills ?? [],
      ...(input.education ? { education: input.education } : {}),
      screeningAnswers: [],
      ...(resume ? { resumePdf: resume.data, resumeFileName: resume.name, resumeFileSize: resume.size } : {}),
    });
  } catch (error) {
    if (createdUserId) await User.deleteOne({ _id: createdUserId });
    if ((error as { code?: number }).code === 11000) {
      throw new ApiError(409, "This candidate already has an application for the selected opportunity");
    }
    throw error;
  }

  if (input.sourcePlatform) {
    const assignment = await OrganizationAssignment.findOne({
      userId: req.authUser!._id,
      department: OrganizationDepartment.HR,
      active: true,
    }).select("level reportsTo").lean();
    const managerId = assignment?.level === OrganizationLevel.MEMBER
      ? assignment.reportsTo ?? null
      : assignment?.level === OrganizationLevel.MANAGER
        ? req.authUser!._id
        : null;
    try {
      await RecruitmentPipeline.updateOne(
        { applicationId: application._id },
        { $setOnInsert: {
          applicationId: application._id,
          opportunityId: opportunity._id,
          stage: RecruitmentPipelineStage.NEW_APPLICATION,
          recruiterId: req.authUser!._id,
          managerId,
          hiringManagerId: null,
          createdBy: req.authUser!._id,
        } },
        { upsert: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) {
        await Application.deleteOne({ _id: application._id });
        if (createdUserId) await User.deleteOne({ _id: createdUserId });
        throw error;
      }
    }
  }

  let activationEmailSent: boolean | null = null;
  if (accountCreated) {
    try {
      await sendRecruitmentCandidateInviteEmail(user.email, user.name);
      activationEmailSent = true;
    } catch (error) {
      activationEmailSent = false;
      console.error("Candidate activation email delivery failed", {
        userId: String(user._id),
        message: error instanceof Error ? error.message : "Unknown email delivery error",
      });
    }
  }
  return {
      success: true,
      accountCreated,
      activationEmailSent,
      application: safeApplication(application),
  };
}

export async function createDirectApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as DirectCandidateInput;
    return res.status(201).json(await createCandidateApplication(input, req));
  } catch (error) {
    next(error);
  }
}

export async function importCandidateListEntries(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = req.body as {
      rows: Array<{ sheet: string; rowNumber: number; values: Record<string, string> }>;
    };
    const imported: Array<{ _id: string; sheet: string; rowNumber: number; name: string; email: string; phoneNumber: string; sourcePlatform: string; archivedAt: null; createdAt: Date }> = [];
    const errors: Array<{ sheet: string; row: number; email: string; message: string }> = [];
    const actorId = req.authUser!._id;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!;
      const candidate = candidateListEntryFields.safeParse({
        name: row.values.name,
        email: row.values.email,
        phoneNumber: row.values.phoneNumber,
        sourcePlatform: row.values.sourcePlatform,
      });
      if (!candidate.success) {
        errors.push({
          sheet: row.sheet,
          row: row.rowNumber,
          email: row.values.email ?? "",
          message: [...new Set(candidate.error.issues.map((issue) => issue.message))].join("; "),
        });
        continue;
      }
      try {
        const entry = await RecruitmentCandidateListEntry.create({
          ...candidate.data,
          sheet: row.sheet,
          rowNumber: row.rowNumber,
          createdBy: actorId,
        });
        imported.push({
          _id: String(entry._id),
          sheet: row.sheet,
          rowNumber: row.rowNumber,
          name: entry.name,
          email: entry.email,
          phoneNumber: entry.phoneNumber,
          sourcePlatform: entry.sourcePlatform,
          archivedAt: null,
          createdAt: entry.createdAt,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          errors.push({ sheet: row.sheet, row: row.rowNumber, email: candidate.data.email, message: error.message });
          continue;
        }
        console.error("Candidate list import stopped after an unexpected row failure", {
          sheet: row.sheet,
          row: row.rowNumber,
          error,
        });
        errors.push({ sheet: row.sheet, row: row.rowNumber, email: candidate.data.email, message: "Import stopped because of a server error. Rows after this one were not attempted." });
        for (const remaining of rows.slice(index + 1)) {
          errors.push({ sheet: remaining.sheet, row: remaining.rowNumber, email: remaining.values.email ?? "", message: "Not attempted because the import stopped after a server error." });
        }
        break;
      }
    }
    return res.json({ success: true, imported, skipped: errors.length, errors });
  } catch (error) {
    next(error);
  }
}

export async function listCandidateListEntries(_req: Request, res: Response, next: NextFunction) {
  try {
    const entries = await RecruitmentCandidateListEntry.find().sort({ createdAt: -1 }).limit(5000).lean();
    return res.json({ success: true, entries });
  } catch (error) {
    next(error);
  }
}

export async function updateCandidateListEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const entryId = String(req.params.entryId);
    if (!Types.ObjectId.isValid(entryId)) throw new ApiError(400, "Invalid candidate list entry id");
    const entry = await RecruitmentCandidateListEntry.findOneAndUpdate(
      { _id: entryId, archivedAt: null },
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!entry) throw new ApiError(404, "Candidate list entry not found");
    return res.json({ success: true, entry });
  } catch (error) {
    next(error);
  }
}

export async function updateCandidateListEntries(req: Request, res: Response, next: NextFunction) {
  try {
    const { entryIds, field, value } = req.body as {
      entryIds: string[];
      field: keyof typeof candidateListEntryFields.shape;
      value: string;
    };
    const normalizedValue = candidateListEntryFields.shape[field].parse(value);
    const result = await RecruitmentCandidateListEntry.updateMany(
      { _id: { $in: entryIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { [field]: normalizedValue } },
      { runValidators: true },
    );
    if (result.matchedCount !== entryIds.length) {
      throw new ApiError(409, "Some selected candidates are no longer available. Refresh the list and try again");
    }
    const entries = await RecruitmentCandidateListEntry.find({ _id: { $in: entryIds } }).lean();
    return res.json({ success: true, entries, updatedCount: result.modifiedCount });
  } catch (error) {
    next(error);
  }
}

export async function archiveCandidateListEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const entryId = String(req.params.entryId);
    if (!Types.ObjectId.isValid(entryId)) throw new ApiError(400, "Invalid candidate list entry id");
    const archived = req.body.archived as boolean;
    const entry = await RecruitmentCandidateListEntry.findOneAndUpdate(
      { _id: entryId },
      { $set: {
        archivedAt: archived ? new Date() : null,
        archivedBy: archived ? req.authUser!._id : null,
      } },
      { new: true, runValidators: true },
    );
    if (!entry) throw new ApiError(404, "Candidate list entry not found");
    return res.json({ success: true, entry });
  } catch (error) {
    next(error);
  }
}

const candidateListDeletionOtpTtlMinutes = 10;
const candidateListDeletionMaxOtpAttempts = 5;

async function resolveCandidateListDeletionTarget(req: Request) {
  const input = req.body as { deleteAll?: true; entryIds?: string[] };
  const entries = await RecruitmentCandidateListEntry.find(
    input.deleteAll ? {} : { _id: { $in: input.entryIds!.map((id) => new Types.ObjectId(id)) } },
  ).select("_id").lean();
  const entryIds = entries.map((entry) => String(entry._id)).sort();
  if (!input.deleteAll && entryIds.length !== input.entryIds!.length) {
    throw new ApiError(409, "Some selected candidates are no longer available. Refresh the list and try again");
  }
  if (!entryIds.length) throw new ApiError(400, "There are no saved Candidates Lists entries to delete");
  const companyId = String(req.company?._id ?? currentScope()?.companyId ?? req.authUser!.companyId ?? "");
  const contextHash = hashToken(JSON.stringify({
    action: input.deleteAll ? "DELETE_CANDIDATE_SOURCE_LIST" : "DELETE_SELECTED_CANDIDATE_SOURCE_ENTRIES",
    companyId,
    userId: String(req.authUser!._id),
    entryIds,
  }));
  return { entryIds, contextHash, deleteAll: Boolean(input.deleteAll) };
}

export async function requestCandidateListDeletionOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const target = await resolveCandidateListDeletionTarget(req);
    const email = req.authUser!.email;
    const otp = otpGenerator.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
      digits: true,
    });
    await OTP.findOneAndUpdate(
      { email },
      {
        $set: {
          email,
          otpHash: otpStorageValue(otp),
          purpose: OtpPurpose.CANDIDATE_LIST_DELETION,
          subjectId: req.authUser!._id,
          contextHash: target.contextHash,
          attempts: 0,
          expiresAt: new Date(Date.now() + candidateListDeletionOtpTtlMinutes * 60 * 1000),
        },
      },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    try {
      await sendEmail(email, "Confirm Candidates Lists deletion", otp);
    } catch (error) {
      await OTP.deleteOne({
        email,
        purpose: OtpPurpose.CANDIDATE_LIST_DELETION,
        subjectId: req.authUser!._id,
        contextHash: target.contextHash,
      });
      throw error;
    }
    return res.status(201).json({
      success: true,
      email,
      entryCount: target.entryIds.length,
      deleteAll: target.deleteAll,
      message: `A verification code was sent to ${email}. It expires in ${candidateListDeletionOtpTtlMinutes} minutes.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAllCandidateListEntries(req: Request, res: Response, next: NextFunction) {
  try {
    const target = await resolveCandidateListDeletionTarget(req);
    const requested = req.body as { otp: string };
    const otpDoc = await OTP.findOne({
      email: req.authUser!.email,
      purpose: OtpPurpose.CANDIDATE_LIST_DELETION,
      subjectId: req.authUser!._id,
      contextHash: target.contextHash,
    });
    if (!otpDoc || otpDoc.expiresAt <= new Date()) {
      throw new ApiError(400, "Verification code expired or does not match the current Candidates Lists. Request a new code");
    }
    if (otpDoc.attempts >= candidateListDeletionMaxOtpAttempts) {
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
      purpose: OtpPurpose.CANDIDATE_LIST_DELETION,
      subjectId: req.authUser!._id,
      contextHash: target.contextHash,
      otpHash: otpStorageValue(requested.otp),
      attempts: { $lt: candidateListDeletionMaxOtpAttempts },
      expiresAt: { $gt: new Date() },
    });
    if (!consumedOtp) {
      throw new ApiError(400, "Verification code expired or has already been used. Request a new code");
    }
    const deletion = await RecruitmentCandidateListEntry.deleteMany({
      _id: { $in: target.entryIds.map((id) => new Types.ObjectId(id)) },
    });
    if (deletion.deletedCount !== target.entryIds.length) {
      throw new ApiError(409, "Some Candidates Lists entries changed before deletion completed. Refresh the list and request a new code");
    }
    return res.json({
      success: true,
      deletedCount: deletion.deletedCount,
      message: `${target.deleteAll ? "All " : ""}${deletion.deletedCount} saved Candidates Lists entr${deletion.deletedCount === 1 ? "y was" : "ies were"} deleted. Candidate accounts, applications, and pipeline records were not changed.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateOpportunity(req: Request, res: Response, next: NextFunction) {
  try {
    const opportunity = await Opportunity.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!opportunity) throw new ApiError(404, "Opportunity not found");
    return res.json({ success: true, opportunity });
  } catch (error) { next(error); }
}

export async function changeOpportunityStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.body.status as OpportunityStatus;
    const update: Record<string, unknown> = { status };
    if (status === OpportunityStatus.PUBLISHED) update.publishedAt = new Date();
    const opportunity = await Opportunity.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!opportunity) throw new ApiError(404, "Opportunity not found");
    return res.json({ success: true, opportunity });
  } catch (error) { next(error); }
}

export async function applyToOpportunity(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.authUser!;
    if (user.roles.some((role) => [UserRole.CUSTOMER, UserRole.INVESTOR, UserRole.ADMIN].includes(role))) throw new ApiError(403, "Your account is not eligible to apply");
    const opportunity = await runWithCompany(null, () => Opportunity.findOne({ _id: req.params.id, ...publicFilter } as any));
    if (!opportunity) throw new ApiError(404, "Opportunity is not available");
    if (opportunity.applicationDeadline && opportunity.applicationDeadline.getTime() < Date.now()) throw new ApiError(409, "Applications are closed for this opportunity");
    const expectedQuestions = opportunity.screeningQuestions ?? [];
    const screeningAnswers = req.body.screeningAnswers as Array<{ question: string; answer: string }>;
    if (
      screeningAnswers.length !== expectedQuestions.length ||
      expectedQuestions.some(
        (question) =>
          screeningAnswers.filter((answer) => answer.question === question).length !== 1,
      )
    ) {
      throw new ApiError(400, "Answer each screening question for this opportunity");
    }
    const resume = getResumeFile(req);
    const opportunityScope = scopeFor(opportunity.companyId);
    return await runWithCompany(opportunityScope, async () => {
      try {
        const application = await Application.create({ ...req.body, opportunityId: opportunity._id, userId: user._id, ...(resume ? { resumePdf: resume.data, resumeFileName: resume.name, resumeFileSize: resume.size } : {}) });
        return res.status(201).json({ success: true, application: safeApplication(application) });
      } catch (error: unknown) {
        if ((error as { code?: number }).code === 11000) {
          if (resume) {
            const existing = await Application.findOne({ opportunityId: opportunity._id, userId: user._id });
            if (existing) {
              existing.resumePdf = resume.data;
              existing.resumeFileName = resume.name;
              existing.resumeFileSize = resume.size;
              if (typeof req.body.address === "string" && req.body.address.trim()) existing.address = req.body.address.trim();
              await existing.save();
              return res.status(200).json({ success: true, message: "Resume attached to your application", application: safeApplication(existing) });
            }
          }
          throw new ApiError(409, "You have already applied to this opportunity");
        }
        throw error;
      }
    });
  } catch (error) { next(error); }
}

export async function listMyApplications(req: Request, res: Response, next: NextFunction) {
  try { return res.json({ success: true, applications: await runWithCompany(null, () => Application.find({ userId: req.authUser!._id }).select("-resumePdf").populate({ path: "opportunityId", populate: { path: "companyId", select: "name slug" } }).sort({ appliedAt: -1 }).lean()) }); }
  catch (error) { next(error); }
}

function assignmentView(assignment: any) {
  const value = assignment.toObject ? assignment.toObject() : assignment;
  delete value.submissionFile;
  return value;
}

export async function createApplicationAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) throw new ApiError(404, "Application not found");
    if (application.status === ApplicationStatus.DECLINED) {
      throw new ApiError(409, "An assignment cannot be sent to a declined applicant");
    }
    const assignment = await ApplicationAssignment.create({
      applicationId: application._id,
      opportunityId: application.opportunityId,
      applicantId: application.userId,
      title: req.body.title,
      instructions: req.body.instructions,
      deadline: req.body.deadline,
      createdBy: req.authUser!._id,
    });
    return res.status(201).json({ success: true, assignment: assignmentView(assignment) });
  } catch (error) {
    next(error);
  }
}

export async function listApplicationAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await Application.findById(req.params.id).select("_id");
    if (!application) throw new ApiError(404, "Application not found");
    const assignments = await ApplicationAssignment.find({ applicationId: application._id })
      .select("-submissionFile")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, assignments });
  } catch (error) {
    next(error);
  }
}

export async function listMyApplicationAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const assignments = await runWithCompany(null, () =>
      ApplicationAssignment.find({ applicantId: req.authUser!._id })
        .select("-submissionFile")
        .populate({ path: "opportunityId", select: "title type companyId", populate: { path: "companyId", select: "name" } })
        .sort({ deadline: 1, createdAt: -1 })
        .lean(),
    );
    return res.json({ success: true, assignments });
  } catch (error) {
    next(error);
  }
}

export async function submitApplicationAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const fileValue = req.files?.file;
    const file = Array.isArray(fileValue) ? fileValue[0] : fileValue;
    const assignment = await runWithCompany(null, () =>
      ApplicationAssignment.findOne({
        _id: req.params.id,
        applicantId: req.authUser!._id,
      } as any).exec(),
    ) as IApplicationAssignment | null;
    if (!assignment) throw new ApiError(404, "Assignment not found");
    if (assignment.status === ApplicationAssignmentStatus.REVIEWED) {
      throw new ApiError(409, "This assignment has already been reviewed");
    }
    if (assignment.deadline.getTime() < Date.now()) {
      throw new ApiError(409, "The assignment deadline has passed");
    }
    const submissionText = typeof req.body.submissionText === "string"
      ? req.body.submissionText.trim()
      : "";
    if (!submissionText && !file) {
      throw new ApiError(400, "Add a written response or attach a file");
    }
    if (file && file.size > 15 * 1024 * 1024) {
      throw new ApiError(413, "Assignment files must be 15 MB or smaller");
    }
    if (file && !/^(application\/pdf|text\/plain|application\/zip|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|application\/msword|application\/vnd\.ms-excel|application\/vnd\.ms-powerpoint|image\/(jpeg|png|webp))$/i.test(file.mimetype)) {
      throw new ApiError(400, "Upload a PDF, document, spreadsheet, presentation, ZIP, text, or image file");
    }
    assignment.submissionText = submissionText;
    if (file) {
      assignment.submissionFile = file.data;
      assignment.submissionFileName = file.name.slice(0, 180);
      assignment.submissionFileType = file.mimetype.slice(0, 100);
    }
    assignment.status = ApplicationAssignmentStatus.SUBMITTED;
    assignment.submittedAt = new Date();
    await assignment.save();
    return res.json({ success: true, assignment: assignmentView(assignment) });
  } catch (error) {
    next(error);
  }
}

export async function downloadApplicationAssignmentSubmission(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await ApplicationAssignment.findOne({
      _id: req.params.assignmentId,
      applicationId: req.params.id,
    } as any)
      .select("+submissionFile")
      .exec() as IApplicationAssignment | null;
    if (!assignment) throw new ApiError(404, "Assignment not found");
    if (!assignment.submissionFile) throw new ApiError(404, "No file was submitted");
    res.setHeader("Content-Type", assignment.submissionFileType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(assignment.submissionFileName ?? "submission")}`);
    res.setHeader("Content-Length", String(assignment.submissionFile.length));
    return res.send(assignment.submissionFile);
  } catch (error) {
    next(error);
  }
}

export async function downloadMyApplicationAssignmentSubmission(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await runWithCompany(null, () =>
      ApplicationAssignment.findOne({ _id: req.params.id, applicantId: req.authUser!._id } as any)
        .select("+submissionFile")
        .exec(),
    ) as IApplicationAssignment | null;
    if (!assignment) throw new ApiError(404, "Assignment not found");
    if (!assignment.submissionFile) throw new ApiError(404, "No file was submitted");
    res.setHeader("Content-Type", assignment.submissionFileType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(assignment.submissionFileName ?? "submission")}`);
    res.setHeader("Content-Length", String(assignment.submissionFile.length));
    return res.send(assignment.submissionFile);
  } catch (error) {
    next(error);
  }
}

export async function reviewApplicationAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await ApplicationAssignment.findOne({
      _id: req.params.assignmentId,
      applicationId: req.params.id,
    } as any).exec() as IApplicationAssignment | null;
    if (!assignment) throw new ApiError(404, "Assignment not found");
    if (assignment.status !== ApplicationAssignmentStatus.SUBMITTED) {
      throw new ApiError(409, "Only submitted assignments can be reviewed");
    }
    assignment.status = ApplicationAssignmentStatus.REVIEWED;
    assignment.reviewedAt = new Date();
    await assignment.save();
    return res.json({ success: true, assignment: assignmentView(assignment) });
  } catch (error) {
    next(error);
  }
}

export async function listAdminApplicationSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const counts = await Application.aggregate([
      {
        $group: {
          _id: "$opportunityId",
          total: { $sum: 1 },
        },
      },
    ]);
    return res.json({ success: true, counts });
  }
  catch (error) { next(error); }
}

export async function listAdminApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const filter: Record<string, unknown> = {};
    const baseFilter: Record<string, unknown> = {};
    if (typeof req.query.opportunityId === "string") {
      if (!Types.ObjectId.isValid(req.query.opportunityId)) {
        throw new ApiError(400, "Invalid opportunity filter");
      }
      baseFilter.opportunityId = new Types.ObjectId(req.query.opportunityId);
      filter.opportunityId = baseFilter.opportunityId;
    }
    if (typeof req.query.status === "string") {
      const statuses = Object.values(ApplicationStatus) as string[];
      if (!statuses.includes(req.query.status)) {
        throw new ApiError(400, "Invalid application status filter");
      }
      filter.status = req.query.status;
    }

    const escapeSearch = (value: string) =>
      value.trim().slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const applicantSearch =
      typeof req.query.search === "string" ? escapeSearch(req.query.search) : "";
    const skillsSearch =
      typeof req.query.skills === "string" ? escapeSearch(req.query.skills) : "";
    const candidateConditions: Record<string, unknown>[] = [];
    if (applicantSearch) {
      candidateConditions.push({
        $or: [
          { name: new RegExp(applicantSearch, "i") },
          { email: new RegExp(applicantSearch, "i") },
        ],
      });
    }
    if (skillsSearch) candidateConditions.push({ about: new RegExp(skillsSearch, "i") });
    if (candidateConditions.length) {
      const candidates = await User.find(
        candidateConditions.length === 1
          ? candidateConditions[0]
          : { $and: candidateConditions },
      ).select("_id").lean();
      filter.userId = { $in: candidates.map((candidate) => candidate._id) };
    }
    if (typeof req.query.location === "string" && req.query.location.trim()) {
      filter.address = new RegExp(escapeSearch(req.query.location), "i");
    }

    const pageParam = typeof req.query.page === "string" ? Number(req.query.page) : 1;
    const requestedPage = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limitParam = typeof req.query.limit === "string" ? Number(req.query.limit) : 10;
    const limit = Number.isSafeInteger(limitParam)
      ? Math.min(50, Math.max(1, limitParam))
      : 10;
    const [total, statusCounts] = await Promise.all([
      Application.countDocuments(filter),
      Application.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);
    const totalPages = Math.ceil(total / limit);
    const page = Math.min(requestedPage, Math.max(1, totalPages));
    const applications = await Application.find(filter)
      .select("-resumePdf")
      .populate("userId", "name email roles profile_pic about phoneNumber status emailVerifiedAt createdAt")
      .populate("opportunityId")
      .sort({ appliedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const offers = await OfferLetter.find({
      applicationId: { $in: applications.map((application) => application._id) },
    }).select("applicationId status sentAt createdAt").sort({ createdAt: -1 }).lean();
    const latestOfferByApplication = new Map<string, typeof offers[number]>();
    for (const offer of offers) {
      const key = String(offer.applicationId);
      if (!latestOfferByApplication.has(key)) latestOfferByApplication.set(key, offer);
    }
    return res.json({
      success: true,
      applications: applications.map((application) => {
        const offer = latestOfferByApplication.get(String(application._id));
        return { ...application, offerStatus: offer?.status ?? null, offerSentAt: offer?.sentAt ?? null };
      }),
      pagination: { page, limit, total, totalPages },
      statusCounts: Object.fromEntries(statusCounts.map((entry) => [entry._id, entry.count])),
    });
  } catch (error) { next(error); }
}

async function reviewApplication(req: Request, res: Response, next: NextFunction, status: ApplicationStatus) {
  try {
    const application = await Application.findOneAndUpdate({ _id: req.params.id } as any, { status, reviewedAt: new Date(), reviewedBy: req.authUser!._id, ...(status === ApplicationStatus.ACCEPTED ? { acceptedAt: new Date() } : { declineReason: req.body.reason ?? null }) }, { new: true }).populate("opportunityId");
    if (!application) throw new ApiError(404, "Application not found");
    return res.json({ success: true, application });
  } catch (error) { next(error); }
}
export const acceptApplication = (req: Request, res: Response, next: NextFunction) => reviewApplication(req, res, next, ApplicationStatus.ACCEPTED);
export const declineApplication = (req: Request, res: Response, next: NextFunction) => reviewApplication(req, res, next, ApplicationStatus.DECLINED);

export async function shortlistApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await Application.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: [ApplicationStatus.APPLIED, ApplicationStatus.UNDER_REVIEW] },
      } as any,
      {
        status: ApplicationStatus.UNDER_REVIEW,
        reviewedAt: new Date(),
        reviewedBy: req.authUser!._id,
      },
      { new: true },
    ).populate("opportunityId");
    if (!application) {
      const exists = await Application.exists({ _id: req.params.id } as any);
      if (!exists) throw new ApiError(404, "Application not found");
      throw new ApiError(409, "Only received applications can be shortlisted");
    }
    return res.json({ success: true, application });
  } catch (error) { next(error); }
}

export async function downloadResume(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await Application.findById(req.params.id).select("+resumePdf resumeFileName");
    if (!application?.resumePdf) throw new ApiError(404, "Resume not found");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${(application.resumeFileName ?? "resume.pdf").replace(/[^a-zA-Z0-9._-]/g, "_")}"`);
    return res.send(application.resumePdf);
  } catch (error) { next(error); }
}

export async function grantRole(req: Request, res: Response, next: NextFunction, targetType: OpportunityType) {
  try {
    const endDate = new Date(req.body.endDate as string);
    const application = await Application.findById(req.params.id).populate<{ opportunityId: { type: OpportunityType; role: string } }>("opportunityId");
    if (!application || !application.opportunityId) throw new ApiError(404, "Application not found");
    if (application.status !== ApplicationStatus.ACCEPTED) throw new ApiError(409, "Application must be accepted first");
    const targetRole = targetType === OpportunityType.INTERNSHIP ? UserRole.INTERN : UserRole.EMPLOYEE;
    if (application.opportunityId.type !== targetType) throw new ApiError(409, "Role does not match opportunity type");
    const user = await User.findByIdAndUpdate(application.userId, { $addToSet: { roles: targetRole } }, { new: true });
    if (!user) throw new ApiError(404, "Applicant not found");
    const roleTitle = application.opportunityId.role ?? null;
    if (targetRole === UserRole.INTERN) {
      const profile = await InternProfile.findOneAndUpdate({ userId: user._id }, { $set: { endDate } }, { upsert: true, new: true, setDefaultsOnInsert: true });
      if (!profile.initialRole && roleTitle) { profile.initialRole = roleTitle; profile.currentRole = roleTitle; await profile.save(); }
    } else {
      const profile = await EmployeeProfile.findOneAndUpdate({ userId: user._id }, { $set: { endDate } }, { upsert: true, new: true, setDefaultsOnInsert: true });
      if (!profile.initialRole && roleTitle) { profile.initialRole = roleTitle; profile.currentRole = roleTitle; await profile.save(); }
    }
    application.roleGrantedAt ??= new Date(); application.roleGrantedBy ??= req.authUser!._id; await application.save();
    return res.json({ success: true, message: `${targetRole} role granted until ${endDate.toISOString().slice(0, 10)}`, application, roles: user.roles, endDate });
  } catch (error) { next(error); }
}

export async function onboardTeamMember(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as {
      department?: OrganizationDepartment;
      reportsTo?: string;
      accountType: "intern" | "employee";
      name: string;
      email: string;
      temporaryPassword: string;
      phoneNumber: string;
      designation: string;
      joiningDate: Date;
      endDate?: Date | null;
      employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | null;
      linkedInUrl?: string;
      address: string;
    };
    const { department, supervisor } = await resolveTeamOnboardingScope(req.authUser!._id, requestRoles(req), input.department, input.reportsTo);
    const targetRole = input.accountType === "intern" ? UserRole.INTERN : UserRole.EMPLOYEE;
    let user = await User.findOne({ email: input.email });
    let accountCreated = false;
    if (user) {
      const assignableRoles = [UserRole.USER, UserRole.INTERN, UserRole.EMPLOYEE];
      if (
        !user.roles.some((role) => assignableRoles.includes(role as UserRole)) ||
        user.roles.some((role) => !assignableRoles.includes(role as UserRole))
      ) {
        throw new ApiError(
          409,
          "Only accounts with User, Intern, or Employee roles can be added as team members",
        );
      }
      const existingAssignment = await OrganizationAssignment.findOne({
        userId: user._id,
        active: true,
      }).lean();
      if (
        existingAssignment &&
        (existingAssignment.level !== OrganizationLevel.MEMBER ||
          String(existingAssignment.reportsTo) !== String(supervisor))
      ) {
        throw new ApiError(409, "This account already belongs to another reporting line");
      }
    }

    if (!user) {
      if (await runWithCompany(null, () => User.exists({ email: input.email }))) {
        throw new ApiError(409, "This email is already registered with another company");
      }
      user = await User.create({
        name: input.name,
        email: input.email,
        phoneNumber: input.phoneNumber,
        password: await bcrypt.hash(input.temporaryPassword, 10),
        profile_pic: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(input.name)}`,
        roles: [targetRole],
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        emailVerified: true,
        about: `${input.designation} · ${department}`,
      });
      accountCreated = true;
    } else {
      if (user.status !== UserStatus.ACTIVE) throw new ApiError(409, "The existing account is not active");
      user.roles = [targetRole];
      user.name = input.name;
      user.phoneNumber = input.phoneNumber;
      await user.save();
    }

    const commonProfileData = {
      isVerified: true,
      joiningDate: input.joiningDate,
      endDate: input.endDate ?? null,
      department,
      managerId: supervisor,
      address: input.address,
      initialRole: input.designation,
      currentRole: input.designation,
    };
    if (targetRole === UserRole.INTERN) {
      await InternProfile.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            ...commonProfileData,
            linkedInUrl: input.linkedInUrl || null,
            verificationStatus: VerificationStatus.VERIFIED,
            verifiedAt: new Date(),
            verifiedBy: req.authUser!._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } else {
      await EmployeeProfile.findOneAndUpdate(
        { userId: user._id },
        { $set: { ...commonProfileData, employmentType: input.employmentType } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    const assignment = await OrganizationAssignment.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          level: OrganizationLevel.MEMBER,
          department,
          reportsTo: supervisor,
          assignedBy: req.authUser!._id,
          active: true,
          effectiveTo: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (accountCreated) {
      await sendWelcomeEmail(user.email, user.name).catch((error) => {
        console.error("Welcome email delivery failed after team onboarding", error);
      });
    }
    return res.status(accountCreated ? 201 : 200).json({
      success: true,
      accountCreated,
      user: { _id: user._id, name: user.name, email: user.email, roles: user.roles },
      assignment,
    });
  } catch (error) { next(error); }
}

export async function resolveTeamOnboardingScope(actorId: Types.ObjectId, roles: readonly string[], requestedDepartment?: string, requestedReportsTo?: string) {
  const executive = roles.includes(UserRole.CEO) || roles.includes(UserRole.ADMIN);
  const assignment = await OrganizationAssignment.findOne({ userId: actorId, active: true }).select("level department").lean();
  const hasDepartmentLeadershipRole = roles.some((role) => role === UserRole.HEAD || role === UserRole.MANAGER || role.endsWith("_HEAD") || role.endsWith("_MANAGER"));
  const companyHr = await isSystemHrStructureAdmin(actorId) || (roles.includes(UserRole.HR) && !hasDepartmentLeadershipRole && await isHrStructureAdmin(actorId, roles));
  if (executive || companyHr) {
    if (!requestedDepartment || !Object.values(OrganizationDepartment).includes(requestedDepartment as OrganizationDepartment)) throw new ApiError(400, "Select a valid department");
    if (!requestedReportsTo || !Types.ObjectId.isValid(requestedReportsTo)) throw new ApiError(400, "Select an active department Manager");
    const manager = await OrganizationAssignment.findOne({ userId: requestedReportsTo, level: OrganizationLevel.MANAGER, department: requestedDepartment, active: true } as any).populate({ path: "userId", match: { status: UserStatus.ACTIVE }, select: "_id" });
    if (!manager?.userId) throw new ApiError(400, "The selected Manager must be active in this department");
    return { department: requestedDepartment as OrganizationDepartment, supervisor: manager.userId._id as Types.ObjectId };
  }
  if (!assignment) throw new ApiError(403, "This action is currently unavailable.");
  if (assignment.level === OrganizationLevel.MANAGER) {
    if (requestedDepartment && requestedDepartment !== assignment.department) throw new ApiError(403, "Managers can only add members to their own department");
    if (requestedReportsTo && requestedReportsTo !== String(actorId)) throw new ApiError(403, "Members added by a Manager must report to that Manager");
    return { department: assignment.department, supervisor: actorId };
  }
  if (assignment.level === OrganizationLevel.HEAD && assignment.department === OrganizationDepartment.HR && roles.some((role) => role === UserRole.HR_HEAD || role === UserRole.HEAD)) {
    if (requestedDepartment && requestedDepartment !== OrganizationDepartment.HR) throw new ApiError(403, "HR Heads can only add members to HR");
    if (!requestedReportsTo || !Types.ObjectId.isValid(requestedReportsTo)) throw new ApiError(400, "Select an active HR Manager");
    const manager = await OrganizationAssignment.findOne({ userId: requestedReportsTo, level: OrganizationLevel.MANAGER, department: OrganizationDepartment.HR, active: true } as any).populate({ path: "userId", match: { status: UserStatus.ACTIVE }, select: "_id" });
    if (!manager?.userId) throw new ApiError(400, "The selected Manager must be active in HR");
    return { department: OrganizationDepartment.HR, supervisor: manager.userId._id as Types.ObjectId };
  }
  throw new ApiError(403, "Only an active Manager, HR Head, CEO, or Admin can add team members");
}

export async function generateOfferForApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const applicationId = req.params.id ?? req.body?.applicationId;
    const application = await Application.findById(applicationId).populate("opportunityId").populate("userId");
    if (!application) throw new ApiError(404, "Application not found");
    const pipeline = await RecruitmentPipeline.findOne({ applicationId: application._id }).exec();
    if (pipeline && pipeline.stage !== RecruitmentPipelineStage.OFFER) {
      throw new ApiError(409, "Move the candidate through the recruitment pipeline and obtain hiring-manager approval before generating an offer");
    }
    const selected = pipeline?.finalSelection;
    if (pipeline && (
      !selected ||
      (!pipeline.importedDirectlyToOffer && !selected.hiringManagerApproved) ||
      !selected.selectedRole ||
      !selected.department ||
      selected.compensationAmount == null ||
      !String(selected.compensationAmount).trim() ||
      !selected.compensationFrequency ||
      !selected.joiningDate ||
      !selected.employmentEndDate ||
      !selected.probationPeriod?.trim() ||
      !selected.workingHours?.trim() ||
      !selected.acceptanceDeadline ||
      selected.acceptanceDeadline <= new Date() ||
      (selected.selectedRole === "EMPLOYEE" && (
        selected.annualCtc == null ||
        !String(selected.annualCtc).trim() ||
        selected.monthlyGrossSalary == null ||
        !String(selected.monthlyGrossSalary).trim() ||
        !selected.salaryStructureReference?.trim()
      ))
    )) throw new ApiError(409, "Complete and approve the pipeline final-selection details first");
    const joiningDate = selected?.joiningDate ?? req.body?.employmentTerms?.joiningDate ?? req.body?.joiningDate ?? null;
    const endDate = selected?.employmentEndDate ?? req.body?.endDate ?? req.body?.employmentTerms?.endDate;
    const sendingTerms = offerSendingTerms(endDate, new Date(), joiningDate);
    const opportunity = application.opportunityId as unknown as {
      type: OpportunityType;
      role?: string;
      workMode?: string;
      location?: string;
      employmentType?: string;
    };
    const [manager, managerEmployeeProfile, managerInternProfile] = selected && pipeline?.hiringManagerId
      ? await Promise.all([
        User.findById(pipeline.hiringManagerId).select("name").lean(),
        EmployeeProfile.findOne({ userId: pipeline.hiringManagerId }).select("currentRole").lean(),
        InternProfile.findOne({ userId: pipeline.hiringManagerId }).select("currentRole").lean(),
      ])
      : [null, null, null];
    const targetRole = selected?.selectedRole ?? null;
    const compensation = selected
      ? {
        salary: targetRole === "EMPLOYEE" ? `${selected.currency} ${selected.compensationAmount}/${selected.compensationFrequency}` : undefined,
        stipend: targetRole === "INTERN" ? `${selected.currency} ${selected.compensationAmount}/${selected.compensationFrequency}` : undefined,
        currency: selected.currency,
        paymentCycle: selected.compensationFrequency === "ANNUAL" ? "Annual" : "Monthly",
        annualCtc: selected.annualCtc,
        monthlyGrossSalary: selected.monthlyGrossSalary,
        salaryStructureReference: selected.salaryStructureReference,
        benefits: selected.benefits,
      }
      : req.body?.compensation;
    const offer = await createOfferDocument(application, req.authUser!._id, {
      type: selected ? selected.selectedRole === "INTERN" ? OfferType.INTERN : OfferType.EMPLOYEE : req.body?.type,
      offerDate: req.body?.offerDate ? new Date(req.body.offerDate) : new Date(),
      joiningDate: sendingTerms.joiningDate,
      compensation,
      employmentTerms: {
        ...req.body?.employmentTerms,
        ...sendingTerms,
        probationPeriod: selected?.probationPeriod ?? req.body?.employmentTerms?.probationPeriod,
        workingHours: selected?.workingHours ?? req.body?.employmentTerms?.workingHours,
        employmentType: selected
          ? targetRole === "INTERN" ? "Internship" : opportunity.employmentType === "PART_TIME" ? "Part-time" : "Full-time"
          : req.body?.employmentTerms?.employmentType,
      },
      position: selected
        ? {
          designation: opportunity.role ?? (targetRole === "INTERN" ? "Intern" : "Employee"),
          department: selected.department,
          workMode: opportunity.workMode,
          location: opportunity.location,
          reportingManager: manager?.name ?? null,
          reportingManagerDesignation: managerEmployeeProfile?.currentRole ?? managerInternProfile?.currentRole ?? null,
        }
        : req.body?.position,
      deadline: selected?.acceptanceDeadline ?? (req.body?.acceptanceDeadline ? new Date(req.body.acceptanceDeadline) : null),
    });
    const generated = await markOfferGenerated(offer, req.authUser!._id);
    const shouldSendEmail = req.body?.send === true || req.body?.sendEmail === true;
    const finalOffer = shouldSendEmail
      ? await sendOfferByEmail(generated, req.authUser!._id, selected?.joiningDate, req.get("Idempotency-Key"))
      : generated;
    return res.status(201).json({ success: true, offer: safeOffer(finalOffer), sent: shouldSendEmail });
  } catch (error) { next(error); }
}

export async function getOfferLetterProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.company?._id) throw new ApiError(400, "Select an active company first");
    const company = await Company.findById(req.company._id).select("name offerLetterProfile").lean();
    if (!company) throw new ApiError(404, "Active company not found");
    return res.json({
      success: true,
      profile: company.offerLetterProfile ?? {
        legalName: company.name,
        displayName: company.name,
        address: "",
        contactPhone: "",
        contactEmail: "",
        logoDataUrl: "",
        hrContactName: "",
        hrContactEmail: "",
        signatoryName: "",
        signatoryDesignation: "",
        signatureDataUrl: "",
      },
    });
  } catch (error) { next(error); }
}

export async function saveOfferLetterProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.company?._id) throw new ApiError(400, "Select an active company first");
    const company = await Company.findByIdAndUpdate(
      req.company._id,
      { $set: { offerLetterProfile: req.body } },
      { new: true, runValidators: true },
    ).select("name offerLetterProfile").lean();
    if (!company) throw new ApiError(404, "Active company not found");
    return res.json({ success: true, profile: company.offerLetterProfile });
  } catch (error) { next(error); }
}

export async function getOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const offer = await OfferLetter.findById(req.params.id)
      .populate("candidateId", "name email roles phoneNumber")
      .populate("applicationId", "status opportunityId");
    if (!offer) throw new ApiError(404, "Offer not found");
    if (req.authUser && !requestRoles(req).includes(UserRole.ADMIN) && String(offer.candidateId) !== String(req.authUser._id)) {
      throw new ApiError(403, "You are not allowed to access this offer");
    }
    return res.json({ success: true, offer });
  } catch (error) { next(error); }
}

export async function listMyOffers(req: Request, res: Response, next: NextFunction) {
  try {
    const filter = req.authUser?.roles.includes(UserRole.ADMIN)
      ? { applicationId: req.params.id ? req.params.id : { $exists: true } }
      : { candidateId: req.authUser!._id };
    const offers = await OfferLetter.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, offers });
  } catch (error) { next(error); }
}

export async function previewOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const offer = await OfferLetter.findById(req.params.id).select("+pdfBuffer");
    if (!offer) throw new ApiError(404, "Offer not found");
    if (req.authUser && !requestRoles(req).includes(UserRole.ADMIN) && String(offer.candidateId) !== String(req.authUser._id)) {
      throw new ApiError(403, "This offer does not belong to you");
    }
    if (!offer.pdfBuffer) {
      const pdf = await markOfferGenerated(offer, req.authUser?._id ?? offer.generatedBy ?? offer.sentBy ?? offer.candidateId);
      if (!pdf.pdfBuffer) throw new ApiError(500, "Unable to generate PDF preview");
    }
    if (
      req.authUser
      && String(offer.candidateId) === String(req.authUser._id)
      && offer.status === OfferLetterStatus.SENT
    ) {
      offer.status = OfferLetterStatus.VIEWED;
      offer.viewedAt = new Date();
      await offer.save();
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${offer.pdf?.fileName ?? `${offer.offerLetterNumber}.pdf`}"`);
    return res.send(offer.pdfBuffer!);
  } catch (error) { next(error); }
}

export async function sendOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const offer = await OfferLetter.findById(req.params.id).select("+pdfBuffer");
    if (!offer) throw new ApiError(404, "Offer not found");
    if (!req.body?.confirm) throw new ApiError(400, "Confirmation is required before sending");
    const pipeline = await RecruitmentPipeline.findOne({
      applicationId: offer.applicationId,
      stage: RecruitmentPipelineStage.OFFER,
    }).select("finalSelection.joiningDate").lean();
    const sent = await sendOfferByEmail(
      offer,
      req.authUser!._id,
      pipeline?.finalSelection?.joiningDate ?? null,
      req.get("Idempotency-Key"),
    );
    return res.json({ success: true, offer: safeOffer(sent) });
  } catch (error) { next(error); }
}

export async function acceptCandidateOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const offer = await OfferLetter.findById(req.params.id);
    if (!offer) throw new ApiError(404, "Offer not found");
    const accepted = await acceptOfferByCandidate(offer, req.authUser!._id);
    return res.json({ success: true, offer: accepted });
  } catch (error) { next(error); }
}

export async function declineCandidateOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const offer = await OfferLetter.findById(req.params.id);
    if (!offer) throw new ApiError(404, "Offer not found");
    const declined = await declineOfferByCandidate(offer, req.authUser!._id);
    return res.json({ success: true, offer: declined });
  } catch (error) { next(error); }
}