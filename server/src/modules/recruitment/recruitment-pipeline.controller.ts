import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  Application,
  ApplicationAssignment,
  ApplicationAssignmentStatus,
  ApplicationAssessmentResult,
  ApplicationSource,
  ApplicationStatus,
  EmployeeProfile,
  EmploymentType,
  InternProfile,
  OfferLetter,
  OfferLetterStatus,
  OpportunityType,
  OrganizationAssignment,
  OrganizationDepartment,
  OrganizationLevel,
  RecruitmentCheckStatus,
  RecruitmentPipeline,
  RecruitmentPipelineStage,
  RecruitmentReviewStatus,
  RecruitmentTaskStatus,
  InterviewRoundStatus,
  PipelineApprovalStatus,
  User,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { currentScope, runWithCompany } from "../company/company.context.js";
import { isDesignatedHr } from "../company/company.service.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { requestRoles } from "../organization/organization.roles.js";
import {
  allChecksResolved,
  applicationStatusForRecruitmentStage,
  assertRecruitmentStageTransition,
} from "./recruitment-pipeline.service.js";

type PipelineAccess = {
  actorId: Types.ObjectId;
  full: boolean;
  manager: boolean;
  hiringManager: boolean;
  assignment: {
    level: OrganizationLevel;
    department: OrganizationDepartment;
    reportsTo?: Types.ObjectId | null;
  } | null;
};

function objectId(value: string | Types.ObjectId) {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
}

function requestParam(req: Request, key: string) {
  const value = req.params[key];
  if (typeof value !== "string") throw new ApiError(400, `A valid ${key} is required`);
  return value;
}

async function recruitmentAccess(req: Request, allowHiringManager = false): Promise<PipelineAccess> {
  const actorId = objectId(req.authUser!._id);
  const roles = requestRoles(req);
  const executive = roles.includes(UserRole.ADMIN) || roles.includes(UserRole.CEO);
  const assignment = await OrganizationAssignment.findOne({ userId: actorId, active: true })
    .select("level department reportsTo")
    .lean();
  const systemOrCompanyHr = roles.includes(UserRole.HR) && await isDesignatedHr(actorId);
  const hrAssignment = assignment?.department === OrganizationDepartment.HR
    && [
      UserRole.HR,
      UserRole.HR_HEAD,
      UserRole.HR_MANAGER,
      UserRole.HEAD,
      UserRole.MANAGER,
    ].some((role) => roles.includes(role));
  const hiringManager = Boolean(allowHiringManager && !hrAssignment && assignment?.level === OrganizationLevel.MANAGER);
  if (!executive && !systemOrCompanyHr && !hrAssignment && !hiringManager) {
    throw new ApiError(403, "Recruitment pipeline access is restricted to company HR and HR leadership");
  }
  return {
    actorId,
    full: executive || systemOrCompanyHr || assignment?.level === OrganizationLevel.HR
      || (assignment?.level === OrganizationLevel.HEAD && assignment.department === OrganizationDepartment.HR),
    manager: assignment?.department === OrganizationDepartment.HR && assignment.level === OrganizationLevel.MANAGER,
    hiringManager,
    assignment: assignment
      ? {
        level: assignment.level,
        department: assignment.department,
        reportsTo: assignment.reportsTo,
      }
      : null,
  };
}

function visibilityFilter(access: PipelineAccess): Record<string, unknown> {
  if (access.full) return {};
  if (access.hiringManager) return { hiringManagerId: access.actorId };
  if (access.manager) {
    return {
      $or: [
        { managerId: access.actorId },
        { recruiterId: access.actorId },
        { hiringManagerId: access.actorId },
      ],
    };
  }
  return { recruiterId: access.actorId };
}

function canAccessEntry(access: PipelineAccess, entry: {
  recruiterId: Types.ObjectId;
  managerId: Types.ObjectId | null;
  hiringManagerId: Types.ObjectId | null;
}) {
  return access.full
    || (access.manager && (
      String(entry.managerId) === String(access.actorId)
      || String(entry.recruiterId) === String(access.actorId)
      || String(entry.hiringManagerId) === String(access.actorId)
    ))
    || (access.hiringManager && String(entry.hiringManagerId) === String(access.actorId))
    || String(entry.recruiterId) === String(access.actorId);
}

async function assignmentForUser(userId: Types.ObjectId) {
  return OrganizationAssignment.findOne({ userId, active: true, department: OrganizationDepartment.HR })
    .select("userId level department reportsTo")
    .lean();
}

async function recruiterAndManager(application: {
  createdBy?: Types.ObjectId | null;
}, fallbackRecruiter: Types.ObjectId) {
  const creatorAssignment = application.createdBy
    ? await assignmentForUser(objectId(application.createdBy))
    : null;
  const defaultHrMember = creatorAssignment
    ? null
    : await OrganizationAssignment.findOne({
      department: OrganizationDepartment.HR,
      level: OrganizationLevel.MEMBER,
      active: true,
    }).select("userId level reportsTo").lean();
  const managerAssignment = creatorAssignment ?? defaultHrMember;
  const recruiterId = managerAssignment?.userId
    ? objectId(managerAssignment.userId)
    : application.createdBy
      ? objectId(application.createdBy)
      : fallbackRecruiter;
  const managerId = managerAssignment?.level === OrganizationLevel.MEMBER
    ? managerAssignment.reportsTo ? objectId(managerAssignment.reportsTo) : null
    : managerAssignment?.level === OrganizationLevel.MANAGER
      ? recruiterId
      : null;
  return { recruiterId, managerId };
}

