You are working on a production-grade Next.js application using:

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Redux Toolkit where global client state is genuinely required
- Server Components by default
- Client Components only when client-side interaction/state/browser APIs are required

Your task is to implement the requirements provided at the bottom of this prompt.

==================================================
1. GLOBAL DEVELOPMENT RULES
==================================================

Follow these rules for EVERY page and component you create or modify.

Do not treat the requested page as an isolated implementation.

It must integrate cleanly with the existing application's:

- architecture
- design system
- authentication
- authorization
- routing
- reusable components
- state management
- API layer
- responsive behavior

Do not unnecessarily create new patterns if an existing reusable pattern already exists.

Before creating a new component, inspect the existing codebase and reuse existing components, hooks, utilities, types, constants, and patterns whenever possible.

Avoid duplication.

==================================================
2. STYLING — IMPORTANT
==================================================

Use Tailwind CSS for component styling and layout.

The project's `globals.css` is the source of truth for:

- brand colors
- typography
- spacing tokens
- borders
- border radius
- shadows
- sidebar styles
- inputs
- buttons
- status colors
- transitions
- other global design tokens

DO NOT randomly invent colors.

DO NOT hardcode brand colors such as:

#c91d20
#18243a
#667085
#e4e7ec

inside components when an equivalent CSS variable already exists in `globals.css`.

Prefer:

bg-[var(--brand-red)]
text-[var(--brand-navy)]
text-[var(--brand-gray)]
border-[var(--brand-border)]
bg-[var(--brand-surface)]

or existing reusable CSS classes from `globals.css`.

Use Tailwind for:

- layout
- flex/grid
- responsive design
- spacing
- sizing
- positioning
- typography utilities
- responsive behavior
- transitions
- visibility
- alignment

Use CSS variables from `globals.css` for the application's design tokens.

Maintain the existing RicozInvoice visual identity:

- deep navy
- strong red
- white
- cool gray
- subtle gray surfaces
- thin borders
- restrained shadows
- professional financial SaaS appearance

Do not introduce unnecessary gradients, excessive colors, glassmorphism, excessive rounded cards, or decorative UI that doesn't support the product.

==================================================
3. SERVER COMPONENTS VS CLIENT COMPONENTS
==================================================

IMPORTANT:

Use React Server Components by default.

Every component should remain a Server Component unless it genuinely requires client-side functionality.

Use `"use client"` ONLY when the component requires things such as:

- useState
- useEffect
- useReducer
- event-driven interactive state
- browser APIs
- window/document
- localStorage/sessionStorage
- client-side subscriptions
- WebSocket
- WebRTC
- Redux hooks
- interactive charts requiring client rendering
- drag and drop
- animations requiring client state
- client-only third-party libraries

Do NOT add `"use client"` simply because a component contains:

- links
- buttons that navigate using normal routing
- forms that can use server actions
- static data
- mapped arrays
- Tailwind classes
- icons
- images
- text
- layouts

Keep those as Server Components whenever possible.

==================================================
4. COMPONENT ARCHITECTURE
==================================================

Do NOT create one huge page.tsx file.

Break complex pages into meaningful components.

For example:

app/
  dashboard/
    page.tsx
    components/

components/
  dashboard/
    DashboardHeader.tsx
    DashboardStats.tsx
    RevenueChart.tsx
    RecentInvoices.tsx

Use the architecture that best fits the existing project.

Prefer:

- small focused components
- reusable components
- composable components
- clear responsibilities
- strong TypeScript types

Avoid:

- giant components
- deeply nested unnecessary abstractions
- duplicated JSX
- duplicated business logic
- duplicated styling
- components that exist only to wrap one line of JSX without a real reason

==================================================
5. PAGE.TSX RESPONSIBILITY
==================================================

Keep `page.tsx` relatively small.

`page.tsx` should primarily:

- fetch server-side data when appropriate
- compose components
- pass required data to components
- handle page-level metadata where appropriate

Do not put all UI markup into page.tsx.

Example:

export default async function Page() {
  const data = await getData();

  return (
    <>
      <PageHeader />
      <StatsSection data={data.stats} />
      <MainContent data={data.items} />
    </>
  );
}

