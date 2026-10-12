import { ProductStatus } from "../../models/product.models.js";
import { TaskWorkflowStage } from "../../models/task.models.js";

export function productLifecycle(workflow?: { workflowStage: string } | null, stored?: string | null) {
  if (!workflow) {
    return stored === ProductStatus.DEVELOPMENT || stored === ProductStatus.PRODUCTION
      ? stored
      : ProductStatus.UNASSIGNED;
  }
  return workflow.workflowStage === TaskWorkflowStage.COMPLETED
    ? ProductStatus.PRODUCTION
    : ProductStatus.DEVELOPMENT;
}

export function productProgress(contributions: Array<{ completed: boolean; progress?: number }>) {
  if (!contributions.length) return 0;
  return Math.round(contributions.reduce((total, contribution) => total + (
    contribution.completed ? 100 : Math.min(100, Math.max(0, contribution.progress ?? 0))
  ), 0) / contributions.length);
}