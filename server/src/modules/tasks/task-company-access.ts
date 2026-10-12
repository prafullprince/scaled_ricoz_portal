import type { NextFunction, Request, Response } from "express";
import { currentScope, getDefaultCompanyId } from "../company/company.context.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { requestRoles } from "../organization/organization.roles.js";
import { UserRole } from "../auth/authorization.js";

const companyWideTaskRoles = [UserRole.CEO, UserRole.ADMIN, UserRole.HR];

export function canReadTaskCompany(
  accountRoles: readonly string[],
  companyRoles: readonly string[],
  homeCompanyId: string | null | undefined,
  activeCompanyId: string,
  defaultCompanyId: string,
) {
  const hasCompanyWideTaskRole = [...accountRoles, ...companyRoles].some((role) => companyWideTaskRoles.includes(role as UserRole));
  if (!hasCompanyWideTaskRole || !homeCompanyId || homeCompanyId === defaultCompanyId) return true;
  return homeCompanyId === activeCompanyId;
}

export function restrictTaskCompanyReads(req: Request, _res: Response, next: NextFunction) {
  const accountRoles = req.authUser?.roles ?? [];
  const companyRoles = requestRoles(req);
  if (![...accountRoles, ...companyRoles].some((role) => companyWideTaskRoles.includes(role))) return next();

  const scope = currentScope();
  if (!scope) return next(new ApiError(403, "Task access requires an active company scope"));

  const defaultCompanyId = String(getDefaultCompanyId());
  if (!canReadTaskCompany(accountRoles, companyRoles, req.authUser?.companyId ? String(req.authUser.companyId) : null, String(scope.companyId), defaultCompanyId)) {
    return next(new ApiError(403, "Task reports and tasks are restricted to your company"));
  }
  return next();
}
