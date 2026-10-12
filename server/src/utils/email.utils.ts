import * as nodemailer from "nodemailer";
import dotenv from "dotenv";
import {
  renderTaskAssignmentEmail,
  renderVerificationEmail,
  renderWelcomeEmail,
  type TaskAssignmentEmail,
} from "./email.presentation.js";
dotenv.config();

const smtpHost = process.env.SMTP_HOST?.trim() || process.env.ZEPTOMAIL_SMTP_HOST?.trim() || "smtp.zeptomail.in";
const smtpPort = Number(process.env.SMTP_PORT || process.env.ZEPTOMAIL_SMTP_PORT || 587);
const smtpSecureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
  throw new Error("SMTP_PORT must be a valid port number");
}
if (smtpSecureValue && !["true", "false"].includes(smtpSecureValue)) {
  throw new Error("SMTP_SECURE must be true or false");
}
const smtpSecure = smtpSecureValue ? smtpSecureValue === "true" : smtpPort === 465;
const smtpUser = process.env.SMTP_USER?.trim() || process.env.ZEPTOMAIL_SMTP_USER?.trim() || "emailapikey";
const smtpPassword = process.env.SMTP_PASS?.trim() || process.env.ZEPTOMAIL_SMTP_PASSWORD?.trim();
const senderEmail = process.env.EMAIL_FROM?.trim() || process.env.ZEPTOMAIL_FROM_EMAIL?.trim();
const senderName =
  process.env.EMAIL_FROM_NAME?.trim() || process.env.ZEPTOMAIL_FROM_NAME?.trim() || "Ricoz Innovation";
// Address used as the reply-to / notification target for contact form submissions.
const contactRecipient =
  process.env.ZEPTOMAIL_CONTACT_TO?.trim() || senderEmail;

if (!smtpPassword || !senderEmail) {
  console.warn(
    "SMTP is not fully configured; email sending requires SMTP_PASS and EMAIL_FROM (or the legacy ZeptoMail equivalents).",
  );
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: smtpPassword ? { user: smtpUser, pass: smtpPassword } : undefined,
  requireTLS: !smtpSecure && smtpPort === 587,
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 60_000,
});

const sender = senderEmail ? { name: senderName, address: senderEmail } : undefined;

function smtpErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return "UNKNOWN";
  return typeof error.code === "string" || typeof error.code === "number" ? String(error.code) : "UNKNOWN";
}

function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

export async function verifyEmailTransport() {
  try {
    await transporter.verify();
    console.log(
      `SMTP transport verified: ${smtpHost}:${smtpPort} as ${senderEmail ?? "unconfigured"}`,
    );
  } catch (error) {
    console.error(
      `SMTP transport verification failed for ${smtpHost}:${smtpPort} (code ${smtpErrorCode(error)})`,
    );
  }
}

