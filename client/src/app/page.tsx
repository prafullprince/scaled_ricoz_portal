import type { Metadata } from "next";
import { Suspense } from "react";
import { BuildAccordion } from "@/components/landing/BuildAccordion";
import { CapabilityTiles } from "@/components/landing/CapabilityTiles";
import { CareersBand, ContactBand } from "@/components/landing/CareersBand";
import { CompanyStats } from "@/components/landing/CompanyStats";
import { ExploreRicoz } from "@/components/landing/ExploreRicoz";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { ProductSection } from "@/components/landing/ProductSection";
import { WhatsNew } from "@/components/landing/WhatsNew";
import styles from "@/components/landing/InvestorLanding.module.css";
import {
  AnimatedSection,
  LandingMotion,
} from "@/components/landing/LandingMotion";
import { ProductFactoryAnimation } from "@/components/landing/ProductFactoryAnimation";

export const metadata: Metadata = {
  title: "Ricoz Innovation | Product Factory",
  description:
    "Explore the Ricoz Product Factory: products across every lifecycle stage, technology, and investor information from Ricoz Innovation.",
};

const loading = (
  <div className="container-ricoz py-16 text-sm text-(--brand-gray)" role="status">
    Loading Ricoz content...
  </div>
);

export default function Home() {
  return (
    <main
      className={`${styles.page} bg-(--brand-background) text-(--brand-text)`}
    >
      <LandingNavbar />
      <LandingMotion>
        <AnimatedSection index={0} stackable>
          <ProductFactoryAnimation />
        </AnimatedSection>
        <AnimatedSection index={1}>
          <Suspense fallback={loading}>
            <WhatsNew />
          </Suspense>
        </AnimatedSection>
        <AnimatedSection index={2}>
          <CapabilityTiles />
        </AnimatedSection>
        <AnimatedSection index={3}>
          <Suspense fallback={loading}>
            <ProductSection />
          </Suspense>
        </AnimatedSection>
        <AnimatedSection index={4} stackable>
          <Suspense fallback={null}>
            <CompanyStats />
          </Suspense>
        </AnimatedSection>
        <AnimatedSection index={5} stackable>
          <BuildAccordion />
        </AnimatedSection>
        <AnimatedSection index={6} stackable>
          <ExploreRicoz />
        </AnimatedSection>
        <AnimatedSection index={7} stackable>
          <CareersBand />
        </AnimatedSection>
        <AnimatedSection index={8} stackable>
          <ContactBand />
        </AnimatedSection>
        <AnimatedSection index={9}>
          <LandingFooter />
        </AnimatedSection>
      </LandingMotion>
    </main>
  );
}
