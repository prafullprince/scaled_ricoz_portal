# Ricoz Sales Department Architecture

This document defines the shared Sales Department architecture for the Next.js website, Expo mobile app, and Express API. The API is the authorization and business-rule authority; clients only adapt presentation and interaction to their platform.

## Current CRM Release: October 3, 2026

### Pipeline Management Update

Pipeline management now uses company-scoped saved definitions, not free-text labels. Each pipeline has a stable key, editable name/description, ordered stages, archive state and revision. Each stage has a stable ID, editable name, probability, archive state and fixed reporting category. Multiple custom stages can share a category without being merged on the board. Existing records retain their legacy category-based stage until moved.

1. Open CRM & Leads and choose **New pipeline**. Set the name and description, add stages, name them, set probabilities, and order them with the arrow controls. Save pipeline.
2. Select a saved pipeline from the picker. Its board shows independent stage columns, full matching counts and currency-separated totals. Each column loads 20 deals at a time with its own Load more button; counts and totals cover all matching deals, not just loaded cards.
3. Use **Pipeline settings** to rename or reorder stages and archive/restore stages or the pipeline. Keep at least one open stage and exactly one active won and lost stage. Existing stage IDs and reporting categories cannot be removed or changed, protecting historical records. Archive obsolete stages instead; records already there remain visible.
4. Add Lead selects a saved active pipeline and an initial open stage. Move a deal with the stage dropdown or desktop drag-and-drop. A lost move requires a reason. Server-side placement derives the reporting category and probability from the selected stage; existing customer and revenue reports continue using those categories.
5. To transfer a deal to another pipeline, open its record, choose the destination pipeline and stage, then save. The destination defaults to its first open stage. This moves the existing record with its history; it does not duplicate it or automatically create a connected deal.
6. Archived pipelines/stages reject new placements. Records can still be read, edited without moving, or moved out through the record drawer. Concurrent settings edits return a conflict instead of silently overwriting a newer revision.

Pipeline settings require department-wide scope plus `SALES_DEAL_UPDATE`: normally CEO/Admin and authorized Sales Heads, or explicitly authorized department-wide HR. Managers and Executives use configured pipelines and move only records within their existing ownership scope and permissions. Pipeline definitions are visible to authorized Sales viewers in the company; pipeline-specific membership restrictions are not implemented.

The implementation adds `salesPipeline.models.ts`, the `/sales/pipelines` GET and `/sales/pipelines/:key` PUT routes, and `SalesPipelineBoard.tsx`. The database needs the compound unique `(companyId, key)` index declared by the model. No destructive lead migration is needed; legacy named pipelines are synthesized with the original stages until saved.

Verification for this update: 24 focused Sales/pipeline tests pass, server build and Sales lint pass. Full client typecheck still has only the seven existing chat nullability errors. Live board reads and full counts/totals were checked; intercepted settings save, custom-stage dropdown, loss validation, stage ordering and drag-event request/error handling were checked. Desktop/mobile screenshots and overflow checks passed. Automated pointer dragging did not complete reliably; native pointer drag still needs a manual browser check. No real leads or settings were changed during browser write tests.

Not included: automatic connected-pipeline rules, mandatory stage-entry fields, workflow automation, per-pipeline membership, or mobile-native pipeline editing. The controls above provide manual pipeline management, not complete Bigin parity.

The implementation below is the shipped web/API baseline. The numbered sections after it describe the broader target architecture, not a claim that every proposed model or feature already exists. Bigin's [official feature list](https://www.bigin.com/features.html) is a functional reference, not a statement of feature parity.

### Available Workspaces

| Workspace | Current behavior |
| --- | --- |
| CRM & Leads | Configurable pipeline board with independent column paging/totals, lead table, scheduled activity queue, search, owner/stage/pipeline/follow-up filters |
| Record drawer | Contact/company details, value, priority, service interest, pipeline label, tags, probability, expected close date, next follow-up, notes and loss reason |
| Activities | Log calls, emails, meetings, notes and dated follow-ups; complete activities; view recorded stage changes |
| Customers | Won lead/deal records, with the same details, activities and ownership controls; not a separate account/contact directory |
| Reports | Scope-wide stage, owner and source reports; open value, won value, weighted open forecast, closed-deal win rate and overdue next-follow-up counts; JSON download |
| My Work | Existing task workflow plus the internal Sales team table for leadership |
| Calendar / Approvals | Existing task calendar and task-review flows; CRM activities and deal approval policies are not wired into these views |

### Hierarchy and Ownership

