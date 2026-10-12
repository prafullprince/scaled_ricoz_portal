# Client Lists communication campaigns

Client Lists supports email and WhatsApp campaigns for individually selected clients or all currently filtered clients (up to 5,000 recipients per campaign). Campaign creation and sending require Sales lead-update access.

## Email

Configure the server SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`). Email subjects and bodies support `{{name}}`, `{{firstName}}`, `{{company}}`, `{{email}}`, and `{{phone}}`. CC/BCC and up to 5 MB of supported attachments are available. Imported clients with an email opt-out or without a valid email are skipped.

Campaigns can be scheduled for a future time. The server processes due campaigns in the background. SMTP acceptance is recorded as `SENT`; SMTP alone does not confirm delivery, opens, bounces, or replies.

To feed additional events from an email provider that supports callbacks, set `EMAIL_CAMPAIGN_WEBHOOK_SECRET` and configure the provider to POST this normalized event:

```http
POST /api/v1/sales/leads/imported/campaigns/email-status
x-ricoz-email-webhook-secret: <configured secret>
Content-Type: application/json
```

```json
{"messageId":"<SMTP message id>","status":"delivered"}
```

Supported callback statuses are `sent`, `delivered`, `read`, `failed`, `bounced`, and `replied`. The provider integration must map its event format and message ID to this contract; events not supplied by the provider cannot be inferred.

## WhatsApp

Connect a Meta WhatsApp Business account in Marketing → Social and configure its Meta webhook so inbound messages and message status events reach the existing `/api/v1/marketing/social/webhook/meta` endpoint. Client Lists only sends Meta-approved templates, including personalized body variables. Operators must confirm client opt-in before creating a WhatsApp campaign; explicit WhatsApp opt-outs in imported fields are skipped. Meta webhook events update sent, delivered, read, failed, and replied recipient statuses where Meta supplies them.
