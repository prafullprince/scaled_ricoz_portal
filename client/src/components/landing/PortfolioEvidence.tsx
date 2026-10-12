import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { getPublicCatalogue } from "@/lib/products/catalogue.server";
import { productPath, productStatusLabels } from "@/lib/products/catalogue";
import { CatalogueNotice } from "@/components/products/CatalogueNotice";

export async function PortfolioEvidence() {
  const result = await getPublicCatalogue();
  return (
    <section id="traction" className="scroll-mt-24 py-16 md:py-24">
      <div className="container-ricoz grid gap-8 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--brand-red)">Portfolio progress</p>
          <h2 className="mt-4 text-3xl font-black text-(--brand-navy) md:text-4xl">A clear view of what&apos;s taking shape.</h2>
          <p className="mt-5 text-base leading-7 text-(--brand-text-secondary)">Product counts come directly from production records in our database. They describe our portfolio, not customer adoption or financial performance.</p>
          <Link href="/investors" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-(--brand-red)"><LockKeyhole size={16} aria-hidden="true" /> Financial analytics remain behind verified investor access <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {!result.ok || !result.data.pagination.total ? <CatalogueNotice result={result} /> : (
          <dl className="grid grid-cols-2 gap-4">
            <div className="rounded-[22px] border border-(--brand-border) bg-(--brand-surface) p-6"><dd className="text-4xl font-black text-(--brand-navy)">{result.data.pagination.total}</dd><dt className="mt-3 text-sm text-(--brand-gray)">Published products</dt></div>
            {result.data.facets.statuses.map((facet) => <div key={facet.value} className="rounded-[22px] border border-(--brand-border) bg-(--brand-surface) p-6"><dd className="text-4xl font-black text-(--brand-navy)">{facet.count}</dd><dt className="mt-3 text-sm text-(--brand-gray)">{productStatusLabels[facet.value]}</dt></div>)}
          </dl>
        )}
      </div>
    </section>
  );
}

export async function RicozPortfolio() {
  const result = await getPublicCatalogue();
  if (!result.ok || !result.data.products.length) return null;
  return (
    <section id="ecosystem" className="scroll-mt-24 border-y border-(--brand-border) bg-(--brand-surface) py-16 md:py-24">
      <div className="container-ricoz">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--brand-red)">One company. A growing portfolio.</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-black text-(--brand-navy) md:text-4xl">Inside Ricoz Innovation.</h2>
        <div className="mt-8 flex flex-wrap gap-3">
          {result.data.products.map((product) => <Link key={product.id} href={productPath(product)} className="rounded-[14px] border border-(--brand-border) bg-white px-5 py-4 text-sm font-semibold text-(--brand-navy) transition-colors hover:border-(--brand-red-soft) hover:text-(--brand-red)">{product.title}</Link>)}
        </div>
        <Link href="/products" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-(--brand-red)">Explore the complete product directory <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
