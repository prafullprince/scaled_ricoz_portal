import type { Metadata } from "next";
import { BuildWithRicoz } from "@/components/products/BuildWithRicoz";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { CustomSoftwareSection } from "@/components/services/CustomSoftwareSection";
import { ProblemSolutions } from "@/components/services/ProblemSolutions";
import { ServiceProcess } from "@/components/services/ServiceProcess";
import { ServicesHero } from "@/components/services/ServicesHero";
import { TechnologyStack } from "@/components/services/TechnologyStack";
import { WhoWeServe } from "@/components/services/WhoWeServe";
import { LiveServicesBrowser } from "@/components/services/LiveServicesBrowser";

export const metadata: Metadata = {
  title: "Services | Ricoz",
  description:
    "Ricoz builds websites, products, internal systems, AI workflows, cloud infrastructure, and business automation experiences for growing companies.",
};

export default function ServicesPage() {
  return (
    <main className="bg-(--brand-background) text-(--brand-text)">
      <LandingNavbar />
      <ServicesHero />
      <LiveServicesBrowser />
      <ProblemSolutions />
      <CustomSoftwareSection />
      <WhoWeServe />
      <ServiceProcess />
      <TechnologyStack />
      <BuildWithRicoz />
      <LandingFooter />
    </main>
  );
}
