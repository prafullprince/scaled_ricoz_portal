import { SalesLeadStatus } from "../../models/salesLead.models.js";
import type { ISalesPipeline } from "../../models/salesPipeline.models.js";
import { ApiError } from "../../utils/apiError.utils.js";

export function defaultPipeline(key = "Sales"): ISalesPipeline {
  const probabilities = [10, 20, 30, 40, 60, 80, 100, 0];
  return {
    key, name: key, description: "", archived: false, revision: 0,
    stages: Object.values(SalesLeadStatus).map((status, index) => ({
      key: status, name: status.charAt(0) + status.slice(1).toLowerCase(), status,
      probability: probabilities[index]!, archived: false,
    })),
  };
}

export function pipelineDestination(pipeline: ISalesPipeline, stageKey?: string) {
  if (pipeline.archived) throw new ApiError(409, "This pipeline is archived");
  const stage = stageKey
    ? pipeline.stages.find((item) => item.key === stageKey)
    : pipeline.stages.find((item) => !item.archived && ![SalesLeadStatus.WON, SalesLeadStatus.LOST].includes(item.status));
  if (!stage || stage.archived) throw new ApiError(400, "Choose an active stage in this pipeline");
  return { pipeline: pipeline.key, stageId: stage.key, status: stage.status, probability: stage.probability };
}

export function assertPipelineRevision(previous: ISalesPipeline, next: ISalesPipeline) {
  for (const stage of previous.stages) {
    const replacement = next.stages.find((item) => item.key === stage.key);
    if (!replacement) throw new ApiError(400, "Archive existing stages instead of deleting them");
    if (replacement.status !== stage.status) throw new ApiError(400, "An existing stage's reporting category cannot change");
  }
}

export function assertSalesStageEvidence(stage: { status: SalesLeadStatus; stageId?: string }, evidence: {
  qualification?: { need?: string; budget?: string; authority?: string; timeline?: string } | null;
  meetingNotes?: string;
  expectedValue?: number;
  lostReason?: string;
  activities?: Array<{ kind: string; dueAt?: Date | null; completedAt?: Date | null }>;
}) {
  const qualification = evidence.qualification;
  if (stage.status === SalesLeadStatus.QUALIFIED && ![qualification?.need, qualification?.budget, qualification?.authority, qualification?.timeline].every((value) => value?.trim()))
    throw new ApiError(400, "Record need, budget, authority and timeline before qualifying a lead");
  if (stage.status === SalesLeadStatus.WON && !(Number(evidence.expectedValue) > 0))
    throw new ApiError(400, "Record a positive closed deal value before marking it won");
  if (stage.status === SalesLeadStatus.LOST && !evidence.lostReason?.trim())
    throw new ApiError(400, "Add a loss reason before closing this deal as lost");
  if (stage.stageId === "MEETING_COMPLETED" && !evidence.meetingNotes?.trim())
    throw new ApiError(400, "Record meeting requirements and objections before completing a meeting");
  if (stage.stageId === "DEMO_SCHEDULED" && !evidence.activities?.some((activity) => activity.kind === "MEETING" && activity.dueAt && !activity.completedAt))
    throw new ApiError(400, "Schedule a dated meeting activity before moving to Demo scheduled");
  if (stage.stageId === "CONTACT_ATTEMPTED" && !evidence.activities?.some((activity) => (activity.kind === "CALL" || activity.kind === "EMAIL") && activity.completedAt))
    throw new ApiError(400, "Complete a call or email activity before marking contact attempted");
}