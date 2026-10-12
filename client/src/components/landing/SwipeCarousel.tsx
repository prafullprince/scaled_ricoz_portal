"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFactoryReducedMotion, useLandingMotion } from "./LandingMotion";

type Props = {
  label: string;
  heading: ReactNode;
  children: ReactNode[];
  tone?: "light" | "dark";
  className?: string;
  peek?: boolean;
};

export function SwipeCarousel({
  label,
  heading,
  children,
  tone = "light",
  className,
  peek = false,
}: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [hasOverflow, setHasOverflow] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const reduced = useFactoryReducedMotion();
  const { paused } = useLandingMotion();

  const update = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const overflows = element.scrollWidth > element.clientWidth + 4;
    setHasOverflow(overflows);
    const nextEdges = {
      start: !overflows || element.scrollLeft <= 4,
      end: !overflows || element.scrollLeft + element.clientWidth >= element.scrollWidth - 4,
    };
    setEdges((current) =>
      current.start === nextEdges.start && current.end === nextEdges.end
        ? current
        : nextEdges,
    );
    const trackLeft = element.getBoundingClientRect().left;
    const slides = Array.from(
      element.querySelectorAll<HTMLElement>("[data-slide]"),
    );
    const nearest = slides.reduce(
      (result, slide, index) => {
        const distance = Math.abs(slide.getBoundingClientRect().left - trackLeft);
        return distance < result.distance ? { index, distance } : result;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    );
    setActiveSlide((current) =>
      current === nearest.index ? current : nearest.index,
    );
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.querySelectorAll<HTMLElement>("[data-slide]").forEach((slide) => observer.observe(slide));
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [children.length, update]);

  function move(direction: 1 | -1) {
    const element = track.current;
    const slide = element?.querySelector<HTMLElement>("[data-slide]");
    if (!element || !slide) return;
    element.scrollBy({ left: direction * (slide.offsetWidth + 24), behavior: reduced || paused ? "auto" : "smooth" });
  }

  function goTo(index: number) {
    const element = track.current;
    const slide = element?.querySelectorAll<HTMLElement>("[data-slide]")[index];
    if (!element || !slide) return;
    const behavior = reduced || paused ? "auto" : "smooth";
    element.scrollTo({
      left:
        element.scrollLeft +
        slide.getBoundingClientRect().left -
        element.getBoundingClientRect().left,
      behavior,
    });
  }

  const button = tone === "dark"
    ? "border-white/25 text-white hover:bg-white/10"
    : "border-(--brand-border) text-(--brand-navy) hover:border-(--brand-red-soft) hover:text-(--brand-red)";
  const slideWidth = children.length <= 2
    ? "lg:w-[calc(50%-12px)]"
    : peek
      ? "lg:w-[calc(40%-16px)]"
      : "lg:w-[calc(33.333%-16px)]";

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className={className}>
      <div className="flex items-end justify-between gap-6">
        {heading}
        <div className="flex shrink-0 gap-3">
          <button type="button" aria-label="Previous slide" disabled={edges.start} onClick={() => move(-1)} className={`flex size-11 items-center justify-center rounded-full border transition-colors disabled:opacity-30 ${button}`}><ArrowLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Next slide" disabled={edges.end} onClick={() => move(1)} className={`flex size-11 items-center justify-center rounded-full border transition-colors disabled:opacity-30 ${button}`}><ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </div>
      <div
        ref={track}
        onScroll={update}
        className="mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-6 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children.map((child, index) => (
          <div key={index} data-slide role="group" aria-roledescription="slide" aria-label={`${index + 1} / ${children.length}`} className={`w-[85%] shrink-0 snap-start sm:w-[calc(50%-12px)] ${slideWidth}`}>
            {child}
          </div>
        ))}
      </div>
      {children.length > 1 && hasOverflow ? (
        <div
          role="group"
          aria-label="Slide pagination"
          className="flex items-center justify-center gap-2"
        >
          {children.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={activeSlide === index ? "page" : undefined}
              onClick={() => goTo(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                activeSlide === index
                  ? "w-7 bg-(--brand-red)"
                  : "w-2 bg-(--brand-border-strong) hover:bg-(--brand-red-soft)"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
