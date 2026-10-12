import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { BusinessChallenges } from "@/components/solutions/BusinessChallenges";
import { FeaturedSolution } from "@/components/solutions/FeaturedSolution";
import { ProblemSolutionOutcome } from "@/components/solutions/ProblemSolutionOutcome";
import { ProductServiceConnection } from "@/components/solutions/ProductServiceConnection";
import { SolutionCategories } from "@/components/solutions/SolutionCategories";
import { SolutionProcess } from "@/components/solutions/SolutionProcess";
import { SolutionsCTA } from "@/components/solutions/SolutionsCTA";
import { SolutionsHero } from "@/components/solutions/SolutionsHero";
import { TechnologyCapabilities } from "@/components/solutions/TechnologyCapabilities";
import { WhoWeHelp } from "@/components/solutions/WhoWeHelp";

export const metadata: Metadata = {
  title: "Solutions | Ricoz",
  description:
    "Explore Ricoz solutions for financial operations, business automation, digital products, custom software, AI-enabled workflows, and connected communication.",
  openGraph: {
    title: "Solutions | Ricoz",
    description:
      "Technology solutions designed around real business challenges and useful outcomes.",
  },
};

export default function SolutionsPage() {
  return (
    <main className="bg-(--brand-background) text-(--brand-text)">
      <LandingNavbar />
      <SolutionsHero />
      <BusinessChallenges />
      <SolutionCategories />
      <FeaturedSolution />
      <ProblemSolutionOutcome />
      <ProductServiceConnection />
      <WhoWeHelp />
      <SolutionProcess />
      <TechnologyCapabilities />
      <SolutionsCTA />
      <LandingFooter />
    </main>
  );
}
