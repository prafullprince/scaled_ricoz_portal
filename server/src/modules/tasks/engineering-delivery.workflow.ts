import type { DeliveryDepartment, DeliveryWorkItem, EngineeringDeliveryRecord } from "../../models/engineering-delivery.models.js";
import { ApiError } from "../../utils/apiError.utils.js";

export type DeliveryAction = "START" | "SUBMIT" | "APPROVE" | "REQUEST_REWORK";
export type DeliveryActor = {
  id: string;
  level: "HEAD" | "MANAGER" | "MEMBER" | null;
  department: string | null;
  ceo: boolean;
  admin: boolean;
  authorizedHr: boolean;
};
export type DeliveryTransition = {
  nodeId: string | null;
  action: DeliveryAction;
  summary?: string;
  note?: string;
  githubUrl?: string;
  liveUrl?: string;
};

const accepted = (item: DeliveryWorkItem) => item.status === "SUBMITTED" || item.status === "COMPLETED";
const companyReviewer = (actor: DeliveryActor) =>
  actor.ceo || actor.admin || actor.authorizedHr;
export const deliveryChildren = (record: EngineeringDeliveryRecord, parentId: string | null) =>
  record.workItems.filter((item) => item.parentId === parentId);

export function isDeliveryHead(record: EngineeringDeliveryRecord, actor: DeliveryActor) {
  return Boolean(
    record.headId &&
      actor.level === "HEAD" &&
      actor.department === record.department &&
      actor.id === record.headId,
  );
}

function ownsNode(record: EngineeringDeliveryRecord, node: DeliveryWorkItem, actor: DeliveryActor) {
  const matchesLevel =
    node.kind === "HEAD"
      ? actor.level === "HEAD"
      : node.kind === "MANAGER"
        ? actor.level === "MANAGER"
        : actor.level === "MEMBER";
  return node.assigneeId === actor.id && actor.department === record.department && matchesLevel;
}

export function canReviewDeliveryNode(record: EngineeringDeliveryRecord, node: DeliveryWorkItem, actor: DeliveryActor) {
  if (node.parentId === null) {
    if (actor.id === node.assigneeId) return false;
    return isDeliveryHead(record, actor) || (
    !record.headId && companyReviewer(actor)
    );
  }
  const parent = record.workItems.find((item) => item.id === node.parentId);
  return Boolean(
    parent &&
      (parent.kind === "MANAGER" || parent.kind === "HEAD") &&
      ownsNode(record, parent, actor),
  );
}

export function deliveryActions(record: EngineeringDeliveryRecord, actor: DeliveryActor, nodeId: string | null): DeliveryAction[] {
  if (record.phase === "COMPLETED") return [];
  if (nodeId === null) {
    if (record.phase === "ADMIN_REVIEW") return actor.admin || actor.authorizedHr || (!record.headId && actor.ceo) ? ["APPROVE", "REQUEST_REWORK"] : [];
    if (record.phase === "CEO_REVIEW") return actor.ceo ? ["APPROVE", "REQUEST_REWORK"] : [];
    const departmentLead =
      isDeliveryHead(record, actor) ||
      (!record.headId && actor.level === "HEAD" && actor.department === record.department);
    if (!departmentLead && !( !record.headId && companyReviewer(actor))) return [];
    const children = deliveryChildren(record, null);
    const ready = children.every(accepted);
    return [
      ...(record.status === "TODO" || record.status === "REWORK" ? ["START" as const] : []),
      ...(ready && record.status !== "TODO" ? ["SUBMIT" as const] : []),
    ];
  }
  if (record.phase !== "DELIVERY") return [];
  const node = record.workItems.find((item) => item.id === nodeId);
  if (!node) return [];
  if (node.status === "REVIEW" && canReviewDeliveryNode(record, node, actor)) return ["APPROVE", "REQUEST_REWORK"];
  if (node.status === "SUBMITTED" && canReviewDeliveryNode(record, node, actor)) return ["REQUEST_REWORK"];
  if (!ownsNode(record, node, actor)) return [];
  if (!["TODO", "IN_PROGRESS", "REWORK"].includes(node.status)) return [];
  const children = deliveryChildren(record, node.id);
  return [
    ...(node.status !== "IN_PROGRESS" ? ["START" as const] : []),
    ...(children.every(accepted) ? ["SUBMIT" as const] : []),
  ];
}

