const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

const appUrl = (path: string) => {
  const origin =
    process.env.CLIENT_URL?.split(",")[0]?.trim() || "http://localhost:3000";
  return new URL(path, origin).toString();
};

function emailShell(content: string, preview: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ricoz Innovation</title>
<style>
html,body{width:100%!important;margin:0!important;padding:0!important}
table{border-collapse:collapse}
.email-root{width:100%!important}
.email-shell-cell{padding:0!important}
.email-main{width:100%!important;max-width:100%!important;overflow-wrap:anywhere}
.email-gutter{padding-left:24px!important;padding-right:24px!important}
@media only screen and (max-width:600px){
  .email-gutter{padding-left:16px!important;padding-right:16px!important}
  .email-heading{font-size:28px!important;line-height:1.2!important}
  .email-code{font-size:28px!important;letter-spacing:5px!important}
}
</style></head>
<body style="width:100%;margin:0;padding:0;background:#ffffff;color:#171717;font-family:Arial,Helvetica,sans-serif;letter-spacing:0">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(preview)}</div>
<table role="presentation" class="email-root" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#ffffff"><tr><td class="email-shell-cell" align="center" valign="top" style="padding:0">
<!--[if mso]><table role="presentation" width="100%"><tr><td><![endif]-->
<table role="presentation" class="email-main" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:100%;background:#ffffff;table-layout:fixed;overflow-wrap:anywhere">
${content}
<tr><td class="email-gutter" style="padding:20px 24px;background:#f7f7f7;border-top:1px solid #eeeeee"><strong style="font-size:14px;letter-spacing:.04em">RICOZ</strong><p style="font-size:13px;color:#666666;line-height:1.55;margin:6px 0 14px">Innovation across technology, digital solutions, and business growth.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td><a href="${escapeHtml(appUrl("/contact"))}" style="font-size:12px;color:#d00020;text-decoration:none">Support</a></td></tr></table><div style="border-top:1px solid #e0e0e0;margin-top:14px;padding-top:11px;font-size:11px;line-height:1.6;color:#909090">&copy; ${new Date().getFullYear()} Ricoz Innovation. All rights reserved.<br>This is an automated email. Please do not reply directly to this message.</div></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

function detailTable(title: string, rows: Array<[string, string]>) {
  return `<tr><td class="email-gutter" style="padding:0 24px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f7;border-radius:4px"><tr><td colspan="2" style="padding:16px 18px 10px;font-size:11px;font-weight:bold;letter-spacing:.06em;color:#737373;text-transform:uppercase">${escapeHtml(title)}</td></tr>${rows.map(([label, value], index) => `<tr><td style="padding:9px 18px;${index < rows.length - 1 ? "border-bottom:1px solid #e5e5e5;" : ""}font-size:13px;color:#737373">${escapeHtml(label)}</td><td align="right" style="padding:9px 18px;${index < rows.length - 1 ? "border-bottom:1px solid #e5e5e5;" : ""}font-size:13px;font-weight:bold;color:#171717;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join("")}<tr><td colspan="2" height="10"></td></tr></table></td></tr>`;
}

function actionButton(label: string, href: string) {
  return `<tr><td class="email-gutter" style="padding:0 24px 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="#ca0b32" style="border-radius:4px;mso-padding-alt:14px 10px"><a href="${escapeHtml(href)}" style="display:block;padding:14px 10px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold">${escapeHtml(label)}</a></td></tr></table></td></tr>`;
}

export function renderVerificationEmail(name: string, code: string) {
  const safeName = escapeHtml(name.trim() || "there");
  const content = `<tr><td class="email-gutter" style="padding:28px 24px 14px"><div style="font-size:12px;color:#d00020;font-weight:bold;letter-spacing:.08em">EMAIL VERIFICATION</div><h1 class="email-heading" style="margin:12px 0 10px;font-family:'Times New Roman',Georgia,serif;font-weight:400;font-size:34px;line-height:1.15">Verify your email.</h1><p style="margin:0;color:#666666;font-size:15px;line-height:1.65">Hi ${safeName}, use this one-time code to verify your email and continue creating your Ricoz account.</p></td></tr><tr><td class="email-gutter" style="padding:10px 24px 20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f7;border-radius:4px"><tr><td align="center" style="padding:22px 12px 8px;font-size:11px;font-weight:bold;letter-spacing:.08em;color:#737373">YOUR VERIFICATION CODE</td></tr><tr><td align="center" class="email-code" style="padding:0 12px 22px;font-size:34px;font-weight:bold;letter-spacing:8px;color:#171717">${escapeHtml(code)}</td></tr></table></td></tr><tr><td class="email-gutter" style="padding:0 24px 24px;color:#737373;font-size:13px;line-height:1.6">This code expires in 10 minutes. If you did not request it, you can safely ignore this message.</td></tr>`;
  return {
    html: emailShell(content, "Your Ricoz email verification code is ready."),
    text: `Hi ${name.trim() || "there"},\n\nYour Ricoz verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request it, ignore this message.`,
  };
}

