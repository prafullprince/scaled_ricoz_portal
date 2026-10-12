import type { SalesLeadPage } from "../../types/sales";

export function scopeBoardPage(page: SalesLeadPage, pipelineKey: string, stageKey: string) {
  const leads = page.leads.filter((lead) =>
    (lead.pipeline || "Sales") === pipelineKey && (lead.stageId ?? lead.status) === stageKey,
  );
  return { page: { ...page, leads }, rejected: leads.length !== page.leads.length };
}