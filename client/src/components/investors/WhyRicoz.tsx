import { strategicReasons } from "@/lib/investors/content";

export function WhyRicoz() {
  return (
    <section className="relative isolate overflow-hidden border-y border-white/10 bg-[radial-gradient(ellipse_at_90%_0%,rgba(201,29,32,0.22),transparent_38%),linear-gradient(120deg,#101a2c,#1d2a40)] py-16 text-white md:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-32 size-80 rounded-full border border-white/5" />
      <div className="container-ricoz relative grid gap-9 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red-soft)">Why Ricoz</p>
          <h2 className="mt-3! text-3xl font-black leading-tight tracking-[-0.055em] text-white md:text-4xl">
            A long-term direction built from connected capabilities.
          </h2>
          <p className="mt-4! text-base leading-7 text-white/70">
            The public case for Ricoz is about the shape of the business: products,
            services, and solutions developed around a shared technology and business focus.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {strategicReasons.map((reason, index) => (
            <li key={reason} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/80 backdrop-blur-sm">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--brand-red)/20 text-[10px] font-bold text-(--brand-red-soft)">
                0{index + 1}
              </span>
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
