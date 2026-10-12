import {
  Bot,
  BriefcaseBusiness,
  CreditCard,
  Database,
  LayoutDashboard,
  MessageSquare,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface Solution {
  id: string;
  title: string;
  description: string;
  problem: string;
  outcome: string;
  category: string;
  icon: LucideIcon;
  services: string[];
  href: string;
  featured?: boolean;
}

export const solutions: Solution[] = [
  {
    id: "financial-operations",
    title: "Financial Operations",
    description: "Connect invoicing, expense tracking, payment visibility, and reporting into a clearer financial workflow.",
    problem: "Invoices, expenses, and payment information are difficult to manage across disconnected workflows.",
    outcome: "Better visibility across day-to-day financial operations.",
    category: "Finance",
    icon: CreditCard,
    services: ["Custom Software Development", "Business Automation"],
    href: "#financial-operations",
    featured: true,
  },
  {
    id: "business-automation",
    title: "Business Automation",
    description: "Reduce repetitive manual work with connected workflows designed around how your team operates.",
    problem: "Teams spend too much time repeating work and coordinating across disconnected tools.",
    outcome: "More consistent operations and more time for higher-value work.",
    category: "Automation",
    icon: Workflow,
    services: ["Business Automation", "Backend Development"],
    href: "#business-automation",
  },
  {
    id: "digital-products",
    title: "Digital Products",
    description: "Turn a product idea or business opportunity into a useful, scalable digital experience.",
    problem: "A promising idea needs a clear product direction and dependable technical foundation.",
    outcome: "A focused product experience ready to evolve with its users.",
    category: "Technology",
    icon: LayoutDashboard,
    services: ["Full-Stack Development", "UI/UX Development"],
    href: "#digital-products",
  },
  {
    id: "custom-systems",
    title: "Custom Business Systems",
    description: "Build software around specific workflows, teams, and operational requirements instead of forcing a generic tool to fit.",
    problem: "Off-the-shelf tools leave important business processes fragmented or underserved.",
    outcome: "A system aligned to the way your business actually works.",
    category: "Business",
    icon: BriefcaseBusiness,
    services: ["Custom Software Development", "Full-Stack Development"],
    href: "#custom-systems",
  },
  {
    id: "ai-enabled-workflows",
    title: "AI-Enabled Workflows",
    description: "Identify practical AI opportunities and connect them to useful business workflows and interfaces.",
    problem: "Teams want to use AI but need a clear, practical path from idea to implementation.",
    outcome: "Useful AI capability embedded into real work, without unnecessary complexity.",
    category: "AI",
    icon: Bot,
    services: ["AI Solutions", "Backend Development"],
    href: "#ai-enabled-workflows",
  },
  {
    id: "connected-communication",
    title: "Connected Communication",
    description: "Create clearer communication flows for teams, customers, and business operations.",
    problem: "Important updates and conversations are spread across channels with limited shared context.",
    outcome: "More coordinated communication and better access to business information.",
    category: "Communication",
    icon: MessageSquare,
    services: ["Custom Software Development", "Cloud & Deployment"],
    href: "#connected-communication",
  },
];

export const businessChallenges = [
  { title: "Manual business processes", solution: "Business Automation", icon: Workflow },
  { title: "Fragmented financial workflows", solution: "Financial Operations", icon: CreditCard },
  { title: "A need for custom software", solution: "Custom Business Systems", icon: Database },
  { title: "A digital product to launch", solution: "Digital Products", icon: LayoutDashboard },
  { title: "Practical AI adoption", solution: "AI-Enabled Workflows", icon: Bot },
  { title: "Disconnected team communication", solution: "Connected Communication", icon: MessageSquare },
] as const;
