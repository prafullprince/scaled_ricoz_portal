import Link from "next/link";
import { ArrowDown, ArrowRight, Compass, Layers3, UsersRound, Workflow } from "lucide-react";
import { investorPillars, opportunityThemes } from "@/lib/investors/content";
import { AnimatedCard } from "./LandingMotion";

const glance = [
  { title: "What we build", description: "Software products, technology services, and business-focused solutions.", icon: Layers3 },
  { title: "Who we serve", description: "Small businesses, growing companies, and the teams running their operations.", icon: UsersRound },
  { title: "Where we focus", description: "Useful products and practical digital systems for everyday business needs.", icon: Workflow },
  { title: "Our direction", description: "A broader ecosystem where useful technology becomes a business advantage.", icon: Compass },
];

const solutionSteps = [
  { label: "Business need", description: "A clearer way to manage everyday work." },
  { label: "Ricoz technology", description: "Product thinking, engineering, and delivery." },
  { label: "Products & solutions", description: "Tools built around practical workflows." },
  { label: "Customer value", description: "Better visibility and less manual work." },
  { label: "Business impact", description: "More informed decisions and coordinated operations." },
];

export function CompanyGlance() {
  return (
    <section id="glance" className="scroll-mt-24 py-14 md:py-20">
      <div className="container-ricoz">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">The company</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-4xl">Ricoz at a Glance</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-(--brand-text-secondary)">
          A technology company connecting product building with practical business delivery.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {glance.map(({ title, description, icon: Icon }, index) => (
            <AnimatedCard key={title} index={index} className="rounded-[22px] border border-(--brand-border) bg-(--brand-surface) p-5 shadow-(--shadow-xs)">
              <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-(--brand-red-pale) text-(--brand-red)">
                <Icon size={19} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-(--brand-navy)">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">{description}</p>
            </AnimatedCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Opportunity() {
  return (
    <section id="opportunity" className="scroll-mt-24 border-y border-(--brand-border) bg-(--brand-surface) py-14 md:py-20">
      <div className="container-ricoz">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">The opportunity</p>
            <h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-4xl">
              Businesses need better systems, not more disconnected tools.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-(--brand-text-secondary)">
            Financial visibility, internal coordination, and useful reporting are recurring needs across modern businesses. Ricoz builds around these everyday problems.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {opportunityThemes.map(([title, description, Icon], index) => (
            <AnimatedCard key={title} index={index} className="rounded-[22px] border border-(--brand-border) bg-white p-6 shadow-(--shadow-xs)">
              <div className="flex items-center justify-between">
                <Icon size={22} className="text-(--brand-red)" aria-hidden="true" />
                <span className="text-xs font-semibold tracking-[0.14em] text-(--brand-gray)">0{index + 1}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-[-0.04em] text-(--brand-navy)">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-(--brand-text-secondary)">{description}</p>
            </AnimatedCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SolutionFlow() {
  return (
    <section id="solutions" className="scroll-mt-24 py-14 md:py-20">
      <div className="container-ricoz">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">Our approach</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-4xl">
          From a real problem to a useful business outcome.
        </h2>
        <ol className="mt-8 grid gap-3 lg:grid-cols-5">
          {solutionSteps.map(({ label, description }, index) => (
            <li key={label}>
              <AnimatedCard index={index} className="relative h-full rounded-[18px] border border-(--brand-border) bg-(--brand-surface) p-5">
              <div className="flex items-center justify-between text-(--brand-red)">
                <span className="text-xs font-bold tracking-[0.12em]">0{index + 1}</span>
                {index < solutionSteps.length - 1 ? (
                  <>
                    <ArrowRight size={16} className="hidden lg:block" aria-hidden="true" />
                    <ArrowDown size={16} className="lg:hidden" aria-hidden="true" />
                  </>
                ) : null}
              </div>
              <h3 className="mt-5 text-base font-bold text-(--brand-navy)">{label}</h3>
              <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">{description}</p>
              </AnimatedCard>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ValueCreation() {
  return (
    <section id="business-model" className="scroll-mt-24 py-14 md:py-20">
      <div className="container-ricoz">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">Business model</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-4xl">How Ricoz Creates Value</h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-(--brand-text-secondary)">
            Our public business model brings three complementary capabilities together. Detailed commercial and financial information is reserved for investor access.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {investorPillars.map(({ title, description, icon: Icon }, index) => (
            <AnimatedCard key={title} index={index} className="rounded-[22px] border border-(--brand-border) bg-(--brand-surface) p-6 shadow-(--shadow-xs)">
              <Icon size={22} className="text-(--brand-red)" aria-hidden="true" />
              <h3 className="mt-5 text-xl font-bold tracking-[-0.04em] text-(--brand-navy)">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-(--brand-text-secondary)">{description}</p>
            </AnimatedCard>
          ))}
        </div>
        <Link href="/investors" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-(--brand-red) hover:text-(--brand-red-hover)">
          Explore the company overview <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
