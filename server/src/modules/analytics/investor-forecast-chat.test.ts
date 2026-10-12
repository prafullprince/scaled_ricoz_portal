import { afterEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { InvestorCompanyAccess, InvestorForecastChatSession, InvestorProfile } from "../../models/index.js";
import { isCompanyScoped } from "../company/company.plugin.js";
import { currentScope, runWithCompany } from "../company/company.context.js";
import { requireVerifiedInvestorCompanyAccess } from "./investor-forecast-chat.controller.js";
import { MongoInvestorForecastChatSession } from "./investor-forecast-chat.session.js";
import { investorForecastChatMessageSchema } from "./investor-forecast-chat.validation.js";

afterEach(() => mock.restoreAll());

it("stores chat sessions in the active company scope and indexes them by company, investor, and session", () => {
  assert.equal(isCompanyScoped(InvestorForecastChatSession.schema), true);
  assert.ok(InvestorForecastChatSession.schema.indexes().some(([fields, options]) =>
    fields.companyId === 1 && fields.userId === 1 && fields.sessionId === 1 && options?.unique === true,
  ));
});

it("keeps OpenAI session history inside the active company context", async () => {
  const companyId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  let receivedItems: unknown[] = [];
  mock.method(InvestorForecastChatSession, "findOne", (() => ({
    select() { return this; },
    lean: async () => {
      assert.equal(String(currentScope()?.companyId), String(companyId));
      return { items: [{ role: "user", content: "Forecast?" }, { role: "assistant", content: "Plan answer." }] };
    },
  })) as any);
  mock.method(InvestorForecastChatSession, "updateOne", (async (filter: unknown, update: any) => {
    assert.equal(String(currentScope()?.companyId), String(companyId));
    assert.deepEqual(filter, { userId, sessionId: "investor-chat" });
    receivedItems = update.$push.items.$each;
    return { acknowledged: true };
  }) as any);

  const session = new MongoInvestorForecastChatSession(String(userId), "investor-chat", 2026);
  await runWithCompany({ companyId, isDefault: false }, async () => {
    assert.equal((await session.getItems(1)).length, 1);
    await session.addItems([{ role: "assistant", content: "Follow-up" } as any]);
  });
  assert.equal(receivedItems.length, 1);
});

it("requires a verified investor and active company grant before chat routes proceed", async () => {
  const investorId = new Types.ObjectId();
  const companyId = new Types.ObjectId();
  mock.method(InvestorProfile, "findOneAndUpdate", (async () => ({ isVerified: true })) as any);
  mock.method(InvestorCompanyAccess, "exists", (async () => null) as any);

  let status = 200;
  let responseBody: unknown;
  let proceeded = false;
  const res = {
    status(value: number) { status = value; return this; },
    json(value: unknown) { responseBody = value; return this; },
  };
  await requireVerifiedInvestorCompanyAccess({
    authUser: { _id: investorId, roles: ["INVESTOR"] },
    company: { _id: companyId },
  } as any, res as any, (error?: unknown) => {
    assert.equal(error, undefined);
    proceeded = true;
  });

  assert.equal(status, 403);
  assert.equal(proceeded, false);
  assert.deepEqual(responseBody, {
    success: false,
    message: "Your investor account does not have access to this company",
  });
});

it("validates investor forecast chat message size and session identifier", () => {
  const sessionId = "c9bd08de-c96c-4115-81c6-ece1303d842a";
  assert.equal(investorForecastChatMessageSchema.safeParse({
    params: { sessionId },
    body: { message: "Compare plan margin and costs." },
  }).success, true);
  assert.equal(investorForecastChatMessageSchema.safeParse({
    params: { sessionId: "other" },
    body: { message: "Question" },
  }).success, false);
  assert.equal(investorForecastChatMessageSchema.safeParse({
    params: { sessionId },
    body: { message: "x".repeat(4001) },
  }).success, false);
});
