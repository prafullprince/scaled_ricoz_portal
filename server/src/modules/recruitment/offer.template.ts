import { chromium, type Browser, type Page } from "playwright";
import { PDFDocument } from "pdf-lib";
import { ApiError } from "../../utils/apiError.utils.js";
import type { OfferPresentation } from "./offer.presentation.js";

const maximumOfferPdfSize = 10 * 1024 * 1024;
export const OFFER_PDF_TEMPLATE_VERSION = 3;

const text = (value: string | null | undefined, fallback = "") => value?.trim() || fallback;
const isRicozInnovation = (company: NonNullable<OfferPresentation["companySnapshot"]>) =>
  company.displayName.trim().toLowerCase() === "ricoz innovation";
const ricozInnovationLegalName = "Ricoz Innovation PRIVATE LIMITED";
const ricozInnovationCin = "U72900DL2021PTC384199";
const dateText = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(date)
    : "";
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
})[character]!);
const formatAmount = (amount: string | number | null | undefined, currency: string | null | undefined) => {
  if (amount == null) return "";
  const value = String(amount).trim();
  if (!value) return "";
  const numericAmount = value.replaceAll(",", "");
  if (!/^\d+(?:\.\d+)?$/.test(numericAmount)) return value;
  return `${text(currency, "INR")} ${Number(numericAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

let browser: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;
const maximumConcurrentPdfRenders = 2;
const maximumQueuedPdfRenders = 20;
let activePdfRenders = 0;
const pdfRenderQueue: Array<(release: () => void) => void> = [];

function releasePdfRenderSlot() {
  const next = pdfRenderQueue.shift();
  if (next) {
    next(createPdfRenderRelease());
  } else {
    activePdfRenders -= 1;
  }
}

function createPdfRenderRelease() {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releasePdfRenderSlot();
  };
}

function acquirePdfRenderSlot() {
  if (activePdfRenders < maximumConcurrentPdfRenders) {
    activePdfRenders += 1;
    return Promise.resolve(createPdfRenderRelease());
  }
  if (pdfRenderQueue.length >= maximumQueuedPdfRenders) {
    return Promise.reject(new ApiError(503, "PDF generation is busy. Retry the request shortly."));
  }
  return new Promise<() => void>((resolve) => pdfRenderQueue.push(resolve));
}

async function getBrowser() {
  if (browser?.isConnected()) return browser;
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    }).then((instance) => {
      browser = instance;
      instance.on("disconnected", () => {
        if (browser === instance) browser = null;
      });
      return instance;
    }).finally(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

export async function closeOfferPdfBrowser() {
  const activeBrowser = browser;
  browser = null;
  if (activeBrowser?.isConnected()) await activeBrowser.close();
}

export function renderOfferHtml(offer: OfferPresentation) {
  const company = offer.companySnapshot;
  if (!company?.legalName || !company.displayName || !company.address || !company.contactEmail
    || !company.hrContactName || !company.hrContactEmail
    || !company.signatoryName || !company.signatoryDesignation) {
    throw new ApiError(409, "Complete the active company offer-letter profile before generating an offer");
  }
  for (const image of [company.logoDataUrl, company.signatureDataUrl]) {
    if (image && (image.length > 100_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))) {
      throw new ApiError(500, "The saved company offer-letter image is invalid");
    }
  }

  const candidateName = text(offer.candidateSnapshot.fullName);
  const candidateAddress = text(offer.candidateSnapshot.address);
  const role = text(offer.position.designation);
  const department = text(offer.position.department);
  const joiningDate = dateText(offer.employmentTerms.joiningDate);
  const endDate = dateText(offer.employmentTerms.endDate);
  const internshipDuration = text(offer.employmentTerms.internshipDuration);
  const acceptanceDeadline = dateText(offer.acceptanceDeadline);
  const intern = offer.type === "INTERN";
  const ricozInnovation = isRicozInnovation(company);
  const manager = intern && ricozInnovation ? "Ms. Alka Singh" : text(offer.position.reportingManager);
  const managerDesignation = intern && ricozInnovation
    ? "Chief Human Resources Officer (CHRO)"
    : text(offer.position.reportingManagerDesignation);
  const workLocation = text(offer.position.location);
  const workingHours = text(offer.employmentTerms.workingHours);
  const probation = text(offer.employmentTerms.probationPeriod);
  const paymentCycle = text(offer.compensation.paymentCycle, "Monthly");
  const legalName = ricozInnovation ? ricozInnovationLegalName : company.legalName;
  if (!candidateName || !candidateAddress || !role || !department) {
    throw new ApiError(409, "Complete the candidate identity, address, role, and department before generating the offer");
  }
  const boundedContent: Array<[string, string, number]> = [
    ["candidate name", candidateName, 200],
    ["candidate address", candidateAddress, 500],
    ["position title", role, 200],
    ["department", department, 120],
    ["reporting manager", manager, 120],
    ["reporting manager designation", managerDesignation, 120],
    ["work location", workLocation, 120],
    ["working hours", workingHours, 120],
    ["probation period", probation, 120],
    ["company name", company.legalName, 200],
    ["company address", company.address, 500],
  ];
  const oversizedField = boundedContent.find(([, value, maximum]) => value.length > maximum);
  if (oversizedField) throw new ApiError(400, `The ${oversizedField[0]} is too long for the offer letter`);
  const logo = ricozInnovation
    ? `<div class="ricoz-wordmark"><span>ricoZ</span><small>Innovation</small></div>`
    : company.logoDataUrl
      ? `<img class="company-logo" src="${escapeHtml(company.logoDataUrl)}" alt="">`
      : `<span class="company-monogram">${escapeHtml(company.displayName.slice(0, 1).toUpperCase())}</span>`;
  const companyIdentity = ricozInnovation
    ? `<p>(CIN: ${ricozInnovationCin})</p>`
    : "";
  const locationLine = workLocation
    ? `<p>Your initial work location will be <strong>${escapeHtml(workLocation)}</strong>.</p>`
    : "";
  const acceptanceDeadlineLine = acceptanceDeadline
    ? `<p>Please confirm your acceptance by <strong>${escapeHtml(acceptanceDeadline)}</strong> using <strong>your Ricoz candidate account</strong>.</p>`
    : "";
  const compensationBlock = intern
    ? `<ul><li>${escapeHtml(paymentCycle)} stipend: <strong>${escapeHtml(text(offer.compensation.stipend || offer.compensation.salary, formatAmount(offer.compensation.monthlyGrossSalary, offer.compensation.currency)))}</strong></li><li>Payment schedule: <strong>${escapeHtml(paymentCycle)}</strong></li></ul>`
    : `<ul><li>Annual cost to company (CTC): <strong>${escapeHtml(formatAmount(offer.compensation.annualCtc, offer.compensation.currency))}</strong></li><li>Monthly gross salary: <strong>${escapeHtml(formatAmount(offer.compensation.monthlyGrossSalary, offer.compensation.currency))}</strong></li><li>Compensation schedule: <strong>${escapeHtml(text(offer.compensation.salaryStructureReference))}</strong></li></ul>`;
  const signature = company.signatureDataUrl
    ? `<img class="signature" src="${escapeHtml(company.signatureDataUrl)}" alt="">`
    : `<div class="signature-placeholder"></div>`;
  const contactDetails = [company.contactPhone, company.contactEmail].filter(Boolean).map(escapeHtml).join(" · ");
  const hrEmail = escapeHtml(company.hrContactEmail);
  const annexureManager = manager || "Ms. Alka Singh";
  const annexureManagerDesignation = managerDesignation || "Chief Human Resources Officer (CHRO)";
  const stipendValue = text(offer.compensation.stipend || offer.compensation.salary, "As agreed in this offer");
  const stipendAmount = /^\d[\d,]*(?:\.\d+)?$/.test(stipendValue)
    ? `₹${Number(stipendValue.replaceAll(",", "")).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : stipendValue;
  const stipendIncludesPaymentCycle = /(?:per|\/)\s*[a-z]+|\b(?:daily|weekly|monthly|annually)\b/i.test(stipendValue);
  const internshipPeriod = joiningDate
    ? endDate
      ? `${joiningDate} to ${endDate}${internshipDuration ? ` (${internshipDuration})` : ""}`
      : `${joiningDate}${internshipDuration ? ` (${internshipDuration})` : ", with an ongoing duration based on regular performance reviews"}`
    : internshipDuration || "To be confirmed";
  const annexurePage = ricozInnovation && intern
    ? `<section class="sheet annexure-sheet" aria-label="Internship offer annexures, page three">
      <header class="annexure-letterhead">
        <div class="annexure-company">
          <h1>${escapeHtml(ricozInnovationLegalName)}</h1>
          <p>(CIN: ${ricozInnovationCin})</p>
          <address>${escapeHtml(company.address)}</address>
        </div>
        <div class="annexure-wordmark"><span>ricoZ</span><small>Innovation</small></div>
      </header>
      <main class="annexure-content">
        <h2>Annexure – I</h2>
        <h3>Internship Terms &amp; Conditions</h3>
        <ol class="terms-list">
          <li>This is a ${escapeHtml(text(offer.employmentTerms.employmentType, "full-time"))} internship. Internship Period: <strong>${escapeHtml(internshipPeriod)}</strong>. Start Date: <strong>${escapeHtml(joiningDate || "To be confirmed")}</strong>.</li>
          <li>The stipend will be <strong>${escapeHtml(stipendAmount)}</strong>${paymentCycle && !stipendIncludesPaymentCycle ? `, payable ${escapeHtml(paymentCycle.toLowerCase())}` : ""}.</li>
          <li>This internship does not guarantee full-time employment; however, outstanding performance and consistency may be considered for future opportunities.</li>
          <li>You are expected to maintain confidentiality, comply with company policies, and demonstrate professionalism in handling all company data, media files, brand assets, and project materials.</li>
          <li>Any misuse of company data, media assets, or misconduct will lead to termination of the internship without stipend for the ongoing month.</li>
          <li>All video content, motion graphics, creative materials, design source files, and intellectual property developed during the internship will remain the sole property of Ricoz Innovation Pvt. Ltd.</li>
        </ol>
        <h2>Annexure – II</h2>
        <h3>Internship Role and Learning Objectives</h3>
        <p>As a ${escapeHtml(role)}, you will play a key role in elevating the company’s visual brand, marketing campaigns, and digital content footprint across multiple platforms. Your responsibilities will include editing raw footage into high-impact videos, designing dynamic motion graphics, vector animations, and title sequences, and incorporating visual effects, seamless transitions, color grading, and custom audio design. You will ensure all video and animated assets align with the brand’s visual identity and aesthetic guidelines. Additionally, you will collaborate closely with the design and marketing teams to support creative campaigns, manage and archive project files, and deliver polished outputs within established timelines. This internship is structured to offer practical exposure to end-to-end post-production workflows, motion design frameworks, and digital content strategy, while sharpening your proficiency in industry-standard editing software, visual communication, and creative execution. You will report directly to ${escapeHtml(annexureManager)}, ${escapeHtml(annexureManagerDesignation)}.</p>
        <p>All video content, motion graphics, edited materials, source files, and creative contributions developed during your internship with Ricoz Innovation Pvt. Ltd. shall remain the sole and exclusive intellectual property of the company.</p>
        <p class="annexure-acceptance-intro">By accepting this offer, you also agree to abide by the terms and learning objectives mentioned in Annexure – I and Annexure – II, which are integral parts of this internship offer letter.</p>
        <h3 class="acceptance-heading">Acknowledgement &amp; Acceptance</h3>
        <p>I, <span class="acceptance-line candidate-acceptance">${escapeHtml(candidateName)}</span>, hereby accept the internship offer for the position of ${escapeHtml(role)} at Ricoz Innovation Pvt. Ltd.</p>
        <p>My confirmed joining date is: <span class="acceptance-line joining-acceptance"></span></p>
        <p>Signature: <span class="acceptance-line signature-acceptance"></span></p>
        <p>Date: <span class="acceptance-line date-acceptance"></span></p>
        <div class="annexure-signatory">
          <h3>For Ricoz Innovation Pvt. Ltd.</h3>
          <p>Name: ${escapeHtml(company.signatoryName)}</p>
          <p>Designation: ${escapeHtml(company.signatoryDesignation)}</p>
          <p>Signature: ${signature}</p>
        </div>
      </main>
      <footer class="annexure-footer"><span>innovation.ricoz.in</span><span>03</span></footer>
    </section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(offer.offerLetterNumber)} - Offer Letter</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: #373737; font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; line-height: 1.38; }
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { position: relative; width: 210mm; height: 297mm; padding: 15mm 18mm 18mm; overflow: hidden; page-break-after: always; break-after: page; background: #fff; }
    .sheet:last-child { page-break-after: auto; break-after: auto; }
    .letterhead { display: flex; align-items: center; gap: 12px; min-height: 26mm; padding-bottom: 4mm; border-bottom: 1px solid #d8d8d8; }
    .company-logo, .company-monogram { width: 25mm; height: 25mm; flex: 0 0 25mm; object-fit: contain; }
    .company-monogram { display: flex; align-items: center; justify-content: center; background: #f1f3f5; color: #34445f; font-size: 25pt; font-weight: 700; }
    .ricoz-wordmark { width: 35mm; flex: 0 0 35mm; color: #5b201d; font-family: Georgia, serif; font-size: 22pt; font-weight: 700; text-align: center; }
    .ricoz-wordmark small { display: block; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .company-heading { min-width: 0; }
    .company-heading h1 { margin: 0 0 4px; color: #222; font-size: 15pt; line-height: 1.2; }
    .company-heading p { margin: 2px 0; color: #555; font-size: 8.5pt; white-space: pre-line; }
    .document-title { margin: 10mm 0 1mm; color: #292929; font-size: 13pt; font-weight: 700; letter-spacing: .04em; }
    .meta { margin: 2px 0; color: #666; font-size: 8.5pt; }
    .recipient { margin: 6mm 0 0; }
    .recipient-label { margin-bottom: 3px; }
    .recipient-name { margin: 0; font-size: 10.5pt; font-weight: 700; }
    .recipient-address { margin: 3px 0 0; color: #555; white-space: pre-line; }
    .subject { margin: 5mm 0 0; }
    .salutation { margin: 5mm 0 2mm; }
    .intro { margin: 0 0 4mm; color: #555; }
    .section { margin: 0 0 3.7mm; break-inside: avoid; }
    .section h2 { margin: 0 0 1.4mm; color: #353535; font-size: 9.8pt; }
    .section p { margin: 0 0 1.2mm; color: #595959; }
    .section ul { margin: 1mm 0 1.3mm; padding-left: 5mm; color: #595959; }
    .section li { padding-left: .4mm; margin: .5mm 0; }
    .section li strong { overflow-wrap: anywhere; }
    .legal { color: #666; }
    .closing { margin-top: 5mm; color: #555; }
    .signoff { margin-top: 7mm; min-height: 22mm; }
    .signature { display: block; width: auto; height: 13mm; max-width: 48mm; margin-bottom: 1mm; object-fit: contain; object-position: left bottom; }
    .signature-placeholder { height: 14mm; }
    .signoff p { margin: 1mm 0; color: #363636; font-weight: 600; }
    .signoff .signatory-title { font-size: 8.5pt; font-weight: 400; }
    .acceptance { margin-top: 5mm; break-inside: avoid; }
    .acceptance h2 { margin: 0 0 1.5mm; font-size: 9.8pt; }
    .acceptance p { margin: 0 0 2mm; color: #5e5e5e; }
    .signature-line { display: inline-block; width: 50mm; margin-left: 2mm; border-bottom: 1px solid #777; vertical-align: bottom; }
    .date-line { width: 42mm; }
    .page-number { position: absolute; right: 18mm; bottom: 9mm; color: #8a8a8a; font-size: 8pt; }
    .page-number::before { content: "Page "; }
    .annexure-sheet { padding: 0; color: #262626; font-family: "Times New Roman", Times, serif; font-size: 10pt; line-height: 1.4; }
    .annexure-letterhead { position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; height: 23mm; padding: 3mm 18mm; background: #5b201d; color: #fff; }
    .annexure-company { min-width: 0; }
    .annexure-company h1, .annexure-company p { margin: 0; font-size: 11pt; font-weight: 700; line-height: 1.15; }
    .annexure-company address { margin-top: 2mm; color: #f5eceb; font-size: 9pt; font-style: italic; }
    .annexure-wordmark { flex: 0 0 31mm; color: #d5c59b; font-family: Georgia, serif; font-size: 25pt; line-height: 1; text-align: center; }
    .annexure-wordmark small { display: block; margin-top: 1mm; font-family: Arial, Helvetica, sans-serif; font-size: 7pt; font-weight: 600; letter-spacing: .1em; }
    .annexure-content { padding: 30mm 18mm 21mm; }
    .annexure-content h2 { margin: 0 0 2mm; font-size: 13pt; }
    .annexure-content h2:not(:first-child) { margin-top: 6mm; }
    .annexure-content h3 { margin: 0 0 2mm; font-size: 10.5pt; }
    .annexure-content p { margin: 0 0 2mm; text-align: justify; }
    .terms-list { margin: 0; padding-left: 7mm; }
    .terms-list li { padding-left: 1mm; margin: 0 0 2mm; text-align: justify; }
    .annexure-acceptance-intro { margin-top: 5mm !important; font-size: 11pt; }
    .acceptance-heading { margin-top: 5mm !important; }
    .acceptance-line { display: inline-block; height: 5mm; border-bottom: 1px solid #888; vertical-align: bottom; }
    .candidate-acceptance { min-width: 40mm; }
    .joining-acceptance { min-width: 42mm; }
    .signature-acceptance, .date-acceptance { min-width: 32mm; }
    .annexure-signatory { margin-top: 8mm; }
    .annexure-signatory h3 { margin-bottom: 2mm; }
    .annexure-signatory p { margin: 0 0 1mm; text-align: left; }
    .annexure-signatory .signature { display: inline-block; height: 10mm; margin: 0; vertical-align: middle; }
    .annexure-signatory .signature-placeholder { display: inline-block; width: 35mm; height: 7mm; margin: 0; vertical-align: middle; }
    .annexure-footer { position: absolute; right: 0; bottom: 0; left: 0; display: flex; justify-content: space-between; align-items: center; height: 12mm; padding: 0 18mm; background: #5b201d; color: #fff; font-size: 11pt; font-weight: 700; }
    @media print { .sheet { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <main>
    <section class="sheet" aria-label="Offer letter, page one">
      <header class="letterhead">
        ${logo}
        <div class="company-heading">
          <h1>${escapeHtml(legalName)}${company.displayName !== legalName ? ` <span style="font-size:9pt;font-weight:400">(${escapeHtml(company.displayName)})</span>` : ""}</h1>
          ${companyIdentity}
          <p>${escapeHtml(company.address)}</p>
          ${contactDetails ? `<p>${contactDetails}</p>` : ""}
        </div>
      </header>
      <h2 class="document-title">OFFER LETTER</h2>
      <p class="meta">Reference: <strong>${escapeHtml(offer.offerLetterNumber)}</strong></p>
      <p class="meta">Date: <strong>${escapeHtml(dateText(offer.offerDate))}</strong></p>
      <div class="recipient">
        <p class="recipient-label">To,</p>
        <p class="recipient-name">${escapeHtml(candidateName)}</p>
        ${candidateAddress ? `<p class="recipient-address">${escapeHtml(candidateAddress)}</p>` : ""}
      </div>
      <p class="subject"><strong>Subject:</strong> Offer of Employment — <strong>${escapeHtml(role)}</strong></p>
      <p class="salutation">Dear <strong>${escapeHtml(candidateName)}</strong>,</p>
      <p class="intro">We are pleased to offer you employment with <strong>${escapeHtml(legalName)}</strong> for the position of <strong>${escapeHtml(role)}</strong>, subject to the terms in this letter and applicable company policies.</p>

      <section class="section">
        <h2>1. Position and Department</h2>
        <p>You are being offered the position of <strong>${escapeHtml(role)}</strong> in the <strong>${escapeHtml(department)}</strong> department. ${manager ? `The position will report to <strong>${escapeHtml(manager)}</strong>${managerDesignation ? `, <strong>${escapeHtml(managerDesignation)}</strong>` : ""}, where applicable.` : ""}</p>
      </section>
      <section class="section">
        <h2>2. Proposed Joining Date</h2>
        <p>Your proposed joining date is <strong>${escapeHtml(joiningDate)}</strong>. Please confirm your availability by the acceptance deadline stated in this letter. Any agreed change to the joining date must be confirmed in writing by the company.</p>
      </section>
      <section class="section">
        <h2>3. Compensation and Benefits</h2>
        <p>The approved compensation package is as follows:</p>
        ${compensationBlock}
        <p class="legal">The applicable components, deductions, statutory contributions, benefits, and payment arrangements will be detailed in the approved compensation schedule and governed by applicable law and company policy. CTC should not be interpreted as monthly take-home pay.</p>
      </section>
      <section class="section">
        <h2>4. Employment Terms</h2>
        ${locationLine || `<p>Your initial work location will be confirmed by the company.</p>`}
        <p>Your normal work schedule will be <strong>${escapeHtml(workingHours)}</strong>, subject to applicable company policies and operational requirements.</p>
      </section>
      <section class="section">
        <h2>5. Probation</h2>
        <p>Your probation period will be <strong>${escapeHtml(probation)}</strong>, subject to the final employment terms and applicable law. The company will communicate the applicable review and confirmation arrangements.</p>
      </section>
      <span class="page-number">1</span>
    </section>

    <section class="sheet" aria-label="Offer letter, page two">
      <section class="section">
        <h2>6. Conditions of the Offer</h2>
        <p>This offer is subject to completion of applicable pre-employment requirements, which may include verification of information supplied by you, submission of required documents, and other lawful requirements communicated by the company for this position.</p>
        <p>Any condition that does not apply to this position is not part of this offer. No requirement not approved for the relevant role is incorporated by this letter.</p>
      </section>
      <section class="section">
        <h2>7. Confidentiality and Company Policies</h2>
        <p>During your employment, you are expected to protect confidential company, employee, customer, supplier, and business information and comply with applicable information-security and workplace policies. Detailed obligations will be set out in the relevant employment documents and policies.</p>
      </section>
      <section class="section">
        <h2>8. Offer Validity and Acceptance</h2>
        ${acceptanceDeadlineLine || `<p>Please confirm your acceptance by the date shown in your candidate account.</p>`}
        <p>If you need clarification about the proposed terms, contact <strong>${escapeHtml(company.hrContactName)}</strong> at <strong>${hrEmail}</strong>. Acceptance must be recorded through your Ricoz candidate account before the stated deadline.</p>
        <p class="legal">The proposed terms do not replace any formal appointment documentation required by the company or applicable law.</p>
      </section>
      <p class="closing">We look forward to the possibility of welcoming you to <strong>${escapeHtml(company.displayName)}</strong>.</p>
      <p class="closing">Yours sincerely,</p>
      <div class="signoff">
        ${signature}
        <p>${escapeHtml(company.signatoryName)}</p>
        <p class="signatory-title">${escapeHtml(company.signatoryDesignation)}</p>
        <p class="signatory-title">${escapeHtml(legalName)}</p>
      </div>
      <section class="acceptance">
        <h2>Candidate Acceptance</h2>
        <p>I, <strong>${escapeHtml(candidateName)}</strong>, acknowledge receipt of this offer and confirm my acceptance of the proposed terms stated in this letter.</p>
        <p>Candidate Signature:<span class="signature-line"></span></p>
        <p>Date:<span class="signature-line date-line"></span></p>
      </section>
      <span class="page-number">2</span>
    </section>
    ${annexurePage}
  </main>
</body>
</html>`;
}

export async function renderTemplateOfferPdf(offer: OfferPresentation): Promise<Buffer> {
  const releaseSlot = await acquirePdfRenderSlot();
  let page: Page | null = null;
  try {
    const browserInstance = await getBrowser();
    page = await browserInstance.newPage({ locale: "en-IN" });
    await page.setContent(renderOfferHtml(offer), { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const output = Buffer.from(await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    }));
    if (!output.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new ApiError(500, "The offer template did not produce a valid PDF");
    }
    if (output.length > maximumOfferPdfSize) {
      throw new ApiError(413, "The generated offer PDF exceeds the 10 MB file limit");
    }
    const parsedPdf = await PDFDocument.load(output);
    const expectedPageCount = offer.type === "INTERN"
      && offer.companySnapshot != null
      && isRicozInnovation(offer.companySnapshot)
      ? 3
      : 2;
    if (parsedPdf.getPageCount() !== expectedPageCount) {
      throw new ApiError(400, `Offer details exceed the ${expectedPageCount}-page template. Shorten the candidate or company details before generating the PDF.`);
    }
    return output;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Offer PDF generation failed");
  } finally {
    try {
      await page?.close();
    } finally {
      releaseSlot();
    }
  }
}
