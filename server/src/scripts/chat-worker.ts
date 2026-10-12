import "dotenv/config";
import { connectDB } from "../config/mongodb.js";
import { startChatWorker } from "../modules/chat/chat.infrastructure.js";
import { ensureDefaultCompany } from "../modules/company/company.service.js";

await connectDB();
await ensureDefaultCompany();
startChatWorker();
console.log("Chat persistence worker started");
