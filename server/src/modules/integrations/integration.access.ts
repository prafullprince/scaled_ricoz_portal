export type IntegrationKind = "CANDIDATE" | "LEAD";

export function narrowIntegrationKinds(allowed: readonly IntegrationKind[], requested: unknown): IntegrationKind[] | null {
  if (requested === undefined) return [...allowed];
  if (requested !== "CANDIDATE" && requested !== "LEAD") return null;
  return allowed.includes(requested) ? [requested] : null;
}

export function integrationKindsForAccess(
  roles: readonly string[],
  isSalesMember: boolean,
  scopedDepartment?: string | null,
): IntegrationKind[] {
  if (roles.includes("ADMIN") || roles.includes("CEO")) {
    if (scopedDepartment === "HR") return ["CANDIDATE"];
    if (scopedDepartment === "SALES") return ["LEAD"];
    return ["CANDIDATE", "LEAD"];
  }
  if (roles.includes("HR")) return ["CANDIDATE"];
  if (isSalesMember) return ["LEAD"];
  return [];
}
