import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPublicCatalogue } from "@/lib/products/catalogue.server";
import { ProductCard } from "@/components/products/ProductCard";
import { CatalogueNotice } from "@/components/products/CatalogueNotice";

export async function ProductShowcase() {
  const result = await getPublicCatalogue("status=production&limit=3");
  return (
    <section className="border-y border-(--brand-border) bg-[linear-gradient(180deg,var(--brand-surface),var(--brand-background))] py-16 md:py-24">
      <div className="container-ricoz">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">The Product Factory</p>
            <h2 className="mt-3! text-3xl font-black leading-tight tracking-[-0.055em] text-(--brand-navy) md:text-4xl">
              Explore the published portfolio.
            </h2>
            <p className="mt-3! max-w-2xl text-base leading-7 text-(--brand-text-secondary)">
              Discover products built to solve practical problems for modern businesses.
            </p>
          </div>
          <Link href="/products" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-(--brand-red) transition-colors hover:text-(--brand-navy)">
            Full product directory <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-9">
          {!result.ok || !result.data.products.length ? (
            <CatalogueNotice result={result} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {result.data.products.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
