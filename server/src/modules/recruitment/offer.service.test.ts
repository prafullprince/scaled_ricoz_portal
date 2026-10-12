import test from "node:test";
import assert from "node:assert/strict";

import { UserRole } from "../auth/authorization.js";
import { OfferType } from "../../models/offerLetter.models.js";
import { acceptOfferByCandidate, buildOfferData, declineOfferByCandidate, markOfferSentAfterDelivery, mergeRoles, offerSendingTerms, generatePdfBufferFromOffer } from "./offer.service.js";
import { renderOfferEmail, type OfferPresentation } from "./offer.presentation.js";
import { PDFDocument } from "pdf-lib";
import jwt from "jsonwebtoken";
import { createOfferLinkToken, verifyOfferLinkToken, openOfferDocument, sendOfferPdfResponse } from "./offer.link.js";
import { closeOfferPdfBrowser, renderOfferHtml } from "./offer.template.js";
import { OfferLetter, OfferLetterStatus } from "../../models/offerLetter.models.js";
import { currentScope, setDefaultCompanyId } from "../company/company.context.js";
import { Types } from "mongoose";
import type { Request, Response } from "express";

test.after(async () => {
  await closeOfferPdfBrowser();
});

const presentationOffer: OfferPresentation = {
  type: OfferType.INTERN,
  offerLetterNumber: "RICOZ-INT-2026-1234",
  offerDate: new Date("2026-10-02"),
  candidateSnapshot: { fullName: "Aman Kumar", email: "aman@example.com", address: "12 Park Road, New Delhi, India" },
  position: { designation: "Video Editor & Motion Designer Intern", department: "Product & Design", workMode: "REMOTE", reportingManager: "Ms. Alka Singh", reportingManagerDesignation: "Chief Human Resources Officer (CHRO)" },
  employmentTerms: { joiningDate: new Date("2026-10-12"), endDate: new Date("2027-04-12"), internshipDuration: "6 months", employmentType: "Full-time" },
  compensation: { stipend: "₹15,000", paymentCycle: "Monthly", benefits: "Learning allowance" },
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

test("offer dates use the sending day in India and require a later selected end date", () => {
  const sentAt = new Date("2026-10-02T20:00:00Z");
  const terms = offerSendingTerms("2026-10-05", sentAt);
  assert.equal(terms.joiningDate, sentAt);
  assert.equal(terms.endDate.toISOString(), "2026-10-05T00:00:00.000Z");
  assert.equal(terms.internshipDuration, "3 days");
  const plannedTerms = offerSendingTerms("2026-11-30", sentAt, new Date("2026-11-01T00:00:00.000Z"));
  assert.equal(plannedTerms.joiningDate.toISOString(), "2026-11-01T00:00:00.000Z");
  for (const invalid of [undefined, null, "invalid", "2026-10-02", "2026-10-03", "2027-02-30", "10/05/2026"]) {
    assert.throws(() => offerSendingTerms(invalid, sentAt));
  }
});

test("first successful offer delivery marks SENT and later sends preserve first-sent metadata and VIEWED status", async () => {
  const senderId = new Types.ObjectId();
  const firstSentAt = new Date("2026-10-11T03:00:00.000Z");
  const offer = {
    status: OfferLetterStatus.GENERATED,
    sentAt: null as Date | null,
    sentBy: null as Types.ObjectId | null,
    save: async () => undefined,
  };
  await markOfferSentAfterDelivery(offer, senderId, firstSentAt);
  assert.equal(offer.status, OfferLetterStatus.SENT);
  assert.equal(offer.sentAt, firstSentAt);
  assert.equal(offer.sentBy, senderId);

  offer.status = OfferLetterStatus.VIEWED;
  await markOfferSentAfterDelivery(offer, new Types.ObjectId(), new Date("2026-10-11T04:00:00.000Z"));
  assert.equal(offer.status, OfferLetterStatus.VIEWED);
  assert.equal(offer.sentAt, firstSentAt);
  assert.equal(offer.sentBy, senderId);
});

test("Ricoz Innovation internship template produces three A4 pages including the candidate-specific annexure", async () => {
  const buffer = await generatePdfBufferFromOffer(presentationOffer);
  const pdf = await PDFDocument.load(buffer);
  assert.equal(pdf.getPageCount(), 3);
  for (const page of pdf.getPages()) {
    const size = page.getSize();
    assert.ok(Math.abs(size.width - 595) < 1, "PDF page width should be A4");
    assert.ok(Math.abs(size.height - 842) < 1, "PDF page height should be A4");
  }
  const html = renderOfferHtml(presentationOffer);
  for (const value of [
    "Ricoz Innovation PRIVATE LIMITED",
    "CIN: U72900DL2021PTC384199",
    "Annexure – I",
    "Annexure – II",
    "Internship Role and Learning Objectives",
    "Video Editor &amp; Motion Designer Intern",
    "12 October 2026 to 12 April 2027 (6 months)",
    "₹15,000",
    "Ms. Alka Singh",
    "Chief Human Resources Officer (CHRO)",
    "innovation.ricoz.in",
  ]) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /FIRSTRICOZ PRIVATE LIMITED|CONNECTING AUDIENCE|www\.ricoz\.in/);
  await assert.rejects(generatePdfBufferFromOffer({ ...presentationOffer, candidateSnapshot: { ...presentationOffer.candidateSnapshot, fullName: "Long recipient ".repeat(100) } }), /too long/);
});

