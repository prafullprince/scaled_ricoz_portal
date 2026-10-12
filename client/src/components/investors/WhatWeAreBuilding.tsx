import { buildingStages } from "@/lib/investors/content";

export function WhatWeAreBuilding() {
  return (
    <section className="border-y border-(--brand-border) bg-(--brand-surface) py-16 md:py-24">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">What Ricoz is building</p>
          <h2 className="mt-3! text-3xl font-black leading-tight tracking-[-0.055em] text-(--brand-navy) md:text-4xl">
            Not isolated software. A connected way to create value.
          </h2>
          <p className="mt-4! text-base leading-7 text-(--brand-text-secondary)">
            Ricoz starts with business problems and builds the products, capabilities,
            and solutions needed to address them. Over time, those pieces can reinforce
            one another.
          </p>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {buildingStages.map(([number, title, description]) => (
            <article
              key={number}
              className="group relative overflow-hidden rounded-[24px] border border-(--brand-border) bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-(--brand-red)/25 hover:shadow-(--shadow-lg)"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black tracking-[0.12em] text-(--brand-red)">{number}</span>
                <span className="h-px w-10 bg-(--brand-border) transition-all duration-300 group-hover:w-16 group-hover:bg-(--brand-red)" />
              </div>
              <h3 className="mt-8! text-xl font-bold tracking-[-0.04em] text-(--brand-navy)">{title}</h3>
              <p className="mt-2! text-sm leading-6 text-(--brand-text-secondary)">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