| Persona | Record scope | Lead ownership |
| --- | --- | --- |
| CEO / Admin | Current company's Sales department | Choose an active Sales owner when creating; assign/reassign within the department |
| Sales Head | Sales department | Assign to active managers or executives in the department |
| Sales Manager | Self and direct active Sales MEMBER reports | Assign/reassign only within that scope |
| Sales Executive (employee or intern) | Own records | Create for self and work own records; no leadership assignment control |
| Custom role / explicitly authorized HR | Resolved permissions and organization scope | Actions require the corresponding Sales permission; a role label alone does not grant access |

`OrganizationAssignment` remains the reporting source of truth. Permissions and tenant scope are enforced by the API. Leads, activities, history and reports stay company-scoped even though user accounts are shared. Moving a lead changes which manager/executive can see its entire history. Existing deleted owners are tolerated; authorized leadership can reassign their records.

Task delegation is unchanged: Head to direct Manager, Manager to direct Executive. Lead ownership is deliberately broader for Heads so they can correct department-wide allocation. Creating as CEO/Admin requires selecting a Sales owner rather than assuming the CEO has a Sales assignment.

### Daily Workflow

1. Configure the Sales Head, Managers and Executives in People & Structure, including `reportsTo` and matching role bindings. Employees and interns have the same executive CRM workflow.
2. Open `/dashboard/sales/crm`, select Add Lead, and capture contact, source, company, service, priority, value and owner. Choose a saved pipeline such as Sales, Renewals or Partnerships and an initial stage.
3. The Head assigns records to a Manager or Executive. A Manager delegates to direct Executives. Assignment events retain the previous/new owner, actor, reason and timestamp.
4. Open a record by its name. Set tags, expected close date, probability and next-follow-up date. Save changes. Dates entered in the browser's local timezone are stored as UTC instants.
5. In Activities, log the call/email/meeting outcome or create a dated follow-up. Use Scheduled Activities in CRM to browse pending dated activities and open a record to complete one. An EMAIL activity is a log, not an email send; contact links open the device's mail/phone handler.
6. Progress the record through its pipeline's configured stages. Stages map to the reporting categories `NEW`, `QUALIFIED`, `CONTACTED`, `REQUIREMENT`, `PROPOSAL`, `NEGOTIATION`, `WON` or `LOST`. Stage order and jumps remain user-controlled, not a mandatory approval sequence. Stage and pipeline changes are recorded in the timeline.
7. Marking WON sets probability to 100% and includes the record in Customers. Marking LOST requires a reason and sets probability to 0%. Reopening a customer removes it from the won-only Customers view.
8. Managers review ownership, dated activities and overdue next-follow-ups. Heads/CEO review Reports by stage, owner and source and download a JSON snapshot. Existing task reviews continue through My Work/Approvals independently of deal stage changes.

### Reporting and Data Semantics

- All monetary amounts use integer minor units. The web form converts INR rupees to paise. Reports group by currency without converting or summing different currencies.
- Weighted forecast = sum of open deal value multiplied by its probability / 100. Missing legacy probabilities use 10%. This is an all-time open forecast, not a date-filtered forecast or revenue recognition.
- Won value is the expected value of WON records, not verified invoiced or collected revenue. Win rate = WON / (WON + LOST), with zero when no deals are closed.
- Reports include every visible record, independent of lead-list pagination. Board stage counts and currency totals include all matching records; cards load independently per stage. List/activity summary tiles marked "on page" remain page-local. Use stage/pipeline filters to work a specific segment.
- The Scheduled Activities view selects records with pending dated activities on the server, then lists those activities within each result page. Paging is by record, not by activity; activity ordering is chronological within the current page.
- A record's Next Follow-up field and its individual scheduled activities are separate. Completing an activity does not clear Next Follow-up. Update or clear that field after outreach. Report overdue counts use Next Follow-up on open deals, not the activity log.
- New fields have backward-compatible defaults; old records do not require a destructive migration. The Sales pipeline filter includes legacy records with no stored pipeline value. Activity history is capped at 500 entries per record; archiving is not yet available.

### Current Implementation

- Model: `server/src/models/salesLead.models.ts` (contact/deal fields and embedded activities/assignment history).
- API: `server/src/modules/sales/`; new activity POST and completion PATCH under `/sales/leads/:leadId/activities`, plus `/sales/reports`. Existing create/update/assign routes are retained.
- Web: `SalesWorkspace.tsx`, `SalesLeadsWorkspace.tsx`, `SalesLeadDetail.tsx`, shared Sales types and service.
- Route permissions: lead view/create/update/assign, activity create for logging/completion, report view for reports. Activity visibility follows lead visibility in this embedded model.

### Not Implemented in This Release

This is not yet a fully furnished Bigin equivalent. Separate contacts/accounts and multiple deals per contact, deduplication/import, connected pipelines, stage transition policies, workflow automation, targets/quotas, deal approval controls, scheduled notifications, products/quotes/invoices/payments, and date-range/velocity reports still require implementation. Custom pipeline stage definitions and manual transfers are available as described in the Pipeline Management Update above.

