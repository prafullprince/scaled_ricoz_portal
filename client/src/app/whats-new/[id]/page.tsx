import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock3,
  Sparkles,
} from "lucide-react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { getPublicMarketingBlogs } from "@/lib/marketing/blogs.server";

const getBlogs = cache(getPublicMarketingBlogs);
const dateLabel = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getBlogs();
  if (!result.ok) {
    return { title: "Ricoz Stories | Ricoz Innovation" };
  }
  const blog = result.blogs.find((item) => item.id === id);
  if (!blog) {
    return { title: "Story not found | Ricoz Innovation" };
  }
  return {
    title: `${blog.title} | Ricoz`,
    description: blog.description,
    openGraph: { images: [blog.thumbnail] },
  };
}

export default async function WhatsNewStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getBlogs();

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-(--brand-background) text-(--brand-text)">
        <LandingNavbar />
        <section className="container-ricoz py-20">
          <p
            role="alert"
            className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900"
          >
            {result.message}
          </p>
        </section>
        <LandingFooter />
      </main>
    );
  }

  const blog = result.blogs.find((item) => item.id === id);
  if (!blog) notFound();

  const storyIndex = result.blogs.findIndex((item) => item.id === blog.id);
  const upNext =
    result.blogs[storyIndex + 1] ??
    result.blogs.find((item) => item.id !== blog.id);
  const relatedStories = result.blogs
    .filter((item) => item.id !== blog.id && item.id !== upNext?.id)
    .slice(0, 4);
  const storyDate = blog.publishedAt ?? blog.createdAt;
  const wordCount = `${blog.description} ${blog.details}`
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <main className="min-h-screen bg-(--brand-background) text-(--brand-text)">
      <LandingNavbar />
      <section className="container-ricoz py-8 md:py-12">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-(--brand-gray)">
            <li>
              <Link
                href="/"
                className="transition-colors hover:text-(--brand-red)"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li>
              <Link
                href="/whats-new"
                className="transition-colors hover:text-(--brand-red)"
              >
                What&apos;s new
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li
              aria-current="page"
              className="max-w-full truncate font-medium text-(--brand-navy)"
            >
              {blog.title}
            </li>
          </ol>
        </nav>

        <div className="mt-7 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12">
          <article className="min-w-0">
            <header>
              <p className="inline-flex items-center gap-2 rounded-full border border-(--brand-red)/15 bg-(--brand-red-pale) px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-(--brand-red)">
                <Sparkles size={14} aria-hidden="true" />
                Inside Ricoz
              </p>
              <h1 className="mt-4! text-3xl font-black leading-[1.08] tracking-[-0.055em] text-(--brand-navy) sm:text-4xl md:text-5xl">
                {blog.title}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-(--brand-text-secondary)">
                <span className="font-semibold text-(--brand-navy)">Ricoz</span>
                <span aria-hidden="true" className="size-1 rounded-full bg-(--brand-red)" />
                <time dateTime={storyDate}>{dateLabel.format(new Date(storyDate))}</time>
                <span aria-hidden="true" className="size-1 rounded-full bg-(--brand-border-strong)" />
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 size={14} aria-hidden="true" />
                  {readingMinutes} min read
                </span>
              </div>
            </header>

            <div className="relative mt-7 aspect-[16/9] overflow-hidden rounded-2xl border border-(--brand-border) bg-(--brand-surface) shadow-(--shadow-lg) md:rounded-3xl">
              <Image
                src={blog.thumbnail}
                alt={`${blog.title} thumbnail`}
                fill
                priority
                unoptimized
                sizes="(min-width: 1024px) 800px, 100vw"
                className="object-cover"
              />
            </div>

            <div className="mx-auto mt-7 max-w-3xl">
              <p className="text-lg font-medium leading-8 text-(--brand-navy) md:text-xl md:leading-9">
                {blog.description}
              </p>
              {blog.details ? (
                <div className="mt-6 whitespace-pre-wrap text-base leading-8 text-(--brand-text-secondary) md:text-lg md:leading-9">
                  {blog.details}
                </div>
              ) : null}
            </div>

            <footer className="mt-10 flex border-t border-(--brand-border) pt-6">
              <Link
                href="/whats-new"
                className="group inline-flex items-center gap-2 text-sm font-bold text-(--brand-navy) transition-colors hover:text-(--brand-red)"
              >
                <ArrowLeft
                  size={18}
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:-translate-x-1"
                />
                More stories
              </Link>
            </footer>
          </article>

          <aside className="space-y-9 lg:sticky lg:top-28">
            {upNext ? (
              <section aria-labelledby="up-next-heading">
                <div className="flex items-center justify-between gap-3">
                  <h2
                    id="up-next-heading"
                    className="text-lg font-bold tracking-[-0.03em] text-(--brand-navy)"
                  >
                    Up next
                  </h2>
                  <Link
                    href="/whats-new"
                    className="text-xs font-semibold text-(--brand-red) transition-colors hover:text-(--brand-red-hover)"
                  >
                    All stories
                  </Link>
                </div>
                <Link
                  href={`/whats-new/${upNext.id}`}
                  className="group mt-4 block overflow-hidden rounded-2xl border border-(--brand-border) bg-white shadow-(--shadow-sm) transition-all duration-300 hover:-translate-y-0.5 hover:shadow-(--shadow-md)"
                >
                  <div className="relative aspect-video overflow-hidden bg-(--brand-surface)">
                    <Image
                      src={upNext.thumbnail}
                      alt={`${upNext.title} thumbnail`}
                      fill
                      unoptimized
                      sizes="(min-width: 1024px) 336px, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--brand-red)">
                      {upNext.publishedAt
                        ? dateLabel.format(new Date(upNext.publishedAt))
                        : "Ricoz story"}
                    </p>
                    <h3 className="mt-2! line-clamp-2 text-base font-bold leading-snug text-(--brand-navy)">
                      {upNext.title}
                    </h3>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-(--brand-text-secondary) transition-colors group-hover:text-(--brand-red)">
                      Read story
                      <ArrowRight
                        size={15}
                        aria-hidden="true"
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </span>
                  </div>
                </Link>
              </section>
            ) : null}

            <section aria-labelledby="related-stories-heading">
              <h2
                id="related-stories-heading"
                className="text-lg font-bold tracking-[-0.03em] text-(--brand-navy)"
              >
                Related stories
              </h2>
              {relatedStories.length ? (
                <div className="mt-4 space-y-4">
                  {relatedStories.map((story) => (
                    <Link
                      key={story.id}
                      href={`/whats-new/${story.id}`}
                      className="group flex gap-3 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--brand-red)"
                    >
                      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl border border-(--brand-border) bg-(--brand-surface)">
                        <Image
                          src={story.thumbnail}
                          alt={`${story.title} thumbnail`}
                          fill
                          unoptimized
                          sizes="128px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0 py-1">
                        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-(--brand-navy) transition-colors group-hover:text-(--brand-red)">
                          {story.title}
                        </h3>
                        <p className="mt-2 text-xs text-(--brand-gray)">
                          {story.publishedAt
                            ? dateLabel.format(new Date(story.publishedAt))
                            : "Ricoz story"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-2xl border border-(--brand-border) bg-(--brand-surface) p-4 text-sm leading-6 text-(--brand-text-secondary)">
                  More stories from Ricoz will appear here as they are published.
                </p>
              )}
            </section>
          </aside>
        </div>
      </section>
      <LandingFooter />
    </main>
  );
}
