import { Compass, Layers3, Network, Workflow } from "lucide-react";
import { strategicReasons } from "@/lib/investors/content";
import { AnimatedCard } from "./LandingMotion";

const reasons = [
  {
    title: "A connected company direction",
    description: strategicReasons[0],
    icon: Network,
  },
  {
    title: "Business-led problem solving",
    description: strategicReasons[1],
    icon: Compass,
  },
  {
    title: "Focused product building",
    description: strategicReasons[2],
    icon: Layers3,
  },
  {
    title: "Capabilities across business needs",
    description: strategicReasons[3],
    icon: Workflow,
  },
];

export function WhyRicoz() {
  return (
    <section id="why-ricoz" className="scroll-mt-24 py-14 md:py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
            Why Ricoz
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
            The principles behind the portfolio.
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {reasons.map(({ title, description, icon: Icon }, index) => (
            <AnimatedCard key={title} index={index} className="rounded-[22px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 shadow-[var(--shadow-sm)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[var(--brand-red-pale)] text-[var(--brand-red)]">
                <Icon size={20} />
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-[-0.04em] text-[var(--brand-navy)]">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--brand-text-secondary)]">
                {description}
              </p>
            </AnimatedCard>
          ))}
        </div>
      </div>
    </section>
  );
}
