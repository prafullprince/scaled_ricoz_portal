import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { getPublicMarketingBlogs } from "@/lib/marketing/blogs.server";

const dateLabel = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const metadata: Metadata = {
  title: "What's New | Ricoz Innovation",
  description:
    "Explore the latest stories, ideas, milestones, and updates from Ricoz.",
};

export default async function WhatsNewPage() {
  const result = await getPublicMarketingBlogs();

  return (
    <main className="min-h-screen bg-(--brand-background) text-(--brand-text)">
      <LandingNavbar />
      <section className="relative isolate overflow-hidden border-b border-white/10 bg-[radial-gradient(ellipse_at_12%_0%,rgba(201,29,32,0.2),transparent_38%),radial-gradient(ellipse_at_100%_72%,rgba(68,94,145,0.26),transparent_40%),linear-gradient(135deg,#0b1220,#18243a_58%,#101a2c)] py-16 md:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-16 size-72 rounded-full border border-white/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 top-28 size-48 rounded-full border border-white/5"
        />
        <div className="container-ricoz relative">
          <Link
            href="/#whats-new"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to the homepage
          </Link>
          <div className="mt-10 max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white/75">
              <Sparkles size={14} aria-hidden="true" className="text-red-400" />
              Inside Ricoz
            </p>
            <h1 className="mt-5! text-4xl font-black leading-[1.04] tracking-[-0.06em] text-white sm:text-5xl md:text-6xl">
              Stories, ideas, and{" "}
              <span className="text-red-400">what&apos;s new.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 md:text-lg md:leading-8">
              Updates and perspectives from the people building at Ricoz.
              Explore every published story in one place.
            </p>
          </div>
        </div>
      </section>

      <section className="container-ricoz py-12 md:py-16">
        {result.ok ? (
          result.blogs.length ? (
            <>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
                    The journal
                  </p>
                  <h2 className="mt-2! text-3xl font-black tracking-[-0.05em] text-(--brand-navy) md:text-4xl">
                    All stories
                  </h2>
                </div>
                <p className="text-sm font-medium text-(--brand-text-secondary)">
                  {result.blogs.length}{" "}
                  {result.blogs.length === 1 ? "story" : "stories"}
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {result.blogs.map((blog, index) => (
                  <Link
                    key={blog.id}
                    href={`/whats-new/${blog.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-3xl border border-(--brand-border) bg-white shadow-(--shadow-sm) transition-all duration-300 hover:-translate-y-1 hover:border-(--brand-red)/25 hover:shadow-(--shadow-xl) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--brand-red)"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-(--brand-surface)">
                      <Image
                        src={blog.thumbnail}
                        alt={`${blog.title} thumbnail`}
                        fill
                        unoptimized
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10"
                      />
                      <span className="absolute bottom-4 left-4 rounded-full border border-white/25 bg-black/40 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
                        {blog.publishedAt
                          ? dateLabel.format(new Date(blog.publishedAt))
                          : "Ricoz news"}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--brand-red)">
                        STORY {String(index + 1).padStart(2, "0")}
                      </p>
                      <h3 className="mt-3! text-2xl font-bold leading-tight tracking-[-0.04em] text-(--brand-navy)">
                        {blog.title}
                      </h3>
                      <p className="mt-3 line-clamp-3 text-sm leading-7 text-(--brand-text-secondary)">
                        {blog.description}
                      </p>
                      <span className="mt-auto flex items-center justify-between border-t border-(--brand-border) pt-5 text-sm font-bold text-(--brand-navy) transition-colors group-hover:text-(--brand-red)">
                        Read story
                        <ArrowUpRight
                          size={19}
                          aria-hidden="true"
                          className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-(--brand-border) bg-(--brand-surface) p-8 md:p-12">
              <h2 className="text-2xl font-bold text-(--brand-navy)">
                No stories published yet
              </h2>
              <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">
                New stories from Ricoz will appear here when they are published.
              </p>
            </div>
          )
        ) : (
          <p
            role="alert"
            className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900"
          >
            {result.message}
          </p>
        )}
      </section>
      <LandingFooter />
    </main>
  );
}
