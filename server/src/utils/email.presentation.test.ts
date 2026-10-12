import assert from "node:assert/strict";
import test from "node:test";
import { renderTaskAssignmentEmail, renderVerificationEmail, renderWelcomeEmail } from "./email.presentation.js";

test("verification email renders the code, expiry, and escaped recipient", () => {
  const message = renderVerificationEmail("Aman <Kumar>", "123456");
  assert.match(message.html, /Aman &lt;Kumar&gt;/);
  assert.match(message.html, /123456/);
  assert.match(message.html, /expires in 10 minutes/);
  assert.match(message.html, /class="email-main" width="100%"/);
  assert.doesNotMatch(message.html, /height="100%"|min-height:100vh/);
  assert.match(message.html, /@media only screen and \(max-width:600px\)/);
  assert.doesNotMatch(message.html, /BEYOND FUTURES/);
  assert.doesNotMatch(message.html, />rZ</);
  assert.doesNotMatch(`${message.html}\n${message.text}`, /View Dashboard|\/login|href="[^"]*\/dashboard/);
  assert.match(message.text, /123456/);
});

test("welcome email confirms account activation and escapes user-provided content", () => {
  const message = renderWelcomeEmail("Aman & Co");
  assert.match(message.html, /Aman &amp; Co/);
  assert.match(message.html, /ACCOUNT ACTIVATED/);
  assert.doesNotMatch(`${message.html}\n${message.text}`, /View Dashboard|\/login|href="[^"]*\/dashboard/);
});

test("task assignment email includes assignment details and escapes task content", () => {
  const message = renderTaskAssignmentEmail({
    recipientName: "Aman",
    taskTitle: "Build <portal>",
    description: "Review & ship the first release.",
    projectObjective: "Launch the customer workspace",
    recommendedStack: ["Next.js", "TypeScript"],
    requirements: ["Responsive layouts", "Role-based access"],
    deliverables: ["Working dashboard", "Deployment notes"],
    startDate: "2026-10-01T00:00:00.000Z",
    role: "Product Design Intern",
    department: "Product & Design",
    assignedBy: "Ricoz Manager",
    deadline: "2026-10-07T00:00:00.000Z",
    priority: "HIGH",
    projectName: "Ricoz Portal",
  });
  assert.match(message.html, /Build &lt;portal&gt;/);
  assert.match(message.html, /Assigned By/);
  assert.match(message.html, /Product &amp; Design/);
  assert.match(message.html, /Project Details/);
  assert.match(message.html, /Your responsibilities/);
  assert.match(message.html, /Deployment notes/);
  assert.match(message.html, /Project Timeline/);
  assert.match(message.html, /01 October 2026/);
  assert.match(message.html, /07 October 2026/);
  assert.match(message.html, /Open Project Workspace/);
  assert.doesNotMatch(message.html, /View Dashboard/);
  assert.match(message.text, /Priority: HIGH/);
});
