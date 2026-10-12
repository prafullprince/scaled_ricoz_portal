import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ProductDirectory } from "@/components/products/ProductDirectory";
import { getPublicCatalogue } from "@/lib/products/catalogue.server";
import styles from "@/components/landing/InvestorLanding.module.css";
import {
  ArrowDown,
  ArrowUpRight,
  Boxes,
  Layers3,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Product Directory | Ricoz Innovation",
  description:
    "Explore Ricoz products across the Unassigned, Development, and Production lifecycle stages.",
};

async function DirectoryContent({ query }: { query: string }) {
  const result = await getPublicCatalogue(query);
  return <ProductDirectory key={query} result={result} query={query} />;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of [
    "search",
    "category",
    "technology",
    "status",
    "sort",
    "page",
  ]) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value);
  }
  query.set("stages", "all");
  return (
    <main
      className={`${styles.page} bg-(--brand-background) text-(--brand-text)`}
    >
      <LandingNavbar />
      <section className="relative isolate overflow-hidden border-b border-(--brand-border) bg-[radial-gradient(ellipse_at_82%_12%,rgba(201,29,32,0.1),transparent_34%),linear-gradient(180deg,var(--brand-background),var(--brand-surface))] py-14 md:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-24 size-128 rounded-full border border-(--brand-red)/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 top-0 size-80 rounded-full border border-(--brand-red)/10"
        />
        <div className="container-ricoz relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-(--brand-red)/15 bg-(--brand-red-pale) px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
              <Sparkles size={14} aria-hidden="true" />
              Ricoz Product Factory
            </p>
            <h1 className="mt-6! text-4xl font-black leading-[1.02] tracking-[-0.06em] text-(--brand-navy) sm:text-5xl md:text-6xl">
              Products built for{" "}
              <span className="text-(--brand-red)">real work.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-(--brand-text-secondary) md:text-lg md:leading-8">
              Explore Ricoz products from Unassigned through Development to
              Production, and see the technology behind each one.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="#all-products"
                className="ricoz-button-primary rounded-full! px-6!"
              >
                Browse products <ArrowDown size={16} aria-hidden="true" />
              </Link>
              <span className="inline-flex items-center gap-2 px-2 text-xs font-semibold text-(--brand-gray)">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-emerald-500"
                />
                Products at every stage
              </span>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="relative mx-auto hidden w-full max-w-md lg:block"
          >
            <div className="absolute inset-8 rounded-[36px] bg-(--brand-red)/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[30px] border border-white/80 bg-white/80 p-6 shadow-(--shadow-xl) backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-red) text-white shadow-(--shadow-brand)">
                  <Boxes size={24} />
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-(--brand-surface) px-3 py-1.5 text-xs font-semibold text-(--brand-text-secondary)">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  All lifecycle stages
                </span>
              </div>
              <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
                Explore the portfolio
              </p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-(--brand-navy)">
                Ideas into impact.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-(--brand-border) bg-white p-4">
                  <Layers3 size={19} className="text-(--brand-red)" />
                  <p className="mt-4 text-sm font-bold text-(--brand-navy)">
                    Purpose-built
                  </p>
                  <p className="mt-1 text-xs leading-5 text-(--brand-gray)">
                    For real workflows
                  </p>
                </div>
                <div className="rounded-2xl border border-(--brand-border) bg-white p-4">
                  <ArrowUpRight size={19} className="text-(--brand-red)" />
                  <p className="mt-4 text-sm font-bold text-(--brand-navy)">
                    Lifecycle-aware
                  </p>
                  <p className="mt-1 text-xs leading-5 text-(--brand-gray)">
                    Stage is shown on every product
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="all-products" className="scroll-mt-24 mt-12 pb-16 md:pb-24">
        <div className="container-ricoz">
          <Suspense
            key={query.toString()}
            fallback={
              <div
                role="status"
                className="rounded-[18px] border border-(--brand-border) bg-(--brand-surface) p-8 text-sm text-(--brand-gray)"
              >
                Loading the product directory...
              </div>
            }
          >
            <DirectoryContent query={query.toString()} />
          </Suspense>
        </div>
      </section>
      <LandingFooter />
    </main>
  );
}
