import Link from "next/link";
import type { Solution } from "@/lib/solutions/solutions";

interface SolutionCardProps { solution: Solution; }

export function SolutionCard({ solution }: SolutionCardProps) {
  const Icon = solution.icon;
  return (
    <article id={solution.id} className="group flex h-full scroll-mt-24 flex-col rounded-[22px] border border-[var(--brand-border)] bg-[var(--brand-background)] p-5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--brand-border-strong)] hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-[var(--brand-red-pale)] text-[var(--brand-red)]"><Icon size={19} aria-hidden="true" /></span><span className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-gray)]">{solution.category}</span></div>
      <h3 className="mt-5 text-xl font-bold tracking-[-0.04em] text-[var(--brand-navy)]">{solution.title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--brand-text-secondary)]">{solution.description}</p>
      <div className="mt-5 border-t border-[var(--brand-border)] pt-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-gray)]">Outcome</p><p className="mt-2 text-sm font-medium leading-6 text-[var(--brand-navy)]">{solution.outcome}</p></div>
      <div className="mt-auto pt-5"><Link href="/products" className="text-xs font-semibold text-[var(--brand-gray)]">Explore published products</Link><Link href="#solutions-contact" className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--brand-red)]">Explore solution <span aria-hidden="true">→</span></Link></div>
    </article>
  );
}
