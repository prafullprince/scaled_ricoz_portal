export type IntegrationKind = "CANDIDATE" | "LEAD";
export const candidateProviders = [
  ["linkedin-jobs", "LinkedIn Jobs"], ["internshala", "Internshala"], ["naukri", "Naukri.com"],
  ["indeed", "Indeed"], ["foundit", "Foundit"], ["apna", "Apna"], ["workindia", "WorkIndia"],
  ["wellfound", "Wellfound"], ["cutshort", "Cutshort"], ["naukri-campus", "Naukri Campus"],
] as const;
export const formProviders = [
  ["google-forms", "Google Forms"], ["zoho-forms", "Zoho Forms"], ["third-party-form", "Third-party form"],
] as const;

export const leadCategories = [
  ["social-media", "Social Media", ["LinkedIn", "Instagram", "Facebook"]],
  ["search-engine", "Search Engine", ["Google Search", "SEO"]],
  ["paid-advertising", "Paid Advertising", ["Google Ads", "Meta Ads"]],
  ["lead-database", "Lead Database", ["Apollo", "ZoomInfo", "Lusha"]],
  ["business-directory", "Business Directory", ["IndiaMART", "Justdial", "Clutch"]],
  ["website", "Website", ["Contact form", "Demo form", "Live chat"]],
  ["email", "Email", ["Inbound email", "Cold outreach"]],
  ["calling", "Calling", ["Inbound call", "Cold call"]],
  ["messaging", "Messaging", ["WhatsApp", "Telegram"]],
  ["referral", "Referral", ["Customer", "Employee", "Partner"]],
  ["partnership", "Partnership", ["Reseller", "Affiliate", "Agency"]],
  ["events", "Events", ["Trade show", "Conference", "Webinar"]],
  ["marketplace", "Marketplace", ["Upwork", "Fiverr", "G2"]],
  ["existing-customer", "Existing Customer", ["Upsell", "Cross-sell", "Renewal"]],
  ["tender-procurement", "Tender / Procurement", ["Government tender", "Private RFP"]],
  ["direct-other", "Direct / Other", ["Walk-in", "Manually added", "Other"]],
] as const;

export const integrationCatalog = [
  ...candidateProviders.map(([id, name]) => ({ id, name, kind: "CANDIDATE" as const, category: "Hiring platform" })),
  ...formProviders.flatMap(([id, name]) => ([
    { id, name, kind: "CANDIDATE" as const, category: "Form platform" },
    { id, name, kind: "LEAD" as const, category: "Form platform" },
  ])),
  ...leadCategories.flatMap(([categoryId, category, names]) =>
    names.map((name) => ({ id: `${categoryId}:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, kind: "LEAD" as const, category })),
  ),
];

export const commonFields = ["externalId", "name", "email", "phone"] as const;
export const candidateFields = [
  ...commonFields, "address", "coverLetter", "resumeUrl", "portfolioUrl", "linkedInUrl", "githubUrl",
  "currentCompany", "experienceYears", "experienceSummary", "skills", "education", "screeningAnswers", "appliedAt",
] as const;
export const leadFields = [...commonFields, "company", "serviceInterest", "notes", "expectedValue", "currency"] as const;

export function catalogProvider(id: string, kind: IntegrationKind) {
  return integrationCatalog.find((provider) => provider.id === id && provider.kind === kind);
}
