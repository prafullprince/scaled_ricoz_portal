import express, { type Request, type Response } from "express";
import { createServer } from "node:http";
import "dotenv/config";
import cors from "cors";

import appRoutes from "./routes/index.js";
import { connectDB } from "./config/mongodb.js";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import { expireAllWorkRoles } from "./modules/recruitment/role-expiry.service.js";
import { verifyEmailTransport } from "./utils/email.utils.js";
import { attachChatGateway } from "./modules/chat/chat.gateway.js";
import { startChatWorker } from "./modules/chat/chat.infrastructure.js";
import { chatQueue } from "./modules/chat/chat.infrastructure.js";
import { validateEnvironment } from "./config/env.js";
import mongoose from "mongoose";
import type { Queue, Worker } from "bullmq";
import { ensureDefaultCompany } from "./modules/company/company.service.js";
import { getDefaultCompanyId, hasDefaultCompany, runWithCompany, scopeFor } from "./modules/company/company.context.js";
import { startComplianceWorker } from "./modules/compliance/compliance.worker.js";
import { syncDueIntegrations } from "./modules/integrations/integration.service.js";
import { remindSalesAccountability } from "./modules/sales/sales-accountability.reminders.js";
import { processDueSalesClientCampaigns } from "./modules/sales/sales.client-campaign.service.js";
import { remindTaskDeadlines } from "./modules/tasks/task-deadline-reminders.js";
import { closeOfferPdfBrowser } from "./modules/recruitment/offer.template.js";

// initialize app
const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT ?? 10000);
let roleExpiryTimer: ReturnType<typeof setInterval> | null = null;
let integrationTimer: ReturnType<typeof setInterval> | null = null;
let integrationSyncRunning = false;
let salesReminderTimer: ReturnType<typeof setInterval> | null = null;
let salesReminderRunning = false;
let salesClientCampaignTimer: ReturnType<typeof setInterval> | null = null;
let salesClientCampaignRunning = false;
let taskDeadlineReminderTimer: ReturnType<typeof setInterval> | null = null;
let taskDeadlineReminderRunning = false;
let chatWorker: Worker | null = null;
let complianceWorker: Worker | null = null;
let complianceQueue: Queue | null = null;
let shuttingDown = false;

// Behind AWS (ALB/ELB/CloudFront) so req.secure / X-Forwarded-Proto is trusted — required for secure cookies.
app.set("trust proxy", 1);

