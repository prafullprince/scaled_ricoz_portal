import type { IOfferLetter } from "../../models/offerLetter.models.js";

export type OfferPresentation = Pick<IOfferLetter, "type" | "candidateSnapshot" | "position" | "employmentTerms" | "compensation" | "companySnapshot" | "offerDate" | "acceptanceDeadline" | "offerLetterNumber">;

const valueOr = (value: string | null | undefined, fallback = "To be confirmed") => value?.trim() || fallback;
const compensationLabel = (value: string | number | null | undefined, currency: string | null | undefined) => {
  if (value == null) return "";
  const amount = String(value).trim();
  if (!amount) return "";
  const numericAmount = amount.replaceAll(",", "");
  if (!/^\d+(?:\.\d+)?$/.test(numericAmount)) return amount;
  return `${valueOr(currency, "INR")} ${Number(numericAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const dateLabel = (value: Date | null | undefined) => value && !Number.isNaN(new Date(value).getTime())
  ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value))
  : "To be confirmed";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export const offerKeyTerms = [
  "The engagement is subject to the terms and conditions provided with the offer.",
  "Responsibilities and expectations may be reviewed during the engagement.",
  "Company policies, confidentiality requirements, and applicable procedures remain in effect throughout the engagement.",
  "Any changes to the engagement will be communicated through the appropriate company channel.",
];

export function offerDetailSections(offer: OfferPresentation) {
  const intern = offer.type === "INTERN";
  const workMode = valueOr(offer.position.workMode);
  const workModes: Record<string, string> = { REMOTE: "Remote", HYBRID: "Hybrid", ON_SITE: "On-site", ONSITE: "On-site" };
  const compensation = intern ? offer.compensation.stipend || offer.compensation.salary : offer.compensation.salary || offer.compensation.stipend;
  const compensationRows = intern
    ? [
      [`${valueOr(offer.compensation.paymentCycle, "Monthly")} Stipend`, valueOr(compensation)],
      ["Payment Cycle", valueOr(offer.compensation.paymentCycle, "Monthly")],
      ["Additional Benefits", valueOr(offer.compensation.benefits, "As stated in the engagement terms")],
    ]
    : [
      ["Annual CTC", valueOr(compensationLabel(offer.compensation.annualCtc, offer.compensation.currency))],
      ["Monthly Gross Salary", valueOr(compensationLabel(offer.compensation.monthlyGrossSalary, offer.compensation.currency))],
      ["Salary Structure Reference", valueOr(offer.compensation.salaryStructureReference)],
      ["Payment Cycle", valueOr(offer.compensation.paymentCycle, "Monthly")],
    ];
  return [
    { title: "Recipient", rows: [
      ["Name", valueOr(offer.candidateSnapshot.fullName)],
      ["Role", valueOr(offer.position.designation)],
      ["Department", valueOr(offer.position.department)],
    ] },
    { title: "Engagement Details", rows: [
      ["Engagement Type", valueOr(offer.employmentTerms.employmentType, intern ? "Internship" : "Employment")],
      ["Start Date", dateLabel(offer.employmentTerms.joiningDate)],
      ["End Date", dateLabel(offer.employmentTerms.endDate)],
      ["Duration", valueOr(offer.employmentTerms.internshipDuration)],
      ["Work Arrangement", workModes[workMode] ?? workMode],
      ["Reporting To", valueOr(offer.position.reportingManager)],
    ] },
    { title: "Compensation & Benefits", rows: [
      ...compensationRows,
    ] },
  ];
}

export function renderOfferEmail(offer: OfferPresentation, links: { pdf: string; dashboard: string; contact: string; privacy?: string; terms?: string }) {
  const companyName = valueOr(offer.companySnapshot?.displayName);
  if (!companyName) throw new Error("Company offer-letter profile is required to render the offer email");
  const sections = offerDetailSections(offer).map((section) => `
    <tr><td style="padding:0 16px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f7;border-radius:4px"><tr><td style="padding:18px 16px 14px;font-size:11px;color:#6b6b6b;text-transform:uppercase">${escapeHtml(section.title)}</td></tr>
      ${section.rows.map(([label, value], index) => `<tr><td style="padding:0 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:10px 0 7px;${index < section.rows.length - 1 ? "border-bottom:1px solid #e5e5e5;" : ""}"><div style="font-size:13px;color:#737373;margin-bottom:5px">${escapeHtml(label!)}</div><div style="font-size:13px;font-weight:600;color:#171717;line-height:1.5;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value!)}</div></td></tr></table></td></tr>`).join("")}
      <tr><td height="14"></td></tr></table></td></tr>`).join("");
  const contact = escapeHtml(links.contact);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Ricoz offer</title>
<style>
html,body{width:100%!important;margin:0!important;padding:0!important}
table{border-collapse:collapse}
.offer-root{width:100%!important}
.offer-shell-cell{padding:0!important}
.offer-main{width:100%!important;max-width:100%!important;overflow-wrap:anywhere}
.offer-heading{font-size:34px;line-height:1.12}
@media only screen and (max-width:600px){.offer-heading{font-size:28px!important;line-height:1.2!important}}
</style></head>
<body style="width:100%;margin:0;padding:0;background:#ffffff;color:#171717;font-family:Arial,Helvetica,sans-serif;letter-spacing:0">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(offer.candidateSnapshot.fullName)}, your offer for ${escapeHtml(offer.position.designation)} from ${escapeHtml(companyName)} is ready to review.</div>
<table role="presentation" class="offer-root" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#ffffff"><tr><td class="offer-shell-cell" align="center" valign="top" style="padding:0">
<!--[if mso]><table role="presentation" width="100%"><tr><td><![endif]-->
<table role="presentation" class="offer-main" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:100%;background:#ffffff;table-layout:fixed;overflow-wrap:anywhere">
<tr><td style="padding:20px 16px 16px"><div style="font-size:11px;color:#d00020;margin-bottom:10px">OFFICIAL OFFER</div>
<h1 class="offer-heading" style="margin:0 0 10px;font-family:'Times New Roman',Georgia,serif;font-weight:400;font-size:34px;line-height:1.12">Your offer from ${escapeHtml(companyName)}<br>is ready to review.</h1>
<p style="margin:0;font-size:15px;line-height:1.65;color:#606060">Hello ${escapeHtml(offer.candidateSnapshot.fullName)}, please review the attached offer letter from ${escapeHtml(companyName)} and complete the required acceptance in your Ricoz candidate account.</p></td></tr>
${sections}
<tr><td style="padding:0 16px 16px"><h2 style="font-size:16px;font-weight:500;margin:0 0 10px">Key Terms</h2><ul style="padding-left:19px;margin:0;color:#606060;font-size:13px;line-height:1.6">${offerKeyTerms.map((term) => `<li>${escapeHtml(term)}</li>`).join("")}</ul>
${offer.acceptanceDeadline ? `<p style="font-size:13px;line-height:1.6;margin:12px 0 0"><strong>Respond by:</strong> ${escapeHtml(dateLabel(offer.acceptanceDeadline))}</p>` : ""}</td></tr>
<tr><td style="padding:0 16px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="#ca0b32" style="border-radius:4px;mso-padding-alt:13px 10px"><a href="${escapeHtml(links.pdf)}" style="display:block;padding:13px 10px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">Review Offer Letter</a></td></tr></table></td></tr>
<tr><td style="padding:0 16px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="border:1px solid #d00020;border-radius:4px;mso-padding-alt:12px 10px"><a href="${escapeHtml(links.pdf)}#nameddest=engagement-terms" style="display:block;padding:12px 10px;color:#d00020;text-decoration:none;font-size:14px">View Engagement Terms</a></td></tr></table></td></tr>
<tr><td style="padding:0 16px 18px"><h2 style="font-size:13px;font-weight:500;margin:0 0 10px">Questions about your offer?</h2><p style="font-size:13px;line-height:1.6;color:#737373;margin:0 0 8px">If you need clarification regarding your role, joining details, compensation, or employment terms, please contact ${escapeHtml(companyName)} HR.</p><a href="${contact}" style="font-size:13px;color:#d00020;text-decoration:none">Contact HR</a></td></tr>
<tr><td style="padding:18px 16px;background:#f7f7f7;border-top:1px solid #eeeeee"><strong style="font-size:14px">${escapeHtml(companyName)}</strong><p style="font-size:12px;color:#606060;line-height:1.5;margin:5px 0 12px">${escapeHtml(offer.companySnapshot?.legalName ?? companyName)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${[["Privacy", links.privacy || links.contact], ["Terms", links.terms || links.pdf]].map(([label, href]) => `<td><a href="${escapeHtml(href!)}" style="font-size:11px;color:#d00020;text-decoration:none">${label}</a></td>`).join("")}</tr></table><div style="border-top:1px solid #e0e0e0;margin-top:12px;padding-top:10px;font-size:11px;line-height:1.5;color:#909090">&copy; ${new Date(offer.offerDate).getFullYear()} ${escapeHtml(companyName)}. All rights reserved.<p style="margin:8px 0 0">This is an automated email. Please do not reply directly to this message.</p></div></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

export function renderOfferEmailText(offer: OfferPresentation, links: { pdf: string; contact: string }) {
  const companyName = valueOr(offer.companySnapshot?.displayName);
  if (!companyName) throw new Error("Company offer-letter profile is required to render the offer email");
  const sections = offerDetailSections(offer)
    .map((section) => `${section.title}\n${section.rows.map(([label, value]) => `${label}: ${value}`).join("\n")}`)
    .join("\n\n");
  return [
    `Hello ${offer.candidateSnapshot.fullName},`,
    `Your offer from ${companyName} is ready to review.`,
    "",
    `Reference: ${offer.offerLetterNumber}`,
    `Role: ${offer.position.designation}`,
    sections,
    offer.acceptanceDeadline ? `Respond by: ${dateLabel(offer.acceptanceDeadline)}` : "",
    "Please complete your acceptance in your Ricoz candidate account.",
    `Offer PDF: ${links.pdf}`,
    `Questions? Contact HR: ${links.contact}`,
  ].filter(Boolean).join("\n");
}
