import { solutions } from "@/lib/solutions/solutions";
import { SolutionCard } from "@/components/solutions/SolutionCard";

export function SolutionCategories() {
  return (
    <section id="solution-categories" className="border-y border-[var(--brand-border)] bg-[var(--brand-surface)] py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">Solution categories</p><h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">Business needs, translated into practical technology.</h2></div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{solutions.map((solution) => <SolutionCard key={solution.id} solution={solution} />)}</div>
      </div>
    </section>
  );
}
