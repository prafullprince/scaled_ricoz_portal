import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { OpportunityDetail } from "@/components/careers/OpportunityDetail";
export default async function InternshipDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <><LandingNavbar /><OpportunityDetail key={id} id={id} /><LandingFooter /></>; }