import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Layers3,
  Sparkles,
} from "lucide-react";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { PublicProductMark } from "@/components/products/PublicProductMark";
import {
  CatalogueError,
  getPublicProduct,
} from "@/lib/products/catalogue.server";
import { productStatusLabels } from "@/lib/products/catalogue";
import styles from "@/components/landing/InvestorLanding.module.css";

type ProductPageProps = { params: Promise<{ slug: string }> };

async function loadProduct(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  try {
    return await getPublicProduct(id);
  } catch (error) {
    if (error instanceof CatalogueError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  return {
    title: `${product.title} | Ricoz Product Factory`,
    description: product.summary || product.description.slice(0, 200),
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  const facts = [
    { label: "Status", value: productStatusLabels[product.status] },
    ...(product.category
      ? [{ label: "Category", value: product.category }]
      : []),
    {
      label: "Added to catalogue",
      value: new Date(product.createdAt).toLocaleDateString("en-IN", {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    },
    {
      label: "Last updated",
      value: new Date(product.updatedAt).toLocaleDateString("en-IN", {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    },
  ];
  return (
    <main
      className={`${styles.page} bg-(--brand-background) text-(--brand-text)`}
    >
      <LandingNavbar />
      <section className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_86%_4%,rgba(201,29,32,0.1),transparent_34%),linear-gradient(180deg,var(--brand-background),var(--brand-surface))] py-8 md:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-16 size-[30rem] rounded-full border border-(--brand-red)/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 top-32 size-72 rounded-full border border-(--brand-red)/10" />
        <div className="container-ricoz relative">
          <nav
            aria-label="Breadcrumb"
            className="mb-7 inline-flex flex-wrap items-center gap-2 rounded-full border border-(--brand-border) bg-white/75 px-4 py-2 text-xs text-(--brand-gray) shadow-(--shadow-xs) backdrop-blur"
          >
            <Link href="/" className="transition-colors hover:text-(--brand-red)">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/products" className="transition-colors hover:text-(--brand-red)">
              Products
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="font-semibold text-(--brand-navy)">{product.title}</span>
          </nav>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
            <div className="min-w-0">
              <header className="relative isolate overflow-hidden rounded-[30px] border border-(--brand-border) bg-white/90 p-6 shadow-(--shadow-lg) backdrop-blur-sm md:p-9">
                <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 size-64 rounded-full border border-(--brand-red)/10" />
                <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-12 size-44 rounded-full border border-(--brand-red)/10" />
                <div className="relative grid items-center gap-8 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
                      <Sparkles size={14} aria-hidden="true" />
                      Ricoz Product Factory
                    </p>
                    <h1 className="mt-4! text-4xl font-black leading-[1.04] tracking-[-0.06em] text-(--brand-navy) md:text-5xl">
                      {product.title}<span className="text-(--brand-red)">.</span>
                    </h1>
                    {product.summary ? (
                      <p className="mt-4 max-w-2xl text-base leading-7 text-(--brand-text-secondary) md:text-lg">
                        {product.summary}
                      </p>
                    ) : null}
                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
                        {productStatusLabels[product.status]}
                      </span>
                      {product.category ? (
                        <span className="rounded-full border border-(--brand-border) bg-(--brand-surface) px-3 py-1.5 text-xs font-medium text-(--brand-text-secondary)">
                          {product.category}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-7 flex flex-wrap gap-3">
                      {product.website ? (
                        <a
                          href={product.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ricoz-button-primary rounded-full! px-5!"
                        >
                          Visit product <ExternalLink size={15} aria-hidden="true" />
                        </a>
                      ) : null}
                      <a href="#overview" className="ricoz-button-secondary rounded-full! px-5!">
                        Explore details <ArrowDown size={15} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                  <div className="relative mx-auto aspect-square w-full max-w-44 overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_50%_45%,rgba(201,29,32,0.32),transparent_42%),linear-gradient(135deg,#101a2c,#24324b)] shadow-(--shadow-xl)">
                    <PublicProductMark product={product} large cover />
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-[12%] rounded-full border border-white/15" />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-[25%] rounded-full border border-white/15" />
                  </div>
                </div>
              </header>
              <nav
                aria-label="Product information"
                className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-(--brand-border) bg-white/85 p-2 shadow-(--shadow-xs)"
              >
                <a href="#overview" className="rounded-xl bg-(--brand-red-pale) px-4 py-2 text-sm font-bold text-(--brand-red)">
                  Overview
                </a>
                {product.techStack.length ? (
                  <a href="#technology" className="rounded-xl px-4 py-2 text-sm font-semibold text-(--brand-text-secondary) transition-colors hover:bg-(--brand-surface) hover:text-(--brand-navy)">
                    Technology
                  </a>
                ) : null}
              </nav>
              <section id="overview" className="scroll-mt-28 mt-5 rounded-3xl border border-(--brand-border) bg-white p-6 shadow-(--shadow-sm) md:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--brand-red)">Product overview</p>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-(--brand-navy) md:text-3xl">
                  About {product.title}
                </h2>
                <p className="mt-4 whitespace-pre-line text-base leading-8 text-(--brand-text-secondary)">
                  {product.description}
                </p>
              </section>
              {product.techStack.length ? (
                <section id="technology" className="scroll-mt-28 mt-5 rounded-3xl border border-(--brand-border) bg-white p-6 shadow-(--shadow-sm) md:p-8">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-(--brand-red-pale) text-(--brand-red)">
                      <Layers3 size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--brand-red)">Under the hood</p>
                      <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-(--brand-navy)">Technology</h2>
                    </div>
                  </div>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {product.techStack.map((technology) => (
                      <li key={technology} className="rounded-full border border-(--brand-border) bg-(--brand-surface) px-4 py-2 text-sm font-medium text-(--brand-text-secondary)">
                        {technology}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <section className="relative isolate mt-5 overflow-hidden rounded-3xl bg-(--brand-navy) p-6 text-white shadow-(--shadow-lg) md:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 size-64 rounded-full border border-white/10" />
                <div className="relative">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red-soft)">Build with Ricoz</p>
                  <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white md:text-3xl">
                    Want to understand this product further?
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                    Contact the Ricoz team for product information or explore the investor overview.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/contact" className="ricoz-button-primary rounded-full! px-5!">
                      Request information <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    <Link href="/investors" className="ricoz-button-secondary rounded-full! border-white/20! bg-white/5! px-5! text-white! hover:bg-white/10! hover:text-white!">
                      Investor relations
                    </Link>
                  </div>
                </div>
              </section>
            </div>
            <aside className="self-start rounded-3xl border border-(--brand-border) bg-white p-5 shadow-(--shadow-md) lg:sticky lg:top-28 md:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--brand-red)">At a glance</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-(--brand-navy)">
                Product details
              </h2>
              <dl className="mt-5 divide-y divide-(--brand-border) text-sm">
                {facts.map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <dt className="text-(--brand-gray)">{label}</dt>
                    <dd className="text-right font-semibold text-(--brand-navy)">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 rounded-2xl bg-(--brand-surface) p-4 text-xs leading-5 text-(--brand-gray)">
                Published by the Ricoz team. Dates describe catalogue records, not founding or launch dates.
              </p>
              <Link href="/products" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-(--brand-navy) transition-colors hover:text-(--brand-red)">
                <ArrowLeft size={15} aria-hidden="true" />
                Back to all products
              </Link>
            </aside>
          </div>
        </div>
      </section>
      <LandingFooter />
    </main>
  );
}
