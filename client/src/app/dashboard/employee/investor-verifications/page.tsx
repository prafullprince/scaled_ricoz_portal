import type { Metadata } from "next";
import { InvestorVerificationQueue } from "@/components/dashboard/employee/InvestorVerificationQueue";

export const metadata: Metadata = { title: "Investor Verifications | Ricoz" };

export default function EmployeeInvestorVerificationsPage() {
  return <InvestorVerificationQueue />;
}