==================================================
6. DATA FETCHING
==================================================

Prefer server-side data fetching when data does not need to be fetched interactively in the browser.

Use Server Components for:

- initial page data
- dashboard data
- invoice data
- customer data
- reports
- static content
- authenticated server-side data

Do not unnecessarily fetch initial page data inside useEffect.

Avoid this pattern when server fetching is possible:

useEffect(() => {
  fetch(...)
}, []);

Prefer server-side fetching and pass the result to Client Components only when necessary.

Client Components should primarily handle interaction.

==================================================
7. CLIENT COMPONENT BOUNDARIES
==================================================

Keep the Client Component boundary as small as possible.

Bad:

"use client";

export default function EntireDashboard() {
  // everything becomes client-side
}

Better:

DashboardPage        → Server Component
    |
    ├── DashboardHeader → Server Component
    ├── Stats            → Server Component
    ├── InvoiceTable     → Server Component
    └── Filter           → Client Component
          |
          └── interactive state

Do not convert an entire page to a Client Component just because one small section needs interaction.

==================================================
8. REDUX
==================================================
Use Redux Toolkit only for state that genuinely needs global client-side access.
Do not put server-fetched page data into Redux unnecessarily.
Do not create Redux state for simple local component state.
Prefer:
useState
for local UI state.
Use Redux when state is:

- shared across unrelated components
- required across routes
- authentication state
- globally controlled UI state
- chat state
- sidebar state
- other genuinely global client state

Follow the existing Redux architecture.

Do not create a new Redux pattern if one already exists.

==================================================
9. RESPONSIVE DESIGN
==================================================
Every page must be responsive.
Design for:
- mobile
- tablet
- desktop
- large desktop screens
Use Tailwind responsive utilities.
Do not make desktop the only priority.
Avoid:

- horizontal overflow
- broken tables
- clipped content
- unreadable text
- buttons overflowing containers
- fixed widths that break mobile layouts

For tables, dashboards, sidebars, and complex layouts, intentionally design their mobile behavior.

==================================================
10. ACCESSIBILITY
==================================================
Implement accessible UI.
Use:

- semantic HTML
- proper button elements
- proper links
- labels for inputs
- aria-label where needed
- aria-expanded for expandable UI
- keyboard accessible interactions
- visible focus states
- sufficient contrast

Do not use a div as a button when a button element is appropriate.

==================================================
11. LOADING / ERROR / EMPTY STATES
==================================================

Where applicable, implement:
- loading states
- skeleton states
- empty states
- error states

Do not leave users with a blank page when data is unavailable.
Use existing project components for these states if they exist.

==================================================
12. AUTHENTICATION / AUTHORIZATION
==================================================
Respect the existing authentication architecture.
Do not implement a second authentication system.
Protected pages should use the existing:
- proxy.ts
- authentication utilities
- ProtectedPage components
- role-based layouts
- permission system
Do not trust client-side role information for security decisions.
Authorization must ultimately be enforced server-side/backend-side.

==================================================
13. SECURITY
==================================================
Never expose:
- secrets
- private tokens
- API keys
- database credentials
Do not put sensitive server-only logic inside Client Components.
Keep server-only operations on the server.
Never rely solely on:
- Redux
- localStorage
- sessionStorage
- client-side role checks
for security.

==================================================
14. PERFORMANCE
==================================================
Optimize for production.
Prefer:
- Server Components
- server-side data fetching
- streaming where useful
- small Client Components
- dynamic imports when genuinely beneficial
- optimized images
- minimal JavaScript sent to the browser
- reusable components
- memoization only when there is a real performance reason
Do not prematurely optimize simple components.
Do not use useMemo/useCallback everywhere without a reason.

==================================================
15. SEO
==================================================
For public pages, implement appropriate Next.js metadata.
Use:
- title
- description
- Open Graph metadata when appropriate

Do not add unnecessary SEO metadata to authenticated internal application pages unless required.

==================================================
16. ICONS
==================================================
Use the project's existing icon library.
If the project uses Lucide React, use Lucide icons.
Do not introduce another icon library unless there is a specific requirement.