function isDuplicateBulkWriteOnly(error: unknown) {
  if (!error || typeof error !== "object" || !("writeErrors" in error)) return false;
  const writeErrors = (error as { writeErrors?: Array<{ code?: number }> }).writeErrors;
  return Boolean(writeErrors?.length && writeErrors.every((writeError) => writeError.code === 11000));
}

async function backfillPipelineEntries(fallbackRecruiter: Types.ObjectId) {
  const scope = currentScope();
  if (!scope) throw new ApiError(500, "An active company scope is required");
  for (;;) {
    const missingApplications = await Application.aggregate<{
      _id: Types.ObjectId;
      opportunityId: Types.ObjectId;
      status: ApplicationStatus;
      createdBy?: Types.ObjectId | null;
    }>([
      {
        $lookup: {
          from: RecruitmentPipeline.collection.name,
          localField: "_id",
          foreignField: "applicationId",
          as: "pipelineEntry",
        },
      },
      { $match: { pipelineEntry: { $eq: [] } } },
      { $sort: { appliedAt: -1 } },
      { $limit: 500 },
      { $project: { _id: 1, opportunityId: 1, status: 1, createdBy: 1 } },
    ]);
    if (!missingApplications.length) return;
    const operations = [];
    for (const application of missingApplications) {
      const { recruiterId, managerId } = await recruiterAndManager(application, fallbackRecruiter);
      operations.push({
        updateOne: {
          filter: {
            applicationId: application._id,
            companyId: scope.isDefault ? { $in: [null, scope.companyId] } : scope.companyId,
          },
          update: {
            $setOnInsert: {
              applicationId: application._id,
              opportunityId: application.opportunityId,
              stage: application.status === ApplicationStatus.DECLINED
                ? RecruitmentPipelineStage.REJECTED
                : application.status === ApplicationStatus.ACCEPTED
                  ? RecruitmentPipelineStage.FINAL_SELECTION
                  : application.status === ApplicationStatus.UNDER_REVIEW
                    ? RecruitmentPipelineStage.SCREENING
                    : RecruitmentPipelineStage.NEW_APPLICATION,
              recruiterId,
              managerId,
              createdBy: recruiterId,
              companyId: scope.companyId,
            },
          },
          upsert: true,
        },
      });
    }
    try {
      await RecruitmentPipeline.bulkWrite(operations, { ordered: false });
    } catch (error) {
      if (!isDuplicateBulkWriteOnly(error)) throw error;
    }
    if (missingApplications.length < 500) return;
  }
}

async function findEntry(pipelineId: string | string[], access: PipelineAccess) {
  if (typeof pipelineId !== "string") throw new ApiError(400, "A valid pipelineId is required");
  const entry = await RecruitmentPipeline.findOne({
    _id: pipelineId,
    ...visibilityFilter(access),
  }).exec();
  if (!entry) throw new ApiError(404, "Recruitment candidate not found");
  return entry;
}

function assertCanEdit(access: PipelineAccess, entry: {
  recruiterId: Types.ObjectId;
  managerId: Types.ObjectId | null;
  hiringManagerId: Types.ObjectId | null;
}) {
  if (!canAccessEntry(access, entry)) throw new ApiError(403, "This candidate is outside your HR team scope");
}

async function assertRecruiterAssignment(userId: Types.ObjectId, access: PipelineAccess) {
  const assignment = await assignmentForUser(userId);
  if (!assignment) throw new ApiError(400, "Assign this candidate to an active HR team member");
  if (!access.full && access.manager && String(assignment.reportsTo) !== String(access.actorId)
    && String(assignment.userId) !== String(access.actorId)) {
    throw new ApiError(403, "HR Managers can only assign candidates to their direct team members");
  }
  if (!access.full && !access.manager && String(assignment.userId) !== String(access.actorId)) {
    throw new ApiError(403, "HR members can only own their assigned candidates");
  }
  return assignment;
}

