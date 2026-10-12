"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Reveal, useFactoryReducedMotion, useLandingMotion, useRevealMotion } from "./LandingMotion";

export function CareersBand() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useFactoryReducedMotion();
  const { paused } = useLandingMotion();
  const animate = !reduced && !paused;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const { ref: drawRef, shown: drawn } = useRevealMotion<SVGSVGElement>();
  const rotate = useTransform(scrollYProgress, [0, 1], [-25, 25]);
  const x = useTransform(scrollYProgress, [0, 1], [-60, 60]);

  return (
    <section ref={ref} id="careers" className="relative scroll-mt-24 overflow-hidden bg-(--brand-navy) py-20 text-white md:py-28">
      <motion.svg ref={drawRef} aria-hidden="true" viewBox="0 0 600 600" style={{ rotate: animate ? rotate : 0, x: animate ? x : 0 }} className="pointer-events-none absolute -right-40 top-1/2 size-[640px] -translate-y-1/2 opacity-60">
        {[0, 1, 2, 3, 4].map((ring) => (
          <motion.ellipse
            key={ring}
            cx="300" cy="300" rx={120 + ring * 40} ry={60 + ring * 25}
            fill="none"
            stroke={ring === 2 ? "var(--brand-red)" : "rgba(255,255,255,0.18)"}
            strokeWidth={ring === 2 ? 2 : 1}
            initial={false}
            animate={{ pathLength: drawn ? 1 : 0 }}
            transition={{ duration: animate ? 1.6 : 0, delay: animate ? ring * 0.15 : 0 }}
          />
        ))}
      </motion.svg>
      <div className="container-ricoz relative">
        <Reveal y={40} className="max-w-2xl">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-(--brand-red-soft)!">Careers</h2>
          <p className="mt-5 text-4xl font-black leading-[1.05] tracking-[-0.04em] text-white md:text-6xl">Build what comes next</p>
          <p className="mt-6 text-base leading-8 text-white/75 md:text-lg">Our teams turn real business problems into products people rely on. Bring your curiosity and craft to the Ricoz Product Factory.</p>
          <Link href="/careers" className="ricoz-button-primary mt-8 rounded-full! px-6!">Come join us <ArrowRight size={16} aria-hidden="true" /></Link>
        </Reveal>
      </div>
    </section>
  );
}

export function ContactBand() {
  const { ref, enabled: animate, shown } = useRevealMotion<HTMLHeadingElement>();
  const words = ["Build", "intelligent", "products", "with", "Ricoz"];

  return (
    <section id="contact-us" aria-labelledby="contact-heading" className="scroll-mt-24 bg-(--brand-red-pale) py-16 md:py-24">
      <div className="container-ricoz flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
        <h2 ref={ref} id="contact-heading" className="max-w-2xl text-3xl font-black tracking-[-0.04em] text-(--brand-navy) md:text-5xl">
          {words.map((word, index) => (
            <motion.span
              key={word}
              initial={false}
              animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: animate ? 0.5 : 0, delay: animate ? index * 0.08 : 0 }}
              className={`inline-block ${index === words.length - 1 ? "text-(--brand-red)" : ""}`}
            >{word}{index < words.length - 1 ? "\u00a0" : ""}</motion.span>
          ))}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/contact" className="ricoz-button-primary rounded-full! px-7!">Contact us <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/investors" className="ricoz-button-secondary rounded-full! px-6!">Investor relations</Link>
        </div>
      </div>
    </section>
  );
}
