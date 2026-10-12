import Link from "next/link";
import { getPublicCatalogue } from "@/lib/products/catalogue.server";

export async function ProductEcosystem() {
  const result = await getPublicCatalogue();
  if (!result.ok || !result.data.facets.categories.length) return null;
  return (
    <section className="border-y border-(--brand-border) bg-(--brand-surface) py-16">
      <div className="container-ricoz">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--brand-red)">Explore the ecosystem</p>
        <h2 className="mt-4 text-3xl font-black text-(--brand-navy)">Production products across our categories.</h2>
        <div className="mt-8 flex flex-wrap gap-4">{result.data.facets.categories.map((facet) => <Link key={facet.value} href={`/products?category=${encodeURIComponent(facet.value)}`} className="rounded-[18px] border border-(--brand-border) bg-white px-6 py-5 text-sm font-semibold text-(--brand-navy) hover:text-(--brand-red)">{facet.value} <span className="ml-3 text-(--brand-gray)">{facet.count}</span></Link>)}</div>
      </div>
    </section>
  );
}
