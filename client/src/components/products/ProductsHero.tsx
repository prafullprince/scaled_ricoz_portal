import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ProductsHero() {
  return (
    <section className="border-b border-(--brand-border) bg-(--brand-surface) py-16 text-center md:py-24">
      <div className="container-ricoz">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--brand-red)">Ricoz Product Factory</p>
        <h1 className="mt-5 text-4xl font-black text-(--brand-navy) md:text-6xl">Explore the product directory.</h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-(--brand-text-secondary)">Discover our production products, the technology behind each product, and its place in Ricoz Innovation.</p>
        <Link href="/products" className="ricoz-button-primary mt-7">View products <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
