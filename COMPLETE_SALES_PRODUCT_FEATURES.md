# Ricoz Innovation Sales Department Product

## Complete Feature Specification for Website and Mobile

This document is the single copy-ready source for the complete Ricoz Sales Department Management and CRM product. It covers the website, mobile app, backend, roles, permissions, workflows, data, analytics, notifications, and delivery phases.

Implementation status: this is the full target specification, not a list of completed features. See [Current CRM Release and Workflow](SALES_ARCHITECTURE.md#current-crm-release-october-3-2026) for the implemented Bigin-inspired web/API features, hierarchy workflow, verification and remaining gaps. The mobile UI and external CRM integrations are not included in that release.

---

## 1. Product Overview
Ricoz Sales is a unified Sales Department Management and CRM platform for:

- Sales Head
- Sales Managers
- Sales Executives employed as Employees
- Sales Executives employed as Interns
- Authorized Administrators

The product manages the full customer acquisition lifecycle:

```text
Lead Capture
  -> Assignment
  -> Contact and Follow-up
  -> Qualification
  -> Deal Creation
  -> Proposal
  -> Negotiation
  -> Approval when required
  -> Won or Lost
  -> Revenue and Performance Reporting
```

The website and mobile app use the same backend, permissions, data ownership rules, statuses, audit history, and real-time events.

---

## 2. Supported Platforms

### Website

- Next.js
- React and TypeScript
- Tailwind CSS
- Server Components by default
- Client Components for interactive features
- Redux Toolkit only for cross-route global state
- Responsive desktop, laptop, tablet, and mobile layouts

### Mobile

- Expo and React Native
- TypeScript
- Expo Router
- Native mobile navigation and controls
- Secure token storage
- Push and in-app notifications
- Mobile-first Sales workspace

### Backend

- Node.js and Express
- TypeScript
- MongoDB and Mongoose
- Redis for caching, queues, events, and pub/sub where useful
- WebSocket for real-time updates
- Existing Ricoz JWT authentication and refresh-session architecture

---

## 3. Organization Structure

```text
Sales Head
  |
  +-- Sales Manager
  |     +-- Sales Executive - Employee
  |     +-- Sales Executive - Employee
  |     +-- Sales Executive - Intern
  |     +-- Sales Executive - Intern
  |
  +-- Sales Manager
        +-- Sales Executive - Employee
        +-- Sales Executive - Intern
```

The hierarchy is data-driven and must never be hard-coded in either client.

### Organization Fields

```text
department
level
designation
employmentType
reportsTo / managerId
active
effectiveFrom
effectiveTo
assignedBy
```

### Department

```text
SALES
```

### Organization Levels

```text
HEAD
MANAGER
MEMBER
```

### Sales Designations

```text
SALES_HEAD
SALES_MANAGER
SALES_EXECUTIVE
```

### Employment Types

```text
EMPLOYEE
INTERN
```

Employee and Intern are employment types, not separate Sales capabilities. Both can perform the complete Sales Executive workflow. Permissions control sensitive actions.

---

## 4. Roles and Visibility

### Sales Head

- View the complete Sales Department
- View all managers, employees, and interns
- View all leads, accounts, contacts, deals, tasks, and activities
- View all pipelines, targets, revenue, and analytics
- View manager and team performance
- View department workload
- Assign and reassign managers
- Assign leads, deals, and tasks directly when needed
- Configure department and manager targets
- Approve configured high-level actions
- View approvals and audit logs
- Access department-wide reports and exports when permitted

### Sales Manager

- View only the assigned team unless broader access is explicitly granted
- View assigned Employees and Interns
- View team leads, deals, tasks, activities, and follow-ups
- Assign and reassign leads to direct team members
- Assign tasks, calls, meetings, and follow-ups
- Schedule work and monitor deadlines
- Set individual targets
- Monitor inactive leads and stalled deals
- Monitor overdue tasks and follow-ups
- Review objective Employee and Intern performance
- Review team workload
- Escalate deals and approvals to Sales Head
- Access team analytics and reports
- Never automatically view another manager's private team data

### Sales Executive - Employee or Intern

- View assigned leads, accounts, contacts, deals, and tasks
- Create and update permitted CRM records
- Contact customers
- Record calls, emails, meetings, notes, and follow-ups
- Update lead status
- Update deal stage
- Create and complete tasks
- Schedule calls and meetings
- Add customer communication history
- Update customer information when permitted
- Request approval for configured sensitive actions
- View personal targets and performance
- Receive assignment, follow-up, and approval notifications

An Intern is not automatically prevented from selling, qualifying leads, creating deals, or closing work. Sensitive capabilities depend on permissions, not employment type.

---

## 5. Permission System

Authorization uses granular permissions plus data scope. Frontend visibility is for usability only; backend authorization is mandatory.

### Dashboard and Team

```text
SALES_DASHBOARD_VIEW
SALES_TEAM_VIEW
```

### Leads

```text
SALES_LEAD_VIEW
SALES_LEAD_CREATE
SALES_LEAD_UPDATE
SALES_LEAD_ASSIGN
SALES_LEAD_REASSIGN
SALES_LEAD_DELETE
SALES_LEAD_EXPORT
```

### Tasks

```text
SALES_TASK_VIEW
SALES_TASK_CREATE
SALES_TASK_ASSIGN
SALES_TASK_UPDATE
SALES_TASK_DELETE
```

### Deals

```text
SALES_DEAL_VIEW
SALES_DEAL_CREATE
SALES_DEAL_UPDATE
SALES_DEAL_CLOSE
SALES_DEAL_DELETE
SALES_FINANCIAL_VIEW
SALES_DISCOUNT_APPROVE
```

### Activities and CRM Data

```text
SALES_ACTIVITY_VIEW
SALES_ACTIVITY_CREATE
SALES_ACCOUNT_VIEW
SALES_ACCOUNT_UPDATE
SALES_CONTACT_VIEW
SALES_CONTACT_UPDATE
```

### Targets, Reports, and Governance

```text
SALES_TARGET_VIEW
SALES_TARGET_MANAGE
SALES_REPORT_VIEW
SALES_EXPORT
SALES_APPROVAL_MANAGE
SALES_AUDIT_VIEW
```

### Default Data Scope

```text
Sales Head      -> DEPARTMENT
Sales Manager   -> TEAM
Sales Executive -> OWN
Admin           -> DEPARTMENT when authorized
```

Every protected operation checks both permission and scope.

---

## 6. Role-Aware Navigation

### Sales Head Website Navigation

```text
Sales
  Dashboard
  Leads
  Accounts
  Contacts
  Deals
  Pipeline
  Activities
  Tasks
  Follow-ups
  Team
  Workload
  Targets
  Reports
  Analytics
  Approvals
  Notifications
  Audit Logs
```

### Sales Manager Website Navigation

```text
Sales
  Dashboard
  My Team
  Leads
  Accounts
  Contacts
  Deals
  Pipeline
  Activities
  Tasks
  Follow-ups
  Workload
  Targets
  Approvals
  Reports
  Notifications
```

### Sales Executive Website Navigation

```text
Sales
  Dashboard
  My Leads
  My Accounts
  My Contacts
  My Deals
  My Tasks
  Follow-ups
  Activities
  Notifications
```

### Mobile Navigation

Mobile prioritizes:

- Sales dashboard
- Quick actions
- Assigned leads
- Assigned deals
- Tasks
- Today's follow-ups
- Activities
- Notifications
- Search
- Profile

Secondary analytics and management features are available through drill-down screens rather than compressed desktop tables.

---

## 7. Sales Head Dashboard

### Header

- Time-aware greeting and user name
- Sales Department title
- Current date
- Date-range selector
- Notifications
- Global search

### Quick Actions

- Add Lead
- Create Deal
- Assign Task
- Create Target
- Record Activity
- Schedule Follow-up

### KPI Cards

- Total Leads
- Qualified Leads
- Open Deals
- Pipeline Value
- Expected Revenue
- Won Revenue
- Lost Revenue
- Conversion Rate
- Average Deal Value
- Active Sales Managers
- Active Sales Employees
- Active Interns
- Overdue Tasks
- Today's Follow-ups

Every KPI supports click-through to filtered details.

### Department Pipeline

Stages:

```text
NEW
QUALIFIED
CONTACTED
REQUIREMENT
PROPOSAL
NEGOTIATION
WON
LOST
```

Each stage shows:

- Number of deals
- Total deal value
- Expected revenue
- Conversion rate
- Average time in stage

Filters:

- Manager
- Employee or Intern
- Date range
- Lead source
- Service
- Deal stage
- Owner
- Team

### Team Performance

Objective metrics only:

- Member
- Role
- Employment type
- Leads
- Qualified leads
- Open deals
- Won deals
- Revenue
- Target
- Achievement percentage
- Completed tasks
- Overdue tasks
- Follow-up completion
- Conversion rate

The product does not assign arbitrary best/worst labels.

---

## 8. Sales Manager Dashboard

### Sections

- Team Overview
- Today's Tasks
- Lead Pipeline
- Deal Pipeline
- Team Target
- Team Revenue
- Pending Follow-ups
- Overdue Follow-ups
- Employee Performance
- Intern Performance
- Team Workload
- Recent Activities
- Approvals Requiring Action

### KPI Cards

- Team Leads
- Qualified Leads
- Open Deals
- Pipeline Value
- Won Revenue
- Pending Follow-ups
- Overdue Tasks
- Team Target Achievement

All data is automatically scoped to the manager's permitted team.

---

## 9. Sales Executive Dashboard

- Personal KPI summary
- Assigned leads
- Open deals
- Today's tasks
- Today's follow-ups
- Overdue work
- Recent activities
- Target progress
- Notifications
- Quick Add Lead when permitted
- Quick Record Call
- Quick Add Note
- Quick Schedule Follow-up
- Quick Create Deal

---

## 10. Team Management

### My Team Page

Each member shows:

- Name and profile image
- Sales designation
- Employment type
- Manager
- Active leads
- Open deals
- Active tasks
- Completed tasks
- Overdue tasks
- Revenue
- Target achievement
- View Profile action
- Assign Task action
- Assign Lead action

Employees and Interns use the same assignment actions.

### Team Member Profile

Profile fields:

- Name
- Designation
- Employment type
- Joining date
- Manager
- Contact details when authorized

Tabs:

```text
Overview
Leads
Deals
Tasks
Activities
Performance
Timeline
```

Performance metrics:

- Leads
- Qualified leads
- Deals
- Won deals
- Revenue
- Tasks
- Completed tasks
- Overdue tasks
- Follow-ups
- Conversion rate
- Target achievement

### Workload Management

For each team member:

- Active leads
- Open deals
- Active tasks
- Overdue tasks
- Due-today work
- Upcoming follow-ups
- Estimated task duration

Actions:

- Assign
- Reassign
- View workload

Indicators remain objective and do not use subjective labels.

---

## 11. Lead Management

### Lead Fields

- Name
- Company
- Email
- Phone
- Alternate contact
- Website
- Address
- Industry
- Lead source
- Service interest
- Status
- Priority
- Owner
- Team
- Assigned by
- Expected value
- Notes
- Tags
- First follow-up
- Next follow-up
- Last activity
- Created by
- Created date
- Updated date

### Lead Statuses

```text
NEW
QUALIFIED
CONTACTED
REQUIREMENT
PROPOSAL
NEGOTIATION
CONVERTED
WON
LOST
DISQUALIFIED
```

### Lead Sources

```text
GOOGLE
META
INSTAGRAM
LINKEDIN
WEBSITE
REFERRAL
EMAIL
YOUTUBE
COLD_CALLING
OTHER
```

### Lead List Features

- Search
- Pagination
- Sort
- Saved filters
- Owner filter
- Manager/team filter
- Status filter
- Source filter
- Service filter
- Priority filter
- Date filter
- Bulk assignment when permitted
- Export when permitted
- Responsive table on web
- Native list and filter sheet on mobile
- Loading, empty, and error states

### Lead Details

Sections:

- Lead information
- Contact information
- Company information
- Lead source
- Assigned owner
- Lead status
- Priority
- Activities
- Tasks
- Notes
- Timeline
- Deals
- Documents
- Assignment history

### Lead Timeline

Example:

```text
Lead created
Assigned to Ravi
Customer called
Follow-up scheduled
Requirement collected
Proposal sent
Converted to Deal
```

---

## 12. Lead Assignment

### Manual Assignment

Fields:

- Lead
- Current owner
- Assign to
- Reason or note
- Priority
- First follow-up date and time

Eligible assignees are returned by the backend based on hierarchy and scope.

### Assignment Rules

A Sales Manager can assign only to users where:

```text
department = SALES
reportsTo = currentManagerId
active = true
```

Sales Head can assign to any active Sales user. Cross-team assignment requires explicit authority.

### Assignment History

Every assignment and reassignment records:

- Assigned by
- Previous owner
- New owner
- Reason
- Timestamp

History is immutable and auditable.

### Automatic Assignment

Strategies:

```text
MANUAL
ROUND_ROBIN
LEAST_ACTIVE_LEADS
PERFORMANCE_BASED
```

Managers can enable or disable rules for their team. Performance-based distribution must use transparent configured metrics and must not discriminate by employment type.

---

## 13. Accounts and Contacts

### Accounts

- Company name
- Industry
- Website
- Address
- Billing details when permitted
- Owner
- Team
- Related contacts
- Related leads
- Related deals
- Activities
- Notes
- Documents
- Timeline

### Contacts

- Name
- Job title
- Account
- Email
- Phone
- Preferred communication method
- Consent and communication preferences
- Owner
- Related leads and deals
- Activity history
- Notes

Ownership and scope rules apply to both modules.

---

## 14. Deal and Pipeline Management

### Deal Fields

- Deal name
- Lead
- Account
- Primary contact
- Owner
- Team
- Service
- Stage
- Amount
- Currency
- Probability
- Expected revenue
- Expected close date
- Last activity
- Next follow-up
- Loss reason
- Won date
- Lost date
- Created by
- Assigned by

Money is stored as integer minor units with an ISO currency code.

### Deal Stages

```text
NEW
QUALIFIED
REQUIREMENT
PROPOSAL
NEGOTIATION
WON
LOST
```

### Deal Table

Columns:

- Deal
- Account
- Owner
- Stage
- Amount
- Probability
- Expected close date
- Last activity
- Next follow-up

### Pipeline Kanban

- Drag or move deals between permitted stages
- Confirm sensitive stage transitions
- Stage totals and counts
- Responsive horizontal board on web
- Stage-based native list on mobile
- Optimistic interaction reconciled with server result
- Audit every stage change

### Deal Filters

- Employee
- Intern
- Manager
- Team
- Lead source
- Service
- Date
- Deal stage
- Amount range
- Expected close date

---

## 15. Task Management

### Task Fields

```text
title
description
assignedTo
assignedBy
leadId?
contactId?
accountId?
dealId?
priority
status
dueDate
dueTime?
estimatedDuration?
createdAt
updatedAt
completedAt?
```

### Priorities

```text
LOW
MEDIUM
HIGH
URGENT
```

### Statuses

```text
TODO
IN_PROGRESS
COMPLETED
CANCELLED
OVERDUE
```

### Assign Task Flow

- Task title
- Description
- Eligible team member
- Related lead
- Related contact
- Related account
- Related deal
- Priority
- Due date
- Due time
- Estimated duration
- Cancel action
- Assign Task action
- Success confirmation

### Task Features

- My tasks
- Team tasks
- Today
- Upcoming
- Overdue
- Completed
- Search and filters
- Create
- Assign
- Reassign
- Edit
- Complete
- Cancel
- Related entity navigation
- Activity and audit history
- Real-time assignment notification

---

## 16. Activities

Supported activity types:

```text
CALL
EMAIL
MEETING
TASK
NOTE
FOLLOW_UP
```

Each activity includes:

- Actor
- Type
- Date and time
- Optional lead
- Optional contact
- Optional account
- Optional deal
- Duration
- Outcome
- Description or notes
- Next follow-up
- Attachments when supported

Activity feeds are visible according to owner/team/department scope.

---

## 17. Follow-Up System

Sections:

```text
TODAY
UPCOMING
OVERDUE
COMPLETED
```

Follow-up cards show:

- Time
- Customer or company
- Action
- Owner
- Related lead or deal
- Priority
- Completion action
- Reschedule action

Overdue follow-ups receive a clear status treatment and contribute to dashboard metrics.

---

## 18. Sales Targets

### Target Scopes

- Department
- Manager
- Team
- Individual Sales Executive

### Target Fields

- Name
- Period
- Scope
- Assignee
- Currency
- Target amount
- Actual amount
- Remaining amount
- Achievement percentage
- Created by

### Target Features

- Sales Head creates department and manager targets
- Managers create individual targets when permitted
- Actual revenue derives from won deals
- Monthly, quarterly, and custom periods
- Progress visualization
- Drill-down to contributing deals
- Audit changes to target definitions

---

## 19. Analytics and Reports

### Core Analytics

- Lead growth
- Lead sources
- Lead qualification
- Lead conversion
- Deal conversion
- Revenue
- Pipeline value
- Expected revenue
- Average deal size
- Sales cycle duration
- Won versus lost
- Loss reasons
- Team performance
- Manager performance
- Individual performance
- Activity volume
- Follow-up completion
- Task completion
- Target achievement
- Workload
- Stalled leads
- Stalled deals

### Date Filters

```text
TODAY
LAST_7_DAYS
LAST_30_DAYS
THIS_MONTH
LAST_MONTH
QUARTER
CUSTOM_RANGE
```

### Lead Source Analytics

For each source:

- Leads
- Qualified leads
- Deals
- Won deals
- Revenue
- Conversion rate
- Average deal value

### Reports

- Department summary
- Manager summary
- Team summary
- Executive summary
- Lead report
- Deal report
- Pipeline report
- Revenue report
- Task report
- Activity report
- Follow-up report
- Target report
- Approval report
- Audit report

Exports require an explicit permission.

---

## 20. Notifications

### Notification Types

- New task assigned
- New lead assigned
- Lead reassigned
- Deal assigned
- Follow-up due
- Follow-up overdue
- Task due
- Task overdue
- Deal moved to a new stage
- Deal marked Won
- Deal marked Lost
- Approval requested
- Approval approved
- Approval rejected
- Manager escalation
- Target updated

### Notification Channels

- In-app notification center
- Dashboard counters
- Mobile push notification where configured
- WebSocket real-time notification
- Email only for configured important events

### Notification Features

- Read/unread state
- Mark one as read
- Mark all as read
- Entity deep link
- Type filters
- Pagination
- Delivery status
- User notification preferences

---

## 21. Approval System

Configurable sensitive actions include:

- Large discount
- High-value deal
- Deal closure
- Customer credit
- Special pricing

Workflow:

```text
Sales Executive
  -> Request Approval
  -> Sales Manager Review
  -> Approve or Reject
  -> Optional Sales Head Escalation
  -> Final Decision
```

Approval fields:

- Requester
- Approver
- Type
- Related entity
- Requested values
- Reason
- Status
- Decision note
- Requested time
- Decided time

Ordinary sales activity remains fast and does not require approval unless a configured rule applies.

---

## 22. Audit System

Audited events include:

- Lead created
- Lead updated
- Lead assigned
- Lead reassigned
- Account or contact updated
- Deal created
- Deal owner changed
- Deal stage changed
- Deal won or lost
- Task created
- Task assigned
- Task reassigned
- Task completed
- Customer information changed
- Target created or changed
- Approval requested
- Approval approved
- Approval rejected
- Permission-sensitive export

Each audit record includes:

```text
actorId
action
entityType
entityId
previousValue?
newValue?
metadata?
timestamp
```

Audit records are immutable and visible only with appropriate permission.

---

## 23. Real-Time Events

Example task assignment flow:

```text
Manager submits task
  -> API authenticates user
  -> Permission and team scope validated
  -> Task saved in MongoDB
  -> Audit record created
  -> Notification created
  -> Transaction committed
  -> Redis event published
  -> WebSocket sends event
  -> Assignee website/mobile updates
```

Real-time event categories:

- Lead assigned or reassigned
- Task assigned, changed, or completed
- Follow-up due
- Deal changed
- Approval changed
- Notification counter changed
- Dashboard metric invalidation

Clients always reconcile real-time events with authoritative API data.

---

## 24. Search, Filters, and Data Interaction

- Global Sales search
- Entity-specific search
- Server-side pagination
- Stable sorting
- Date filters
- Owner and team filters
- Status and stage filters
- Lead source filters
- Service filters
- Saved filters
- Clear filters
- Responsive tables
- Mobile filter sheets
- Empty states
- Loading skeletons
- Retryable error states
- Permission-aware actions
- Confirmation dialogs for destructive or sensitive changes
- Toast or native success/error feedback

---

## 25. UI and Accessibility

### Shared Requirements

- Original Ricoz visual language
- Existing brand tokens and dashboard patterns
- Clean enterprise interface
- Consistent spacing and typography
- Clear status badges
- Keyboard-accessible web interactions
- Screen-reader labels
- Visible focus states
- Accessible dialog focus management
- Sufficient color contrast
- Reduced unnecessary animation
- No nested card-heavy layouts
- No arbitrary performance rankings

### Desktop Priority

- Sidebar navigation
- KPI overview
- Dense tables
- Charts
- Kanban pipeline
- Split views and drawers

### Mobile Priority

- KPIs
- Quick actions
- Tasks
- Follow-ups
- Notifications
- Native lists
- Bottom sheets
- Pull-to-refresh
- Comfortable touch targets

### Product States

Every feature includes:

- Loading state
- Skeleton state where appropriate
- Empty state
- Error state
- Retry action
- Success feedback
- Unauthorized state
- Offline/network handling on mobile where practical

---

## 26. Data Ownership and Security Rules

Every CRM object has:

```text
ownerId
teamId where appropriate
departmentId
createdBy
assignedBy where appropriate
createdAt
updatedAt
```

Mandatory rules:

1. Sales Head can view the complete Sales Department.
2. Sales Manager can manage only the assigned team unless broader scope is granted.
3. Sales Manager can assign work to direct Employees and Interns.
4. Employees and Interns can perform the same operational Sales workflow.
5. Employment type never automatically determines Sales capability.
6. Permissions control sensitive actions.
7. Sales Executives cannot manipulate records outside authorized scope.
8. Every reassignment is recorded.
9. Every important state change is auditable.
10. Backend authorization is mandatory.
11. Hidden frontend buttons are not security.
12. Ordinary work does not require Sales Head approval.
13. Approval applies only to configured sensitive actions.
14. Employee and Intern do not have duplicated business logic.
15. List queries are scoped before data is read from MongoDB.
16. API input is validated.
17. Sensitive values are not exposed without permission.
18. Mutation retries use idempotency where duplicate creation is possible.

---

## 27. Core Database Models

### OrganizationAssignment

- User
- Department
- Level
- Designation
- Employment type
- Reports to
- Assigned by
- Active status
- Effective dates

### SalesLead

- Lead identity and contact details
- Source and service
- Status and priority
- Owner and team
- Assignment history
- Follow-up dates
- Audit metadata

### SalesAccount

- Company profile
- Owner and team
- Related contacts, leads, deals, and activities

### SalesContact

- Person and communication details
- Account
- Owner
- Consent preferences
- Related CRM entities

### SalesDeal

- Lead, account, and contact
- Owner and team
- Stage
- Amount, currency, and probability
- Expected close
- Win/loss information

### SalesTask

- Assignment
- Related CRM entities
- Priority and status
- Due date/time
- Duration and completion

### SalesActivity

- Actor
- Type
- Related entities
- Outcome
- Duration
- Follow-up

### SalesTarget

- Period
- Scope
- Assignee
- Target and actual values

### SalesApproval

- Requester and approver
- Type and entity
- Status
- Requested and decided values

### SalesAudit

- Actor
- Action
- Entity
- Previous and new values
- Timestamp

### SalesNotification

- Recipient
- Type
- Entity link
- Read and delivery state

---

## 28. API Features

Base route:

```text
/api/v1/sales
```

### Access and Dashboard

```text
GET /access
GET /dashboard
```

### Team

```text
GET /team
GET /team/:userId
GET /team/:userId/workload
```

### Leads

```text
GET    /leads
POST   /leads
GET    /leads/:id
PATCH  /leads/:id
DELETE /leads/:id
POST   /leads/:id/assign
GET    /leads/:id/assignment-history
```

### Accounts and Contacts

```text
GET    /accounts
POST   /accounts
GET    /accounts/:id
PATCH  /accounts/:id
GET    /contacts
POST   /contacts
GET    /contacts/:id
PATCH  /contacts/:id
```

### Deals

```text
GET    /deals
POST   /deals
GET    /deals/:id
PATCH  /deals/:id
POST   /deals/:id/assign
POST   /deals/:id/stage
```

### Tasks

```text
GET    /tasks
POST   /tasks
GET    /tasks/:id
PATCH  /tasks/:id
POST   /tasks/:id/assign
POST   /tasks/:id/complete
```

### Activities and Follow-ups

```text
GET  /activities
POST /activities
GET  /follow-ups
POST /follow-ups
PATCH /follow-ups/:id
```

### Targets

```text
GET   /targets
POST  /targets
PATCH /targets/:id
```

### Analytics and Reports

```text
GET /analytics
GET /reports
GET /reports/:type/export
```

### Approvals

```text
GET  /approvals
POST /approvals
POST /approvals/:id/decision
```

### Audit and Notifications

```text
GET   /audit-logs
GET   /notifications
PATCH /notifications/:id/read
POST  /notifications/read-all
```

All endpoints use authentication, validation, granular permissions, and organization scope.

---

## 29. State Management

### Website

- Server Components load initial route data where practical
- Existing Axios client handles authenticated API access and refresh
- Client state handles forms, filters, dialogs, and optimistic interactions
- Redux stores only genuinely cross-route state such as auth, global Sales filters, and notification counters

### Mobile

- Existing authenticated API client and token vault
- Local screen state for forms and filters
- Redux for auth and cross-screen state
- Pull-to-refresh and reconnection handling
- Real-time events reconcile with API state

### Shared Contract

Website and mobile share:

- API shapes
- Permission names
- Status values
- Stage values
- Scope values
- Validation expectations
- Event vocabulary

They do not share rendering components.

---

## 30. Complete Example User Flow

```text
Lead arrives from Website
  -> Lead is created with WEBSITE source
  -> Sales Manager receives a notification
  -> Manager opens Lead Details
  -> Manager selects Assign Lead
  -> Manager selects Ravi, Sales Executive, Intern
  -> Backend validates Ravi is an active direct report
  -> Owner and assignment history are updated
  -> Audit record and notification are created
  -> Ravi receives real-time web/mobile notification
  -> Ravi calls the customer
  -> Ravi records a CALL activity and outcome
  -> Ravi schedules a follow-up
  -> Manager sees the activity in team scope
  -> Ravi updates lead to QUALIFIED
  -> Ravi creates a Deal
  -> Deal enters the pipeline
  -> Requirement is collected
  -> Proposal is sent
  -> Deal enters NEGOTIATION
  -> Approval is requested only if a configured rule applies
  -> Deal is marked WON
  -> Revenue updates Ravi's target
  -> Revenue updates Manager dashboard
  -> Revenue updates Sales Head dashboard
  -> All important transitions remain in the audit timeline
```

---

## 31. Delivery Phases

### Phase 1 - Organization and RBAC

- Sales organization metadata
- Designation and employment type separation
- Reporting hierarchy
- Granular permissions
- Assignment-aware scope resolver
- Effective Sales access API
- Shared website/mobile access contracts

### Phase 2 - Sales Head Dashboard

- Department KPIs
- Pipeline summary
- Revenue and conversion metrics
- Team performance
- Filters and click-through
- Responsive website and mobile dashboard experiences

### Phase 3 - Sales Manager Dashboard

- Team metrics
- Work queues
- Team pipeline
- Revenue and targets
- Overdue work
- Recent activities

### Phase 4 - Team Management

- My Team
- Team member profile
- Workload
- Assignment eligibility
- Objective performance views

### Phase 5 - Lead Management

- Lead model and APIs
- Lead list and details
- Search and filters
- Timeline and notes

### Phase 6 - Lead Assignment

- Manual assignment
- Reassignment
- Assignment history
- Automatic distribution rules

### Phase 7 - Task Management

- Task model and APIs
- Assignment flow
- Personal and team task views
- Due and overdue workflows

### Phase 8 - Deals and Pipeline

- Deal model and APIs
- Deal list
- Kanban pipeline
- Stage transitions
- Won/lost handling

### Phase 9 - Activities and Follow-ups

- Calls, emails, meetings, notes, and follow-ups
- Activity feeds
- Today/upcoming/overdue screens

### Phase 10 - Targets

- Department, manager, team, and individual targets
- Actual revenue calculation
- Progress reporting

### Phase 11 - Analytics

- Lead, deal, source, revenue, activity, conversion, and target analytics
- Date filters and reports

### Phase 12 - Notifications

- Notification center
- Read state
- Entity deep links
- Mobile push where configured

### Phase 13 - Approvals

- Configured approval rules
- Manager and Head decisions
- Escalation

### Phase 14 - Audit Logs

- Immutable Sales audit records
- Permission-aware audit viewer
- Entity timelines

### Phase 15 - Real-Time Updates

- Redis events
- WebSocket delivery
- Live counters and lists
- Reconnection and reconciliation

---

## 32. Current Implementation Status

Completed foundation:

- Unified Sales architecture for server, website, and mobile
- Sales designation separated from employment type
- Sales Head, Manager, and Executive hierarchy metadata
- Granular Sales permission vocabulary
- Department, team, and own access scopes
- Assignment-aware Sales authorization resolver
- Intern and Employee operational parity for Sales Executives
- Backward-compatible metadata inference for existing assignments
- Auth payload fields for designation and employment type
- `GET /api/v1/sales/access`
- Typed website Sales access service
- Typed mobile Sales access service
- Server, website, and mobile TypeScript validation

Remaining product delivery:

- Role-aware Sales navigation
- Sales dashboards
- CRM entity models and APIs
- Team management UI
- Leads and assignment
- Tasks
- Deals and pipeline
- Activities and follow-ups
- Targets
- Analytics and reports
- Notifications
- Approvals
- Audit viewer
- Real-time Sales event integration

---

## 33. Production Acceptance Criteria

The product is complete when:

- All listed features work on website and mobile where applicable
- The backend enforces every permission and ownership rule
- Sales Manager cannot access another private team by changing a URL or API request
- Sales Executive cannot access records outside the permitted scope
- Employee and Intern can execute the same permitted Sales workflow
- Assignment and reassignment history is complete
- Important changes are auditable
- Dashboard metrics match CRM records
- Won deals update revenue and targets correctly
- Notifications deep-link to the correct entity
- Responsive layouts work across supported viewports
- Forms are validated and accessible
- Loading, empty, error, and unauthorized states exist
- Server and both clients pass type checks, lint, tests, and production builds
- Existing Ricoz Admin, Customer, Investor, Employee, Intern, chat, and other dashboard functionality remains intact