export async function listRecruitmentPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    await backfillPipelineEntries(access.actorId);
    const stage = req.query.stage as RecruitmentPipelineStage | undefined;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = { ...visibilityFilter(access), ...(stage ? { stage } : {}) };
    const [total, entries, stageCounts] = await Promise.all([
      RecruitmentPipeline.countDocuments(filter),
      RecruitmentPipeline.find(filter)
        .populate({
          path: "applicationId",
          select: "userId opportunityId source sourceDetail candidatePhone address coverLetter resumeFileName resumeUrl portfolioUrl linkedInUrl githubUrl currentCompany experienceYears experienceSummary skills education screeningAnswers appliedAt",
          populate: [
            { path: "userId", select: "name email phoneNumber status emailVerifiedAt profile_pic" },
            { path: "opportunityId", select: "title role type category workMode location companyId" },
          ],
        })
        .populate("recruiterId", "name email")
        .populate("managerId", "name email")
        .populate("hiringManagerId", "name email")
        .populate("tasks.assignedTo", "name email")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RecruitmentPipeline.aggregate<{ _id: RecruitmentPipelineStage; total: number }>([
        { $match: visibilityFilter(access) },
        { $group: { _id: "$stage", total: { $sum: 1 } } },
      ]),
    ]);
    const applicationIds = entries
      .map((entry) => (entry.applicationId as unknown as { _id?: Types.ObjectId })?._id)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const [offers, assessmentCounts] = await Promise.all([
      applicationIds.length
        ? OfferLetter.find({ applicationId: { $in: applicationIds } })
          .select("applicationId status sentAt acceptedAt createdAt")
          .sort({ createdAt: -1 }).lean()
        : [],
      applicationIds.length
        ? ApplicationAssignment.aggregate<{ _id: Types.ObjectId; total: number; passed: number; pending: number }>([
          { $match: { applicationId: { $in: applicationIds } } },
          { $group: {
            _id: "$applicationId",
            total: { $sum: 1 },
            passed: { $sum: { $cond: [{ $eq: ["$result", ApplicationAssessmentResult.PASS] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $ne: ["$status", ApplicationAssignmentStatus.REVIEWED] }, 1, 0] } },
          } },
        ])
        : [],
    ]);
    const latestOffer = new Map<string, typeof offers[number]>();
    for (const offer of offers) {
      const id = String(offer.applicationId);
      if (!latestOffer.has(id)) latestOffer.set(id, offer);
    }
    const assessments = new Map(assessmentCounts.map((item) => [String(item._id), item]));
    return res.json({
      success: true,
      entries: entries.map((entry) => {
        const application = entry.applicationId as unknown as { _id: Types.ObjectId } | null;
        return {
          ...entry,
          latestOffer: application ? latestOffer.get(String(application._id)) ?? null : null,
          assessmentSummary: application ? assessments.get(String(application._id)) ?? { total: 0, passed: 0, pending: 0 } : { total: 0, passed: 0, pending: 0 },
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stageCounts: Object.fromEntries(stageCounts.map((item) => [item._id, item.total])),
    });
  } catch (error) {
    next(error);
  }
}

export async function listRecruitmentPipelineStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const assignments = await OrganizationAssignment.find({ department: OrganizationDepartment.HR, active: true })
      .populate<{ userId: { _id: Types.ObjectId; name: string; email: string } | null }>({ path: "userId", match: { status: UserStatus.ACTIVE }, select: "name email roles" })
      .select("userId level reportsTo")
      .lean();
    const managers = await OrganizationAssignment.find({ level: OrganizationLevel.MANAGER, active: true })
      .populate<{ userId: { _id: Types.ObjectId; name: string; email: string } | null }>({ path: "userId", match: { status: UserStatus.ACTIVE }, select: "name email roles" })
      .select("userId department reportsTo")
      .lean();
    const visibleHrStaff = assignments.filter((assignment) => {
      if (!assignment.userId) return false;
      if (access.full) return true;
      if (access.manager) return String(assignment.reportsTo) === String(access.actorId) || String(assignment.userId._id) === String(access.actorId);
      return String(assignment.userId._id) === String(access.actorId)
        || String(assignment.userId._id) === String(access.assignment?.reportsTo);
    });
    const visibleManagers = managers.filter((assignment) => {
      if (!assignment.userId) return false;
      if (access.full) return true;
      if (access.manager) return String(assignment.userId._id) === String(access.actorId);
      return String(assignment.userId._id) === String(access.assignment?.reportsTo);
    });
    return res.json({
      success: true,
      hrStaff: visibleHrStaff.map((item) => ({
        _id: String(item.userId!._id),
        name: item.userId!.name,
        email: item.userId!.email,
        level: item.level,
        reportsTo: item.reportsTo ? String(item.reportsTo) : null,
      })),
      hiringManagers: visibleManagers.map((item) => ({
        _id: String(item.userId!._id),
        name: item.userId!.name,
        email: item.userId!.email,
        department: item.department,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function assignRecruitmentPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (req.body.recruiterId) {
      const recruiterAssignment = await assertRecruiterAssignment(objectId(req.body.recruiterId), access);
      entry.recruiterId = objectId(req.body.recruiterId);
      entry.managerId = recruiterAssignment.level === OrganizationLevel.MEMBER
        ? recruiterAssignment.reportsTo ? objectId(recruiterAssignment.reportsTo) : null
        : recruiterAssignment.level === OrganizationLevel.MANAGER
          ? objectId(recruiterAssignment.userId)
          : entry.managerId;
      entry.finalApproval = { status: PipelineApprovalStatus.PENDING, note: "", decidedBy: null, decidedAt: null };
    }
    if (req.body.hiringManagerId !== undefined) {
      if (req.body.hiringManagerId === null) {
        entry.hiringManagerId = null;
      } else {
        const manager = await OrganizationAssignment.findOne({
          userId: req.body.hiringManagerId,
          active: true,
          level: OrganizationLevel.MANAGER,
        });
        if (!manager) throw new ApiError(400, "Select an active company manager");
        if (!access.full && !access.manager && String(manager.userId) !== String(access.assignment?.reportsTo)) {
          throw new ApiError(403, "HR members can only select their assigned manager");
        }
        entry.hiringManagerId = objectId(req.body.hiringManagerId);
      }
    }
    await entry.save();
    return res.json({ success: true, entry });
  } catch (error) {
    next(error);
  }
}

export async function updateRecruitmentScreening(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (entry.stage !== RecruitmentPipelineStage.SCREENING) throw new ApiError(409, "Screening can only be edited in the Screening stage");
    entry.screening = { ...entry.screening, ...req.body };
    await entry.save();
    return res.json({ success: true, screening: entry.screening });
  } catch (error) {
    next(error);
  }
}

export async function createRecruitmentTask(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    const assignedTo = objectId(req.body.assignedTo);
    await assertRecruiterAssignment(assignedTo, access);
    entry.tasks.push({
      stage: entry.stage,
      title: req.body.title,
      description: req.body.description ?? "",
      assignedTo,
      dueDate: req.body.dueDate,
      status: RecruitmentTaskStatus.OPEN,
      completedAt: null,
      confirmedAt: null,
      confirmedBy: null,
      createdBy: access.actorId,
      createdAt: new Date(),
    });
    await entry.save();
    return res.status(201).json({ success: true, task: entry.tasks.at(-1) });
  } catch (error) {
    next(error);
  }
}

export async function completeRecruitmentTask(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    const task = entry.tasks.id(requestParam(req, "taskId"));
    if (!task) throw new ApiError(404, "Recruitment task not found");
    if (String(task.assignedTo) !== String(access.actorId) && !access.full && !access.manager) {
      throw new ApiError(403, "Only the assigned HR member can complete this task");
    }
    if (task.status === RecruitmentTaskStatus.CONFIRMED) throw new ApiError(409, "A manager-confirmed task cannot be changed");
    task.status = RecruitmentTaskStatus.COMPLETED;
    task.completedAt = new Date();
    task.confirmedAt = null;
    task.confirmedBy = null;
    await entry.save();
    return res.json({ success: true, task });
  } catch (error) {
    next(error);
  }
}

export async function confirmRecruitmentTask(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    const task = entry.tasks.id(requestParam(req, "taskId"));
    if (!task) throw new ApiError(404, "Recruitment task not found");
    if (!access.full && String(entry.managerId) !== String(access.actorId)) {
      throw new ApiError(403, "Only the candidate's assigned HR Manager can confirm this task");
    }
    if (task.status !== RecruitmentTaskStatus.COMPLETED) throw new ApiError(409, "Complete the task before manager confirmation");
    task.status = RecruitmentTaskStatus.CONFIRMED;
    task.confirmedAt = new Date();
    task.confirmedBy = access.actorId;
    await entry.save();
    return res.json({ success: true, task });
  } catch (error) {
    next(error);
  }
}

