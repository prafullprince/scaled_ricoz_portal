import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { getPublicCatalogue } from "@/lib/products/catalogue.server";
import { CatalogueNotice } from "@/components/products/CatalogueNotice";
import { FactoryPortfolio } from "./FactoryPortfolio";

export async function ProductSection() {
  const result = await getPublicCatalogue("stages=all");
  return (
    <section
      id="products"
      className="relative isolate scroll-mt-24 overflow-hidden border-y border-(--brand-border) bg-[radial-gradient(ellipse_at_88%_4%,rgba(201,29,32,0.09),transparent_34%),linear-gradient(180deg,var(--brand-background),var(--brand-surface))] py-16 md:py-24"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-36 top-20 size-96 rounded-full border border-(--brand-red)/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-36 size-64 rounded-full border border-(--brand-red)/10" />
      <div className="container-ricoz relative">
        <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-(--brand-red)/15 bg-(--brand-red-pale) px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
              <Sparkles size={14} aria-hidden="true" />
              Product Factory · Every lifecycle stage
            </p>
            <h2 className="mt-5! text-4xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-6xl">
              Product stories<span className="text-(--brand-red)">.</span>
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-(--brand-text-secondary) md:text-lg">
              Explore products at every stage—Unassigned, Development, and
              Production—along with the problems they solve and the technology
              behind them.
            </p>
          </div>
          <Link
            href="/products"
            className="ricoz-button-secondary self-start rounded-full! px-5! md:self-auto"
          >
            View all products <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-10 md:mt-14">
          {!result.ok || !result.data.products.length
            ? <CatalogueNotice result={result} />
            : <FactoryPortfolio catalogue={result.data} />}
        </div>
      </div>
    </section>
  );
}
