import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, GraduationCap, Sparkles } from "lucide-react";

const careerRoles = [
  {
    title: "Internships",
    description: "Hands-on learning opportunities for students and early-stage talent building real products and business systems.",
    action: "Apply for internship",
    href: "/contact",
    icon: GraduationCap,
  },
  {
    title: "Jobs",
    description: "Full-time roles for people who want to contribute to product delivery, technology, and business growth.",
    action: "View open positions",
    href: "/contact",
    icon: BriefcaseBusiness,
  },
  {
    title: "Engineering & Technology",
    description: "Product, platform, and engineering roles focused on building durable systems and valuable customer outcomes.",
    action: "Explore engineering roles",
    href: "/contact",
    icon: Sparkles,
  },
];

export function CareersSection() {
  return (
    <section id="careers" className="bg-[var(--brand-surface)] py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
            Careers
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
            Build with us.
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--brand-text-secondary)]">
            We work on meaningful products, solve practical problems, and give people the space to learn, contribute, and grow alongside a focused, technology-driven team.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {careerRoles.map(({ title, description, action, href, icon: Icon }) => (
            <article
              key={title}
              className="flex h-full flex-col rounded-[22px] border border-[var(--brand-border)] bg-[var(--brand-background)] p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[var(--brand-red-pale)] text-[var(--brand-red)]">
                <Icon size={20} />
              </div>

              <h3 className="mt-5 text-2xl font-bold tracking-[-0.05em] text-[var(--brand-navy)]">
                {title}
              </h3>

              <p className="mt-3 flex-1 text-sm leading-6 text-[var(--brand-text-secondary)]">
                {description}
              </p>

              <Link href={href} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-red)]">
                {action}
                <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
