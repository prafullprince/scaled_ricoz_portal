# Offer and HR document delivery

The document API reuses approved recruitment offer records and published HR-document PDFs. It does not accept arbitrary HTML, PDF bytes, recipients, or email content. Offer recipients come from the candidate account; HR-document recipients come from the employee record.

## Setup

Configure the SMTP variables in `server/.env` (ZeptoMail and other SMTP providers use the same settings):

```dotenv
SMTP_HOST=smtp.zeptomail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=emailapikey
SMTP_PASS=replace-with-your-smtp-token
EMAIL_FROM=hr@example.com
EMAIL_FROM_NAME=Ricoz Innovation
```

For ZeptoMail, use the SMTP token from the mail agent settings as `SMTP_PASS`. Do not add SMTP configuration to the Next.js environment or expose it to the browser. The server continues to accept the legacy `ZEPTOMAIL_*` variables when generic SMTP variables are absent.

Install the server dependencies and the matching Playwright browser on each deployment host:

```bash
cd server
npm install
npx playwright install chromium
```

On a Linux EC2 host, install Chromium runtime libraries if they are not already present (`npx playwright install --with-deps chromium` on a Debian/Ubuntu image). Chromium runs headlessly with the sandbox disabled for server deployment. PDF rendering permits two concurrent browser pages and queues up to twenty waiting renders per process; additional work receives HTTP 503 and can be retried.

Complete the active company's offer-letter profile at `PUT /api/v1/recruitment/admin/offer-letter-profile` before generating an offer. The profile contains the legal/display names, address, contact details, HR contact, authorized signatory, and optional small PNG/JPEG/WebP logo and signature. Offer compensation and acceptance details must be approved in the recruitment pipeline before the candidate can move to the Offer stage.

## API

All endpoints require the existing bearer access token and active-company context (`x-company-id` where the account has multiple companies). Offer-letter actions require recruitment-admin access (including company HR, ADMIN, and CEO); published HR document actions require the existing HR document-management access.

### Generate and download

```bash
curl -X POST "$API_URL/api/v1/documents/generate" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-company-id: $COMPANY_ID" \
  -H "Content-Type: application/json" \
  -d '{"documentType":"OFFER_LETTER","documentId":"65f0a10f3d1b2a4c5e6f7890"}' \
  -o offer-letter.pdf
```

Use `"HR_DOCUMENT"` and a published HR document ID to download an employee document. The PDF is returned with `Content-Type: application/pdf`, `Cache-Control: private, no-store`, and `X-Pdf-Generated: true`.

### Send email with attachment

```bash
curl -X POST "$API_URL/api/v1/documents/send-email" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-company-id: $COMPANY_ID" \
  -H "Idempotency-Key: offer-65f0a10f3d1b2a4c5e6f7890-v1" \
  -H "Content-Type: application/json" \
  -d '{"documentType":"OFFER_LETTER","documentId":"65f0a10f3d1b2a4c5e6f7890"}'
```

The first successful response contains `pdfGenerated: true` and `emailSent: true`. A PDF-generation or SMTP failure is not reported as a successful delivery; email failures return HTTP 502 and include `pdfGenerated: true, emailSent: false` in the error details. Reuse the same idempotency key for retries of the same send attempt. A failed delivery must be deliberately retried with a new key.

### Generate, send, and optionally return the PDF

```bash
curl -X POST "$API_URL/api/v1/documents/generate-and-send" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-company-id: $COMPANY_ID" \
  -H "Idempotency-Key: offer-65f0a10f3d1b2a4c5e6f7890-v1" \
  -H "Content-Type: application/json" \
  -d '{"documentType":"OFFER_LETTER","documentId":"65f0a10f3d1b2a4c5e6f7890","returnPdf":true}' \
  -o offer-letter.pdf
```

Set `returnPdf` to `false` or omit it for a JSON delivery result. If email delivery fails, the endpoint returns the error response rather than a success-shaped PDF response.

## Next.js client

Use the existing authenticated API client and `DocumentsService` in `client/src/services/documents.service.ts`; it includes methods for PDF download, email delivery, and combined delivery. For example:

```ts
const pdf = await DocumentsService.generate({
  documentType: "OFFER_LETTER",
  documentId: offerId,
});
const url = URL.createObjectURL(pdf.data);
const link = document.createElement("a");
link.href = url;
link.download = "offer-letter.pdf";
link.click();
URL.revokeObjectURL(url);

await DocumentsService.sendEmail(
  { documentType: "OFFER_LETTER", documentId: offerId },
  `offer:${offerId}:initial-send`,
);
```

The recruitment pipeline already exposes offer generation and send actions for HR/ADMIN/CEO users. Use an offer ID/version-scoped idempotency key so network retries cannot send duplicate email. Do not send recipient addresses or document contents from the browser.

Offer PDFs are rendered as exactly two A4 pages by the Playwright template at `server/src/modules/recruitment/offer.template.ts`. Existing HR-document types use the stored, published PDF generated by `server/src/modules/hr/hr-document.pdf.ts`. Invoice, receipt, and report document types are not exposed because this application does not yet have approved persisted source records for those documents.