export async function addRecruitmentInterviewRound(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (entry.stage !== RecruitmentPipelineStage.INTERVIEW) throw new ApiError(409, "Interview rounds can only be scheduled in the Interview stage");
    const activeInterviewers = await OrganizationAssignment.find({
      userId: { $in: req.body.interviewerIds },
      active: true,
    }).distinct("userId");
    if (activeInterviewers.length !== req.body.interviewerIds.length) throw new ApiError(400, "Every interviewer must have an active company assignment");
    entry.interviewRounds.push({
      type: req.body.type,
      scheduledAt: req.body.scheduledAt,
      interviewerIds: req.body.interviewerIds.map(objectId),
      status: InterviewRoundStatus.SCHEDULED,
      feedback: "",
      score: null,
      result: RecruitmentReviewStatus.PENDING,
      updatedBy: access.actorId,
      updatedAt: new Date(),
    });
    await entry.save();
    return res.status(201).json({ success: true, round: entry.interviewRounds.at(-1) });
  } catch (error) {
    next(error);
  }
}

const nextInterviewStatus: Record<InterviewRoundStatus, InterviewRoundStatus[]> = {
  [InterviewRoundStatus.SCHEDULED]: [InterviewRoundStatus.COMPLETED],
  [InterviewRoundStatus.COMPLETED]: [InterviewRoundStatus.FEEDBACK_PENDING],
  [InterviewRoundStatus.FEEDBACK_PENDING]: [InterviewRoundStatus.PASSED, InterviewRoundStatus.FAILED],
  [InterviewRoundStatus.PASSED]: [],
  [InterviewRoundStatus.FAILED]: [],
};

export async function updateRecruitmentInterviewRound(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    const round = entry.interviewRounds.id(requestParam(req, "roundId"));
    if (!round) throw new ApiError(404, "Interview round not found");
    if (!nextInterviewStatus[round.status].includes(req.body.status)) {
      throw new ApiError(409, "Interview rounds must move from scheduled to completed, feedback pending, then a final result");
    }
    if (
      (req.body.status === InterviewRoundStatus.PASSED || req.body.status === InterviewRoundStatus.FAILED)
      && (!req.body.feedback?.trim() || !req.body.result || req.body.result === RecruitmentReviewStatus.PENDING)
    ) {
      throw new ApiError(400, "Final interview feedback and a pass/fail result are required");
    }
    round.status = req.body.status;
    if (req.body.feedback !== undefined) round.feedback = req.body.feedback;
    if (req.body.score !== undefined) round.score = req.body.score;
    if (req.body.result !== undefined) round.result = req.body.result;
    round.updatedBy = access.actorId;
    round.updatedAt = new Date();
    await entry.save();
    return res.json({ success: true, round });
  } catch (error) {
    next(error);
  }
}

