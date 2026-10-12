export type SalesDesignation = 'SALES_HEAD' | 'SALES_MANAGER' | 'SALES_EXECUTIVE';
export type SalesEmploymentType = 'EMPLOYEE' | 'INTERN';
export type SalesAccessScope = 'OWN' | 'TEAM' | 'DEPARTMENT';

export interface SalesAccess {
  designation: SalesDesignation | null;
  employmentType: SalesEmploymentType | null;
  reportsTo: string | null;
  scope: SalesAccessScope;
  permissions: string[];
}

export interface SalesPerson { _id: string; name: string; email: string; roles: string[] }
export type SalesTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export interface SalesTask { _id: string; title: string; description: string; deadline: string; priority: SalesTaskPriority; status: 'PENDING' | 'DONE'; effectiveStatus: 'PENDING' | 'DONE' | 'OVERDUE'; assignedTo?: SalesPerson | null }
export interface CreateSalesTaskInput { title: string; description: string; assignedToIds: string[]; priority: SalesTaskPriority; deadline: string }
export interface SalesTeamMember { user: SalesPerson; level: string; designation: SalesDesignation | null; employmentType: SalesEmploymentType | null; reportsTo: string | null; assignable: boolean; activeTasks: number; completedTasks: number; overdueTasks: number }
export interface SalesDashboard {
  scope: SalesAccessScope;
  designation: SalesDesignation | null;
  employmentType: SalesEmploymentType | null;
  metrics: { totalLeads: number; qualifiedLeads: number; openDeals: number; pipelineValue: number; wonRevenue: number; conversionRate: number; pendingTasks: number; overdueTasks: number; dueToday: number; completedTasks: number };
  pipeline: Array<{ stage: string; count: number; value: number }>;
  tasks: SalesTask[];
  team: SalesTeamMember[];
}
export type SalesLeadSource = 'GOOGLE' | 'META' | 'INSTAGRAM' | 'LINKEDIN' | 'WEBSITE' | 'REFERRAL' | 'EMAIL' | 'YOUTUBE' | 'COLD_CALLING' | 'OTHER';
export type SalesLeadPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export interface SalesLead { _id: string; name: string; company?: string; email?: string; phone: string; source: SalesLeadSource; serviceInterest?: string; status: string; priority: SalesLeadPriority; expectedValue: number; currency: string; ownerId: SalesPerson; nextFollowUpAt?: string | null; notes?: string; updatedAt: string }
export interface CreateSalesLeadInput { name: string; company?: string; email?: string; phone: string; source: SalesLeadSource; priority: SalesLeadPriority; expectedValue: number; serviceInterest?: string; nextFollowUpAt?: string; notes?: string }