import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";
import { growthStory } from "@/lib/investors/content";
import { AnimatedCard } from "./LandingMotion";

export function CompanyDirection() {
  return (
    <section id="vision" className="scroll-mt-24 py-14 md:py-20">
      <div className="container-ricoz">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">Vision & direction</p>
            <h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-4xl">Building What Comes Next</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-(--brand-text-secondary)">
              Today, Ricoz brings software products, services, and business-focused implementations together. Our long-term direction is to expand those capabilities and build an ecosystem where technology becomes a business advantage.
            </p>
          </div>
          <aside className="rounded-[22px] border border-(--brand-border) bg-(--brand-surface) p-6 shadow-(--shadow-xs)">
            <UsersRound size={22} className="text-(--brand-red)" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-bold tracking-[-0.04em] text-(--brand-navy)">The team behind the work</h3>
            <p className="mt-3 text-sm leading-6 text-(--brand-text-secondary)">
              Ricoz brings product thinking, engineering, and business understanding into one focused team. Clear problems, careful decisions, and dependable delivery guide how we work.
            </p>
            <Link href="/about" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-(--brand-red) hover:text-(--brand-red-hover)">
              Our approach to building <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </aside>
        </div>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {growthStory.map(([title, description], index) => (
            <li key={title}>
              <AnimatedCard index={index} className="h-full rounded-[18px] border border-(--brand-border) bg-(--brand-background) p-5">
              <p className="text-xs font-semibold tracking-[0.14em] text-(--brand-red)">0{index + 1}</p>
              <h3 className="mt-4 text-lg font-bold text-(--brand-navy)">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">{description}</p>
              </AnimatedCard>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs leading-5 text-(--brand-gray)">Strategic direction, not a timeline or a forecast of financial performance.</p>
      </div>
    </section>
  );
}