export async function updateRecruitmentFinalSelection(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (entry.stage !== RecruitmentPipelineStage.FINAL_SELECTION) throw new ApiError(409, "Final selection can only be edited at the Final Selection stage");
    const application = await Application.findById(entry.applicationId).populate("opportunityId").exec();
    if (!application) throw new ApiError(404, "Application not found");
    const opportunity = application.opportunityId as unknown as { type: OpportunityType };
    const previousHiringManagerId = entry.hiringManagerId ? String(entry.hiringManagerId) : null;
    if (req.body.selectedRole && req.body.selectedRole !== (opportunity.type === OpportunityType.JOB ? "EMPLOYEE" : "INTERN")) {
      throw new ApiError(400, "Selected role must match the opportunity type");
    }
    if (req.body.hiringManagerId !== undefined) {
      if (req.body.hiringManagerId === null) entry.hiringManagerId = null;
      else {
        const hiringManager = await OrganizationAssignment.findOne({
          userId: req.body.hiringManagerId,
          level: OrganizationLevel.MANAGER,
          active: true,
        });
        if (!hiringManager) throw new ApiError(400, "Select an active company hiring manager");
        entry.hiringManagerId = objectId(req.body.hiringManagerId);
      }
    }
    const { hiringManagerId: _hiringManagerId, ...selection } = req.body;
    const approvalRelevantChange = (
      selection.selectedRole !== undefined && selection.selectedRole !== entry.finalSelection.selectedRole
    ) || (
      selection.department !== undefined && selection.department !== entry.finalSelection.department
    ) || (
      selection.compensationAmount !== undefined && selection.compensationAmount !== entry.finalSelection.compensationAmount
    ) || (
      selection.compensationFrequency !== undefined && selection.compensationFrequency !== entry.finalSelection.compensationFrequency
    ) || (
      selection.annualCtc !== undefined && selection.annualCtc !== entry.finalSelection.annualCtc
    ) || (
      selection.monthlyGrossSalary !== undefined && selection.monthlyGrossSalary !== entry.finalSelection.monthlyGrossSalary
    ) || (
      selection.salaryStructureReference !== undefined && selection.salaryStructureReference !== entry.finalSelection.salaryStructureReference
    ) || (
      selection.benefits !== undefined && selection.benefits !== entry.finalSelection.benefits
    ) || (
      selection.currency !== undefined && selection.currency.toUpperCase() !== entry.finalSelection.currency
    ) || (
      selection.joiningDate !== undefined
      && String(selection.joiningDate ?? "") !== String(entry.finalSelection.joiningDate ?? "")
    ) || (
      selection.employmentEndDate !== undefined
      && String(selection.employmentEndDate ?? "") !== String(entry.finalSelection.employmentEndDate ?? "")
    ) || (
      selection.probationPeriod !== undefined && selection.probationPeriod !== entry.finalSelection.probationPeriod
    ) || (
      selection.workingHours !== undefined && selection.workingHours !== entry.finalSelection.workingHours
    ) || (
      selection.acceptanceDeadline !== undefined
      && String(selection.acceptanceDeadline ?? "") !== String(entry.finalSelection.acceptanceDeadline ?? "")
    ) || (
      req.body.hiringManagerId !== undefined
      && (req.body.hiringManagerId ? String(req.body.hiringManagerId) : null) !== previousHiringManagerId
    );
    entry.finalSelection = { ...entry.finalSelection, ...selection };
    if (approvalRelevantChange) {
      entry.finalSelection.hiringManagerApproved = false;
      entry.finalSelection.hiringManagerApprovedBy = null;
      entry.finalSelection.hiringManagerApprovedAt = null;
      entry.finalSelection.approvalNote = "";
    }
    await entry.save();
    return res.json({ success: true, finalSelection: entry.finalSelection, hiringManagerId: entry.hiringManagerId });
  } catch (error) {
    next(error);
  }
}

export async function updateRecruitmentPreJoining(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (entry.stage !== RecruitmentPipelineStage.PRE_JOINING) throw new ApiError(409, "Pre-joining checks can only be edited at the Pre-Joining stage");
    entry.preJoining = { ...entry.preJoining, ...req.body };
    await entry.save();
    return res.json({ success: true, preJoining: entry.preJoining });
  } catch (error) {
    next(error);
  }
}

export async function updateRecruitmentOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (entry.stage !== RecruitmentPipelineStage.ONBOARDING) throw new ApiError(409, "Onboarding details can only be edited at the Onboarding stage");
    entry.onboarding = { ...entry.onboarding, ...req.body };
    await entry.save();
    return res.json({ success: true, onboarding: entry.onboarding });
  } catch (error) {
    next(error);
  }
}

async function latestOfferStatus(applicationId: Types.ObjectId) {
  return OfferLetter.findOne({ applicationId }).sort({ createdAt: -1 }).select("status").lean();
}