test("offer email matches reference sections and escapes candidate data", () => {
  const html = renderOfferEmail({ ...presentationOffer, candidateSnapshot: { ...presentationOffer.candidateSnapshot, fullName: '<img src=x onerror="alert(1)">' } }, { pdf: "https://api.example.com/offer?token=private", dashboard: "https://example.com/dashboard", contact: "mailto:hr@example.com" });
  for (const value of ["OFFICIAL OFFER", "Recipient", "Engagement Details", "Compensation &amp; Benefits", "Product &amp; Design", "₹15,000", "Monthly", "Learning allowance", "12 October 2026", "Review Offer Letter", 'href="https://api.example.com/offer?token=private"']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /BEYOND FUTURES/);
  assert.doesNotMatch(html, /View Dashboard|href="[^"]*\/dashboard/);
  assert.doesNotMatch(html, /height="100%"|min-height:100vh/);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("[Joining Date]"));
});

test("offer PDFs and emails support free-form compensation and numeric strings", () => {
  const employeeOffer: OfferPresentation = {
    ...presentationOffer,
    type: OfferType.EMPLOYEE,
    compensation: {
      salary: "INR performance based/ANNUAL",
      currency: "INR",
      annualCtc: "3000",
      monthlyGrossSalary: "performance based",
      salaryStructureReference: "Performance-based incentive plan",
    },
  };
  const html = renderOfferHtml(employeeOffer);
  const email = renderOfferEmail(employeeOffer, {
    pdf: "https://api.example.com/offer.pdf",
    dashboard: "https://example.com/dashboard",
    contact: "mailto:hr@example.com",
  });

  for (const output of [html, email]) {
    assert.ok(output.includes("INR 3,000.00"));
    assert.ok(output.includes("performance based"));
    assert.ok(output.includes("Performance-based incentive plan"));
  }
  assert.doesNotMatch(html, /Annexure – II|innovation\.ricoz\.in/);
});


test("offer links bind recipient, company and version; reject tampering, expiry and access tokens", () => {
  const originalSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "offer-link-unit-test-secret";
  try {
    const offer = { _id: new Types.ObjectId(), candidateId: new Types.ObjectId(), companyId: new Types.ObjectId(), version: 3 };
    const token = createOfferLinkToken(offer);
    const claims = verifyOfferLinkToken(token);
    assert.equal(claims.offerId, String(offer._id));
    assert.equal(claims.candidateId, String(offer.candidateId));
    assert.equal(claims.companyId, String(offer.companyId));
    assert.equal(claims.version, 3);
    assert.throws(() => verifyOfferLinkToken(`${token.slice(0, -10)}tampered`));
    assert.throws(() => verifyOfferLinkToken(jwt.sign({ offerId: offer._id }, process.env.JWT_ACCESS_SECRET!, { expiresIn: "1h" })));
    const expired = jwt.sign({ offerId: String(offer._id), candidateId: String(offer.candidateId), companyId: String(offer.companyId), version: 3 }, process.env.JWT_ACCESS_SECRET!, { audience: "ricoz:offer-pdf", issuer: "ricoz:recruitment", expiresIn: -1 });
    assert.throws(() => verifyOfferLinkToken(expired));
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = originalSecret;
  }
});