Email synchronization/sending, WhatsApp, telephony, booking and payment integrations need provider credentials, consent rules, configuration and dedicated delivery workflows; logging an activity does not enable those services. No Bigin data synchronization is included. The Expo mobile interface was not changed by this release.

### Verification

- Server: `./node_modules/.bin/tsx --test --test-force-exit src/modules/sales/sales.test.ts` (14 passing tests), plus `npm run build`.
- Web: focused Sales ESLint passes. Full `tsc --noEmit` remains blocked by seven pre-existing nullable-user errors in the chat DetailsPanel.
- Live browser read checks: existing lead board, won-only Customers, currency-separated Reports. Desktop/mobile screenshots and overflow checks completed.
- Write interactions: intercepted test responses verified record save, activity log/completion, required loss reason and responsive drawer. No real Sales record was modified for browser tests; these checks do not prove live write persistence or provider integrations.

## 1. Folder Structure

```text
server/src/
  models/sales/
    salesLead.models.ts
    salesAccount.models.ts
    salesContact.models.ts
    salesDeal.models.ts
    salesTask.models.ts
    salesActivity.models.ts
    salesTarget.models.ts
    salesApproval.models.ts
    salesAudit.models.ts
    salesNotification.models.ts
  modules/sales/
    sales.routes.ts
    sales.authorization.ts
    dashboard/
    team/
    leads/
    deals/
    tasks/
    activities/
    targets/
    analytics/
    approvals/
    audit/
    notifications/

client/src/
  app/dashboard/sales/
    page.tsx
    leads/
    accounts/
    contacts/
    deals/
    pipeline/
    activities/
    tasks/
    team/
    targets/
    reports/
    analytics/
    approvals/
    audit-logs/
  components/dashboard/sales/
    shared/
    dashboard/
    leads/
    deals/
    tasks/
    team/
    activities/
  services/sales.service.ts
  types/sales/

mobile/src/
  app/(app)/sales/
    _layout.tsx
    index.tsx
    leads/
    deals/
    tasks/
    follow-ups/
    activities/
    notifications.tsx
  components/sales/
  services/sales.service.ts
  types/sales.ts
```

Folders are introduced phase by phase. Shared web components stay under `components/dashboard/sales`; mobile uses native components while sharing the API contract, status vocabulary, and business rules.

## 2. Database Models

`OrganizationAssignment` remains the hierarchy source of truth:

- `department = SALES`
- `level = HEAD | MANAGER | MEMBER`
- `reportsTo = null | headUserId | managerUserId`
- `designation = SALES_HEAD | SALES_MANAGER | SALES_EXECUTIVE`
- `employmentType = EMPLOYEE | INTERN` for executives; it does not grant or remove sales capabilities

Every CRM entity includes `ownerId`, `departmentId`, `createdBy`, timestamps, and an organization/team scope where appropriate.

| Model | Important fields |
| --- | --- |
| Lead | identity/contact/company, source, service, status, priority, ownerId, assignedBy, nextFollowUpAt, assignmentHistory |
| Account | name, industry, contacts, ownerId, teamId, billing metadata |
| Contact | accountId, name, communication fields, ownerId, consent metadata |
| Deal | leadId, accountId, ownerId, stage, amount, probability, expectedCloseDate, won/lost metadata |
| SalesTask | assignedTo, assignedBy, optional entity links, priority, status, dueAt, duration, completedAt |
| Activity | actorId, type, optional entity links, outcome, duration, nextFollowUpAt |
| Target | period, scope, assigneeId, targetAmount, actualAmount |
| Approval | requesterId, approverId, type, entity, status, reason, decision |
| Audit | actorId, action, entityType, entityId, previousValue, newValue, timestamp |
| Notification | recipientId, type, entity link, readAt, delivery state |

MongoDB transactions group state changes with assignment history, audit records, and notifications. Indexes prioritize owner/team/status, stage, due date, source, and reporting periods. Money is stored in integer minor units with an ISO currency code.

## 3. RBAC and Permission Architecture

Existing user roles remain authentication-level roles. Sales authority uses granular permissions such as `SALES_LEAD_VIEW`, `SALES_LEAD_ASSIGN`, `SALES_TASK_ASSIGN`, `SALES_DEAL_UPDATE`, `SALES_TEAM_VIEW`, `SALES_TARGET_MANAGE`, and `SALES_APPROVAL_MANAGE`.

Authorization has two checks:

1. Capability: `requirePermission(...)` verifies the action.
2. Scope: sales authorization resolves the actor's active `OrganizationAssignment` and constrains queries to department, descendants, direct reports, or owned records.

Default scope:

| Actor | Visibility and assignment scope |
| --- | --- |
| Sales Head | Entire Sales department |
| Sales Manager | Own assignment plus direct/managed descendants |
| Sales Executive | Owned or explicitly shared records |

