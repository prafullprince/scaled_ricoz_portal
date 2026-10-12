const STORAGE_KEY = "ricoz-active-company";

export type CompanySummary = {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
};

export function getActiveCompanyId() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveCompanyId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing; the server falls back to the home company.
  }
}

export function companyHeaders(): Record<string, string> {
  const id = getActiveCompanyId();
  return id ? { "X-Company-Id": id } : {};
}
