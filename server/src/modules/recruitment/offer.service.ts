import type { Types } from "mongoose";
import { renderOfferEmail } from "./offer.presentation.js";
import { renderTemplateOfferPdf } from "./offer.template.js";
import { offerEmailLinks } from "./offer.link.js";
import {
  ApplicationStatus,
  Company,
  EmployeeProfile,
  InternProfile,
  Opportunity,
  User,
} from "../../models/index.js";
import {
  OfferLetter,
  OfferType,
  OfferLetterStatus,
  type IOfferLetter,
} from "../../models/offerLetter.models.js";
import { UserRole } from "../auth/authorization.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { sendEmail } from "../../utils/email.utils.js";
import { currentScope } from "../company/company.context.js";
import { beginDocumentEmailDelivery, markDocumentEmailFailed, markDocumentEmailSent } from "../documents/document-email.service.js";
import { renderOfferEmailText } from "./offer.presentation.js";
import { OFFER_PDF_TEMPLATE_VERSION } from "./offer.template.js";

export type OfferBuildInput = {
  offerDate?: Date;
  joiningDate?: Date | null;
  deadline?: Date | null;
  compensation?: {
    salary?: string;
    stipend?: string;
    currency?: string;
    paymentCycle?: string;
    benefits?: string;
    annualCtc?: string | number | null;
    monthlyGrossSalary?: string | number | null;
    salaryStructureReference?: string | null;
  };
  employmentTerms?: {
    joiningDate?: Date | null;
    endDate?: Date | null;
    internshipDuration?: string;
    probationPeriod?: string;
    workingHours?: string;
    employmentType?: string;
  };
  position?: {
    designation?: string;
    department?: string;
    workMode?: string;
    location?: string;
    reportingManager?: string;
    reportingManagerDesignation?: string;
  };
};

type CompanyOfferSnapshot = NonNullable<IOfferLetter["companySnapshot"]>;

async function activeCompanyOfferSnapshot(): Promise<CompanyOfferSnapshot> {
  const scope = currentScope();
  if (!scope) throw new ApiError(400, "An active company is required to generate an offer");
  const company = await Company.findById(scope.companyId).select("name offerLetterProfile").lean();
  const profile = company?.offerLetterProfile;
  if (!company || !profile) {
    throw new ApiError(409, "Complete the active company offer-letter profile before generating an offer");
  }
  const required = [
    profile.legalName,
    profile.displayName,
    profile.address,
    profile.contactEmail,
    profile.hrContactName,
    profile.hrContactEmail,
    profile.signatoryName,
    profile.signatoryDesignation,
  ];
  if (required.some((value) => !value?.trim())) {
    throw new ApiError(409, "Complete all required company, HR contact, and signatory details in the offer-letter profile");
  }
  return {
    legalName: profile.legalName,
    displayName: profile.displayName,
    address: profile.address,
    contactPhone: profile.contactPhone ?? "",
    contactEmail: profile.contactEmail,
    logoDataUrl: profile.logoDataUrl ?? "",
    hrContactName: profile.hrContactName,
    hrContactEmail: profile.hrContactEmail,
    signatoryName: profile.signatoryName,
    signatoryDesignation: profile.signatoryDesignation,
    signatureDataUrl: profile.signatureDataUrl ?? "",
  };
}

export function offerSendingTerms(
  endDate: Date | string | null | undefined,
  sentAt = new Date(),
  joiningDate?: Date | string | null,
) {
  if (!(endDate instanceof Date) && (typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endDate))) throw new ApiError(400, "Select a valid offer end date");
  const joiningAt = joiningDate == null
    ? sentAt
    : joiningDate instanceof Date ? joiningDate : new Date(joiningDate);
  if (!Number.isFinite(joiningAt.getTime())) throw new ApiError(400, "Select a valid offer joining date");
  const startDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(joiningAt);
  const end = endDate instanceof Date ? endDate : new Date(endDate ?? "");
  if (!Number.isFinite(end.getTime())) throw new ApiError(400, "Select a valid offer end date");
  const endDay = end.toISOString().slice(0, 10);
  if (typeof endDate === "string" && endDate !== endDay) throw new ApiError(400, "Select a valid offer end date");
  if (endDay <= startDay) throw new ApiError(400, "Offer end date must be after the joining date");
  const durationDays = Math.round((Date.parse(endDay) - Date.parse(startDay)) / 86400000) + 1;
  return { joiningDate: joiningAt, endDate: new Date(`${endDay}T00:00:00.000Z`), internshipDuration: `${durationDays} days` };
}

export function mergeRoles(
  existingRoles: string[] = [],
  targetRole: UserRole,
): UserRole[] {
  return Array.from(
    new Set([...(existingRoles ?? []), targetRole]),
  ) as UserRole[];
}