async function activateCandidate(entry: InstanceType<typeof RecruitmentPipeline>, actorId: Types.ObjectId) {
  const application = await Application.findById(entry.applicationId).populate("opportunityId").exec();
  if (!application) throw new ApiError(404, "Application not found");
  const user = await User.findById(application.userId);
  if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt) {
    throw new ApiError(409, "The candidate must activate and verify their Ricoz account before onboarding");
  }
  const activeAssignment = await runWithCompany(null, () => OrganizationAssignment.findOne({
    userId: user._id,
    active: true,
  }).select("companyId").lean());
  if (activeAssignment) {
    throw new ApiError(409, "This candidate already has an active organization assignment; resolve the existing employment before onboarding");
  }
  if (!entry.finalSelection.selectedRole || !entry.finalSelection.department || !entry.finalSelection.joiningDate || !entry.hiringManagerId) {
    throw new ApiError(409, "Complete role, department, manager and joining-date details before activation");
  }
  const opportunity = application.opportunityId as unknown as {
    type: OpportunityType;
    role?: string;
    employmentType?: "FULL_TIME" | "PART_TIME";
  };
  const isIntern = opportunity.type === OpportunityType.INTERNSHIP;
  if (entry.finalSelection.selectedRole !== (isIntern ? "INTERN" : "EMPLOYEE")) {
    throw new ApiError(409, "Selected role does not match the opportunity type");
  }
  const role = isIntern ? UserRole.INTERN : UserRole.EMPLOYEE;
  if (!user.roles.includes(role)) user.roles.push(role);
  await user.save();
  const profileData = {
    joiningDate: entry.finalSelection.joiningDate,
    department: entry.finalSelection.department,
    managerId: entry.hiringManagerId,
    address: application.address,
    initialRole: opportunity.role ?? (isIntern ? "Intern" : "Employee"),
    currentRole: opportunity.role ?? (isIntern ? "Intern" : "Employee"),
  };
  if (isIntern) {
    await InternProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: { ...profileData, endDate: entry.finalSelection.employmentEndDate ?? null } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } else {
    const employmentType = opportunity.employmentType === "PART_TIME" ? "PART_TIME" : "FULL_TIME";
    await EmployeeProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: { ...profileData, endDate: null, employmentType } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  await OrganizationAssignment.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        level: OrganizationLevel.MEMBER,
        department: entry.finalSelection.department,
        roleKeys: [role],
        employmentType: isIntern ? EmploymentType.INTERN : EmploymentType.EMPLOYEE,
        reportsTo: entry.hiringManagerId,
        assignedBy: actorId,
        active: true,
        effectiveFrom: entry.finalSelection.joiningDate,
        effectiveTo: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  application.roleGrantedAt = new Date();
  application.roleGrantedBy = actorId;
  application.status = ApplicationStatus.ACCEPTED;
  await application.save();
}