`EMPLOYEE` and `INTERN` identify employment type, not capability. Sensitive permissions can be granted explicitly without branching operational workflows by employment type. All authorization is enforced server-side.

## 4. API Architecture

Routes are mounted under `/api/v1/sales` following the existing controller/service/route pattern:

```text
GET    /dashboard
GET    /team
GET    /team/:userId
GET    /leads
POST   /leads
GET    /leads/:id
PATCH  /leads/:id
POST   /leads/:id/assign
GET    /accounts
GET    /contacts
GET    /deals
POST   /deals
PATCH  /deals/:id
GET    /tasks
POST   /tasks
PATCH  /tasks/:id
POST   /tasks/:id/assign
GET    /activities
POST   /activities
GET    /follow-ups
GET    /targets
POST   /targets
GET    /analytics
GET    /approvals
POST   /approvals/:id/decision
GET    /audit-logs
GET    /notifications
PATCH  /notifications/:id/read
```

Controllers validate HTTP input, services own transactions and business rules, repositories/models own persistence, and authorization helpers build scoped MongoDB filters. List endpoints use pagination, stable sorting, filters, and searchable fields. Mutations return the updated resource and emit an outbox event after commit.

## 5. Page Architecture

The website uses `/dashboard/sales` as the role-adaptive entry point. Sales Head and Manager dashboards use the same route with different server-scoped data and modules. Executives see a compact personal dashboard. Dedicated pages provide leads, accounts, contacts, deals, pipeline, activities, tasks, team, targets, reports, analytics, approvals, and audit logs according to permissions.

Mobile uses `/sales` with a role-aware native stack. Its first-level experience prioritizes KPIs, quick actions, assigned leads/deals/tasks, follow-ups, and notifications. Dense analytics, tables, and Kanban become drill-down screens rather than compressed desktop layouts.

## 6. Component Architecture

Web and mobile components do not share rendering code. They share API DTOs and status semantics.

- Shared domain views: KPI definitions, filters, assignment inputs, entity summaries, status/stage mappings.
- Web: accessible tables, filter bars, pipeline columns, drawers, dialogs, charts, skeletons, errors, and empty states using existing dashboard tokens.
- Mobile: native lists, bottom sheets, segmented controls, compact KPI grids, pull-to-refresh, offline/error states, and platform accessibility labels.
- Feature components receive data and callbacks; service calls and authorization decisions do not live in visual components.

## 7. State Management Architecture

- Server state is fetched through the existing Axios service layers. Route-level pages load initial web data; interactive client components refresh mutations.
- Redux remains limited to authenticated identity, cross-route filters, notification counters, and optimistic real-time updates. Entity collections are not duplicated globally without a cross-route need.
- Web and mobile normalize incoming WebSocket events into the same event vocabulary.
- Forms keep local state, submit idempotency keys for mutation retries, and reconcile with the server response.

## 8. Complete User Flows

### Lead to Revenue

1. Website lead is created with source, owner/team scope, and audit event.
2. The responsible manager receives a notification.
3. Manager assigns it to a Sales Executive who may be an Employee or Intern.
4. The API verifies permission and direct-team scope, updates ownership, appends assignment history, writes audit data, and emits a notification event.
5. Assignee records calls, notes, meetings, and the next follow-up.
6. Manager observes activity and overdue follow-ups within team scope.
7. Qualified lead becomes a deal without changing ownership unless explicitly reassigned.
8. Stage changes are audited; configured discount/value thresholds create approvals.
9. Won deal updates target actuals and dashboard analytics for executive, manager, and head scopes.

### Task Assignment

1. Head or manager opens Assign Task on web or mobile.
2. Eligible assignees come from the server-scoped Sales hierarchy endpoint.
3. The API validates capability, assignee scope, related CRM objects, and due date.
4. It creates the task, audit entry, and notification atomically.
5. Redis publishes the committed event; WebSocket updates the assignee's clients.
6. Completion records actor/time and refreshes workload and performance metrics.

### Reassignment

1. Authorized actor selects a new eligible owner and supplies a reason.
2. The API rejects cross-team moves unless the actor has department-wide scope.
3. Previous owner, new owner, actor, reason, and timestamp are immutable history.
4. Both affected users receive notifications and dashboards invalidate related metrics.

### Approval

1. A configured sensitive action creates a pending approval instead of blocking normal work.
2. The manager decides within team scope; rules can escalate to Sales Head.
3. Approval or rejection is audited and resumes or cancels the requested mutation.

## Delivery Phases

Implementation follows the requested fifteen phases. Each phase adds server contracts first, then website and mobile experiences against the same API. Existing Admin, Customer, Investor, Employee, and Intern routes remain intact; sales navigation is additive and permission-filtered.