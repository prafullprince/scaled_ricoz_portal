import { EngineeringDeliveryReports } from "@/components/dashboard/delivery/EngineeringDeliveryReports";

export default async function ProductEngineeringReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const query = await searchParams;
  return <EngineeringDeliveryReports initialDepartment={query.department} />;
}