export async function buildOfferData(
  application: any,
  targetRole: UserRole,
  offerType: OfferType,
  overrides: OfferBuildInput = {},
) {
  const user =
    application.userId ?? (await User.findById(application.userId).lean());
  const opportunity =
    application.opportunityId ??
    (await Opportunity.findById(application.opportunityId).lean());
  if (!user || !opportunity)
    throw new ApiError(404, "Application data is incomplete");

  // Prefer an approved offer override and the opportunity's official title over self-editable profile data.
  const roleProfile = overrides.position?.designation || opportunity.role
    ? null
    : targetRole === UserRole.INTERN
      ? await InternProfile.findOne({ userId: user._id }).select("currentRole").lean()
      : await EmployeeProfile.findOne({ userId: user._id }).select("currentRole").lean();
  const computedDesignation =
    overrides.position?.designation ??
    opportunity.role ??
    roleProfile?.currentRole ??
    (offerType === OfferType.INTERN ? "Intern" : "Employee");
  return {
    offerType,
    roles: mergeRoles(Array.isArray(user.roles) ? user.roles : [], targetRole),
    candidateSnapshot: {
      fullName: user.name,
      email: user.email,
      phone: user.phoneNumber ?? null,
      address:
        application.address ??
        user.address ??
        null,
    },
    position: {
      designation: computedDesignation,
      department:
        overrides.position?.department ?? opportunity.category ?? null,
      workMode: overrides.position?.workMode ?? opportunity.workMode ?? null,
      location: overrides.position?.location ?? opportunity.location ?? null,
      reportingManager: overrides.position?.reportingManager ?? null,
      reportingManagerDesignation: overrides.position?.reportingManagerDesignation ?? null,
    },
    employmentTerms: {
      joiningDate:
        overrides.employmentTerms?.joiningDate ?? overrides.joiningDate ?? null,
      endDate: overrides.employmentTerms?.endDate ?? null,
      internshipDuration: overrides.employmentTerms?.internshipDuration ?? null,
      probationPeriod: overrides.employmentTerms?.probationPeriod ?? null,
      workingHours: overrides.employmentTerms?.workingHours ?? null,
      employmentType:
        overrides.employmentTerms?.employmentType ??
        (opportunity.type === "JOB" ? "Full-time" : "Internship"),
    },
    compensation: {
      salary: overrides.compensation?.salary ?? opportunity.salary ?? null,
      stipend: overrides.compensation?.stipend ?? null,
      currency: overrides.compensation?.currency ?? null,
      paymentCycle: overrides.compensation?.paymentCycle ?? "Monthly",
      benefits: overrides.compensation?.benefits ?? null,
      annualCtc: overrides.compensation?.annualCtc ?? null,
      monthlyGrossSalary: overrides.compensation?.monthlyGrossSalary ?? null,
      salaryStructureReference: overrides.compensation?.salaryStructureReference ?? null,
    },
    offerDate: overrides.offerDate ?? new Date(),
    acceptanceDeadline: overrides.deadline ?? null,
  };
}

export function generateOfferNumber(
  type: OfferType,
  year = new Date().getFullYear(),
) {
  const prefix = type === OfferType.INTERN ? "RICOZ-INT" : "RICOZ-EMP";
  return `${prefix}-${year}-${String(Date.now() % 1000000).padStart(4, "0")}`;
}

