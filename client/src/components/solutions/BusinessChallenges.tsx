import Link from "next/link";
import { businessChallenges } from "@/lib/solutions/solutions";

export function BusinessChallenges() {
  return (
    <section className="py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">Start with the problem</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">What are you trying to solve?</h2>
          <p className="mt-4 text-base leading-7 text-[var(--brand-text-secondary)]">Choose the challenge that sounds closest to your situation and explore the way Ricoz can help address it.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {businessChallenges.map(({ title, solution, icon: Icon }) => (
            <Link key={title} href={`#${solution.toLowerCase().replaceAll(" ", "-")}`} className="group flex items-center gap-4 rounded-[18px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-border-strong)] hover:bg-white hover:shadow-[var(--shadow-md)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-[var(--brand-red-pale)] text-[var(--brand-red)]"><Icon size={19} aria-hidden="true" /></span>
              <span className="min-w-0"><span className="block text-sm font-semibold text-[var(--brand-navy)]">{title}</span><span className="mt-1 block text-xs font-medium text-[var(--brand-red)]">Explore {solution} <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span></span></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
