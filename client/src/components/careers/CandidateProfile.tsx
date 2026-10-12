const traits = [
  "Curious about how things work",
  "Able to explain ideas clearly",
  "Willing to learn from feedback",
  "Comfortable taking responsibility",
  "Interested in the user and business context",
  "Thoughtful about quality and trade-offs",
];

export function CandidateProfile() {
  return (
    <section className="border-y border-(--brand-border) bg-(--brand-surface) py-20">
      <div className="container-ricoz grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">
            Who we look for
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-4xl">
            People who build with purpose.
          </h2>
          <p className="mt-4 text-base leading-7 text-(--brand-text-secondary)">
            Your background matters, but so does how you approach a problem,
            work with others, and keep learning.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {traits.map((trait) => (
            <li
              key={trait}
              className="flex items-start gap-3 rounded-[15px] border border-(--brand-border) bg-white p-4 text-sm font-medium leading-6 text-(--brand-navy)"
            >
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-(--brand-red)"
                aria-hidden="true"
              />
              {trait}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
