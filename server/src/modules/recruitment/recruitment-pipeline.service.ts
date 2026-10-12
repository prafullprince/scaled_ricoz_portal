import { ApplicationStatus } from "../../models/application.models.js";
import { RecruitmentPipelineStage } from "../../models/recruitment-pipeline.models.js";
import { ApiError } from "../../utils/apiError.utils.js";

export const recruitmentStageOrder = [
  RecruitmentPipelineStage.NEW_APPLICATION,
  RecruitmentPipelineStage.SCREENING,
  RecruitmentPipelineStage.SHORTLISTED,
  RecruitmentPipelineStage.ASSESSMENT,
  RecruitmentPipelineStage.INTERVIEW,
  RecruitmentPipelineStage.FINAL_SELECTION,
  RecruitmentPipelineStage.OFFER,
  RecruitmentPipelineStage.PRE_JOINING,
  RecruitmentPipelineStage.ONBOARDING,
  RecruitmentPipelineStage.ACTIVE,
] as const;

export function assertRecruitmentStageTransition(
  current: RecruitmentPipelineStage,
  target: RecruitmentPipelineStage,
) {
  if (target === RecruitmentPipelineStage.REJECTED) {
    if ([
      RecruitmentPipelineStage.ACTIVE,
      RecruitmentPipelineStage.REJECTED,
    ].includes(current)) {
      throw new ApiError(409, "This candidate can no longer be rejected at this stage");
    }
    return;
  }
  const currentIndex = recruitmentStageOrder.indexOf(current as typeof recruitmentStageOrder[number]);
  const targetIndex = recruitmentStageOrder.indexOf(target as typeof recruitmentStageOrder[number]);
  if (currentIndex < 0 || targetIndex !== currentIndex + 1) {
    throw new ApiError(409, "Candidates must move through the hiring stages in order");
  }
}

export function applicationStatusForRecruitmentStage(stage: RecruitmentPipelineStage) {
  if (stage === RecruitmentPipelineStage.REJECTED) return ApplicationStatus.DECLINED;
  if (stage === RecruitmentPipelineStage.NEW_APPLICATION || stage === RecruitmentPipelineStage.SCREENING) {
    return ApplicationStatus.APPLIED;
  }
  if ([
    RecruitmentPipelineStage.SHORTLISTED,
    RecruitmentPipelineStage.ASSESSMENT,
    RecruitmentPipelineStage.INTERVIEW,
  ].includes(stage)) return ApplicationStatus.UNDER_REVIEW;
  return ApplicationStatus.ACCEPTED;
}

export function allChecksResolved(values: readonly string[]) {
  return values.every((value) => value === "COMPLETE" || value === "WAIVED");
}
