This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started
First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Investor-focused public site

- `/` uses an enterprise-style layout (inspired by large IT-services homepages, using only Ricoz content and brand colors): full-bleed hero video with play/pause and "Learn more", What's new carousel of the latest production products (`#whats-new`), expanding capability tiles (`#what-we-do`), product stories (`#products`), catalogue stats, a How-we-build accordion (`#how-we-build`), an Explore carousel (`#explore`), a careers band (`#careers`), and a contact band (`#contact-us`).
- The homepage presents Ricoz as a **Product Factory**, with database-backed product stories, a searchable directory, and detailed product profiles. The site-wide navbar is a mega-menu (What we do, Who we are, Products, Careers, Investors) that opens on hover or click, closes on Escape/blur, and becomes an accordion menu on mobile.
- `SwipeCarousel` provides accessible scroll-snap carousels (swipe, prev/next buttons disabled at edges). Section entrances use `Reveal`/`useRevealMotion` from `LandingMotion.tsx`, which start from `initial={false}` and animate from state after mount so they remain hydration-safe and respect reduced motion.
- All public products come from the database through `GET /products/public` and `GET /products/public/:id` under the existing API base. The hardcoded public product list has been removed. The landing page, directory, profiles, and investor showcase share this source.
- The landing-page Product Stories section and `/products` directory display every non-deleted default-company product in the **Unassigned**, **Development**, or **Production** lifecycle. A completed root delivery workflow means Production; an unfinished workflow means Development. Records without a workflow use their valid stored status, defaulting to Unassigned. Other public catalogue consumers remain production-only unless they explicitly request all stages. The legacy `isPublic` API field remains accepted for compatibility but does not control visibility. No records are seeded or modified by public requests.
- Public endpoints are fixed to the default Ricoz company, ignore visitor company headers, and expose an explicit whitelist. They never expose developers, staff IDs, assignments, tasks, progress reports, or internal workflow objects. Leaving Production or deleting removes a product from public list/profile requests.
- `/products` supports database search, category/status/technology filters, sort, and pagination across all three lifecycle stages. `/products/[id]` loads current public database metadata for any stage; invalid, deleted, and foreign-company records return 404. There are no hardcoded or success-shaped fallback products.
- Catalogue counts and lifecycle labels are derived from the requested product stages. They are not customer, revenue, launch, or growth metrics. Optional categories, summaries, and website links are entered in the existing admin editor.
- `src/lib/products/catalogue.server.ts` makes credential-free, uncached server requests using `API_URL` or the existing `NEXT_PUBLIC_API_URL` (including `/api/v1`). It validates responses, bounds request time, and surfaces errors separately from an empty catalogue. `/api/catalogue` exposes the same safe catalogue through the frontend origin.
- The hero serves the supplied original video unchanged from `public/animations/product-factory.mp4`, without a fixed logo or company-name overlay. A lazily loaded Three.js scene shows four innovation thoughts at the moments the video's path changes (start ring, two crossing markers, and the fan-out of new paths; cues and the light's sampled position live in `src/lib/products/innovation-story.ts`). Each thought is pinned beside the travelling light with a pulsing ring marker and leader line, mapped through the video's `object-cover` crop; on narrow screens the video framing pans with the light so the path change stays visible. The video's playhead drives the anchor and text, so seeking, looping, and pausing keep them synchronized. Copy expresses our approach, not invented product data or performance claims. Accessible text and a visible static/non-WebGL fallback preserve the story. Playback pauses offscreen, in hidden tabs, and with reduced motion. The overlay is bounded to 30fps and 1.5 device pixel ratio; observers, listeners, geometries, textures, materials, and renderer resources are cleaned up on unmount. WebGL/media failures are surfaced explicitly.
- Framer Motion animates the headline, scroll progress, all section reveals/parallax, staggered story/principle cards and solution/vision steps with hover/tap feedback, hero perspective, product selector interactions, and directional product transitions. A page-wide pause control and reactive system reduced-motion support disable these effects. The hero also has its own playback control.
- The homepage Product Stories selector starts with the first all-stage catalogue page and fetches additional pages through `/api/catalogue`, so every product is accessible from both Product Stories and the full directory. Investor showcase requests remain production-only. Requests have a timeout, cancellation, validated responses, and explicit retryable errors. It supports product selection, previous/next buttons, arrow keys on the stable focused product article, and directional horizontal swipe animations without intercepting vertical scrolling.
- Product delivery records and company APIs require authentication. Investor analytics also require authorization and investor verification. The public landing page does not fetch or disclose those records.
- Verified market-size figures and named leadership profiles are not present in the public content, so no TAM/SAM/SOM numbers or founder biographies are displayed. The team approach and strategic direction reuse the existing About and investor content; no revenue model is inferred.
- Investor actions connect to `/investors`, `/signup?role=investor`, `/login`, and the existing `/contact` form. Footer links only point to existing destinations; placeholder legal/social URLs are not rendered.
- The existing global brand tokens, Geist fonts, logo, button helpers, and reduced-motion styles are unchanged. A scoped CSS module restores heading spacing and tracking on the redesigned pages where global heading rules would otherwise override utilities. It uses horizontal overflow clipping only while these pages are mounted so the sticky navbar can track the document rather than a non-scrolling body container. Other public pages retain their existing navigation routes.

