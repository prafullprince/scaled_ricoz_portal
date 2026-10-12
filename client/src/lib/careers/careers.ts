import {
  Bot,
  BriefcaseBusiness,
  Code2,
  Database,
  GraduationCap,
  Palette,
  type LucideIcon,
} from "lucide-react";

export interface Job {
  id: string;
  title: string;
  department: string;
  employmentType: string;
  location?: string;
  experience?: string;
  description: string;
  skills?: string[];
  status: "open" | "closed";
  href?: string;
}

export interface CareerArea {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const careerAreas: CareerArea[] = [
  {
    id: "engineering",
    title: "Engineering",
    description: "Build reliable products, platforms, and business systems across the Ricoz technology stack.",
    icon: Code2,
  },
  {
    id: "product-design",
    title: "Product & Design",
    description: "Shape clear product experiences that connect user needs with useful business outcomes.",
    icon: Palette,
  },
  {
    id: "ai-automation",
    title: "AI & Automation",
    description: "Explore practical ways to improve workflows with intelligent systems and thoughtful automation.",
    icon: Bot,
  },
  {
    id: "business-operations",
    title: "Business & Operations",
    description: "Help turn business opportunities into focused products, delivery, and lasting relationships.",
    icon: BriefcaseBusiness,
  },
  {
    id: "data-platforms",
    title: "Data & Platforms",
    description: "Work with the systems, APIs, and infrastructure that make digital products dependable.",
    icon: Database,
  },
  {
    id: "internships",
    title: "Internships",
    description: "Early-career opportunities to learn through practical work across products and technology.",
    icon: GraduationCap,
  },
];

export const openJobs: Job[] = [];

export const hiringSteps = [
  ["01", "Apply", "Share your profile for an open role or tell us where you could contribute."],
  ["02", "Review", "We review your experience, interests, and fit for the opportunity."],
  ["03", "Conversation", "Talk through your work, how you think, and what you want to learn."],
  ["04", "Role discussion", "Explore the role, expectations, and the kind of work you may take on."],
  ["05", "Next steps", "We share the outcome and the clearest path forward."],
] as const;
