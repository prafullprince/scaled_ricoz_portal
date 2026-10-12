import Link from "next/link";
import type { ReactNode } from "react";

export function AuthLayout({ children, contentClassName = "max-w-115" }: { children: ReactNode; contentClassName?: string }) {
  return (
    <main className="min-h-screen bg-(--brand-surface) text-(--brand-text)">
      <div className="mx-auto flex min-h-screen max-w-360 flex-col lg:flex-row">

        <aside className="relative hidden overflow-hidden bg-(--brand-navy) px-12 py-10 text-white lg:flex lg:w-[42%] lg:flex-col lg:justify-between xl:px-20">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full border border-(--brand-red)/30" />
          <Link
            href="/"
            className="relative z-10 text-xl font-bold tracking-[0.22em]"
          >
            RICOZ
          </Link>
          <div className="relative z-10 max-w-sm pb-10">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red-soft)">
              Built for what&apos;s next
            </p>
            <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">
              Move your work forward with clarity.
            </h1>
            <p className="mt-6 text-base leading-7 text-white/65">
              One secure account for the products, services, and opportunities
              that make Ricoz useful.
            </p>
          </div>
          <p className="relative z-10 text-xs text-white/45">
            © {new Date().getFullYear()} Ricoz. All rights reserved.
          </p>
        </aside>
        
        <section className="flex min-h-screen flex-1 flex-col px-5 py-7 sm:px-10 sm:py-10">
          <header className="flex items-center justify-between lg:justify-end">
            <Link
              href="/"
              className="text-lg font-bold tracking-[0.2em] text-(--brand-navy) lg:hidden"
            >
              RICOZ
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-(--brand-text-secondary) transition-colors hover:text-(--brand-red)"
            >
              Back to Ricoz
            </Link>
          </header>
          <div className="flex flex-1 items-center justify-center py-10">
            <div className={`w-full ${contentClassName}`}>{children}</div>
          </div>
          <footer className="text-center text-xs text-(--brand-text-muted)">
            A focused, secure Ricoz experience.
          </footer>
        </section>
      </div>
    </main>
  );
}

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-(--brand-text)"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="text-sm text-(--status-danger)"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClassName = (hasError = false) =>
  `h-12 w-full rounded-(--radius-md) border bg-white px-4 text-[15px] text-(--brand-text) outline-none transition placeholder:text-(--brand-text-muted) focus:ring-4 ${hasError ? "border-(--status-danger) focus:border-(--status-danger) focus:ring-(--status-danger-bg)" : "border-(--brand-border-strong) focus:border-(--brand-red) focus:ring-(--brand-red-pale)"}`;

export function FormMessage({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success";
}) {
  return (
    <div
      aria-live="polite"
      className={`rounded-md border px-4 py-3 text-sm ${tone === "success" ? "border-(--status-success-border) bg-(--status-success-bg) text-(--status-success)" : "border-(--status-danger-border) bg-(--status-danger-bg) text-(--status-danger)"}`}
    >
      {children}
    </div>
  );
}
