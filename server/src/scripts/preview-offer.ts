import { createServer } from "node:http";
import { renderOfferEmail, type OfferPresentation } from "../modules/recruitment/offer.presentation.js";
import { renderTemplateOfferPdf } from "../modules/recruitment/offer.template.js";
import { OfferType } from "../models/offerLetter.models.js";
import { offerSendingTerms } from "../modules/recruitment/offer.service.js";

const offer: OfferPresentation = {
  type: OfferType.INTERN,
  offerLetterNumber: "RICOZ-INT-2026-PREVIEW",
  offerDate: new Date(),
  candidateSnapshot: { fullName: "Aman Kumar", email: "aman@example.com", address: "12 Park Road, New Delhi, India" },
  position: { designation: "Product Design Intern", department: "Product & Design", workMode: "REMOTE", reportingManager: "Asha Rao" },
  employmentTerms: { ...offerSendingTerms(new Date(Date.now() + 183 * 86400000)), employmentType: "Part-time", workingHours: "4-5 hours per day" },
  compensation: { stipend: "₹15,000", paymentCycle: "Monthly", benefits: "As stated in the engagement terms" },
  companySnapshot: {
    legalName: "Ricoz Innovation Private Limited",
    displayName: "Ricoz Innovation",
    address: "New Delhi, India",
    contactPhone: "",
    contactEmail: "hr@example.com",
    logoDataUrl: "",
    hrContactName: "People Operations",
    hrContactEmail: "hr@example.com",
    signatoryName: "Asha Rao",
    signatoryDesignation: "Head of Human Resources",
    signatureDataUrl: "",
  },
};
const port = Number(process.env.OFFER_PREVIEW_PORT || 3101);
const origin = `http://localhost:${port}`;
const pdf = await renderTemplateOfferPdf(offer);
const html = renderOfferEmail(offer, { pdf: `${origin}/offer.pdf`, dashboard: "http://localhost:3000/dashboard", contact: "http://localhost:3000/contact" });
createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/offer.pdf") {
    response.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="sample-offer.pdf"' });
    response.end(pdf);
  } else if (request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  } else {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Sample offer email: ${origin}\nSample offer PDF: ${origin}/offer.pdf`));