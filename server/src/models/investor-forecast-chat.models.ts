import { model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export interface IInvestorForecastChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface IInvestorForecastChatSession {
  userId: Types.ObjectId;
  companyId?: Types.ObjectId;
  sessionId: string;
  fiscalYearStart: number;
  title: string;
  items: unknown[];
  messages: IInvestorForecastChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IInvestorForecastChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 24_000 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const investorForecastChatSessionSchema = new Schema<IInvestorForecastChatSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: String, required: true, maxlength: 120 },
    fiscalYearStart: { type: Number, required: true, min: 2000, max: 2100 },
    title: { type: String, required: true, maxlength: 120 },
    items: { type: [Schema.Types.Mixed], default: [] },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

investorForecastChatSessionSchema.plugin(companyScoped);
investorForecastChatSessionSchema.index(
  { companyId: 1, userId: 1, sessionId: 1 },
  { unique: true, name: "investor_forecast_chat_session_unique" },
);
investorForecastChatSessionSchema.index({ companyId: 1, userId: 1, updatedAt: -1 });

export const InvestorForecastChatSession = model<IInvestorForecastChatSession>(
  "InvestorForecastChatSession",
  investorForecastChatSessionSchema,
);
