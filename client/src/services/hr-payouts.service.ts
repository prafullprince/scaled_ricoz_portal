import api from "./axios";

export type PayoutMethodType = "BANK_ACCOUNT" | "VPA";
export type PayoutMode = "IMPS" | "NEFT" | "RTGS" | "UPI";
export type PayoutStatus =
  | "REQUESTED"
  | "CREATED"
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "PROCESSED"
  | "REJECTED"
  | "FAILED"
  | "REVERSED"
  | "CANCELLED";

export interface PayoutMethod {
  accountType: PayoutMethodType;
  displayLabel: string;
}

export interface PayoutRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  payPeriod: string;
  amount: number;
  currency: "INR";
  mode: PayoutMode;
  description: string;
  status: PayoutStatus;
  referenceId: string;
  utr: string | null;
  statusDetails: string;
  createdAt: string;
}

export const HrPayoutsService = {
  async myMethod() {
    return (await api.get<{
      payoutsEnabled: boolean;
      payoutMethod: PayoutMethod | null;
    }>("/hr/finance/me/payout-method")).data;
  },
  async saveMyMethod(input:
    | { accountType: "BANK_ACCOUNT"; name: string; accountNumber: string; ifsc: string }
    | { accountType: "VPA"; address: string },
  ) {
    return (await api.put<{ payoutMethod: PayoutMethod }>("/hr/finance/me/payout-method", input)).data.payoutMethod;
  },
  async myPayouts() {
    return (await api.get<{ payoutsEnabled: boolean; payouts: PayoutRecord[] }>("/hr/finance/me/payouts")).data;
  },
  async employeePayouts(employeeId: string) {
    return (await api.get<{
      payoutsEnabled: boolean;
      payoutMethod: PayoutMethod | null;
      payouts: PayoutRecord[];
    }>(`/hr/finance/employees/${encodeURIComponent(employeeId)}/payouts`)).data;
  },
  async createPayout(employeeId: string, input: {
    clientRequestId: string;
    amount: number;
    payPeriod: string;
    mode: PayoutMode;
    description: string;
  }) {
    return (await api.post<{ payout: PayoutRecord }>(
      `/hr/finance/employees/${encodeURIComponent(employeeId)}/payouts`,
      input,
    )).data.payout;
  },
};
