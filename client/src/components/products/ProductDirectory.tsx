"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { productStatusLabels, type CatalogueResult } from "@/lib/products/catalogue";
import { ProductCard } from "./ProductCard";

export function ProductDirectory({ result, query }: { result: CatalogueResult; query: string }) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = new URLSearchParams(query);
  const filtered = Boolean(params.get("search") || params.get("category") || params.get("technology") || params.get("status"));

  function pagePath(page: number) {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `/products?${next}`;
  }

  return (
    <Form action="/products" className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-7">
      <input type="hidden" name="stages" value="all" />
      <button type="button" aria-expanded={filtersOpen} aria-controls="directory-filters" onClick={() => setFiltersOpen(!filtersOpen)} className="ricoz-button-secondary min-h-12 rounded-2xl! bg-white! shadow-(--shadow-xs) lg:hidden!">
        <SlidersHorizontal size={16} aria-hidden="true" /> {filtersOpen ? "Hide filters" : "Filter products"}
      </button>
      <aside id="directory-filters" className={`${filtersOpen ? "block" : "hidden"} self-start rounded-3xl border border-(--brand-border) bg-white p-5 shadow-(--shadow-sm) lg:sticky lg:top-24 lg:block`}>
        <div className="flex items-center justify-between border-b border-(--brand-border) pb-4">
          <span className="text-sm font-bold text-(--brand-navy)">Refine products</span>
          <Link href="/products" className="rounded-full px-2 py-1 text-xs font-semibold text-(--brand-red) transition-colors hover:bg-(--brand-red-pale)">Clear</Link>
        </div>
        {result.ok ? (
          <>
            {result.data.facets.categories.length ? (
              <fieldset className="mt-5">
                <legend className="text-sm font-bold text-(--brand-navy)">Category</legend>
                <label className="mt-3 flex items-center gap-2 text-sm text-(--brand-text-secondary)"><input type="radio" name="category" value="" defaultChecked={!params.get("category")} className="accent-(--brand-red)" /> All categories</label>
                {result.data.facets.categories.map((facet) => <label key={facet.value} className="mt-3 flex items-center justify-between gap-2 text-sm text-(--brand-text-secondary)"><span className="flex items-center gap-2"><input type="radio" name="category" value={facet.value} defaultChecked={params.get("category") === facet.value} className="accent-(--brand-red)" />{facet.value}</span><span className="rounded bg-white px-1.5 py-0.5 text-xs text-(--brand-gray)">{facet.count}</span></label>)}
              </fieldset>
            ) : null}
            <fieldset className="mt-5 border-t border-(--brand-border) pt-5">
              <legend className="pt-5 text-sm font-bold text-(--brand-navy)">Product status</legend>
              <label className="mt-3 flex items-center gap-2 text-sm text-(--brand-text-secondary)"><input type="radio" name="status" value="" defaultChecked={!params.get("status")} className="accent-(--brand-red)" /> All statuses</label>
              {result.data.facets.statuses.map((facet) => <label key={facet.value} className="mt-3 flex items-center justify-between gap-2 text-sm text-(--brand-text-secondary)"><span className="flex items-center gap-2"><input type="radio" name="status" value={facet.value} defaultChecked={params.get("status") === facet.value} className="accent-(--brand-red)" />{productStatusLabels[facet.value]}</span><span className="rounded bg-white px-1.5 py-0.5 text-xs text-(--brand-gray)">{facet.count}</span></label>)}
            </fieldset>
            {result.data.facets.technologies.length ? (
              <label className="mt-6 block border-t border-(--brand-border) pt-5 text-sm font-bold text-(--brand-navy)">
                Technology
                <select name="technology" defaultValue={params.get("technology") || ""} className="ricoz-input mt-3 font-normal">
                  <option value="">All technologies</option>
                  {result.data.facets.technologies.map((facet) => <option key={facet.value} value={facet.value}>{facet.value} ({facet.count})</option>)}
                </select>
              </label>
            ) : null}
          </>
        ) : <p className="mt-4 text-xs leading-5 text-(--brand-gray)">Filters will be available when the catalogue loads.</p>}
        <button type="submit" className="ricoz-button-primary mt-6 w-full rounded-full!">Apply filters</button>
      </aside>
      <div className="min-w-0">
        <div className="flex flex-col gap-3 rounded-3xl border border-(--brand-border) bg-white p-3 shadow-(--shadow-sm) sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search products</span>
            <Search size={17} className="pointer-events-none absolute left-4 top-3.5 text-(--brand-gray)" aria-hidden="true" />
            <input name="search" type="search" defaultValue={params.get("search") || ""} maxLength={100} placeholder="Search products..." className="ricoz-input rounded-2xl! border-transparent! bg-(--brand-surface)! pl-11! focus:border-(--brand-red)! focus:bg-white!" />
          </label>
          <button type="submit" className="ricoz-button-primary min-h-11 rounded-2xl! px-6!">Search</button>
        </div>
        <div className="my-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--brand-border) bg-white/70 px-4 py-3">
          <p role="status" className="text-xs font-medium text-(--brand-text-secondary)">
            {result.ok ? result.data.pagination.total && result.data.products.length
              ? `Showing ${(result.data.pagination.page - 1) * result.data.pagination.limit + 1}-${Math.min(result.data.pagination.page * result.data.pagination.limit, result.data.pagination.total)} of ${result.data.pagination.total} products`
              : "No products to display"
              : "Catalogue unavailable"}
          </p>
          <label className="flex items-center gap-2 text-xs font-medium text-(--brand-text-secondary)">
            Sort by
            <select name="sort" defaultValue={params.get("sort") || "newest"} onChange={(event) => event.currentTarget.form?.requestSubmit()} className="min-h-10 rounded-xl border border-(--brand-border) bg-white px-3 text-sm shadow-(--shadow-xs)">
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A-Z</option>
            </select>
          </label>
        </div>
        {!result.ok ? (
          <div role="alert" className="rounded-3xl border border-(--status-danger-border) bg-(--status-danger-bg) p-6 shadow-(--shadow-sm)">
            <p className="text-sm font-semibold text-(--status-danger)">{result.message}</p>
            <button type="button" onClick={() => router.refresh()} className="ricoz-button-secondary mt-4">Retry catalogue</button>
          </div>
        ) : !result.data.products.length ? (
          <div className="rounded-3xl border border-dashed border-(--brand-border-strong) bg-white p-8 shadow-(--shadow-sm)">
            <p className="text-lg font-bold text-(--brand-navy)">{filtered ? "No matching products" : "No public products yet"}</p>
            <p className="mt-3 text-sm leading-6 text-(--brand-text-secondary)">{filtered ? "Try a different search or clear the filters." : "Products across Unassigned, Development, and Production stages appear here."}</p>
            <Link href="/products" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-(--brand-red)">Reset directory <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {result.data.products.map((product) => (
              <li key={product.id} className="min-w-0">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
        {result.ok && result.data.pagination.totalPages > 1 ? (
          <nav aria-label="Product directory pages" className="mt-8 flex items-center justify-between gap-3 rounded-3xl border border-(--brand-border) bg-white p-4 shadow-(--shadow-sm)">
            {result.data.pagination.page > 1 ? <Link href={pagePath(result.data.pagination.page - 1)} className="ricoz-button-secondary rounded-full! px-4!"><ArrowLeft size={15} aria-hidden="true" /> Previous</Link> : <span />}
            <span className="rounded-full bg-(--brand-surface) px-4 py-2 text-xs font-semibold tabular-nums text-(--brand-text-secondary)">Page {result.data.pagination.page} of {result.data.pagination.totalPages}</span>
            {result.data.pagination.page < result.data.pagination.totalPages ? <Link href={pagePath(result.data.pagination.page + 1)} className="ricoz-button-secondary rounded-full! px-4!">Next <ArrowRight size={15} aria-hidden="true" /></Link> : <span />}
          </nav>
        ) : null}
      </div>
    </Form>
  );
}
