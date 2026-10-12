import { growthStory } from "@/lib/investors/content";

export function VisionAndGrowth() {
  return (
    <section className="border-y border-(--brand-border) bg-[linear-gradient(180deg,var(--brand-surface),var(--brand-background))] py-16 md:py-24">
      <div className="container-ricoz">
        <div className="grid gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">Vision &amp; direction</p>
            <h2 className="mt-3! text-3xl font-black leading-tight tracking-[-0.055em] text-(--brand-navy) md:text-4xl">
              Build an ecosystem where technology becomes a business advantage.
            </h2>
            <p className="mt-4! text-base leading-7 text-(--brand-text-secondary)">
              The long-term direction is deliberate: create useful products, expand
              the capabilities around them, solve more business problems, and connect
              the ecosystem as it grows.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {growthStory.map(([title, description], index) => (
              <li
                key={title}
                className="rounded-[20px] border border-(--brand-border) bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-(--brand-red)/25 hover:shadow-md"
              >
                <span className="flex size-8 items-center justify-center rounded-xl bg-(--brand-red-pale) text-xs font-bold text-(--brand-red)">
                  0{index + 1}
                </span>
                <p className="mt-4! text-sm font-bold text-(--brand-navy)">{title}</p>
                <p className="mt-2! text-xs leading-5 text-(--brand-text-secondary)">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
