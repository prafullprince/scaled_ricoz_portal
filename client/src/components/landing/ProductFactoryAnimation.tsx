"use client";

import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { FactoryThreeScene } from "./FactoryThreeScene";
import { useFactoryReducedMotion, useLandingMotion } from "./LandingMotion";
import {
  innovationStory,
  innovationVideoFocus,
} from "@/lib/products/innovation-story";

export function ProductFactoryAnimation() {
  const container = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const shouldPlay = useRef(false);
  const visible = useInView(container, { margin: "80px" });
  const reduced = useFactoryReducedMotion();
  const { paused: pagePaused } = useLandingMotion();
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start start", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const drift = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const controlsOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0]);
  const active = visible && !reduced && !pagePaused && !paused && !hidden;

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    shouldPlay.current = active;
    let cancelled = false;
    if (!active) element.pause();
    else {
      void element
        .play()
        .then(() => {
          if (!shouldPlay.current) element.pause();
        })
        .catch((error: unknown) => {
          if (
            cancelled ||
            (error instanceof DOMException && error.name === "AbortError")
          )
            return;
          console.warn(
            "Factory video playback requires user interaction",
            error,
          );
          setPlayBlocked(true);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <section
      ref={container}
      aria-labelledby="hero-heading"
      className="relative isolate h-[min(78svh,760px)] min-h-120 overflow-hidden bg-(--brand-navy-dark) md:h-[calc(100svh-76px)] md:max-h-230"
    >
      <h1 id="hero-heading" className="sr-only">
        Ricoz Innovation Product Factory: technology products built for real
        business
      </h1>
      <motion.div
        style={{
          scale: reduced || pagePaused ? 1 : scale,
          y: reduced || pagePaused ? 0 : drift,
        }}
        className="absolute inset-0"
      >
        <video
          ref={video}
          src="/animations/product-factory.mp4"
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Original orbital animation supplied for the Ricoz Product Factory"
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            objectPosition: `${innovationVideoFocus.x * 100}% ${innovationVideoFocus.y * 100}%`,
          }}
          onLoadedData={() => {
            if (!active && video.current) video.current.currentTime = 0.1;
          }}
          onError={() => {
            console.error("Unable to load /animations/product-factory.mp4");
            setFailed(true);
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-(--brand-navy-dark)/25"
        />
        {visible && !reduced ? (
          <FactoryThreeScene
            active={active && !playBlocked && !failed}
            video={video}
          />
        ) : null}
      </motion.div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-(--brand-navy-dark) to-transparent"
      />
      {/* Temporarily disabled: the visible innovation text overlay.
      {!sceneReady || reduced ? (
        <div
          aria-hidden="true"
          data-innovation-fallback
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 pb-20 text-center"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-(--brand-red-soft) sm:text-xs">
            {thought.label}
          </p>
          <p className="mt-3 text-2xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
            {thought.lines[0]}
            <br />
            {thought.lines[1]}
          </p>
          <p className="mt-3 max-w-lg text-xs text-white/85 sm:text-base">
            {thought.thought}
          </p>
        </div>
      ) : null}
      */}
      <ol className="sr-only" aria-label="Our innovation thoughts">
        {innovationStory.map((item) => (
          <li key={item.label}>
            {item.label}. {item.lines.join(" ")} {item.thought}
          </li>
        ))}
      </ol>
      {failed ? (
        <p
          role="alert"
          className="absolute inset-x-4 top-6 text-center text-xs text-white"
        >
          The animation could not load. Reload the page to retry.
        </p>
      ) : null}
      <motion.div
        style={{ opacity: reduced || pagePaused ? 1 : controlsOpacity }}
        className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 pb-5 sm:gap-4 sm:px-8 sm:pb-8"
      >
        {!reduced && !pagePaused ? (
          <button
            type="button"
            aria-label={
              paused || playBlocked
                ? "Play factory animation"
                : "Pause factory animation"
            }
            aria-pressed={paused}
            onClick={() => {
              setPaused(paused || playBlocked ? false : true);
              if (playBlocked && video.current) {
                void video.current
                  .play()
                  .then(() => setPlayBlocked(false))
                  .catch((error: unknown) => {
                    console.error("Unable to start factory animation", error);
                    setFailed(true);
                  });
              }
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-(--brand-navy-dark)/70 text-white backdrop-blur"
          >
            {paused || playBlocked ? (
              <Play size={16} aria-hidden="true" />
            ) : (
              <Pause size={16} aria-hidden="true" />
            )}
          </button>
        ) : null}
        <Link
          href="#whats-new"
          className="ricoz-button-primary rounded-full! px-6!"
        >
          Learn more <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link
          href="/investors"
          className="hidden rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10 sm:inline-flex"
        >
          Investor relations
        </Link>
        <p className="ml-auto hidden text-[10px] font-medium uppercase tracking-[0.14em] text-white/60 lg:block">
          Product Factory animation · illustrative
        </p>
      </motion.div>
    </section>
  );
}