export async function moveRecruitmentPipelineStage(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    const target = req.body.stage as RecruitmentPipelineStage;
    assertRecruitmentStageTransition(entry.stage, target);
    const application = await Application.findById(entry.applicationId).populate("opportunityId").exec();
    if (!application) throw new ApiError(404, "Application not found");

    if (target === RecruitmentPipelineStage.REJECTED) {
      if (entry.stage === RecruitmentPipelineStage.OFFER) {
        const offer = await latestOfferStatus(application._id);
        if (offer?.status !== OfferLetterStatus.DECLINED) {
          throw new ApiError(409, "Only a candidate-declined offer can be moved to Rejected");
        }
      } else if ([
        RecruitmentPipelineStage.PRE_JOINING,
        RecruitmentPipelineStage.ONBOARDING,
      ].includes(entry.stage)) {
        throw new ApiError(409, "A candidate cannot be rejected after accepting an offer");
      }
      if (!req.body.note?.trim()) throw new ApiError(400, "Record a rejection reason");
      application.status = ApplicationStatus.DECLINED;
      application.declineReason = req.body.note;
    } else if (target === RecruitmentPipelineStage.SHORTLISTED) {
      const checks = [
        entry.screening.skillsFit,
        entry.screening.educationFit,
        entry.screening.experienceFit,
        entry.screening.locationFit,
        entry.screening.eligibility,
      ];
      if (checks.some((value) => typeof value === "string" && ["PENDING", "FAIL"].includes(value))) {
        throw new ApiError(409, "Resolve all screening checks as pass before shortlisting");
      }
    } else if (target === RecruitmentPipelineStage.INTERVIEW) {
      const assignments = await ApplicationAssignment.find({ applicationId: application._id }).select("status result").lean();
      const passed = assignments.length > 0 && assignments.every(
        (item) => item.status === ApplicationAssignmentStatus.REVIEWED && item.result === ApplicationAssessmentResult.PASS,
      );
      if (!entry.assessmentWaiverReason.trim() && !passed) {
        throw new ApiError(409, "Pass all assigned assessments or record an approved reason to skip assessment");
      }
    } else if (target === RecruitmentPipelineStage.FINAL_SELECTION) {
      const passed = entry.interviewRounds.length > 0 && entry.interviewRounds.every((round) => round.status === InterviewRoundStatus.PASSED);
      if (!entry.interviewWaiverReason.trim() && !passed) {
        throw new ApiError(409, "Pass every interview round or record an approved reason to skip interviews");
      }
    } else if (target === RecruitmentPipelineStage.OFFER) {
      const opportunity = application.opportunityId as unknown as { type: OpportunityType };
      const expectedRole = opportunity.type === OpportunityType.JOB ? "EMPLOYEE" : "INTERN";
      const selection = entry.finalSelection;
      const joiningDate = selection.joiningDate;
      const employmentEndDate = selection.employmentEndDate;
      const missingRequirements: string[] = [];
      if (selection.selectedRole !== expectedRole) missingRequirements.push(`role must be ${expectedRole}`);
      if (!selection.department?.trim()) missingRequirements.push("department");
      if (selection.compensationAmount == null || !String(selection.compensationAmount).trim()) missingRequirements.push("compensation amount");
      if (!selection.compensationFrequency) missingRequirements.push("pay frequency");
      if (!joiningDate) missingRequirements.push("joining date");
      if (!employmentEndDate) missingRequirements.push("employment/contract end date");
      if (!selection.probationPeriod?.trim()) missingRequirements.push("probation period");
      if (!selection.workingHours?.trim()) missingRequirements.push("working hours");
      if (!selection.acceptanceDeadline || selection.acceptanceDeadline <= new Date()) {
        missingRequirements.push("a future acceptance deadline");
      }
      if (selection.selectedRole === "EMPLOYEE") {
        if (selection.annualCtc == null || !String(selection.annualCtc).trim()) missingRequirements.push("annual CTC");
        if (selection.monthlyGrossSalary == null || !String(selection.monthlyGrossSalary).trim()) missingRequirements.push("monthly gross salary");
        if (!selection.salaryStructureReference?.trim()) missingRequirements.push("salary-structure reference");
      }
      if (!entry.hiringManagerId) missingRequirements.push("assigned hiring manager");
      if (!selection.hiringManagerApproved) missingRequirements.push("hiring-manager approval");
      if (missingRequirements.length) {
        throw new ApiError(
          409,
          `Complete these Final Selection requirements before moving to Offer: ${missingRequirements.join(", ")}.`,
        );
      }
      if (!joiningDate || !employmentEndDate) {
        throw new ApiError(409, "A joining date and employment/contract end date are required before issuing an offer");
      }
      if (joiningDate <= new Date()) {
        throw new ApiError(409, "The planned joining date must be in the future before issuing an offer");
      }
      if (employmentEndDate <= joiningDate) {
        throw new ApiError(409, "The employment end date must be after the joining date");
      }
      application.status = ApplicationStatus.ACCEPTED;
    } else if (target === RecruitmentPipelineStage.PRE_JOINING) {
      const offer = await latestOfferStatus(application._id);
      if (offer?.status !== OfferLetterStatus.ACCEPTED) throw new ApiError(409, "The candidate must accept the offer before Pre-Joining");
    } else if (target === RecruitmentPipelineStage.ONBOARDING) {
      if (!allChecksResolved([
        entry.preJoining.documents,
        entry.preJoining.backgroundVerification,
        entry.preJoining.bankDetails,
        entry.preJoining.identityVerification,
        entry.preJoining.communication,
      ])) throw new ApiError(409, "Complete or formally waive every pre-joining check first");
    } else if (target === RecruitmentPipelineStage.ACTIVE) {
      if (!allChecksResolved([
        entry.onboarding.systemAccess,
        entry.onboarding.policiesAccepted,
        entry.onboarding.equipmentAssigned,
        entry.onboarding.orientationCompleted,
      ])) {
        throw new ApiError(409, "Complete or formally waive every onboarding checklist item first");
      }
      if (entry.finalApproval.status !== PipelineApprovalStatus.CONFIRMED) {
        throw new ApiError(409, "The assigned HR Manager must confirm onboarding before activation");
      }
      if (!entry.onboarding.employeeId.trim() || !entry.onboarding.companyEmail.trim()) {
        throw new ApiError(409, "Record the employee ID and company email before activation");
      }
      if (!entry.finalSelection.joiningDate || entry.finalSelection.joiningDate > new Date()) {
        throw new ApiError(409, "The joining date must be today or earlier before activation");
      }
      await activateCandidate(entry, access.actorId);
    }

    const previous = entry.stage;
    entry.stage = target;
    entry.history.push({
      from: previous,
      to: target,
      actorId: access.actorId,
      note: req.body.note ?? "",
      changedAt: new Date(),
    });
    if (target !== RecruitmentPipelineStage.ACTIVE) {
      application.status = applicationStatusForRecruitmentStage(target);
    }
    application.reviewedAt = new Date();
    application.reviewedBy = access.actorId;
    await Promise.all([entry.save(), application.save()]);
    return res.json({ success: true, entry, applicationStatus: application.status });
  } catch (error) {
    next(error);
  }
}