export function renderWelcomeEmail(name: string) {
  const safeName = escapeHtml(name.trim() || "there");
  const content = `<tr><td class="email-gutter" style="padding:30px 24px 18px"><div style="font-size:12px;color:#d00020;font-weight:bold;letter-spacing:.08em">ACCOUNT ACTIVATED</div><h1 class="email-heading" style="margin:12px 0 12px;font-family:'Times New Roman',Georgia,serif;font-weight:400;font-size:36px;line-height:1.15">Welcome to Ricoz Innovation.</h1><p style="margin:0;color:#666666;font-size:16px;line-height:1.65">Hi ${safeName}, your Ricoz Innovation account is ready. You can now access your dashboard, manage your workspace, and continue with the next steps assigned to you.</p></td></tr>${detailTable(
    "Account Details",
    [
      ["Name", name.trim() || "Ricoz member"],
      ["Access", "Ricoz Innovation Dashboard"],
    ],
  )}<tr><td class="email-gutter" style="padding:0 24px 22px;color:#777777;font-size:13px;line-height:1.6">If you did not expect this account, contact the Ricoz Innovation support team before taking any action.</td></tr>`;
  return {
    html: emailShell(
      content,
      `Welcome to Ricoz Innovation, ${name.trim() || "there"}. Your account is ready.`,
    ),
    text: `Welcome to Ricoz Innovation, ${name.trim() || "there"}.\n\nYour account is ready. If you did not expect this account, contact Ricoz Innovation support.`,
  };
}

export type TaskAssignmentEmail = {
  recipientName: string;
  taskTitle: string;
  description: string;
  projectObjective?: string | undefined;
  recommendedStack?: string[] | undefined;
  requirements?: string[] | undefined;
  deliverables?: string[] | undefined;
  startDate?: Date | string | null | undefined;
  role?: string | undefined;
  department?: string | undefined;
  assignedBy?: string | undefined;
  deadline?: Date | string | null | undefined;
  priority?: string | undefined;
  projectName?: string | undefined;
};

const dateLabel = (value?: Date | string | null) => {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(date);
};

export function renderTaskAssignmentEmail(task: TaskAssignmentEmail) {
  const recipient = task.recipientName.trim() || "there";
  const safeTitle = escapeHtml(task.taskTitle.trim() || "New task");
  const summary = escapeHtml(
    task.description.trim() ||
      "Open your dashboard to review the task details and deliverables.",
  );
  const rows: Array<[string, string]> = [["Assigned To", recipient]];
  if (task.role) rows.push(["Role", task.role]);
  if (task.department) rows.push(["Department", task.department]);
  if (task.assignedBy) rows.push(["Assigned By", task.assignedBy]);
  rows.push(
    ["Priority", (task.priority || "MEDIUM").toUpperCase()],
    ["Due Date", dateLabel(task.deadline)],
  );
  if (task.projectName) rows.push(["Project", task.projectName]);
  const projectRows: Array<[string, string]> = [];
  if (task.projectName) projectRows.push(["Project Name", task.projectName]);
  if (task.projectObjective)
    projectRows.push(["Objective", task.projectObjective]);
  if (task.recommendedStack?.length)
    projectRows.push(["Recommended Stack", task.recommendedStack.join(", ")]);
  if (task.requirements?.length)
    projectRows.push(["Requirements", task.requirements.join(" · ")]);
  const projectSection = projectRows.length
    ? detailTable("Project Details", projectRows)
    : "";
  const deliverables = task.deliverables?.length
    ? task.deliverables
    : [
        "Review and complete the assigned task",
        "Submit completed work for review",
      ];
  const responsibilities = `<tr><td class="email-gutter" style="padding:0 24px 20px"><h2 style="font-size:15px;font-weight:bold;margin:0 0 8px">Your responsibilities</h2><p style="font-size:13px;line-height:1.65;color:#666666;margin:0">Review the scope, follow the agreed timeline and team standards, and keep your supervisor informed about progress or blockers.</p></td></tr>`;
  const deliverablesSection = `<tr><td class="email-gutter" style="padding:0 24px 20px"><h2 style="font-size:15px;font-weight:bold;margin:0 0 8px">Expected deliverables</h2><ol style="padding-left:20px;margin:0;color:#666666;font-size:13px;line-height:1.7">${deliverables.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></td></tr>`;
  const timeline = detailTable("Project Timeline", [
    ["Priority", (task.priority || "MEDIUM").toUpperCase()],
    ["Start Date", dateLabel(task.startDate)],
    ["Due Date", dateLabel(task.deadline)],
  ]);
  const content = `<tr><td class="email-gutter" style="padding:26px 24px 16px"><div style="font-size:12px;color:#d00020;font-weight:bold;letter-spacing:.08em">PROJECT ASSIGNMENT</div><h1 class="email-heading" style="margin:12px 0 10px;font-family:'Times New Roman',Georgia,serif;font-weight:400;font-size:32px;line-height:1.15">You have been assigned a task.</h1><p style="margin:0;color:#666666;font-size:15px;line-height:1.6">Hi ${escapeHtml(recipient)}, a new task is ready for you in Ricoz Innovation. Review the assignment details, responsibilities, and expected delivery below.</p></td></tr>${detailTable("Assignment Details", [["Task", task.taskTitle], ...rows])}${projectSection}<tr><td class="email-gutter" style="padding:0 24px 20px"><h2 style="font-size:16px;font-weight:bold;margin:0 0 8px">${safeTitle}</h2><p style="font-size:13px;line-height:1.65;color:#666666;margin:0">${summary}</p></td></tr>${responsibilities}${deliverablesSection}${timeline}${actionButton("Open Project Workspace", appUrl("/dashboard"))}<tr><td class="email-gutter" style="padding:0 24px 24px;color:#777777;font-size:13px;line-height:1.6">Need clarification about this assignment? Contact your supervisor or reply through your Ricoz workspace.</td></tr>`;
  return {
    html: emailShell(content, `New Ricoz task assigned: ${task.taskTitle}`),
    text: `PROJECT ASSIGNMENT\n\nHi ${recipient}, you have been assigned: ${task.taskTitle}\n\n${task.description}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nProject Details\n${projectRows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nExpected deliverables\n${deliverables.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\nStart date: ${dateLabel(task.startDate)}\nDue date: ${dateLabel(task.deadline)}\n\nOpen your workspace: ${appUrl("/dashboard")}`,
  };
}