// SendEmail
export const sendEmail = async (
  email: string,
  title: string,
  body: string,
  attachments?: Array<{ filename: string; content: Buffer }>,
  text?: string,
  options: { cc?: string[]; bcc?: string[] } = {},
) => {
  if (!sender) throw new Error("Email sender is not configured. Set EMAIL_FROM.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("A valid recipient email address is required");
  if (!title.trim() || title.length > 200) throw new Error("Email subject must be between 1 and 200 characters");
  if ((attachments ?? []).some((attachment) => !attachment.filename.trim() || !Buffer.isBuffer(attachment.content))
    || (attachments ?? []).reduce((total, attachment) => total + attachment.content.length, 0) > 10 * 1024 * 1024) {
    throw new Error("Email attachments must be valid buffers no larger than 10 MB");
  }
  const html = body.trimStart().startsWith("<")
    ? body.trim()
    : `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; }
          @media only screen and (max-width: 600px) { .otp-content { padding: 20px 16px !important; } .otp-title { font-size: 22px !important; } }
        </style>
      </head>
      <body style="width:100%;margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
    <div class="otp-content" style="box-sizing:border-box;width:100%;margin:0;padding:32px 24px;color:#171717">
      <h2>${escapeEmailHtml(title)}</h2>
      <p>Your one-time code is:</p>
      <p class="otp-title" style="font-size:32px;font-weight:bold;letter-spacing:6px;overflow-wrap:anywhere">${escapeEmailHtml(body)}</p>
      <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
      </body>
    </html>
  `;
  try {
    const safeAttachments = attachments?.map((attachment) => ({
      ...attachment,
      filename: attachment.filename.replace(/[\r\n\\/]/g, "_").slice(0, 180),
    }));
    const plainText = text?.trim()
      || (body.trimStart().startsWith("<")
        ? body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
        : `${title}\n\n${body}`);
    const info = await transporter.sendMail({
      from: sender,
      to: email.trim(),
      ...(options.cc?.length ? { cc: options.cc } : {}),
      ...(options.bcc?.length ? { bcc: options.bcc } : {}),
      subject: title.replace(/[\r\n]/g, " ").trim(),
      html,
      text: plainText,
      attachments: safeAttachments,
    });
    return { messageId: info.messageId };
  } catch (err) {
    console.error(`SMTP email delivery failed for ${smtpHost}:${smtpPort} (code ${smtpErrorCode(err)})`);
    throw new Error("Email delivery failed");
  }
};

export async function sendBrandedEmail(
  email: string,
  subject: string,
  html: string,
  text: string,
) {
  if (!sender) throw new Error("Email sender is not configured. Set EMAIL_FROM.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("A valid recipient email address is required");
  if (!subject.trim() || subject.length > 200) throw new Error("Email subject must be between 1 and 200 characters");
  try {
    await transporter.sendMail({
      from: sender,
      to: email.trim(),
      subject: subject.replace(/[\r\n]/g, " ").trim(),
      html,
      text,
    });
  } catch (err) {
    console.error(`SMTP email delivery failed for ${smtpHost}:${smtpPort} (code ${smtpErrorCode(err)})`);
    throw new Error("Email delivery failed");
  }
}

export async function sendVerificationCodeEmail(
  email: string,
  name: string,
  code: string,
) {
  const message = renderVerificationEmail(name, code);
  return sendBrandedEmail(
    email,
    "Verify your Ricoz email",
    message.html,
    message.text,
  );
}

export async function sendWelcomeEmail(email: string, name: string) {
  const message = renderWelcomeEmail(name);
  return sendBrandedEmail(
    email,
    "Welcome to Ricoz Innovation",
    message.html,
    message.text,
  );
}

export async function sendRecruitmentCandidateInviteEmail(email: string, name: string) {
  const clientOrigin = process.env.CLIENT_URL?.split(",")[0]?.trim() || "http://localhost:3000";
  const signupUrl = new URL("/signup", clientOrigin);
  if (!["http:", "https:"].includes(signupUrl.protocol) || (process.env.NODE_ENV === "production" && signupUrl.protocol !== "https:")) {
    throw new Error("Candidate activation URLs must use HTTPS in production");
  }
  signupUrl.searchParams.set("email", email);
  signupUrl.searchParams.set("redirect", "/dashboard/applications");
  const safeName = name.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
  const message = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#18243a"><h2>Continue your Ricoz recruitment process</h2><p>Hello ${safeName},</p><p>A recruiter has added your candidate profile to Ricoz. Create your account using the email address this message was sent to, then verify your email to access your application and any offer documents.</p><p><a href="${signupUrl.href}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#c91d20;color:#fff;text-decoration:none;font-weight:700">Activate your candidate account</a></p><p>If you were not expecting this invitation, you can ignore this email.</p></div>`;
  return sendBrandedEmail(
    email,
    "Activate your Ricoz candidate account",
    message,
    `Hello ${name}, a recruiter has added your Ricoz candidate profile. Activate your account at ${signupUrl.href}.`,
  );
}

export async function sendTaskAssignmentEmail(
  email: string,
  task: TaskAssignmentEmail,
) {
  const message = renderTaskAssignmentEmail(task);
  return sendBrandedEmail(
    email,
    "New task assignment from Ricoz Innovation",
    message.html,
    message.text,
  );
}

export const sendContactEmail = async ({
  name,
  email,
  subject,
  message,
}: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) => {
  if (!contactRecipient)
    throw new Error(
      "ZeptoMail contact recipient is not configured. Set ZEPTOMAIL_CONTACT_TO or ZEPTOMAIL_FROM_EMAIL.",
    );
  if (!sender) throw new Error("Email sender is not configured. Set EMAIL_FROM.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("A valid reply email address is required");
  try {
    await transporter.sendMail({
      from: sender,
      to: contactRecipient,
      replyTo: email.trim(),
      subject: `[Ricoz contact] ${subject.replace(/[\r\n]/g, " ").trim()}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });
  } catch (error) {
    console.error(`SMTP contact email delivery failed for ${smtpHost}:${smtpPort} (code ${smtpErrorCode(error)})`);
    throw new Error("Contact email delivery failed");
  }
};
