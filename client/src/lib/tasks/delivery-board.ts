import type { DeliveryAccess, DeliveryAction, DeliveryPackage, DeliveryPerson, DeliveryStatus, DeliveryWorkItem } from "@/services/engineering-delivery.service";

export const DELIVERY_COLUMNS: Array<{ id: DeliveryStatus; label: string; hint: string }> = [
  { id: "TODO", label: "Assigned", hint: "Ready to start" },
  { id: "IN_PROGRESS", label: "In progress", hint: "Building and coordinating" },
  { id: "REVIEW", label: "In review", hint: "Your approval queue" },
  { id: "REWORK", label: "Changes requested", hint: "Address reviewer feedback" },
  { id: "SUBMITTED", label: "Submitted", hint: "Approved or awaiting next reviewer" },
  { id: "COMPLETED", label: "Completed", hint: "Final CEO approval" },
];
export type DeliveryCard = { delivery: DeliveryPackage; node: DeliveryWorkItem | null };
export type DeliveryCardKey = { packageId: string; nodeId: string | null };
export const cardKey = (card: DeliveryCard): DeliveryCardKey => ({ packageId: card.delivery._id, nodeId: card.node?.id ?? null });
export const cardId = (card: DeliveryCard) => `${card.delivery._id}:${card.node?.id ?? "root"}`;
export const cardActions = (card: DeliveryCard) => card.node?.actions ?? card.delivery.actions;
export const cardOwner = (card: DeliveryCard) => card.node?.assigneeId ?? card.delivery.headId;
export const cardTitle = (card: DeliveryCard) => card.node?.title ?? card.delivery.title;
export const cardChildren = (card: DeliveryCard) => card.delivery.workItems.filter((item) => item.parentId === (card.node?.id ?? null));
export const isApproved = (item: DeliveryWorkItem) => item.status === "SUBMITTED" || item.status === "COMPLETED";
export const personName = (people: DeliveryPerson[], id: string | null) =>
  id
    ? people.find((person) => person.id === id)?.name ?? "Former team member"
    : "No department head assigned";

export function boardStage(card: DeliveryCard, access: DeliveryAccess): DeliveryStatus {
  if (card.delivery.phase === "COMPLETED") return "COMPLETED";
  if (card.node) {
    if (card.node.status === "REVIEW" && cardOwner(card) === access.id) return "SUBMITTED";
    return card.node.status;
  }
  if (card.delivery.phase === "CEO_REVIEW") return access.ceo ? "REVIEW" : "SUBMITTED";
  if (card.delivery.phase === "ADMIN_REVIEW") return access.admin || access.authorizedHr ? "REVIEW" : access.ceo ? "IN_PROGRESS" : "SUBMITTED";
  return card.delivery.status;
}

export function myDeliveryCards(packages: DeliveryPackage[], access: DeliveryAccess): DeliveryCard[] {
  return packages.flatMap((delivery) => {
    if (access.ceo || access.admin || access.authorizedHr) return [{ delivery, node: null }];
    const cards: DeliveryCard[] = [];
    if (delivery.headId === access.id) cards.push({ delivery, node: null });
    for (const node of delivery.workItems) {
      const parent = delivery.workItems.find((item) => item.id === node.parentId);
      if (node.assigneeId === access.id || parent?.assigneeId === access.id || (!node.parentId && delivery.headId === access.id) || node.actions.some((action) => action === "APPROVE" || action === "REQUEST_REWORK")) cards.push({ delivery, node });
    }
    return cards;
  });
}

export function actionForColumn(card: DeliveryCard, target: DeliveryStatus, access: DeliveryAccess): DeliveryAction | null {
  if (target === boardStage(card, access)) return null;
  const actions = cardActions(card);
  if (target === "IN_PROGRESS" && actions.includes("START")) return "START";
  if (target === "REWORK" && actions.includes("REQUEST_REWORK")) return "REQUEST_REWORK";
  if (target === "SUBMITTED") {
    if (actions.includes("APPROVE") && card.delivery.phase !== "CEO_REVIEW") return "APPROVE";
    if (actions.includes("SUBMIT")) return "SUBMIT";
  }
  if (target === "COMPLETED" && card.delivery.phase === "CEO_REVIEW" && actions.includes("APPROVE")) return "APPROVE";
  return null;
}
