import { getPublicMarketingBlogs } from "@/lib/marketing/blogs.server";
import { WhatsNewCarousel } from "./WhatsNewCarousel";

export async function WhatsNew() {
  const result = await getPublicMarketingBlogs();

  return (
    <section
      id="whats-new"
      className="relative isolate scroll-mt-24 overflow-hidden border-y border-white/10 bg-[radial-gradient(ellipse_at_12%_0%,rgba(201,29,32,0.2),transparent_38%),radial-gradient(ellipse_at_100%_72%,rgba(68,94,145,0.26),transparent_40%),linear-gradient(135deg,#0b1220,#18243a_58%,#101a2c)] py-20 md:py-28"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-20 size-72 rounded-full border border-white/5" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-32 size-48 rounded-full border border-white/5" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-32 size-96 rounded-full bg-(--brand-red)/10 blur-3xl" />
      <div className="container-ricoz relative">
        {result.ok ? (
          result.blogs.length ? (
            <WhatsNewCarousel blogs={result.blogs} />
          ) : (
            <>
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white/75">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]" />
                  Inside Ricoz
                </p>
                <h2 className="mt-5! text-4xl font-black tracking-[-0.06em] text-white md:text-6xl">
                  What&apos;s new<span className="text-red-400">.</span>
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-white/65 md:text-lg">
                  Ideas, milestones, and stories from the people building at Ricoz.
                </p>
                <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.05] p-7 shadow-2xl backdrop-blur-sm md:p-10">
                  <p className="text-lg font-bold text-white">Stories in the making</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    New stories from Ricoz are on the way. Check back soon.
                  </p>
                </div>
              </div>
            </>
          )
        ) : (
          <p
            role="alert"
            className="rounded-3xl border border-rose-200/15 bg-rose-400/10 p-6 text-sm text-white/80 shadow-(--shadow-sm)"
          >
            {result.message}
          </p>
        )}
      </div>
    </section>
  );
}