export async function decideRecruitmentManagerApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req, true);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (entry.stage === RecruitmentPipelineStage.FINAL_SELECTION) {
      if (!access.full && String(entry.hiringManagerId) !== String(access.actorId)) {
        throw new ApiError(403, "Only the assigned hiring manager can approve this selection");
      }
      entry.finalSelection.hiringManagerApproved = req.body.confirm;
      entry.finalSelection.approvalNote = req.body.note ?? "";
      entry.finalSelection.hiringManagerApprovedBy = req.body.confirm ? access.actorId : null;
      entry.finalSelection.hiringManagerApprovedAt = req.body.confirm ? new Date() : null;
    } else if (entry.stage === RecruitmentPipelineStage.ONBOARDING) {
      if (!access.full && String(entry.managerId) !== String(access.actorId)) {
        throw new ApiError(403, "Only the candidate's assigned HR Manager can confirm onboarding");
      }
      entry.finalApproval.status = req.body.confirm
        ? PipelineApprovalStatus.CONFIRMED
        : PipelineApprovalStatus.REJECTED;
      entry.finalApproval.note = req.body.note ?? "";
      entry.finalApproval.decidedBy = access.actorId;
      entry.finalApproval.decidedAt = new Date();
    } else {
      throw new ApiError(409, "Manager approval is available at Final Selection and Onboarding");
    }
    await entry.save();
    return res.json({ success: true, entry });
  } catch (error) {
    next(error);
  }
}

export async function updateAssessmentResult(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (entry.stage !== RecruitmentPipelineStage.ASSESSMENT) throw new ApiError(409, "Assessment results can only be recorded in the Assessment stage");
    const assignment = await ApplicationAssignment.findById(requestParam(req, "assessmentId")).exec();
    if (!assignment) throw new ApiError(404, "Submitted candidate assessment not found");
    if (
      String(assignment.applicationId) !== String(entry.applicationId)
      || ![ApplicationAssignmentStatus.SUBMITTED, ApplicationAssignmentStatus.REVIEWED].includes(assignment.status)
      || !assignment.submittedAt
    ) throw new ApiError(404, "Submitted candidate assessment not found");
    assignment.status = ApplicationAssignmentStatus.REVIEWED;
    assignment.result = req.body.result;
    assignment.score = req.body.score ?? null;
    assignment.feedback = req.body.feedback;
    assignment.reviewerId = access.actorId;
    assignment.reviewedAt = new Date();
    await assignment.save();
    return res.json({ success: true, assessment: {
      id: String(assignment._id),
      status: assignment.status,
      result: assignment.result,
      score: assignment.score,
      feedback: assignment.feedback,
      reviewerId: assignment.reviewerId,
      reviewedAt: assignment.reviewedAt,
    } });
  } catch (error) {
    next(error);
  }
}

export async function listRecruitmentAssessments(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    const assignments = await ApplicationAssignment.find({ applicationId: entry.applicationId })
      .select("-submissionFile")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, assignments });
  } catch (error) {
    next(error);
  }
}

export async function createRecruitmentAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (entry.stage !== RecruitmentPipelineStage.ASSESSMENT) throw new ApiError(409, "Assessments can only be assigned in the Assessment stage");
    const application = await Application.findById(entry.applicationId).exec();
    if (!application) throw new ApiError(404, "Application not found");
    const assignment = await ApplicationAssignment.create({
      applicationId: application._id,
      opportunityId: application.opportunityId,
      applicantId: application.userId,
      title: req.body.title,
      instructions: req.body.instructions,
      deadline: req.body.deadline,
      createdBy: access.actorId,
    });
    return res.status(201).json({ success: true, assignment });
  } catch (error) {
    next(error);
  }
}

export async function downloadRecruitmentAssessmentSubmission(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    const assignment = await ApplicationAssignment.findById(requestParam(req, "assessmentId"))
      .select("+submissionFile")
      .exec();
    if (!assignment || String(assignment.applicationId) !== String(entry.applicationId)) {
      throw new ApiError(404, "Assessment submission not found");
    }
    if (!assignment.submissionFile) throw new ApiError(404, "No file was submitted");
    res.setHeader("Content-Type", assignment.submissionFileType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(assignment.submissionFileName ?? "submission")}`);
    res.setHeader("Content-Length", String(assignment.submissionFile.length));
    return res.send(assignment.submissionFile);
  } catch (error) {
    next(error);
  }
}

export async function recordAssessmentWaiver(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (!access.full && !access.manager) {
      throw new ApiError(403, "Only an HR Manager or HR leadership can waive an assessment");
    }
    if (entry.stage !== RecruitmentPipelineStage.ASSESSMENT) throw new ApiError(409, "Assessment waiver can only be recorded in the Assessment stage");
    entry.assessmentWaiverReason = req.body.reason;
    await entry.save();
    return res.json({ success: true, assessmentWaiverReason: entry.assessmentWaiverReason });
  } catch (error) {
    next(error);
  }
}

export async function recordInterviewWaiver(req: Request, res: Response, next: NextFunction) {
  try {
    const access = await recruitmentAccess(req);
    const entry = await findEntry(req.params.pipelineId!, access);
    assertCanEdit(access, entry);
    if (!access.full && !access.manager) {
      throw new ApiError(403, "Only an HR Manager or HR leadership can waive interviews");
    }
    if (entry.stage !== RecruitmentPipelineStage.INTERVIEW) throw new ApiError(409, "Interview waiver can only be recorded in the Interview stage");
    entry.interviewWaiverReason = req.body.reason;
    await entry.save();
    return res.json({ success: true, interviewWaiverReason: entry.interviewWaiverReason });
  } catch (error) {
    next(error);
  }
}
