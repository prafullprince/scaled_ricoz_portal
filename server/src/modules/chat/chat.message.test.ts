import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { ChatMessage, Conversation, User } from "../../models/index.js";
import { createDirectConversation, deleteMessage, editMessage, listContacts, listConversations, listMessages, startGroupCall } from "./chat.controller.js";
import { deleteMessageSchema, messageEditWindowMs } from "./chat.validation.js";

afterEach(() => mock.restoreAll());
const actor = new Types.ObjectId();
const conversationId = new Types.ObjectId();
const messageId = new Types.ObjectId();
const query = (value: unknown): any => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  limit() { return this; },
  lean: async () => value,
});
const conversation = { _id: conversationId, members: [{ userId: actor }] };

async function run(handler: (req: Request, res: Response, next: (error?: unknown) => void) => unknown, req: object, locals: object = {}) {
  let body: any;
  let error: any;
  const res = { locals, json(value: unknown) { body = value; return this; } } as unknown as Response;
  await handler({ authUser: { _id: actor }, params: { messageId: String(messageId), id: String(conversationId) }, query: {}, body: {}, ...req } as unknown as Request, res, (caught) => { error = caught; });
  return { body, error };
}

test("delete scope defaults to everyone and rejects unknown scopes", () => {
  assert.equal(deleteMessageSchema.parse({ query: {} }).query.scope, "everyone");
  assert.equal(deleteMessageSchema.safeParse({ query: { scope: "all" } }).success, false);
});

for (const type of ["GROUP", "COMMUNITY"]) {
  test(`${type} members cannot start calls without conversation admin rights`, async () => {
    mock.method(Conversation, "findOne", (async () => ({ ...conversation, type, admins: [new Types.ObjectId()] })) as any);
    const { error } = await run(startGroupCall, { body: { type: "audio" } });
    assert.equal(error?.statusCode, 403);
  });
}

test("delete for me hides the message only for the requesting member", async () => {
  mock.method(ChatMessage, "findById", (() => query({ _id: messageId, conversationId })) as any);
  mock.method(Conversation, "findOne", (async () => conversation) as any);
  const hide = mock.method(ChatMessage, "updateOne", (async (filter: any, update: any) => {
    assert.equal(String(filter._id), String(messageId));
    assert.equal(String(update.$addToSet.hiddenFor), String(actor));
  }) as any);
  const destroy = mock.method(ChatMessage, "findOneAndUpdate");
  const result = await run(deleteMessage, {}, { query: { scope: "me" } });
  assert.equal(result.error, undefined);
  assert.equal(result.body.scope, "me");
  assert.equal(hide.mock.callCount(), 1);
  assert.equal(destroy.mock.callCount(), 0);
});

test("messages older than one hour cannot be edited", async () => {
  mock.method(ChatMessage, "findOne", (() => query({ _id: messageId, createdAt: new Date(Date.now() - messageEditWindowMs - 1000) })) as any);
  const update = mock.method(ChatMessage, "findOneAndUpdate");
  const result = await run(editMessage, { body: { text: "Updated" } });
  assert.equal(result.error?.statusCode, 403);
  assert.equal(update.mock.callCount(), 0);
});

test("edits within one hour re-check the window atomically", async () => {
  mock.method(ChatMessage, "findOne", (() => query({ _id: messageId, createdAt: new Date() })) as any);
  mock.method(ChatMessage, "findOneAndUpdate", ((filter: any) => {
    assert.ok(filter.createdAt.$gte instanceof Date);
    assert.equal(filter.deletedForEveryoneAt, null);
    return query(null);
  }) as any);
  const result = await run(editMessage, { body: { text: "Updated" } });
  assert.equal(result.error?.statusCode, 403);
});

test("message history excludes messages hidden by the reader", async () => {
  mock.method(Conversation, "findOne", (async () => conversation) as any);
  mock.method(ChatMessage, "find", ((filter: any) => {
    assert.equal(String(filter.hiddenFor.$ne), String(actor));
    return query([]);
  }) as any);
  const result = await run(listMessages, { params: { id: String(conversationId) } });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.body.messages, []);
});

test("conversation list tolerates members whose user account was deleted", async () => {
  const savedConversation = {
    _id: conversationId,
    members: [
      { userId: null, lastReadAt: new Date(0) },
      { userId: actor, lastReadAt: new Date(0) },
    ],
    lastMessageAt: new Date(),
  };
  mock.method(Conversation, "find", (() => query([savedConversation])) as any);
  mock.method(ChatMessage, "findOne", (() => query(null)) as any);
  mock.method(ChatMessage, "countDocuments", (async () => 0) as any);
  const result = await run(listConversations, {});
  assert.equal(result.error, undefined);
  assert.equal(result.body.conversations.length, 1);
  assert.equal(result.body.conversations[0].mySettings.userId, actor);
});

test("contact search includes active users outside the selected company", async () => {
  const crossCompanyUser = new Types.ObjectId();
  mock.method(User, "find", ((filter: any) => {
    assert.equal(String(filter._id.$ne), String(actor));
    assert.equal(filter.status, "ACTIVE");
    assert.equal("companyId" in filter, false);
    assert.equal("$and" in filter, false);
    return { ...query([{ _id: crossCompanyUser }]), sort() { return this; }, limit() { return this; } };
  }) as any);
  const result = await run(listContacts, {});
  assert.equal(result.error, undefined);
  assert.equal(result.body.users[0]._id, crossCompanyUser);
});

test("direct conversations can be created with an active user from another company", async () => {
  const crossCompanyUser = new Types.ObjectId();
  const savedConversation = { _id: conversationId, members: [{ userId: actor }, { userId: crossCompanyUser }] };
  mock.method(User, "findOne", ((filter: any) => {
    assert.equal(String(filter._id), String(crossCompanyUser));
    assert.equal(filter.status, "ACTIVE");
    assert.equal("companyId" in filter, false);
    assert.equal("$or" in filter, false);
    return query({ _id: crossCompanyUser });
  }) as any);
  mock.method(Conversation, "findOneAndUpdate", ((filter: any) => {
    assert.equal(filter.directKey, [String(actor), String(crossCompanyUser)].sort().join(":"));
    return { populate: async () => savedConversation };
  }) as any);
  let body: any;
  let statusCode: number | undefined;
  let error: any;
  await createDirectConversation(
    { authUser: { _id: actor }, body: { userId: String(crossCompanyUser) } } as unknown as Request,
    { status(value: number) { statusCode = value; return this; }, json(value: unknown) { body = value; return this; } } as unknown as Response,
    (caught) => { error = caught; },
  );
  assert.equal(error, undefined);
  assert.equal(statusCode, 201);
  assert.equal(body.conversation, savedConversation);
});
