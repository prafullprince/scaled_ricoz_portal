import { ArrowDown, Building2, Cpu, Workflow } from "lucide-react";
import { opportunityThemes } from "@/lib/investors/content";

export function OpportunitySection() {
  const icons = [Building2, Workflow, Cpu];
  return (
    <section className="py-16 md:py-24">
      <div className="container-ricoz grid gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">The opportunity</p>
          <h2 className="mt-3! text-3xl font-black leading-tight tracking-[-0.055em] text-(--brand-navy) md:text-4xl">
            Businesses are still looking for better ways to work.
          </h2>
          <p className="mt-4! text-base leading-7 text-(--brand-text-secondary)">
            Ricoz is focused on the space between business need and usable technology:
            better workflows, clearer financial operations, custom systems, digital
            products, and practical AI.
          </p>
        </div>
        <div className="rounded-[28px] border border-(--brand-border) bg-(--brand-surface) p-4 shadow-sm md:p-6">
          {opportunityThemes.map(([title, description], index) => {
            const Icon = icons[index];
            return (
              <div key={title}>
                <div className="group flex gap-4 rounded-[20px] border border-(--brand-border) bg-white p-4 transition-colors hover:border-(--brand-red)/25 md:p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-(--brand-red-pale) text-(--brand-red) transition-colors group-hover:bg-(--brand-red) group-hover:text-white">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--brand-gray)">{title}</p>
                    <p className="mt-2! text-sm leading-6 text-(--brand-navy)">{description}</p>
                  </div>
                </div>
                {index < opportunityThemes.length - 1 ? (
                  <div className="flex justify-center py-2 text-(--brand-red)" aria-hidden="true">
                    <ArrowDown size={15} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
