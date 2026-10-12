"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { PublicMarketingBlog } from "@/types/marketing";
import { AnimatedCard } from "./LandingMotion";
import { SwipeCarousel } from "./SwipeCarousel";
import styles from "./WhatsNewCarousel.module.css";

const dateLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function WhatsNewCarousel({ blogs }: { blogs: PublicMarketingBlog[] }) {
  const heading = (
    <div className="max-w-2xl">
      <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white/75">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]"
        />
        Inside Ricoz
      </p>
      <h2 className="mt-5! text-4xl font-black tracking-[-0.06em] text-white md:text-6xl">
        What&apos;s new<span className="text-red-400">.</span>
      </h2>
      <p className="mt-4 max-w-xl text-base leading-7 text-white/65 md:text-lg">
        Ideas, milestones, and stories from the people building at Ricoz.
      </p>
    </div>
  );

  return (
    <>
      <SwipeCarousel
        label="What's new at Ricoz"
        heading={heading}
        tone="dark"
        className={styles.extendRight}
        peek
      >
        {blogs.map((blog, index) => (
          <AnimatedCard
            key={blog.id}
            index={index % 3}
            className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.2)] transition-[border-color,box-shadow] duration-300 hover:border-white hover:shadow-[0_14px_50px_rgba(0,0,0,0.01)]"
          >
            <div className="relative aspect-16/10 overflow-hidden bg-slate-200">
              <Image
                src={blog.thumbnail}
                alt={`${blog.title} thumbnail`}
                fill
                unoptimized
                sizes="(min-width: 1024px) 33vw, 85vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-black/15"
              />
              <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-red-400"
                />
                {blog.publishedAt
                  ? dateLabel.format(new Date(blog.publishedAt))
                  : "Ricoz news"}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-6 md:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--brand-red)">
                STORY {String(index + 1).padStart(2, "0")}{" "}
                <span className="text-(--brand-text-muted)">
                  / {String(blogs.length).padStart(2, "0")}
                </span>
              </p>
              <h3 className="mt-3! text-2xl font-bold leading-tight tracking-[-0.04em] text-(--brand-navy) md:text-[1.7rem]">
                {blog.title}
              </h3>
              <p className="mt-3 line-clamp-3 text-sm leading-7 text-(--brand-text-secondary) md:text-base">
                {blog.description}
              </p>
              <Link
                href={`/whats-new/${blog.id}`}
                className="mt-auto flex items-center justify-between border-t border-(--brand-border) pt-5 text-left text-sm font-bold text-(--brand-navy) transition-colors hover:text-(--brand-red)"
              >
                Read story
                <ArrowRight
                  size={20}
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </div>
          </AnimatedCard>
        ))}
      </SwipeCarousel>
      <div className="mt-1 flex justify-end">
        <Link
          href="/whats-new"
          className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10"
        >
          Browse all stories
          <ArrowUpRight
            size={17}
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </>
  );
}