## CEO and Admin workspaces

- The desktop workspace rail and mobile navigation include a dedicated **My workspace** icon for the personal dashboard, calendar, attendance, leave and daily planner.
- For CEO and Admin, the **My account** sidebar section (Profile, Settings, Security and Notifications) appears only in **My workspace**, not in department sidebars. Other roles retain their existing account navigation.
- The CEO/Admin **Organization-wide** and **Services** (Service catalog and Service requests) sections also appear only in **My workspace**, with their existing role-based access checks. Department-specific links and Compliance remain in their department workspaces.
- Personal navigation is separate from department workspaces. Shared pages retain the selected workspace through the `department` query parameter (`PERSONAL` for My workspace); department routes retain their own department context.
- Recruitment navigation appears only in the **HR** workspace for CEO and Admin. Other department navigation and existing role-based access remain unchanged.
- **Task reports** includes a **Progress reports** tab for users who can access delivery reports. It reuses the existing Progress & contributions view, carries over supported delivery departments and leaves the existing Task reports view as the default.
- **My Work** uses a shared inbox across Sales, HR, Marketing, employee/intern task work and departmental workflow tasks. Filters group urgent work, approvals, tasks and meetings; each source retains its own review or completion flow. CRM follow-ups and scheduled Sales meetings appear only for the assigned lead owner, and employee submissions still require their existing evidence rather than being marked complete directly.

## Sales delegation and accountability