export async function ensureRoleGrant(
  application: any,
  targetRole: UserRole,
  actorId: Types.ObjectId,
) {
  const user = await User.findById(application.userId);
  if (!user) throw new ApiError(404, "Applicant not found");
  if (!user.roles.includes(targetRole)) {
    user.roles = mergeRoles(user.roles, targetRole) as UserRole[];
    await user.save();
  }
  const roleTitle = application.opportunityId?.role ?? null;
  if (targetRole === UserRole.INTERN) {
    const profile = await InternProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          isVerified: true,
          verificationStatus: "VERIFIED",
          verifiedAt: new Date(),
          verifiedBy: actorId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (!profile.initialRole && roleTitle) { profile.initialRole = roleTitle; profile.currentRole = roleTitle; await profile.save(); }
  } else {
    const profile = await EmployeeProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: { isVerified: true, verifiedAt: new Date(), verifiedBy: actorId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (!profile.initialRole && roleTitle) { profile.initialRole = roleTitle; profile.currentRole = roleTitle; await profile.save(); }
  }
  application.roleGrantedAt ??= new Date();
  application.roleGrantedBy ??= actorId;
  await application.save();
}

export async function getActiveOfferForApplication(
  applicationId: string | Types.ObjectId,
) {
  return OfferLetter.findOne({
    applicationId,
    status: {
      $in: [
        OfferLetterStatus.GENERATED,
        OfferLetterStatus.SENT,
        OfferLetterStatus.ACCEPTED,
        OfferLetterStatus.DECLINED,
        OfferLetterStatus.EXPIRED,
      ],
    },
  }).sort({ createdAt: -1 });
}

export async function createOfferDocument(
  application: any,
  adminUserId: Types.ObjectId,
  input: OfferBuildInput & { type?: OfferType } = {},
) {
  if (!application || application.status !== ApplicationStatus.ACCEPTED)
    throw new ApiError(
      409,
      "Application must be accepted before generating an offer",
    );
  const targetRole =
    application.opportunityId?.type === "JOB"
      ? UserRole.EMPLOYEE
      : UserRole.INTERN;
  const offerType =
    input.type ??
    (targetRole === UserRole.EMPLOYEE ? OfferType.EMPLOYEE : OfferType.INTERN);
  if (
    application.opportunityId?.type === "JOB" &&
    offerType !== OfferType.EMPLOYEE
  )
    throw new ApiError(409, "Offer type must match the opportunity type");
  if (
    application.opportunityId?.type === "INTERNSHIP" &&
    offerType !== OfferType.INTERN
  )
    throw new ApiError(409, "Offer type must match the opportunity type");

  const previousOffer = await getActiveOfferForApplication(application._id);

  const data = await buildOfferData(application, targetRole, offerType, input);
  if (!data.candidateSnapshot.fullName?.trim() || !data.candidateSnapshot.address?.trim()) {
    throw new ApiError(409, "Add the candidate's full name and address before generating the offer");
  }
  if (
    !data.position.designation?.trim()
    || !data.position.department?.trim()
    || !data.employmentTerms.joiningDate
    || !data.employmentTerms.endDate
    || !data.employmentTerms.workingHours?.trim()
    || !data.employmentTerms.probationPeriod?.trim()
    || !data.acceptanceDeadline
    || data.acceptanceDeadline <= new Date()
  ) {
    throw new ApiError(409, "Complete the approved position, employment terms, and future acceptance deadline before generating the offer");
  }
  if (
    offerType === OfferType.EMPLOYEE
    && (
      data.compensation.annualCtc == null
        || !String(data.compensation.annualCtc).trim()
        || data.compensation.monthlyGrossSalary == null
        || !String(data.compensation.monthlyGrossSalary).trim()
      || !data.compensation.salaryStructureReference?.trim()
    )
  ) {
    throw new ApiError(409, "Enter the approved annual CTC, monthly gross salary, and salary structure reference");
  }
  const companySnapshot = await activeCompanyOfferSnapshot();
  const offerNumber = generateOfferNumber(offerType);
  const document = await OfferLetter.create({
    // Store a plain ObjectId reference, not the populated user document, so no user fields leak onto the offer.
    candidateId: application.userId?._id ?? application.userId,
    applicationId: application._id,
    type: offerType,
    offerLetterNumber: offerNumber,
    status: OfferLetterStatus.DRAFT,
    version: previousOffer ? (previousOffer.version ?? 1) + 1 : 1,
    previousOfferId: previousOffer?._id ?? null,
    candidateSnapshot: data.candidateSnapshot,
    position: data.position,
    employmentTerms: data.employmentTerms,
    compensation: data.compensation,
    companySnapshot,
    offerDate: data.offerDate,
    acceptanceDeadline: data.acceptanceDeadline,
    generatedBy: adminUserId,
  });
  return document;
}

export async function generatePdfBufferFromOffer(offer: any) {
  return renderTemplateOfferPdf(offer);
}

export async function ensureOfferPdf(offer: any, force = false) {
  if (!offer.companySnapshot) offer.companySnapshot = await activeCompanyOfferSnapshot();
  if (
    force
    || !Buffer.isBuffer(offer.pdfBuffer)
    || offer.pdf?.templateVersion !== OFFER_PDF_TEMPLATE_VERSION
  ) {
    const pdfBuffer = await generatePdfBufferFromOffer(offer);
    offer.pdfBuffer = pdfBuffer;
    offer.pdf = {
      ...offer.pdf,
      fileName: `${offer.offerLetterNumber}.pdf`,
      storageKey: `offers/${offer.offerLetterNumber}.pdf`,
      generatedAt: new Date(),
      templateVersion: OFFER_PDF_TEMPLATE_VERSION,
    };
  }
  return offer;
}

export async function markOfferGenerated(
  offer: any,
  adminUserId: Types.ObjectId,
) {
  await ensureOfferPdf(offer);
  offer.status = OfferLetterStatus.GENERATED;
  offer.generatedBy = adminUserId;
  await offer.save();
  return offer;
}

export async function markOfferSentAfterDelivery<T extends {
  sentAt?: Date | null;
  sentBy?: Types.ObjectId | null;
  status: OfferLetterStatus;
  save: () => Promise<unknown>;
}>(
  offer: T,
  senderUserId: Types.ObjectId,
  sentAt = new Date(),
): Promise<T> {
  if (!offer.sentAt) {
    offer.sentAt = sentAt;
    offer.sentBy = senderUserId;
  }
  if (offer.status === OfferLetterStatus.GENERATED) {
    offer.status = OfferLetterStatus.SENT;
  }
  await offer.save();
  return offer;
}

export async function sendOfferByEmail(
  offer: any,
  senderUserId: Types.ObjectId,
  plannedJoiningDate?: Date | null,
  idempotencyKey?: string,
) {
  if (!idempotencyKey || !/^[a-zA-Z0-9._:-]{16,120}$/.test(idempotencyKey)) {
    throw new ApiError(400, "A valid Idempotency-Key header is required for offer email delivery");
  }
  const candidate = await User.findById(offer.candidateId).lean();
  if (!candidate || !candidate.email)
    throw new ApiError(400, "Candidate email is missing");
  if (candidate.email.trim().toLowerCase() !== offer.candidateSnapshot?.email?.trim().toLowerCase()) {
    throw new ApiError(409, "The candidate email changed after offer generation. Generate an updated offer before sending.");
  }
  if (
    offer.status !== OfferLetterStatus.GENERATED &&
    offer.status !== OfferLetterStatus.SENT &&
    offer.status !== OfferLetterStatus.VIEWED
  )
    throw new ApiError(409, "Offer must be generated before it can be sent");
  if (!offer.acceptanceDeadline || offer.acceptanceDeadline <= new Date()) {
    throw new ApiError(409, "Set a future offer acceptance deadline before sending");
  }

  if (!offer.companySnapshot) offer.companySnapshot = await activeCompanyOfferSnapshot();
  const { delivery, alreadySent } = await beginDocumentEmailDelivery({
    documentType: "OFFER_LETTER",
    documentId: offer._id,
    idempotencyKey,
  });
  if (alreadySent) {
    return markOfferSentAfterDelivery(offer, senderUserId, delivery.sentAt ?? new Date());
  }

  const sendingAt = new Date();
  let subject: string;
  let html: string;
  let text: string;
  try {
    const sendingTerms = offerSendingTerms(offer.employmentTerms?.endDate, sendingAt, plannedJoiningDate);
    offer.employmentTerms.joiningDate = sendingTerms.joiningDate;
    offer.employmentTerms.endDate = sendingTerms.endDate;
    offer.employmentTerms.internshipDuration = sendingTerms.internshipDuration;
    offer.offerDate = sendingAt;
    offer.compensation.paymentCycle = offer.compensation?.paymentCycle ?? "Monthly";
    await ensureOfferPdf(offer, true);
    await offer.save();
    const companyName = offer.companySnapshot.displayName;
    subject = `${companyName} — Offer Letter for ${offer.position?.designation ?? "Role"}`;
    const links = offerEmailLinks(offer);
    html = renderOfferEmail(offer, links);
    text = renderOfferEmailText(offer, links);
  } catch (error) {
    await markDocumentEmailFailed(delivery);
    throw error;
  }

  try {
    await sendEmail(candidate.email, subject, html, [
      {
        filename: offer.pdf?.fileName ?? `${offer.offerLetterNumber}.pdf`,
        content: offer.pdfBuffer,
      },
    ], text);
  } catch (error) {
    await markDocumentEmailFailed(delivery);
    throw new ApiError(502, "Offer PDF was generated, but email delivery failed. The offer was not marked as sent.", {
      pdfGenerated: true,
      emailSent: false,
    });
  }

  await markDocumentEmailSent(delivery);
  return markOfferSentAfterDelivery(offer, senderUserId, sendingAt);
}

export async function acceptOfferByCandidate(
  offer: any,
  candidateId: Types.ObjectId,
) {
  if (String(offer.candidateId) !== String(candidateId))
    throw new ApiError(403, "This offer does not belong to you");
  if (offer.status !== OfferLetterStatus.SENT && offer.status !== OfferLetterStatus.VIEWED)
    throw new ApiError(409, "Only a sent offer can be accepted");
  offer.status = OfferLetterStatus.ACCEPTED;
  offer.acceptedAt = new Date();
  await offer.save();
  return offer;
}

export async function declineOfferByCandidate(
  offer: any,
  candidateId: Types.ObjectId,
) {
  if (String(offer.candidateId) !== String(candidateId))
    throw new ApiError(403, "This offer does not belong to you");
  if (offer.status !== OfferLetterStatus.SENT && offer.status !== OfferLetterStatus.VIEWED)
    throw new ApiError(409, "Only a sent offer can be declined");
  offer.status = OfferLetterStatus.DECLINED;
  offer.declinedAt = new Date();
  await offer.save();
  return offer;
}
