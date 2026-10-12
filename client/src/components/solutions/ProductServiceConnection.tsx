import { ArrowDown, Boxes, Code2, Layers3 } from "lucide-react";
import { solutions } from "@/lib/solutions/solutions";
import Link from "next/link";

export function ProductServiceConnection() {
  const solution = solutions.find((item) => item.id === "business-automation") ?? solutions[1];
  return (
    <section className="py-20">
      <div className="container-ricoz">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">The Ricoz advantage</p><h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">Products, services, and technology working as one solution.</h2><p className="mt-4 text-base leading-7 text-[var(--brand-text-secondary)]">Some business challenges need a product. Others need custom development around an existing product. Ricoz can bring the right pieces together around the problem.</p></div>
          <div className="rounded-[24px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 md:p-7"><div className="grid gap-3 md:grid-cols-3"><div className="rounded-[16px] border border-[var(--brand-border)] bg-white p-4"><Boxes size={18} className="text-[var(--brand-red)]" /><p className="mt-4 text-sm font-semibold text-[var(--brand-navy)]">Products</p><Link href="/products" className="mt-2 block text-xs leading-5 text-[var(--brand-red)]">Explore the published portfolio</Link></div><div className="rounded-[16px] border border-[var(--brand-border)] bg-white p-4"><Code2 size={18} className="text-[var(--brand-red)]" /><p className="mt-4 text-sm font-semibold text-[var(--brand-navy)]">Services</p><p className="mt-2 text-xs leading-5 text-[var(--brand-text-secondary)]">{solution.services.join(" + ")}</p></div><div className="rounded-[16px] border border-[var(--brand-border)] bg-white p-4"><Layers3 size={18} className="text-[var(--brand-red)]" /><p className="mt-4 text-sm font-semibold text-[var(--brand-navy)]">Technology</p><p className="mt-2 text-xs leading-5 text-[var(--brand-text-secondary)]">APIs, data, cloud, and interfaces</p></div></div><div className="flex justify-center py-3"><ArrowDown size={18} className="text-[var(--brand-red)]" /></div><div className="rounded-[16px] bg-[var(--brand-navy)] p-5 text-white"><p className="text-xs uppercase tracking-[0.14em] text-white/55">Business outcome</p><p className="mt-2 text-base font-semibold">{solution.outcome}</p></div></div>
        </div>
      </div>
    </section>
  );
}
