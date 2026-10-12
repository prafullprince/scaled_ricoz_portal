import Link from "next/link";

const footerGroups = [
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "How we build", href: "/#how-we-build" },
    ],
  },
  {
    heading: "Products",
    links: [
      { label: "Product Directory", href: "/products" },
      { label: "What's new", href: "/whats-new" },
      { label: "Product stories", href: "/#products" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Product portfolio", href: "/products" },
      { label: "Technology services", href: "/services#service-marketplace" },
      { label: "Business solutions", href: "/solutions" },
    ],
  },
  {
    heading: "Investors",
    links: [
      { label: "Investor Relations", href: "/investors" },
      { label: "Investor account", href: "/signup?role=investor" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    heading: "Contact",
    links: [
      { label: "Contact Ricoz", href: "/contact" },
      { label: "Request investor information", href: "/contact" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer id="contact" className="bg-[var(--brand-navy)] text-white">
      <div className="container-ricoz py-16">
        <div className="mb-10 border-b border-white/10 pb-8">
            <Link href="/" className="flex items-center gap-3" aria-label="Ricoz home">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--brand-red)] text-sm font-black text-white">
                R
              </span>
              <span className="text-lg font-extrabold tracking-[-0.04em] text-white">Ricoz</span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/70">
              Ricoz builds digital products and technology solutions that help businesses operate, grow, and scale with confidence.
            </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {footerGroups.map((group) => (
            <div key={group.heading}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60!">
                {group.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/75 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Ricoz. All rights reserved.</p>
          <p>Products. Services. Business technology.</p>
        </div>
      </div>
    </footer>
  );
}
