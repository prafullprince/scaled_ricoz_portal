import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { ServiceDetail } from "@/components/services/ServiceDetail";

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  return <><LandingNavbar /><ServiceDetail slug={(await params).slug} /><LandingFooter /></>;
}
