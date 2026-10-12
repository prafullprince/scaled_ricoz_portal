import test from "node:test";
import assert from "node:assert/strict";
import {
  emailDocumentSchema,
  generateAndSendDocumentSchema,
  generateDocumentSchema,
} from "./documents.validation.js";

const offerRequest = {
  body: {
    documentType: "OFFER_LETTER",
    documentId: "65f0a10f3d1b2a4c5e6f7890",
  },
};

test("document endpoints accept only persisted document references", () => {
  assert.equal(generateDocumentSchema.parse(offerRequest).body.documentType, "OFFER_LETTER");
  assert.equal(emailDocumentSchema.parse(offerRequest).body.documentId, offerRequest.body.documentId);
  assert.equal(generateAndSendDocumentSchema.parse(offerRequest).body.returnPdf, false);
});

test("document endpoints reject arbitrary recipient, HTML, and malformed IDs", () => {
  assert.throws(() => emailDocumentSchema.parse({
    body: { ...offerRequest.body, recipient: "attacker@example.com" },
  }));
  assert.throws(() => generateDocumentSchema.parse({
    body: { ...offerRequest.body, html: "<script>alert(1)</script>" },
  }));
  assert.throws(() => generateDocumentSchema.parse({
    body: { documentType: "HR_DOCUMENT", documentId: "../private.pdf" },
  }));
});
