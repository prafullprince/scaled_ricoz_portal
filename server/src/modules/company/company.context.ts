import { AsyncLocalStorage } from "node:async_hooks";
import { Types } from "mongoose";

export type CompanyScope = {
  companyId: Types.ObjectId;
  isDefault: boolean;
};

const storage = new AsyncLocalStorage<CompanyScope | null>();
let defaultCompanyId: Types.ObjectId | null = null;

export function setDefaultCompanyId(id: Types.ObjectId) {
  defaultCompanyId = id;
}

export function getDefaultCompanyId() {
  if (!defaultCompanyId) throw new Error("The default company has not been initialized");
  return defaultCompanyId;
}

export function hasDefaultCompany() {
  return defaultCompanyId !== null;
}

export function isDefaultCompany(id: Types.ObjectId | string | null | undefined) {
  return !id || String(id) === String(getDefaultCompanyId());
}

export function scopeFor(id: Types.ObjectId | string | null | undefined): CompanyScope {
  const companyId = id ? new Types.ObjectId(String(id)) : getDefaultCompanyId();
  return { companyId, isDefault: isDefaultCompany(companyId) };
}

export function currentScope() {
  return storage.getStore() ?? null;
}

export function runWithCompany<T>(scope: CompanyScope | null, fn: () => T): T {
  return storage.run(scope, fn);
}

// Records created before multi-company support have no companyId and belong to the default company.
export function companyCondition(scope: CompanyScope): Record<string, unknown> {
  return scope.isDefault ? { companyId: { $in: [null, scope.companyId] } } : { companyId: scope.companyId };
}