test("private PDF route restores signed company scope, records viewing, and never accepts on GET", async (context) => {
  const originalSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "offer-route-unit-test-secret";
  context.after(() => {
    if (originalSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = originalSecret;
  });
  const companyId = new Types.ObjectId();
  setDefaultCompanyId(new Types.ObjectId());
  const offer = { _id: new Types.ObjectId(), candidateId: new Types.ObjectId(), companyId, version: 2, offerLetterNumber: "RICOZ-INT-123", status: OfferLetterStatus.SENT, pdfBuffer: Buffer.from("%PDF-test"), save: async () => undefined };
  context.mock.method(OfferLetter, "findOne", (filter: Record<string, unknown>) => {
    assert.equal(String(currentScope()?.companyId), String(companyId));
    assert.equal(filter._id, String(offer._id));
    assert.equal(filter.candidateId, String(offer.candidateId));
    assert.equal(filter.version, 2);
    return { select: (selection: string) => { assert.equal(selection, "+pdfBuffer"); return { exec: async () => offer }; } };
  });
  const headers = new Map<string, string>();
  let bytes: Buffer | undefined;
  const response = { setHeader: (name: string, value: string) => headers.set(name, value), send: (body: Buffer) => { bytes = body; } } as unknown as Response;
  await openOfferDocument({ query: { token: createOfferLinkToken(offer) } } as unknown as Request, response, (error) => { throw error; });
  assert.equal(bytes, offer.pdfBuffer);
  assert.equal(headers.get("Content-Type"), "application/pdf");
  assert.equal(headers.get("Cache-Control"), "private, no-store");
  assert.match(headers.get("Content-Disposition")!, /^inline;/);
  assert.equal(offer.status, OfferLetterStatus.VIEWED);
  assert.notEqual(offer.status, OfferLetterStatus.ACCEPTED);
  assert.throws(() => sendOfferPdfResponse(response, { offerLetterNumber: "missing" }));
});

test("mergeRoles appends work role without duplication", () => {
  const roles = mergeRoles([UserRole.USER, UserRole.CUSTOMER], UserRole.INTERN);
  assert.deepEqual(roles, [UserRole.USER, UserRole.CUSTOMER, UserRole.INTERN]);
  assert.deepEqual(mergeRoles([UserRole.USER, UserRole.INTERN], UserRole.INTERN), [UserRole.USER, UserRole.INTERN]);
});

test("only sent or viewed offers can be accepted or declined by their candidate", async () => {
  const candidateId = new Types.ObjectId();
  const offer = (status: OfferLetterStatus) => {
    const value: {
      candidateId: Types.ObjectId;
      status: OfferLetterStatus;
      acceptedAt?: Date;
      declinedAt?: Date;
      save: () => Promise<void>;
    } = { candidateId, status, save: async () => undefined };
    return value;
  };
  await assert.rejects(acceptOfferByCandidate(offer(OfferLetterStatus.GENERATED), candidateId), /sent offer/);
  await assert.rejects(declineOfferByCandidate(offer(OfferLetterStatus.DRAFT), candidateId), /sent offer/);
  const viewed = offer(OfferLetterStatus.VIEWED);
  await acceptOfferByCandidate(viewed, candidateId);
  assert.equal(viewed.status, OfferLetterStatus.ACCEPTED);
  assert.ok(viewed.acceptedAt instanceof Date);
  const sent = offer(OfferLetterStatus.SENT);
  await declineOfferByCandidate(sent, candidateId);
  assert.equal(sent.status, OfferLetterStatus.DECLINED);
  assert.ok(sent.declinedAt instanceof Date);
});

test("buildOfferData uses trusted server-side applicant data and correct offer type", async () => {
  const data = await buildOfferData(
    {
      _id: "app-1",
      opportunityId: { _id: "opp-1", type: "INTERNSHIP", title: "Product Design Intern", role: "Design Intern", category: "Design", workMode: "REMOTE", location: "Bengaluru", responsibilities: ["Research"], salary: "Rs. 15,000" },
      userId: { _id: "user-1", name: "Jane Doe", email: "jane@example.com", phoneNumber: "+91 99999 99999", roles: [UserRole.USER, UserRole.CUSTOMER], address: "12 Main Street" },
    },
    UserRole.INTERN,
    OfferType.INTERN,
    {
      offerDate: new Date("2026-09-20"),
      joiningDate: new Date("2026-10-01"),
      deadline: new Date("2026-09-30"),
      compensation: { stipend: "₹15,000/month", currency: "INR" },
      employmentTerms: { endDate: new Date("2027-04-01"), internshipDuration: "6 months", probationPeriod: "30 days", workingHours: "Mon-Fri, 9am-6pm", employmentType: "Part-time" },
      position: { designation: "Design Intern", department: "Product Design", workMode: "REMOTE", location: "Bengaluru", reportingManager: "Asha Rao" },
    },
  );

  assert.equal(data.offerType, OfferType.INTERN);
  assert.equal(data.candidateSnapshot.email, "jane@example.com");
  assert.equal(data.position.designation, "Design Intern");
  assert.equal(data.employmentTerms.joiningDate?.toISOString().slice(0, 10), "2026-10-01");
  assert.equal(data.compensation.stipend, "₹15,000/month");
  assert.equal(data.employmentTerms.employmentType, "Part-time");
  assert.equal(data.employmentTerms.endDate?.toISOString().slice(0, 10), "2027-04-01");
  assert.equal(data.compensation.paymentCycle, "Monthly");
  assert.deepEqual(data.roles, [UserRole.USER, UserRole.CUSTOMER, UserRole.INTERN]);
});
