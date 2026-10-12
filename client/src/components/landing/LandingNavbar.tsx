"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, LayoutGrid, Menu, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import styles from "./LandingNavbar.module.css";

const menus = [
  {
    label: "What we do",
    intro:
      "Products, services, and solutions built around real business needs.",
    cta: { label: "Explore Ricoz capabilities", href: "/#what-we-do" },
    links: [
      {
        label: "Products",
        href: "/products",
        note: "Software built for recurring business needs",
      },
      {
        label: "Services",
        href: "/services",
        note: "Design and delivery of digital systems",
      },
      {
        label: "Solutions",
        href: "/solutions",
        note: "Technology connected to business outcomes",
      },
      {
        label: "Product Factory",
        href: "/#products",
        note: "Every product live in production",
      },
    ],
  },
  {
    label: "Who we are",
    intro:
      "Ricoz Innovation is a product company that turns practical problems into useful technology.",
    cta: { label: "About Ricoz", href: "/about" },
    links: [
      { label: "About Ricoz", href: "/about", note: "Our story and beliefs" },
      {
        label: "How we build",
        href: "/#how-we-build",
        note: "From understanding to ecosystem",
      },
      {
        label: "Explore Ricoz",
        href: "/#explore",
        note: "Every part of Ricoz in one place",
      },
      { label: "Contact", href: "/contact", note: "Start a conversation" },
    ],
  },
  {
    label: "Products",
    intro:
      "Every product shown is live in production and comes directly from the Ricoz database.",
    cta: { label: "Product directory", href: "/products" },
    links: [
      {
        label: "Product directory",
        href: "/products",
        note: "Search and filter all products",
      },
      {
        label: "What's new",
        href: "/#whats-new",
        note: "Latest products in production",
      },
      {
        label: "Product stories",
        href: "/#products",
        note: "Swipe through the portfolio",
      },
    ],
  },
  {
    label: "Careers",
    intro:
      "Build what comes next with the teams behind the Ricoz Product Factory.",
    cta: { label: "Come join us", href: "/careers" },
    links: [
      {
        label: "Careers & roles",
        href: "/careers",
        note: "Open jobs and internships",
      },
      { label: "Life at Ricoz", href: "/#careers", note: "How our teams work" },
    ],
  },
  {
    label: "Investors",
    intro:
      "Understand the Ricoz opportunity and request verified investor access.",
    cta: { label: "Investor relations", href: "/investors" },
    links: [
      {
        label: "Investor relations",
        href: "/investors",
        note: "The Ricoz investment story",
      },
      {
        label: "Investor account",
        href: "/signup?role=investor",
        note: "Request verified access",
      },
      {
        label: "Sign in",
        href: "/login",
        note: "Access your investor dashboard",
      },
    ],
  },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();
  const pathname = usePathname();
  const current = menus.find((item) => item.label === menu);

  const openMenu = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenu(label);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenu(null), 150);
  };

  // Hover-opened menus do not hold focus, so Escape must be handled at document level.
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  return (
    <header
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        const target = menu
          ? `[data-menu="${menu}"]`
          : '[aria-controls="mobile-navigation"]';
        setOpen(false);
        setMenu(null);
        event.currentTarget.querySelector<HTMLButtonElement>(target)?.focus();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMenu(null);
      }}
      onMouseLeave={scheduleClose}
      className={styles.navbar}
    >
      <nav
        aria-label="Main navigation"
        className={`${styles.content} flex h-19 items-center justify-between gap-3`}
      >
        <div className="flex min-w-0 shrink-0 items-center">
          <Link
            href="/"
            className="flex items-center gap-3 pr-5 transition-opacity hover:opacity-80 sm:pr-7"
            aria-label="Ricoz home"
          >
            <span className="flex size-11 items-center justify-center rounded-[13px] bg-[#c91d20] text-white shadow-[0_5px_14px_rgba(201,29,32,0.2)]">
              <LayoutGrid size={22} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <span className="text-[19px] font-extrabold tracking-[-0.045em] text-white">
              Ricoz<span className="text-[#c91d20]">.</span>
            </span>
          </Link>
          {/* <div className="hidden h-10 items-center border-l border-white/20 pl-5 sm:flex sm:pl-7">
            <span className="whitespace-nowrap text-sm font-semibold text-white/70">
              Product Factory
            </span>
          </div> */}
        </div>

        <ul className="hidden h-full items-center gap-0.5 xl:flex">
          {menus.map((item) => {
            const active = item.links.some(
              (link) =>
                !link.href.includes("#") &&
                link.href !== "/login" &&
                pathname.startsWith(link.href.split("?")[0]),
            );
            return (
              <li
                key={item.label}
                className="h-full"
                onMouseEnter={() => openMenu(item.label)}
              >
                <button
                  type="button"
                  data-menu={item.label}
                  aria-expanded={menu === item.label}
                  aria-controls="mega-menu"
                  onClick={() =>
                    setMenu(menu === item.label ? null : item.label)
                  }
                  className={`relative flex h-full items-center gap-1.5 px-2.5 text-[13px] font-semibold transition-colors after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:origin-left after:bg-[#c91d20] after:transition-transform ${menu === item.label || active ? "text-white after:scale-x-100" : "text-white/70 after:scale-x-0 hover:text-white"}`}
                >
                  {item.label}
                  <ChevronDown
                    size={13}
                    aria-hidden="true"
                    className={`transition-transform ${menu === item.label ? "rotate-180" : ""}`}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="hidden items-center gap-2 xl:flex">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-4 text-[13px] font-semibold text-white shadow-sm backdrop-blur-md transition-colors hover:bg-white/20"
          >
            Sign in
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#c91d20] px-4 text-[13px] font-semibold text-white shadow-[0_5px_14px_rgba(201,29,32,0.18)] transition-colors hover:bg-[#ad181b]"
          >
            Contact us <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-white/20 xl:hidden"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      <AnimatePresence>
        {current ? (
          <motion.div
            id="mega-menu"
            key="mega"
            onMouseEnter={() => openMenu(current.label)}
            initial={reduced ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-full hidden border-y border-white/15 bg-[rgba(12,12,12,0.96)] text-white shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl xl:block"
          >
            <div className={`${styles.content} grid grid-cols-[0.9fr_1.6fr] gap-12 py-10`}>
              <motion.div
                key={current.label}
                initial={reduced ? false : { opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c91d20]">
                  {current.label}
                </p>
                <p className="mt-4 text-2xl font-bold leading-snug text-white">
                  {current.intro}
                </p>
                <Link
                  href={current.cta.href}
                  onClick={() => setMenu(null)}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#c91d20]"
                >
                  {current.cta.label}{" "}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </motion.div>
              <ul className="grid grid-cols-2 gap-x-8 gap-y-2">
                {current.links.map((link, index) => (
                  <motion.li
                    key={`${current.label}-${link.href}`}
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMenu(null)}
                      className="group block rounded-[12px] px-4 py-4 transition-colors hover:bg-white/10"
                    >
                      <span className="flex items-center gap-2 text-base font-semibold text-white group-hover:text-[#c91d20]">
                        {link.label}
                        <ArrowRight
                          size={14}
                          aria-hidden="true"
                          className="opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100"
                        />
                      </span>
                      <span className="mt-1 block text-sm text-white/55">
                        {link.note}
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {open ? (
        <div
          id="mobile-navigation"
          className="max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-white/15 bg-[rgba(12,12,12,0.98)] text-white shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl xl:hidden"
        >
          <div className={`${styles.content} py-4`}>
            {menus.map((item) => (
              <div
                key={item.label}
                className="border-b border-white/15"
              >
                <button
                  type="button"
                  aria-expanded={mobileGroup === item.label}
                  onClick={() =>
                    setMobileGroup(
                      mobileGroup === item.label ? null : item.label,
                    )
                  }
                  className="flex w-full items-center justify-between py-4 text-left text-base font-semibold text-white"
                >
                  {item.label}
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`transition-transform ${mobileGroup === item.label ? "rotate-180" : ""}`}
                  />
                </button>
                {mobileGroup === item.label ? (
                  <ul className="pb-3">
                    {item.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className="block rounded-md px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
            <div className="mt-4 flex gap-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md border border-white/20 px-4 py-2 text-center text-sm font-semibold text-white"
              >
                Sign in
              </Link>
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md bg-[#c91d20] px-4 py-2 text-center text-sm font-semibold text-white"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
