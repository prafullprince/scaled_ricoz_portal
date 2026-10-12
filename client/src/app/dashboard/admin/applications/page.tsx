import { AdminRecruitmentView } from "@/components/dashboard/AdminRecruitmentView";

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const opportunityId =
    typeof params.opportunity === "string" ? params.opportunity : undefined;
  const candidateSearch =
    typeof params.candidate === "string" ? params.candidate : undefined;

  return (
    <AdminRecruitmentView
      key={opportunityId ?? candidateSearch ?? "all-applications"}
      applicationsOnly
      initialOpportunityId={opportunityId}
      initialApplicantSearch={candidateSearch}
    />
  );
}