==================================================
17. TYPOGRAPHY
==================================================
Follow the typography system already established by the application.
Use the existing global font configuration.
Headings should maintain the RicozInvoice style:
- strong
- professional
- compact
- high readability

Avoid excessive font sizes or decorative typography.

==================================================
18. REUSABILITY
==================================================
Before creating a component, ask:
"Could this component reasonably be reused elsewhere?"
If yes, create it in the appropriate shared component directory.
Examples:

components/
  ui/
  layout/
  sidebar/
  forms/
  tables/
  charts/

Feature-specific components should stay inside their feature when they aren't broadly reusable.

==================================================
19. DO NOT OVERENGINEER
==================================================
Do not create abstractions just for the sake of abstraction.
Do not create:

- unnecessary hooks
- unnecessary context providers
- unnecessary Redux slices
- unnecessary utility functions
- unnecessary wrapper components

Choose the simplest architecture that remains maintainable and scalable.

==================================================
20. EXISTING CODE FIRST
==================================================
Before implementation:

1. Inspect the existing project structure.
2. Identify reusable components.
3. Identify existing hooks.
4. Identify existing UI components.
5. Identify existing Redux state.
6. Identify existing API utilities.
7. Identify existing authentication utilities.
8. Identify existing CSS variables in globals.css.
9. Identify existing layout patterns.
10. Reuse them wherever possible.

Do not duplicate existing functionality.

==================================================
21. CODE QUALITY
==================================================
Use strict TypeScript.
Avoid:
any
unless absolutely unavoidable.
Prefer explicit interfaces/types.
Keep functions focused.
Use meaningful names.
Avoid magic strings when constants already exist.
Do not leave:

- console.logs
- dead code
- commented-out experiments
- unused imports
- unused variables
- temporary mock logic
in the final implementation.

==================================================
22. IMPLEMENTATION PROCESS
==================================================

Before writing code:

1. Understand the requirements.
2. Inspect relevant existing files.
3. Determine Server vs Client Component boundaries.
4. Identify reusable components.
5. Determine whether data should be fetched on the server or client.
6. Determine whether Redux is actually required.
7. Determine responsive behavior.
8. Determine loading/error/empty states.
9. Implement.
10. Check TypeScript correctness.
11. Check imports.
12. Check responsive behavior.
13. Check accessibility.
14. Check that no unnecessary `"use client"` was introduced.
15. Check that no duplicate components or logic were created.

==================================================
23. IMPORTANT OUTPUT RULE
==================================================
Implement the requested feature directly.
Do not rewrite unrelated parts of the application.
Do not modify architecture that is unrelated to the requirement.
If an existing component should be improved to support the requirement, modify it instead of creating a duplicate.
If a reusable component is needed, create it and use it.
Keep the implementation production-ready and maintainable.
==================================================
24. CURRENT REQUIREMENTS
==================================================
[PASTE PAGE / COMPONENT REQUIREMENTS HERE]
==================================================
25. FINAL CHECK
==================================================
Before finishing, verify:
[ ] Tailwind CSS is used for styling/layout.
[ ] Existing globals.css variables are used for brand styling.
[ ] No unnecessary hardcoded brand colors exist.
[ ] Server Components are used by default.
[ ] Client Components exist only where interaction requires them.
[ ] `"use client"` is not unnecessarily added to page.tsx.
[ ] Existing reusable components were reused.
[ ] No unnecessary duplication exists.
[ ] Redux is used only where genuinely required.
[ ] Initial server data is not unnecessarily fetched in useEffect.
[ ] Mobile/tablet/desktop layouts work correctly.
[ ] Accessibility has been considered.
[ ] Loading/error/empty states are handled where necessary.
[ ] Authentication/authorization follows the existing architecture.
[ ] No sensitive server-side logic was moved into Client Components.
[ ] TypeScript is clean.
[ ] No unused imports/variables remain.
[ ] No console.log/debug code remains.
[ ] The implementation matches the existing RicozInvoice design system.
[ ] The implementation is production-ready.
