import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LiveCareersBrowser } from "@/components/careers/LiveCareersBrowser";

export const metadata: Metadata = {
  title: "Jobs and Internships | Ricoz Careers",
  description:
    "Browse current jobs and internships from companies hiring through Ricoz.",
  openGraph: {
    title: "Jobs and Internships | Ricoz Careers",
    description: "Explore current job and internship opportunities.",
  },
};

export default function CareersPage() {
  return (
    <>
      <LandingNavbar />
      <main className="bg-[#f7f7f7] text-(--brand-text)">
        <LiveCareersBrowser />
      </main>
      <LandingFooter />
    </>
  );
}
