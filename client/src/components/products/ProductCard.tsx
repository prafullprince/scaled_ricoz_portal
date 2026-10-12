import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { productPath, productStatusLabels, type PublicProduct } from "@/lib/products/catalogue";
import { PublicProductMark } from "./PublicProductMark";

export function ProductCard({ product }: { product: PublicProduct }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-(--brand-border) bg-white shadow-(--shadow-sm) hover:-translate-y-1 hover:border-(--brand-red)/25 hover:shadow-(--shadow-xl) transition-all duration-300">
      <div className="relative aspect-[16/9] min-h-48 overflow-hidden bg-[radial-gradient(circle_at_50%_40%,rgba(201,29,32,0.2),transparent_38%),linear-gradient(135deg,#101a2c,#24324b)]">
        <PublicProductMark product={product} large cover />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 z-10 size-48 rounded-full border border-white/10" />
        <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-10 z-10 size-32 rounded-full border border-white/10" />
        <span className="absolute left-4 top-4 z-20 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-md">
          {productStatusLabels[product.status]}
        </span>
        {product.category ? (
          <span className="absolute bottom-4 right-4 z-20 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[10px] font-semibold text-white/85 backdrop-blur-md">
            {product.category}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <h3 className="text-xl font-bold tracking-[-0.03em] text-(--brand-navy) transition-colors group-hover:text-(--brand-red)">{product.title}</h3>
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-(--brand-text-secondary)">{product.summary || product.description}</p>
        {product.techStack.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {product.techStack.slice(0, 3).map((technology) => (
              <span key={technology} className="rounded-full border border-(--brand-border) bg-(--brand-surface) px-2.5 py-1 text-[10px] font-medium text-(--brand-text-secondary)">
                {technology}
              </span>
            ))}
          </div>
        ) : null}
        <Link href={productPath(product)} className="mt-6 inline-flex items-center justify-between border-t border-(--brand-border) pt-4 text-sm font-bold text-(--brand-navy) transition-colors hover:text-(--brand-red)">
          Explore product
          <span className="flex size-9 items-center justify-center rounded-full bg-(--brand-red-pale) text-(--brand-red) transition-transform group-hover:translate-x-0.5">
            <ArrowUpRight size={17} aria-hidden="true" />
          </span>
        </Link>
      </div>
    </article>
  );
}
