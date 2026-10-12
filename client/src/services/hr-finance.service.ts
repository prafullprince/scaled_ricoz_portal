import api from "./axios";

export type PayComponentType =
  | "BASE"
  | "ALLOWANCE"
  | "BONUS"
  | "INCENTIVE"
  | "DEDUCTION"
  | "OTHER";

export type PayComponentCadence = "MONTHLY" | "ANNUAL";
export type PayrollAdjustmentType = "BONUS" | "INCENTIVE" | "DEDUCTION";

export interface PayComponent {
  type: PayComponentType;
  label: string;
  amount: number;
  cadence: PayComponentCadence;
}

export interface SalaryStructure {
  effectiveFrom: string;
  currency: string;
  components: PayComponent[];
}

export interface SalaryRevision extends SalaryStructure {
  id: string;
  reason: string;
  changedAt: string;
}

export interface PayrollAdjustment {
  id: string;
  type: PayrollAdjustmentType;
  label: string;
  amount: number;
  currency: string;
  payPeriod: string;
  note: string;
  createdAt: string;
}

export interface Payslip {
  id: string;
  payPeriod: string;
  currency: string;
  fileName: string;
  fileSize: number;
  publishedAt: string;
}

export interface FinanceEmployee {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  salaryStructure: SalaryStructure | null;
}

export interface EmployeeFinanceDetails {
  employee: Omit<FinanceEmployee, "salaryStructure">;
  salaryStructure: SalaryStructure | null;
  revisionHistory: SalaryRevision[];
  adjustments: PayrollAdjustment[];
  payslips: Payslip[];
}

export const HrFinanceService = {
  async employees() {
    return (await api.get<{ employees: FinanceEmployee[] }>("/hr/finance/employees")).data.employees;
  },
  async employee(employeeId: string) {
    return (await api.get<EmployeeFinanceDetails>(`/hr/finance/employees/${encodeURIComponent(employeeId)}`)).data;
  },
  async saveStructure(employeeId: string, input: {
    effectiveFrom: string;
    currency: string;
    components: PayComponent[];
    reason?: string;
  }) {
    return (await api.put<{ salaryStructure: SalaryStructure; revisionHistory: SalaryRevision[] }>(
      `/hr/finance/employees/${encodeURIComponent(employeeId)}/structure`,
      input,
    )).data;
  },
  async addAdjustment(employeeId: string, input: {
    type: PayrollAdjustmentType;
    label: string;
    amount: number;
    currency: string;
    payPeriod: string;
    note?: string;
  }) {
    return (await api.post<{ adjustment: PayrollAdjustment }>(
      `/hr/finance/employees/${encodeURIComponent(employeeId)}/adjustments`,
      input,
    )).data.adjustment;
  },
  async generatePayslip(employeeId: string, payPeriod: string) {
    return (await api.post<{ payslip: Payslip }>(
      `/hr/finance/employees/${encodeURIComponent(employeeId)}/payslips/generate`,
      { payPeriod },
    )).data.payslip;
  },
  async payslipFile(payslipId: string) {
    return (await api.get<Blob>(`/hr/finance/payslips/${encodeURIComponent(payslipId)}/file`, {
      responseType: "blob",
    })).data;
  },
  async myPayslips() {
    return (await api.get<{ payslips: Payslip[] }>("/hr/finance/me/payslips")).data.payslips;
  },
  async myPayslipFile(payslipId: string) {
    return (await api.get<Blob>(
      `/hr/finance/me/payslips/${encodeURIComponent(payslipId)}/file`,
      { responseType: "blob" },
    )).data;
  },
};
