import {
  Bot,
  BriefcaseBusiness,
  Cloud,
  Code2,
  Cpu,
  Database,
  LayoutDashboard,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface Service {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  icon: LucideIcon;
  href: string;
  featured?: boolean;
  outcome?: string;
}

export const services: Service[] = [
  {
    id: "web-development",
    title: "Web Development",
    shortDescription: "Modern, conversion-focused websites and digital experiences built for growth and trust.",
    description:
      "We design and build websites that help businesses present their value clearly, communicate more effectively, and turn visitors into customers.",
    category: "Development",
    icon: LayoutDashboard,
    href: "/contact",
    featured: true,
    outcome: "A credible digital presence that converts.",
  },
  {
    id: "full-stack-development",
    title: "Full-Stack Development",
    shortDescription: "End-to-end product engineering across the front end, API layer, and infrastructure.",
    description:
      "Ricoz builds complete digital products and internal systems with architecture designed for reliability, scale, and operational clarity.",
    category: "Development",
    icon: Code2,
    href: "/contact",
    featured: true,
    outcome: "A product that is stable, connected, and ready to scale.",
  },
  {
    id: "custom-software-development",
    title: "Custom Software Development",
    shortDescription: "Business-specific platforms built around your workflows, users, and goals.",
    description:
      "We create custom software that supports real business requirements, improves operations, and replaces manual processes with dependable systems.",
    category: "Business",
    icon: BriefcaseBusiness,
    href: "/contact",
    outcome: "Solutions aligned directly to your business process.",
  },
  {
    id: "ai-solutions",
    title: "AI Solutions",
    shortDescription: "Practical AI tools that improve workflows, productivity, and decision support.",
    description:
      "We help businesses identify valuable AI use cases and build the supporting workflows and interfaces behind them.",
    category: "AI",
    icon: Bot,
    href: "/contact",
    outcome: "Smarter operations without unnecessary complexity.",
  },
  {
    id: "ui-ux-development",
    title: "UI/UX Development",
    shortDescription: "Product design and interface systems that are simple, clear, and easy to trust.",
    description:
      "We shape product interactions and digital experiences so they are intuitive, consistent, and aligned to real user needs.",
    category: "Design",
    icon: Sparkles,
    href: "/contact",
    outcome: "A clearer product experience for users and teams.",
  },
  {
    id: "cloud-deployment",
    title: "Cloud & Deployment",
    shortDescription: "Reliable launch, deployment strategy, and operational support for digital products.",
    description:
      "We help ensure technology is deployed smoothly, runs reliably, and is ready to support business usage in production environments.",
    category: "Cloud",
    icon: Cloud,
    href: "/contact",
    outcome: "A dependable digital product your team can trust.",
  },
  {
    id: "backend-development",
    title: "Backend Development",
    shortDescription: "APIs, integrations, and infrastructure architecture built for business-critical systems.",
    description:
      "We design the systems that power modern products, including APIs, database access, business logic, and secure integrations.",
    category: "Development",
    icon: Database,
    href: "/contact",
    outcome: "Reliable systems behind every business workflow.",
  },
  {
    id: "business-automation",
    title: "Business Automation",
    shortDescription: "Process automation that reduces manual work and improves consistency.",
    description:
      "Ricoz helps teams automate repetitive operational work so people can focus on higher-value activities and decision-making.",
    category: "Business",
    icon: Cpu,
    href: "/contact",
    outcome: "Less admin work, more momentum.",
  },
  {
    id: "saas-development",
    title: "SaaS Development",
    shortDescription: "Product architecture for scalable, user-facing software businesses.",
    description:
      "We help build SaaS products that can evolve with users, business complexity, and future product growth.",
    category: "Development",
    icon: Rocket,
    href: "/contact",
    outcome: "A scalable product foundation built for growth.",
  },
];
