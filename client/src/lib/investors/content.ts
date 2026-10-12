import { Blocks, Compass, Layers3, Lightbulb, Network, Route, type LucideIcon } from "lucide-react";

export interface InvestorPillar {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const investorPillars: InvestorPillar[] = [
  { title: "Products", description: "Software products built around recurring business needs.", icon: Blocks },
  { title: "Services", description: "Technology capabilities that help businesses design and deliver digital systems.", icon: Layers3 },
  { title: "Solutions", description: "Business-focused implementations that connect problems to practical technology outcomes.", icon: Network },
];

export const buildingStages = [
  ["01", "Understand", "Start with a real business need."],
  ["02", "Build", "Create a product or technology response."],
  ["03", "Connect", "Bring products, services, and solutions together."],
  ["04", "Extend", "Develop a broader ecosystem over time."],
] as const;

export const opportunityThemes = [
  ["Business need", "Modern businesses need clearer systems, better workflows, and useful digital products.", Lightbulb],
  ["Technology gap", "Many teams need technology shaped around their processes rather than disconnected tools.", Compass],
  ["Ricoz response", "Ricoz brings products, services, and solutions together around those needs.", Route],
] as const;

export const strategicReasons = [
  "A connected product, service, and solution ecosystem",
  "Technology work grounded in practical business problems",
  "A focus on building useful digital products over time",
  "Capabilities that can support different stages of business need",
] as const;

export const growthStory = [
  ["Build", "Create useful technology."],
  ["Validate", "Solve real business problems."],
  ["Expand", "Grow products and capabilities."],
  ["Connect", "Develop a broader ecosystem."],
  ["Scale", "Extend the reach of Ricoz technology."],
] as const;