- **Sales Task operations** defaults to **Sales targets & execution**, alongside an **Existing tasks** view. The same accountability workspace appears in Sales **My Work**, Sales **Reports** and the **Sales targets** tab in Task reports for Sales / All departments. Existing flat tasks and legacy workflow records are preserved.
- CEO/Admin and HR with the selected company's `TASK_ASSIGN` grant can create department targets assigned to an active Sales Head. HR has a **Sales targets** link under Granted company features; this grant does not grant unrestricted CRM editing.
- A Sales Head delegates within an assigned target to their direct Sales Managers; a Manager delegates execution or lead-linked tasks to direct Sales employees/interns. Child deadlines cannot exceed the parent deadline. Other managers' teams cannot be used. Sales task view/create/assign/update permissions and active organization assignments continue to apply.
- Task types are **Target**, **Execution** and **Lead-linked**. Records reuse `Task` with optional `salesAccountability` metadata; assignee, assigner/reporting reviewer, parent, priority, deadline, expected outcome, target and history stay together. Leads are chosen through a searchable, paginated picker and must be inside the assignee's Sales scope. Lead-linked tasks require exactly one lead.
- Revenue targets are entered in major currency units: **10 lakh INR = 1,000,000**, not paise. Revenue uses distinct linked closed-won CRM deals from the task and its descendants, with matching currency and a recorded `closedAt` inside the selected target period. The optional period start defaults to creation for department targets and inherits from the parent for children. Existing won leads without a recorded closing date are not silently counted as new sales.
- Customer targets count distinct customer identities (normalized company, otherwise email, phone or lead ID), not repeated deals. Customers already represented by an earlier won lead, including legacy won leads without a closing date, are excluded from new-acquisition counts. This is CRM-based identity matching, not a new customer master database.
- Activity and strategy targets use cumulative achieved units plus progress descriptions and evidence references. Activity targets sum matching activity units (such as calls, qualified leads or demos); strategy plans or different units cannot substitute for completed calls. Strategy targets roll up child milestones by completion percentage. Reported progress rolls up separately from reviewed / CRM-backed progress, so leadership can see ongoing work without treating unreviewed claims as verified performance.
- Only an assigned owner can report or submit for review. The assigner or CEO/Admin/authorized HR can approve or request changes, but cannot approve their own work. Approval requires the target to be achieved and every descendant task to be reviewed and completed. Legacy completion endpoints cannot bypass this review. Comments, evidence and review notes remain in task history.
- Assignment and progress notifications include the assignee, assigner and ancestor supervisors. An hourly, company-scoped scan creates deduplicated daily in-app reminders for work due within 24 hours, overdue work and blockers, escalating to the same leadership chain. No tasks are automatically marked complete.
- **New pipeline** starts with the recommended New → Assigned → Contact attempted → Contacted → Qualified → Meeting / demo scheduled → Meeting completed → Proposal → Negotiation → Won / Lost template. Existing configured and default pipelines and leads are not migrated or reordered.
- Qualifying a lead requires need, budget, authority and timeline. Contact-attempted and demo stages require matching CRM activities; completing a meeting requires documented requirements / objections; closing won requires a positive deal value, and closing lost requires a reason. Lead creation and stage updates share these checks. Closed-won dates are server-recorded and cleared if a deal is reopened.
- Accountability lists are explicitly bounded to 1,000 visible tasks, a target tree to 1,000 records, links to 100 leads, reports to 200 and history to 500 events per task; exceeding these limits returns an explicit error rather than truncated totals.

## Recruitment & Sales integrations

- `/dashboard/integrations` is available to the selected company's Admin, CEO and HR. It configures imports into the existing recruitment and sales pipelines; it does not introduce another sales dashboard.
- The source directory includes LinkedIn Jobs, Internshala, Naukri.com, Indeed, Foundit, Apna, WorkIndia, Wellfound, Cutshort and Naukri Campus, plus all 16 lead-source categories and their example sources.
- These are **configurable JSON API/webhook connectors**, not native provider OAuth or partner API integrations. Obtain authorized API access from the provider, or use a permitted automation/middleware service. A provider without a supported export/API/webhook cannot be connected simply by choosing its name. No portal scraping or account-password automation is provided.
- The connector directory includes **Google Forms**, **Zoho Forms**, and **Third-party form** for both Sales leads and HR candidates. These use the existing signed JSON webhook: select the form provider, destination, owner, and field mappings, save the connector, then copy its webhook URL and one-time signing secret. Candidate responses enter the selected opportunity at **New Application**; lead responses enter Sales at **New**. Google Forms needs an installable Apps Script submit trigger or automation to send the signed request; Zoho/other forms can post directly only if they support the required headers and HMAC signature, otherwise relay them through an authorized middleware service. This is a webhook connection, not native Google/Zoho OAuth.
- **Google Forms Apps Script example:** bind a script to the Google Form, add an installable `onFormSubmit` trigger, then save `RICOZ_WEBHOOK_URL` and `RICOZ_WEBHOOK_SECRET` as Script Properties. The script turns question titles into safe paths such as `answers.full_name`; map those paths in the connector. Keep the URL and secret in Script Properties, not in the form or source control.