export function canDelegateDelivery(record: EngineeringDeliveryRecord, actor: DeliveryActor, parentId: string | null) {
  if (record.phase !== "DELIVERY") return false;
  if (parentId === null) return isDeliveryHead(record, actor) || actor.admin || actor.authorizedHr;
  const parent = record.workItems.find((node) => node.id === parentId);
  return Boolean(
    parent &&
      (parent.kind === "MANAGER" || parent.kind === "HEAD") &&
      ownsNode(record, parent, actor) &&
      ["TODO", "IN_PROGRESS", "REWORK"].includes(parent.status),
  );
}

export function rollUpDelivery(record: EngineeringDeliveryRecord, now: Date, changedParentId: string | null) {
  for (const manager of record.workItems.filter(
    (item) =>
      (item.kind === "MANAGER" || item.kind === "HEAD") &&
      item.id === changedParentId,
  )) {
    const children = deliveryChildren(record, manager.id);
    if (!children.length || ["SUBMITTED", "COMPLETED"].includes(manager.status)) continue;
    if (children.every(accepted)) {
      if (manager.status !== "REVIEW") {
        manager.status = "REVIEW";
        record.history.push({ nodeId: manager.id, actorId: manager.assigneeId, action: "READY_FOR_HEAD_REVIEW", note: "All delegated work has been approved by the manager.", createdAt: now });
      }
    } else if (manager.status === "REVIEW") {
      manager.status = "IN_PROGRESS";
    }
  }
  const topLevel = deliveryChildren(record, null);
  if (topLevel.length) {
    record.status = topLevel.every(accepted) ? "REVIEW" : "IN_PROGRESS";
  }
}

export function applyDeliveryTransition(record: EngineeringDeliveryRecord, actor: DeliveryActor, input: DeliveryTransition, now = new Date()) {
  if (!deliveryActions(record, actor, input.nodeId).includes(input.action)) {
    throw new ApiError(409, "This action is unavailable for your role or the current stage. Refresh the board; all delegated work must be approved before forwarding.");
  }
  const node = input.nodeId ? record.workItems.find((item) => item.id === input.nodeId)! : null;
  if (input.action === "REQUEST_REWORK" && (!input.note || input.note.trim().length < 2)) {
    throw new ApiError(400, "Explain the changes needed before requesting rework");
  }
  if (input.action === "START") {
    if (node) node.status = "IN_PROGRESS";
    else record.status = "IN_PROGRESS";
  } else if (input.action === "SUBMIT") {
    if (!input.summary || input.summary.trim().length < 20) throw new ApiError(400, "Describe the delivery in at least 20 characters");
    if (!node && !input.liveUrl) throw new ApiError(400, "A live website URL is required for department delivery");
    const submission = {
      summary: input.summary.trim(),
      githubUrl: input.githubUrl ?? node?.githubUrl ?? record.githubUrl,
      liveUrl: input.liveUrl ?? "",
      submittedAt: now,
    };
    if (node) {
      node.submission = submission;
      node.status = "REVIEW";
    } else {
      record.submission = submission;
      record.phase = "ADMIN_REVIEW";
      record.status = "REVIEW";
    }
  } else if (input.action === "APPROVE") {
    if (node) {
      if (!deliveryChildren(record, node.id).every(accepted)) throw new ApiError(409, "All delegated work must be approved first");
      node.status = "SUBMITTED";
      rollUpDelivery(record, now, node.parentId);
    } else if (record.phase === "ADMIN_REVIEW") {
      record.phase = "CEO_REVIEW";
    } else {
      record.phase = "COMPLETED";
      record.status = "COMPLETED";
      record.completedAt = now;
      record.workItems.forEach((item) => { item.status = "COMPLETED"; item.completedAt = now; });
    }
  } else if (node) {
    node.status = "REWORK";
    if (node.parentId) {
      const parent = record.workItems.find((item) => item.id === node.parentId)!;
      parent.status = "REWORK";
    }
    record.status = "IN_PROGRESS";
  } else {
    record.phase = "DELIVERY";
    record.status = "REWORK";
  }
  record.history.push({
    nodeId: input.nodeId,
    actorId: actor.id,
    action: input.action === "APPROVE" && record.phase === "COMPLETED" ? "CEO_COMPLETED" : input.action,
    note: input.note?.trim() ?? "",
    createdAt: now,
  });
}

export function isDeliveryDepartment(value: string): value is DeliveryDepartment {
  return value === "PRODUCT" || value === "ENGINEERING" || value === "IT";
}