// Comma-separated list, e.g. "https://ricoz.vercel.app,https://app.ricoz.com"
const allowedOrigins = (process.env.CLIENT_URL ?? "https://ricoz-innovation-testing.vercel.app, http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

// middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use("/api/v1/finance/revenue-projections", express.json({ limit: "8mb" }));
app.use("/api/v1/sales/leads/import", express.json({ limit: "8mb" }));
app.use("/api/v1/sales/leads/imported/campaigns", express.json({ limit: "12mb" }));
app.use("/api/v1/sales/leads", express.json({ limit: "300kb" }));
app.use("/api/v1/recruitment/admin/candidate-lists/import", express.json({ limit: "8mb" }));
app.use("/api/v1/recruitment/admin/offer-letter-profile", express.json({ limit: "300kb" }));
app.use("/api/v1/integrations/webhooks", express.json({
  limit: "2mb",
  verify(req, _res, buffer) {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
}));
app.use(express.json({
  verify(req, _res, buffer) {
    if (
      (req as Request).originalUrl.startsWith("/api/v1/hr/finance/payouts/webhook") ||
      (req as Request).originalUrl.startsWith("/api/v1/marketing/social/webhook/meta")
    ) {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 }, abortOnLimit: true, createParentPath: false }));
app.use(cookieParser());
// Public and pre-authentication requests belong to the default company.
app.use((_req, _res, next) => {
  if (!hasDefaultCompany()) return next();
  runWithCompany(scopeFor(getDefaultCompanyId()), next);
});

// default routes
app.get("/health", (req: Request, res: Response) => {
  return res.json({
    success: true,
    message: "ok",
  });
});

app.get("/ready", (_req: Request, res: Response) => {
  const ready = mongoose.connection.readyState === 1;
  return res.status(ready ? 200 : 503).json({
    success: ready,
    message: ready ? "ready" : "database unavailable",
  });
});

// routes
app.use("/api/v1", appRoutes);

// start server
function listen() {
  return new Promise<void>((resolve, reject) => {
    const handleError = (error: NodeJS.ErrnoException) => reject(error);
    httpServer.once("error", handleError);
    httpServer.listen(PORT, () => {
      httpServer.off("error", handleError);
      resolve();
    });
  });
}

async function main() {
  validateEnvironment();
  try {
    await listen();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. The API may already be running.`);
      return;
    }
    throw error;
  }

  // connect db
  try {
    await connectDB();
    await ensureDefaultCompany();
    await verifyEmailTransport();
    if (process.env.SCHEDULERS_ENABLED !== "false") {
      await expireAllWorkRoles();
      roleExpiryTimer = setInterval(() => { void expireAllWorkRoles().catch((error) => console.error("Role expiry sweep failed", error)); }, 60 * 1000);
      integrationTimer = setInterval(() => {
        if (integrationSyncRunning || !process.env.INTEGRATIONS_ENCRYPTION_KEY) return;
        integrationSyncRunning = true;
        void syncDueIntegrations()
          .catch((error) => console.error("Integration scheduler failed", error))
          .finally(() => { integrationSyncRunning = false; });
      }, 60_000);
      const scanSalesReminders = () => {
        if (salesReminderRunning) return;
        salesReminderRunning = true;
        void remindSalesAccountability()
          .catch((error) => console.error("Sales accountability reminder scan failed", error))
          .finally(() => { salesReminderRunning = false; });
      };
      scanSalesReminders();
      salesReminderTimer = setInterval(scanSalesReminders, 60 * 60 * 1000);
      const scanSalesClientCampaigns = () => {
        if (salesClientCampaignRunning) return;
        salesClientCampaignRunning = true;
        void processDueSalesClientCampaigns()
          .catch((error) => console.error("Client communication campaign scan failed", error))
          .finally(() => { salesClientCampaignRunning = false; });
      };
      scanSalesClientCampaigns();
      salesClientCampaignTimer = setInterval(scanSalesClientCampaigns, 5_000);
      const scanTaskDeadlineReminders = () => {
        if (taskDeadlineReminderRunning) return;
        taskDeadlineReminderRunning = true;
        void remindTaskDeadlines()
          .catch((error) => console.error("Task deadline reminder scan failed", error))
          .finally(() => { taskDeadlineReminderRunning = false; });
      };
      scanTaskDeadlineReminders();
      taskDeadlineReminderTimer = setInterval(scanTaskDeadlineReminders, 60_000);
    }

    attachChatGateway(httpServer);
    if (process.env.CHAT_EMBEDDED_WORKER !== "false") chatWorker = startChatWorker();
    if (process.env.COMPLIANCE_WORKER_ENABLED !== "false") {
      const compliance = await startComplianceWorker();
      complianceWorker = compliance.worker;
      complianceQueue = compliance.queue;
    }
    console.log(`Server is running on port ${PORT}`);
  } catch (error) {
    httpServer.close();
    throw error;
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down`);
  if (roleExpiryTimer) clearInterval(roleExpiryTimer);
  if (integrationTimer) clearInterval(integrationTimer);
  if (salesReminderTimer) clearInterval(salesReminderTimer);
  if (salesClientCampaignTimer) clearInterval(salesClientCampaignTimer);
  if (taskDeadlineReminderTimer) clearInterval(taskDeadlineReminderTimer);
  const forceExit = setTimeout(() => process.exit(1), 15_000);
  forceExit.unref();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await closeOfferPdfBrowser();
  await chatWorker?.close();
  await complianceWorker?.close();
  await complianceQueue?.close();
  await chatQueue.close();
  await mongoose.disconnect();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

void main().catch((error) => {
  console.error("Server startup failed", error);
  process.exitCode = 1;
});
