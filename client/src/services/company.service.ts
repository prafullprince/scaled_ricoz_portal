import api from "./axios";
import { getActiveCompanyId, setActiveCompanyId } from "@/lib/company";
import type { IUser } from "@/redux/slice/auth.slice";

export type Company = {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
  is_home?: boolean;
  assigned_hr?: boolean;
  organization_parent_company_id?: string | null;
  organization_anchor_user_id?: string | null;
  assignments?: Array<{ level: string; department: string; roles: string[] }>;
  description: string;
  industry: string;
  category: string;
  created_at: string;
  stats: { members: number; products: number; active_tasks: number };
};

export type CompanyInput = { name: string; description?: string; industry?: string; category?: string };
export type CompanyCategory = { id: string | null; name: string };
export type InvestorAccessInvestor = { id: string; name: string; email: string; status: string };
export type InvestorAccessCompany = { id: string; name: string; category: string };
export type InvestorCompanyAccessOverview = {
  investors: InvestorAccessInvestor[];
  companies: InvestorAccessCompany[];
  grants: Array<{ investorId: string; companyId: string }>;
};

export type CompanyPerson = {
  id: string;
  name: string;
  email: string;
  status: string;
  level: string;
  department: string;
  designation: string | null;
  employment_type: string | null;
  since: string;
};

export type CompanyOverview = {
  company: Omit<Company, "stats">;
  people: { department: CompanyPerson[]; employees: CompanyPerson[]; interns: CompanyPerson[] };
  departments: Array<{ department: string; total: number }>;
  stats: {
    members: number;
    heads: number;
    managers: number;
    employees: number;
    interns: number;
    products: number;
    products_by_status: { unassigned: number; development: number; production: number };
    tasks: number;
    pending_tasks: number;
    completed_tasks: number;
    pending_leave: number;
    attendance_this_month: number;
  };
};

export const CompanyService = {
  async activate(id: string) {
    const previousId = getActiveCompanyId();
    setActiveCompanyId(id);
    try {
      const response = await api.get<{ user: IUser }>("/auth/me");
      if (response.data.user.company?.id !== id) {
        throw new Error("The server could not activate that company. Check your company access and try again.");
      }
      return response.data.user;
    } catch (error) {
      setActiveCompanyId(previousId);
      throw error;
    }
  },
  async current() {
    const response = await api.get<{
      can_switch_company: boolean;
      can_create_company: boolean;
      can_view_company_admin_pages: boolean;
    }>("/companies/current");
    return response.data;
  },
  async list(filters: { search?: string; category?: string } = {}) {
    const response = await api.get<{ companies: Company[] }>("/companies", { params: filters });
    return response.data.companies;
  },
  async categories() {
    const response = await api.get<{ categories: CompanyCategory[] }>("/companies/categories");
    return response.data.categories;
  },
  async createCategory(name: string) {
    const response = await api.post<{ category: CompanyCategory }>("/companies/categories", { name });
    return response.data.category;
  },
  async create(input: CompanyInput) {
    const response = await api.post<{ company: Company }>("/companies", input);
    return response.data.company;
  },
  async update(id: string, input: CompanyInput) {
    const response = await api.patch<{ company: Company }>(`/companies/${id}`, input);
    return response.data.company;
  },
  async setOrganizationParent(
    id: string,
    parentCompanyId: string,
    anchorUserId: string,
  ) {
    await api.patch(`/companies/${id}/organization-parent`, {
      parentCompanyId,
      anchorUserId,
    });
  },
  async requestOrganizationRemoval(id: string) {
    const response = await api.post<{ message: string }>(
      `/companies/${id}/organization-parent/remove/request`,
      {},
    );
    return response.data.message;
  },
  async confirmOrganizationRemoval(id: string, otp: string) {
    const response = await api.post<{
      removedAssignments: number;
      message: string;
    }>(`/companies/${id}/organization-parent/remove/confirm`, { otp });
    return response.data;
  },
  async overview(id: string) {
    const response = await api.get<CompanyOverview>(`/companies/${id}/overview`);
    return response.data;
  },
  async investorCompanyAccess() {
    const response = await api.get<InvestorCompanyAccessOverview>("/companies/investor-access");
    return response.data;
  },
  async updateInvestorCompanyAccess(investorId: string, companyIds: string[]) {
    await api.put(`/companies/investor-access/${investorId}`, { companyIds });
  },
};
