"use client";

import { createContext, useContext, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { MotionConfig, motion, useInView, useScroll, useSpring, useTransform } from "framer-motion";
import { Pause, Play } from "lucide-react";

const LandingMotionContext = createContext({ paused: false });

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useFactoryReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

export function useLandingMotion() {
  return useContext(LandingMotionContext);
}

export function LandingMotion({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  const reduced = useFactoryReducedMotion();

  return (
    <LandingMotionContext.Provider value={{ paused: paused || Boolean(reduced) }}>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>
        {children}
        {!reduced ? (
          <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)} className="fixed bottom-5 right-5 z-50 flex min-h-11 items-center gap-2 rounded-full border border-(--brand-border) bg-(--brand-background)/95 px-4 text-xs font-semibold text-(--brand-navy) shadow-(--shadow-md) backdrop-blur-md">
            {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
            {paused ? "Resume animations" : "Pause animations"}
          </button>
        ) : null}
      </MotionConfig>
    </LandingMotionContext.Provider>
  );
}

export function AnimatedSection({ children, index = 0, stackable = false }: { children: ReactNode; index?: number; stackable?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, margin: "0px 0px -30px 0px" });
  const reduced = useFactoryReducedMotion();
  const { paused } = useLandingMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 0.4, 1], [18, 0, -8]);
  const smoothDrift = useSpring(drift, { stiffness: 90, damping: 30, mass: 0.25 });
  const enabled = !reduced && !paused;

  return (
    <div
      ref={ref}
      data-landing-motion="section"
      data-stack-layer={index}
      data-stack-mode={stackable ? "pinned" : "flow"}
      style={{ zIndex: index + 1 }}
    >
      <motion.div
        initial={false}
        animate={{ opacity: !enabled || visible ? 1 : 0.45, filter: !enabled || visible ? "blur(0px)" : "blur(2px)" }}
        transition={{ duration: enabled ? 0.65 : 0, delay: enabled ? (index % 3) * 0.06 : 0 }}
        style={{ y: enabled ? smoothDrift : 0 }}
      >{children}</motion.div>
    </div>
  );
}

export function FactoryHeadline() {
  const reduced = useFactoryReducedMotion();
  const { paused } = useLandingMotion();
  const lines = [
    ["A", "Product", "Factory."],
    ["Built", "for", "real", "business."],
  ];
  return (
    <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-black leading-[1.08] text-(--brand-navy) sm:text-5xl lg:text-7xl">
      {lines.map((words, line) => (
        <span key={line} className="block">
          {words.map((word, index) => (
            <motion.span
              key={`${word}-${reduced ? "static" : "animated"}`}
              initial={reduced || paused ? false : { opacity: 0, y: 32, rotateX: -25 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: reduced || paused ? 0 : 0.7, delay: (line * 3 + index) * 0.08 }}
              className={`inline-block ${line === 0 && index > 0 ? "text-(--brand-red)" : ""}`}
            >{word}{index < words.length - 1 ? "\u00a0" : ""}</motion.span>
          ))}
        </span>
      ))}
    </h1>
  );
}

export function AnimatedCard({ children, className, index = 0 }: { children: ReactNode; className: string; index?: number }) {
  const ref = useRef<HTMLElement>(null);
  const visible = useInView(ref, { once: true, margin: "0px 0px -20px 0px" });
  const reduced = useFactoryReducedMotion();
  const { paused } = useLandingMotion();
  const enabled = !reduced && !paused;
  return (
    <motion.article
      ref={ref}
      className={className}
      initial={false}
      animate={{ opacity: !enabled || visible ? 1 : 0.6, y: !enabled || visible ? 0 : 32 }}
      whileHover={enabled ? { y: -6, scale: 1.015 } : undefined}
      whileTap={enabled ? { scale: 0.99 } : undefined}
      transition={{ duration: enabled ? 0.45 : 0, delay: enabled && visible ? index * 0.06 : 0 }}
    >{children}</motion.article>
  );
}

export function useRevealMotion<T extends Element>(margin: `${number}px ${number}px ${number}px ${number}px` = "0px 0px -60px 0px") {
  const ref = useRef<T>(null);
  const visible = useInView(ref, { once: true, margin });
  const reduced = useFactoryReducedMotion();
  const { paused } = useLandingMotion();
  const enabled = !reduced && !paused;
  return { ref, enabled, shown: !enabled || visible };
}

export function Reveal({ children, className, delay = 0, x = 0, y = 32 }: { children: ReactNode; className?: string; delay?: number; x?: number; y?: number }) {
  const { ref, enabled, shown } = useRevealMotion<HTMLDivElement>();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={shown ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x, y }}
      transition={{ duration: enabled ? 0.6 : 0, delay: enabled ? delay : 0, ease: [0.22, 1, 0.36, 1] }}
    >{children}</motion.div>
  );
}
