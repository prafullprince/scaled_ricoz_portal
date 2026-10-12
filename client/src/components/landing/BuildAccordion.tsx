"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { buildingStages } from "@/lib/investors/content";
import { Reveal, useFactoryReducedMotion, useLandingMotion } from "./LandingMotion";

const detail: Record<string, string> = {
  Understand: "Every Ricoz product begins with a clear business problem, the people who face it, and the workflow it should improve.",
  Build: "Product, design, and engineering work together to turn that need into software that is ready for real use.",
  Connect: "Products, services, and solutions are combined so businesses get one connected technology response.",
  Extend: "Products that prove useful grow into a broader ecosystem that Ricoz can keep improving over time.",
};

export function BuildAccordion() {
  const [open, setOpen] = useState(0);
  const reduced = useFactoryReducedMotion();
  const { paused } = useLandingMotion();
  const animate = !reduced && !paused;

  return (
    <section id="how-we-build" className="scroll-mt-24 bg-(--brand-surface) py-16 md:py-24">
      <div className="container-ricoz">
        <Reveal><h2 className="text-3xl font-black tracking-[-0.04em] text-(--brand-navy) md:text-5xl">How we build</h2></Reveal>
        <div className="mt-10 space-y-4">
          {buildingStages.map(([number, title, summary], index) => {
            const expanded = open === index;
            return (
              <Reveal key={title} x={-40} y={0} delay={index * 0.08} className="overflow-hidden rounded-[18px] bg-white shadow-(--shadow-xs)">
                <h3 className="mt-0!">
                  <button
                    type="button"
                    id={`stage-${number}`}
                    aria-expanded={expanded}
                    aria-controls={`stage-panel-${number}`}
                    onClick={() => setOpen(expanded ? -1 : index)}
                    className="flex w-full items-center gap-5 px-6 py-5 text-left md:px-8"
                  >
                    <span className="text-sm font-bold tabular-nums text-(--brand-red)">{number}</span>
                    <span className={`flex-1 text-xl font-bold transition-colors md:text-2xl ${expanded ? "text-(--brand-red)" : "text-(--brand-navy)"}`}>{title}</span>
                    <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: animate ? 0.3 : 0 }}><ChevronDown size={22} aria-hidden="true" className="text-(--brand-navy)" /></motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.div
                      id={`stage-panel-${number}`}
                      role="region"
                      aria-labelledby={`stage-${number}`}
                      initial={animate ? { height: 0, opacity: 0 } : false}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={animate ? { height: 0, opacity: 0 } : undefined}
                      transition={{ duration: animate ? 0.4 : 0, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="grid gap-6 px-6 pb-7 md:grid-cols-[1fr_1.1fr] md:px-8">
                        <div>
                          <p className="text-lg font-semibold text-(--brand-navy)">{summary}</p>
                          <p className="mt-3 text-base leading-7 text-(--brand-text-secondary)">{detail[title]}</p>
                        </div>
                        <div aria-hidden="true" className="relative flex min-h-40 items-center justify-center overflow-hidden rounded-[14px] bg-(--brand-navy-dark)">
                          {[0, 1, 2].map((ring) => (
                            <motion.span
                              key={ring}
                              className="absolute rounded-full border border-(--brand-red-soft)/40"
                              style={{ width: 80 + ring * 70, height: 80 + ring * 70 }}
                              animate={animate ? { scale: [1, 1.12, 1], opacity: [0.7, 0.25, 0.7] } : undefined}
                              transition={{ duration: 3, delay: ring * 0.4, repeat: Infinity }}
                            />
                          ))}
                          <span className="relative text-5xl font-black text-white">{number}</span>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
