import { ArrowDown, Check, Lightbulb, TriangleAlert } from "lucide-react";
import { solutions } from "@/lib/solutions/solutions";

export function ProblemSolutionOutcome() {
  const stories = solutions.slice(0, 3);
  return (
    <section className="border-y border-[var(--brand-border)] bg-[var(--brand-surface)] py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">The Ricoz lens</p><h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">Every solution starts with the problem, not the tool.</h2><p className="mt-4 text-base leading-7 text-[var(--brand-text-secondary)]">We connect the business reality to a practical technology response and a useful outcome.</p></div>
        <div className="mt-10 space-y-4">{stories.map((story) => <div key={story.id} className="grid gap-4 rounded-[22px] border border-[var(--brand-border)] bg-white p-5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center md:p-6"><div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-gray)]"><TriangleAlert size={13} className="text-[var(--brand-red)]" /> Problem</p><p className="mt-2 text-sm leading-6 text-[var(--brand-navy)]">{story.problem}</p></div><ArrowDown className="mx-auto text-[var(--brand-red)] md:rotate-[-90deg]" size={18} /><div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-gray)]"><Lightbulb size={13} className="text-[var(--brand-red)]" /> Solution</p><p className="mt-2 text-sm font-semibold leading-6 text-[var(--brand-navy)]">{story.title}</p></div><ArrowDown className="mx-auto text-[var(--brand-red)] md:rotate-[-90deg]" size={18} /><div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-gray)]"><Check size={13} className="text-[var(--brand-red)]" /> Outcome</p><p className="mt-2 text-sm leading-6 text-[var(--brand-navy)]">{story.outcome}</p></div></div>)}</div>
      </div>
    </section>
  );
}
