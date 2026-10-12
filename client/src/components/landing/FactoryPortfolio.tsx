"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Boxes } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { isProductCatalogue, productPath, productStatusLabels, type ProductCatalogue } from "@/lib/products/catalogue";
import { useFactoryReducedMotion, useLandingMotion } from "./LandingMotion";

export function FactoryPortfolio({ catalogue: initialCatalogue }: { catalogue: ProductCatalogue }) {
  const [loaded, setLoaded] = useState<{ source: ProductCatalogue; data: ProductCatalogue } | null>(null);
  const catalogue = loaded?.source === initialCatalogue ? loaded.data : initialCatalogue;
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedThumbnailId, setFailedThumbnailId] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const requestedPage = useRef(1);
  const reduced = useFactoryReducedMotion();
  const { paused } = useLandingMotion();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const currentIndex = Math.min(active, catalogue.products.length - 1);
  const product = catalogue.products[currentIndex];
  useEffect(() => () => request.current?.abort(), []);

  async function loadPage(page: number) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    requestedPage.current = page;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/catalogue?page=${page}&limit=${catalogue.pagination.limit}&stages=all`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("We could not load more products. Please try again.");
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || !("ok" in payload) || payload.ok !== true || !("data" in payload) || !isProductCatalogue(payload.data)) {
        throw new Error("The catalogue returned an invalid response. Please try again.");
      }
      const data = payload.data;
      if (!data.products.length) throw new Error("The portfolio has changed. Refresh the page to see the latest products.");
      if (controller.signal.aborted) return;
      setDirection(page >= catalogue.pagination.page ? 1 : -1);
      setActive(0);
      setLoaded({ source: initialCatalogue, data });
    } catch (reason) {
      if (controller.signal.aborted) return;
      console.error("Unable to paginate the Product Factory showcase", reason);
      setError(reason instanceof Error ? reason.message : "Unable to load products. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function select(index: number) {
    const next = Math.max(0, Math.min(catalogue.products.length - 1, index));
    setDirection(next >= currentIndex ? 1 : -1);
    setActive(next);
  }

  return (
    <div role="region" aria-label="Product lifecycle showcase" aria-busy={loading} className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-start lg:gap-8">
      <div className="rounded-3xl border border-(--brand-border) bg-white/85 p-4 shadow-(--shadow-sm) backdrop-blur-sm md:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--brand-red)">Portfolio</p>
            <p className="mt-1 text-lg font-bold tracking-[-0.03em] text-(--brand-navy)">Choose a product</p>
          </div>
          <span className="shrink-0 rounded-full bg-(--brand-surface) px-3 py-1 text-xs font-semibold tabular-nums text-(--brand-text-secondary)">
            {catalogue.pagination.total} products
          </span>
        </div>
        <div aria-label="Select a product" className="flex gap-2 overflow-x-auto pb-2 lg:max-h-[430px] lg:flex-col lg:overflow-y-auto lg:pb-0">
          {catalogue.products.map((item, index) => (
            <motion.button
              key={item.id}
              type="button"
              aria-pressed={currentIndex === index}
              aria-controls="factory-product"
              onClick={() => select(index)}
              whileHover={reduced || paused ? undefined : { x: 6 }}
              whileTap={reduced || paused ? undefined : { scale: 0.97 }}
              className={`group flex min-w-48 shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-[background,border-color,color,box-shadow] duration-200 lg:min-w-0 ${currentIndex === index ? "border-(--brand-red-soft) bg-(--brand-red-pale) text-(--brand-navy) shadow-(--shadow-xs)" : "border-transparent text-(--brand-text-secondary) hover:border-(--brand-border) hover:bg-(--brand-surface)"}`}
            >
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums ${currentIndex === index ? "bg-white text-(--brand-red)" : "bg-(--brand-surface) text-(--brand-gray)"}`}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold md:text-base">{item.title}</span>
              <ArrowRight size={16} aria-hidden="true" className={`shrink-0 transition-transform ${currentIndex === index ? "translate-x-0 text-(--brand-red)" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-70"}`} />
            </motion.button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-(--brand-border) pt-4">
          <p role="status" aria-live="polite" aria-atomic="true" className="text-xs font-semibold tabular-nums text-(--brand-gray)">
            Story <span className="text-(--brand-navy)">{(catalogue.pagination.page - 1) * catalogue.pagination.limit + currentIndex + 1}</span> of {catalogue.pagination.total}
          </p>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous product" disabled={currentIndex === 0} onClick={() => select(currentIndex - 1)} className="ricoz-button-secondary size-10 rounded-full! p-0! disabled:opacity-35"><ArrowLeft size={16} aria-hidden="true" /></button>
            <button type="button" aria-label="Next product" disabled={currentIndex === catalogue.products.length - 1} onClick={() => select(currentIndex + 1)} className="ricoz-button-secondary size-10 rounded-full! p-0! disabled:opacity-35"><ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </div>
        {catalogue.pagination.totalPages > 1 ? (
          <nav aria-label="Showcase pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-(--brand-surface) p-3">
            <span role="status" className="text-xs font-medium text-(--brand-gray)">{loading ? "Loading products..." : `Page ${catalogue.pagination.page} of ${catalogue.pagination.totalPages}`}</span>
            <div className="flex gap-2">
              <button type="button" disabled={loading || catalogue.pagination.page === 1} onClick={() => void loadPage(catalogue.pagination.page - 1)} className="ricoz-button-secondary rounded-full! px-3! text-xs! disabled:opacity-35">Previous</button>
              <button type="button" disabled={loading || catalogue.pagination.page === catalogue.pagination.totalPages} onClick={() => void loadPage(catalogue.pagination.page + 1)} className="ricoz-button-secondary rounded-full! px-3! text-xs! disabled:opacity-35">Next</button>
            </div>
          </nav>
        ) : null}
        {error ? <div role="alert" className="mt-4 rounded-2xl border border-(--status-danger-border) bg-(--status-danger-bg) p-4 text-sm text-(--status-danger)"><p>{error}</p><button type="button" disabled={loading} onClick={() => void loadPage(requestedPage.current)} className="ricoz-button-secondary mt-3">Retry products</button></div> : null}
      </div>
      <article
        id="factory-product"
        tabIndex={0}
        aria-label={`${product.title}. Use left and right arrow keys to explore products.`}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            select(currentIndex + (event.key === "ArrowRight" ? 1 : -1));
          }
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          const touch = event.changedTouches[0];
          if (!start || !touch) return;
          const distance = touch.clientX - start.x;
          if (Math.abs(distance) >= 50 && Math.abs(touch.clientY - start.y) < 50) {
            select(currentIndex + (distance < 0 ? 1 : -1));
          }
        }}
        onTouchCancel={() => { touchStart.current = null; }}
        className="group touch-pan-y overflow-hidden rounded-3xl border border-(--brand-border) bg-white shadow-(--shadow-lg) transition-shadow duration-300 hover:shadow-(--shadow-xl) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--brand-red)"
      >
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={product.id}
            custom={direction}
            variants={{
              enter: (movement: number) => ({ opacity: 0, x: movement * 55, scale: 0.98 }),
              visible: { opacity: 1, x: 0, scale: 1 },
              exit: (movement: number) => ({ opacity: 0, x: movement * -35, scale: 0.98 }),
            }}
            initial={reduced || paused ? false : "enter"}
            animate="visible"
            exit={reduced || paused ? undefined : "exit"}
            transition={{ duration: reduced || paused ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative min-h-60 overflow-hidden border-b border-(--brand-border) bg-[radial-gradient(circle_at_50%_48%,rgba(201,29,32,0.28),transparent_36%),linear-gradient(135deg,#101a2c,#24324b)] md:min-h-80">
              {product.thumbnail && failedThumbnailId !== product.id ? (
                <Image
                  src={product.thumbnail}
                  alt={`${product.title} product preview`}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 65vw, 100vw"
                  onError={() => setFailedThumbnailId(product.id)}
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-(--brand-red-soft)">
                  <Boxes size={72} aria-hidden="true" />
                </div>
              )}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full border border-white/10" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-14 size-48 rounded-full border border-white/10" />
              <span className="absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-400" />
                {productStatusLabels[product.status]}
              </span>
              <span className="absolute right-5 top-5 z-10 text-xs font-bold uppercase tracking-[0.15em] text-white/80">
                {(catalogue.pagination.page - 1) * catalogue.pagination.limit + currentIndex + 1} / {catalogue.pagination.total}
              </span>
              <span aria-hidden="true" className="pointer-events-none absolute bottom-3 right-5 z-10 text-5xl font-black tracking-[-0.08em] text-white/15 md:text-7xl">
                {String(currentIndex + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="p-6 md:p-8">
              {product.category ? (
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-(--brand-red)" />
                  {product.category}
                </p>
              ) : null}
              <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0 max-w-2xl">
                  <h3 className="text-2xl font-black tracking-[-0.04em] text-(--brand-navy) md:text-3xl">{product.title}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-(--brand-text-secondary) md:text-base">{product.summary || product.description}</p>
                </div>
                <Link href={productPath(product)} className="ricoz-button-primary shrink-0 rounded-full! px-5! py-3! text-sm! shadow-(--shadow-brand)">
                  Explore product <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
              {product.techStack.length ? (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-(--brand-border) pt-5">
                  {product.techStack.slice(0, 4).map((technology) => (
                    <span key={technology} className="rounded-full border border-(--brand-border) bg-(--brand-surface) px-3 py-1.5 text-xs font-medium text-(--brand-text-secondary)">
                      {technology}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      </article>
    </div>
  );
}
