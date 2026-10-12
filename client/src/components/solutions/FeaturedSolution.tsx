import Link from "next/link";
import { ArrowRight, Check, CreditCard, FileCheck2, ReceiptText } from "lucide-react";
import { solutions } from "@/lib/solutions/solutions";

export function FeaturedSolution() {
  const solution = solutions.find((item) => item.featured) ?? solutions[0];
  return (
    <section className="py-20">
      <div className="container-ricoz">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">Featured solution</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">A clearer way to manage financial operations.</h2>
            <p className="mt-4 text-base leading-7 text-[var(--brand-text-secondary)]">{solution.description} Ricoz technology services can shape the workflow around your business needs. Explore the public product directory for our current portfolio.</p>
            <Link href="#solutions-contact" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-red)]">Discuss your workflow <ArrowRight size={15} /></Link>
          </div>
          <div className="rounded-[26px] border border-[var(--brand-border)] bg-[var(--brand-navy)] p-5 text-white shadow-[var(--shadow-lg)] md:p-7">
            <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--brand-red)]"><CreditCard size={20} /></span><div><p className="text-sm font-semibold">{solution.title}</p><p className="text-xs text-white/60">Business solution</p></div></div><Link href="/products" className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">Product directory</Link></div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-[15px] border border-white/10 bg-white/5 p-4"><ReceiptText size={17} className="text-[var(--brand-red-soft)]" /><p className="mt-3 text-xs text-white/60">Invoices</p><p className="mt-1 text-sm font-semibold">Create and track</p></div><div className="rounded-[15px] border border-white/10 bg-white/5 p-4"><FileCheck2 size={17} className="text-[var(--brand-red-soft)]" /><p className="mt-3 text-xs text-white/60">Expenses</p><p className="mt-1 text-sm font-semibold">Keep organized</p></div><div className="rounded-[15px] border border-white/10 bg-white/5 p-4"><Check size={17} className="text-[var(--brand-red-soft)]" /><p className="mt-3 text-xs text-white/60">Visibility</p><p className="mt-1 text-sm font-semibold">Understand activity</p></div></div>
            <div className="mt-5 border-t border-white/10 pt-5"><p className="text-xs uppercase tracking-[0.14em] text-white/50">Outcome</p><p className="mt-2 text-sm leading-6 text-white/80">{solution.outcome}</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}
