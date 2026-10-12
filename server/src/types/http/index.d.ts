import "http";
import type { AuthenticatedUser, Permission } from "../../modules/auth/authorization.js";
import type { ICompany } from "../../models/company.models.js";

export interface IUserPayload {
  id: string;
  name: string;
  email: string;
}

declare module "http" {
  interface IncomingMessage {
    user?: IUserPayload;
  }
}

declare global {
  namespace Express {
    interface Request {
    User?: IUserPayload;
    authUser?: AuthenticatedUser;
    companyRoles?: string[];
    companyPermissions?: Permission[];
    companyPermissionRoles?: string[];
    company?: ICompany;
    }
  }
}
