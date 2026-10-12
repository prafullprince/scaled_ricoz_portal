# Compliance Management

The Compliance Center is a company-scoped internal management workspace for obligations configured by authorized company personnel. It is not legal advice, a certification, or a determination that a company is compliant. No universal legal requirement or deadline is seeded; teams must confirm applicability, jurisdiction, source, owner, and review cadence with qualified professionals.

## Current capabilities

- Capability-gated views for requirements, review and approval, evidence, risks, issues, policies and acknowledgements, notifications, audit history, CSV reports, and reminder rules.
- Configurable requirements record applicability, source type/reference, jurisdiction, department, owners, review roles, status, deadlines, renewal, risk, and evidence expectations.
- Review and approval are separate decisions. Rejections require a reason; required evidence must be verified before submission/approval.
- Evidence is stored privately as Mongo binary data, limited to 8 MB, checked for PDF/JPEG/PNG signatures, hashed with SHA-256, and only downloaded after related-requirement authorization. Uploads are rate-limited.
- Reminder rules are company-configured. The BullMQ hourly worker creates deduplicated in-app due, renewal, and evidence-expiry notifications and records expiry transitions.
- Audit events have read-only API coverage and record actor, entity, action, and selected before/after values. Company scoping is supplied by the existing authenticated request context and `companyScoped` model plugin.
- The dashboard reports internal counts and labels itself as an internal management view, not a legal determination.

## Authorization and scope

The server is authoritative; hiding a tab or button is not an access control. API routes require `COMPLIANCE_VIEW` or the relevant capability. Requirements, risks, and issues are further filtered by executive status, active department assignment, ownership, reporting relationship, and assigned review roles. Active organization assignments receive view capability; higher-level and dynamic company roles may receive more capabilities through the existing role resolver. Custom role grants should be reviewed by the company administrator before use.

Relevant capabilities are `COMPLIANCE_VIEW`, `COMPLIANCE_CREATE`, `COMPLIANCE_UPDATE`, `COMPLIANCE_DELETE`, `COMPLIANCE_ASSIGN`, `COMPLIANCE_APPROVE`, `COMPLIANCE_AUDIT`, `COMPLIANCE_MANAGE_DOCUMENTS`, `COMPLIANCE_MANAGE_POLICIES`, `COMPLIANCE_MANAGE_RISKS`, and `COMPLIANCE_MANAGE_SETTINGS`.

## API and operations

Routes are mounted at `/api/v1/compliance` and include:

- `/access`, `/dashboard`, `/calendar`, `/categories`
- `/requirements` and requirement `submit`, `review`, and `approve` actions
- `/evidence`, evidence `download` and `verify` actions
- `/risks`, `/issues`, `/policies`, and policy `publish`/`acknowledge` actions
- `/notifications`, `/audit-logs`, `/reports`, and `/settings/reminder-rules`

The worker starts by default with the server. Set `COMPLIANCE_WORKER_ENABLED=false` to disable it in environments where a separate worker deployment is not configured. The worker uses the existing Redis/BullMQ connection and must have access to the same MongoDB and Redis deployments as the API. Monitor failed queue jobs and Redis/Mongo availability.

Categories are initialized idempotently for a company when an authorized user lists categories. The default category names are classifications only; their descriptions explicitly leave applicability to the company.

## Verification

From `server/`:

```sh
./node_modules/.bin/tsx --test --test-force-exit src/modules/compliance/compliance.validation.test.ts
./node_modules/.bin/tsx --test --test-force-exit src/**/*.test.ts
npm run build
```

The compliance validation suite covers calendar date/department boundaries, requirement department filters, and rejection reasons. Before production rollout, add database-backed tests for cross-company and cross-department access, assignment loss, upload signature/size limits, approval evidence invariants, notification deduplication, worker expiry, and audit behavior.

## Production rollout gaps

This is an initial integrated compliance core, not the complete set of integrations described in the product brief. Vendor/partner onboarding, investor document records, recruitment workflows, customer/contract obligations, sales CRM, invoice/finance records, and HR lifecycle hooks are not connected to their owning systems. The current portal has no local invoice ledger; invoice work should consume the configured external invoice API rather than creating a second source of truth. PDF reporting, configurable escalation chains/ownership reassignment, and notifications for access loss or departing owners are also not implemented.

Audit writes currently follow business writes sequentially and are not transactionally atomic. For stronger audit guarantees, use a durable outbox/idempotent event design and reconcile records after partial failures. Evidence in Mongo requires explicit backup/restore, retention, encryption-at-rest, and capacity validation. Review upload malware scanning, evidence retention/deletion policy, download logging, and any applicable data residency requirements with security and legal owners. The client-wide TypeScript check currently has a separate pre-existing unresolved `InternService` reference in `client/src/components/dashboard/ProfileView.tsx`.
