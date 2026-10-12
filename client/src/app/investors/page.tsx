import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { BusinessModel } from "@/components/investors/BusinessModel";
import { CompanyOverview } from "@/components/investors/CompanyOverview";
import { InvestorAccess } from "@/components/investors/InvestorAccess";
import { InvestorHero } from "@/components/investors/InvestorHero";
import { OpportunitySection } from "@/components/investors/OpportunitySection";
import { ProductShowcase } from "@/components/investors/ProductShowcase";
import { RicozEcosystem } from "@/components/investors/RicozEcosystem";
import { VisionAndGrowth } from "@/components/investors/VisionAndGrowth";
import { WhatWeAreBuilding } from "@/components/investors/WhatWeAreBuilding";
import { WhyRicoz } from "@/components/investors/WhyRicoz";

export const metadata: Metadata = {
  title: "Investors | Ricoz",
  description:
    "Discover Ricoz at a high level: a technology company building products, services, and business solutions for modern businesses.",
  openGraph: {
    title: "Investors | Ricoz",
    description:
      "Explore the Ricoz ecosystem and continue into the investor experience for additional company information.",
  },
};

export default function InvestorsPage() {
  return (
    <main className="bg-(--brand-background) text-(--brand-text)">
      <LandingNavbar />
      <InvestorHero />
      <CompanyOverview />
      <WhatWeAreBuilding />
      <RicozEcosystem />
      <ProductShowcase />
      <OpportunitySection />
      <WhyRicoz />
      <BusinessModel />
      <VisionAndGrowth />
      <InvestorAccess />
      <LandingFooter />
    </main>
  );
}