```javascript
function onFormSubmit(event) {
  const properties = PropertiesService.getScriptProperties();
  const url = properties.getProperty("RICOZ_WEBHOOK_URL");
  const secret = properties.getProperty("RICOZ_WEBHOOK_SECRET");
  if (!url || !secret || !event.response) throw new Error("Configure Ricoz webhook Script Properties and a form submit trigger.");

  const answers = {};
  event.response.getItemResponses().forEach((itemResponse, index) => {
    const key = itemResponse.getItem().getTitle().toLowerCase()
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `field_${index + 1}`;
    answers[key] = itemResponse.getResponse();
  });
  const body = JSON.stringify({ id: event.response.getId(), answers });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = Utilities.computeHmacSha256Signature(
    `${timestamp}.${body}`, secret, Utilities.Charset.UTF_8
  ).map((byte) => (byte & 0xff).toString(16).padStart(2, "0")).join("");
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: body,
    headers: { "X-Ricoz-Timestamp": timestamp, "X-Ricoz-Signature": signature },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`Ricoz webhook returned HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
  }
}
```

- Set `INTEGRATIONS_ENCRYPTION_KEY` on the API server to a stable 64-character hex key (`openssl rand -hex 32`). Keep it private and backed up. AES-256-GCM encrypts stored provider credentials and webhook secrets. Secrets never appear in connector lists; new/rotated webhook secrets are shown once.
- The Recruitment view includes an HR candidate import form for name, email, phone, source platform, job/internship, and an optional PDF resume. Imports record the submitting HR user and application timestamp, reject duplicate applications for the same candidate/opportunity, create or reuse the candidate account, and immediately place the application in **Applied / New Application**. Newly created candidate accounts receive an activation email when delivery is available. CSV/Excel bulk import is not implemented yet.
- Create one recruitment connector per external posting and map it to an internal job/internship and recruiter. Candidates enter **New Application** with source attribution, contact details, skills, education, experience, statements, screening answers and optional resume/profile links. Fields unavailable from the source remain empty. Source payloads are retained privately for audit but are not returned in normal application queries. Resume URLs are linked, not downloaded or converted.
- Existing accounts are reused by email without overwriting their identity, password, roles or verification. New candidate accounts remain pending/unverified with randomly generated hashed passwords; imports never grant login access or employment roles. API connector imports do not send invitation emails automatically.
- Sales connectors require an active Sales owner and place leads into the active **New** stage of the Sales pipeline. Provider/category attribution is retained in addition to the existing source enum. The contact's name, phone and a stable external ID are required. Candidates require name, email and a stable external application ID.
- Field mapping uses safe dotted JSON paths (`applicant.email`). The records path can point to an array (`data.applications`) or a single object. Skills must be an array of strings; screening answers must be an array of `{ question, answer }`. Invalid records produce indexed errors in import history; they are not silently accepted.
- API mode performs authorized HTTPS **GET** requests with no auth, bearer token or an API-key header. Only public IPv4 destinations on port 443 are supported; private addresses, redirects, credentials in URLs, responses over 2 MB, and requests over 20 seconds are rejected. Tokens requiring OAuth refresh must be managed by your provider/middleware and updated in the connector.
- Enabled API connectors are checked every minute while the API process is running and imported at their configured interval (5–1440 minutes); **Sync now** imports one page immediately. Cursor pagination supports a request parameter and a response next-cursor path. Each run processes at most 100 records. Failed records prevent cursor advancement, so retrying cannot skip failures; larger batches need upstream pagination or splitting. Offset/page-number APIs require a middleware adapter.
- Webhook mode accepts JSON (up to 2 MB) at `/api/v1/integrations/webhooks/:id`. Send Unix seconds in `X-Ricoz-Timestamp` and the hex HMAC-SHA256 of `timestamp + "." + exact JSON request body` in `X-Ricoz-Signature`, using the issued secret. A provider using another signature format needs a middleware adapter. Timestamps expire after five minutes; stable external IDs make retries idempotent. Partial imports return HTTP 207 with counts and issues; successful imports return HTTP 200.
- Candidate duplicates are detected by connector/external ID and opportunity/account; sales duplicates use company/connector/external ID. Existing pipeline stages are never reset by an import retry. A database lease prevents concurrent runs of one connector, and retrying repairs missing recruitment pipeline entries.
- Connectors, runs, opportunities, assignments and imported work are company-scoped. Webhooks derive their company from the authenticated connector, never from the incoming payload. Non-Ricoz CEO/Admin/HR are blocked from configuring another company's connectors. Ricoz executives may use authorized company contexts, with each connection and its imported data remaining in that selected company.
- Import history shows the last 20 runs with added/duplicate/failed counts and indexed validation issues. Pausing rejects webhook deliveries and stops scheduled imports; rotating a secret immediately invalidates the previous one.

## Product Delivery

### Hierarchical Product & Engineering task delivery

- `/dashboard/product-engineering-pipeline` is the delivery board for active Product/Engineering members, their heads and managers, CEO/Admin, and HR users with the company `TASK_ASSIGN` grant. Personal task pages and department task operations expose this board, with an **Existing tasks** tab preserving previous tasks, reports, and product-dispatch behavior.
- Create a delivery package and select its responsible department head. The head can create multiple independent manager branches and direct intern/employee tasks in the same package. Manager branches must be assigned to that head's direct-report managers; managers delegate only to their direct-report interns/employees. Head-direct tasks can go to any active intern/employee in the department and report directly to the head, even if managers exist.
- Individual submissions enter their assigned reviewer's **In review** column. Manager approval of every delegated task automatically puts that manager branch into the head's review queue. Every assigned manager branch and head-direct task must be approved before the head can forward the complete package. This gate applies to work assigned in the package, not unrelated tasks or unassigned managers in the department.
- The head's submission requires a delivery summary and an HTTP(S) live website URL. GitHub source code is optional. A GitHub repository and contribution instructions can also be included in the package or any work assignment; blank child values inherit the parent guidance.
- Either Admin or authorized HR approves the head's package, forwarding it to CEO. Only CEO can complete it. Final approval atomically marks the package and all manager/individual tasks completed. Senior-review rework returns to the head and must pass Admin/HR review again.
- Stage changes support drag-and-drop and keyboard/touch-friendly menus, with confirmation and submission/rework forms. **My work & reviews**, **Department visibility**, package search, and **Hierarchy** organize work without granting additional mutation permissions. Completion is visible to department members and authorized company reviewers, not public users or unrelated departments.
- The board refreshes every five seconds while visible and on tab return, refreshing every already-loaded page. Errors are surfaced; stale confirmation forms cannot apply actions without reopening. All branch writes compare and increment one package revision, so concurrent delegation, rework, and approvals cannot bypass roll-up gates. No MongoDB replica-set transactions are required.
- These new delivery packages are stored separately from legacy task/product-dispatch records. No existing records are migrated, completed, or deleted. The previous ten-stage technical pipeline remains available through **Technical pipeline**.

Regression checks (from `server/`, using the existing test runner):

```bash
./node_modules/.bin/tsx --test src/modules/tasks/engineering-delivery.workflow.test.ts src/modules/tasks/engineering-delivery.controller.test.ts ../client/src/lib/tasks/delivery-board.test.ts
```

- CEO and Admin manage catalog metadata and delete products at `/dashboard/admin/products`.
- Tasks includes an unassigned-product selector and dispatch to an active department Head. Multiple active Heads require an explicit selection.
- Dispatch creates the existing Head -> Manager -> Employee/Intern workflow. Each delegated task retains its product reference.
- Status is derived from the root workflow: no workflow means Unassigned; assigned work means Development; final executive approval means Production. Legacy catalog statuses without a linked workflow also display as Unassigned.
- Progress averages the latest report for each visible delegated task, with unreported work at zero and accepted work at 100. Reporting 100% does not bypass final approval. Heads see department contributions, Managers their direct team, and Members their own contributions; CEO/Admin see all.
- Progress refreshes after local reports, on window focus, and every 30 seconds while visible. Report history is paginated.
- Deletion removes a product from the catalog but preserves tasks, submissions, and reports. It does not cancel delivery work or delete uploaded media.
- Dispatch uses the product ID as the root task ID, making duplicate assignment a single-document duplicate-key conflict. It does not require MongoDB multi-document transactions.

Run backend regression checks from `server/`:

```bash
./node_modules/.bin/tsx --test --test-force-exit src/modules/products/products.public.test.ts src/modules/products/products.test.ts src/modules/organization/organization.access.test.ts
```

The public catalogue response guards can be checked with the same existing runner from `server/`:

```bash
./node_modules/.bin/tsx --test ../client/src/lib/products/catalogue.test.ts
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
