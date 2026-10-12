import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { activityPageSchema, finishedCallState, storyInputSchema } from "./chat.validation.js";
import { createStory, deleteStory, listCallHistory, listStories, storyViewers, viewStory } from "./chat.activity.controller.js";
import { ChatCallRecord, ChatStory, ChatStoryView } from "../../models/chatActivity.models.js";
import { User } from "../../models/index.js";

afterEach(() => mock.restoreAll());
const actor = new Types.ObjectId();
const author = new Types.ObjectId();
const storyId = new Types.ObjectId();
const request = (extra: object = {}) => ({ authUser: { _id: actor }, params: { id: String(storyId) }, query: {}, ...extra }) as unknown as Request;
const query = (value: unknown): any => ({ populate() { return this; }, select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => value });
const fail = (error?: unknown) => { if (error) throw error; };

test("status viewer lists require ownership and an unexpired status", async () => {
  mock.method(ChatStory, "findOne", (async (filter: any) => {
    assert.equal(String(filter.authorId), String(actor));
    assert.ok(filter.expiresAt.$gt instanceof Date);
    return null;
  }) as any);
  const readViews = mock.method(ChatStoryView, "find");
  let caught: any;
  await storyViewers(request(), {} as Response, (error) => { caught = error; });
  assert.equal(caught.statusCode, 404);
  assert.equal(readViews.mock.callCount(), 0);
});

test("a viewed status records the authenticated viewer exactly once via upsert", async () => {
  const expiresAt = new Date(Date.now() + 10000);
  mock.method(ChatStory, "findOne", (async (filter: any) => {
    assert.ok(filter.expiresAt.$gt instanceof Date);
    return { _id: storyId, authorId: author, expiresAt };
  }) as any);
  mock.method(User, "exists", (async () => ({ _id: author })) as any);
  const update = mock.method(ChatStoryView, "updateOne", (async (filter: any, value: any, options: any) => {
    assert.equal(String(filter.userId), String(actor));
    assert.equal(String(filter.storyId), String(storyId));
    assert.equal(value.$setOnInsert.expiresAt, expiresAt);
    assert.equal(options.upsert, true);
  }) as any);
  await viewStory(request(), { json: () => undefined } as unknown as Response, fail);
  assert.equal(update.mock.callCount(), 1);
});

test("owners viewing their own status do not inflate the view count", async () => {
  mock.method(ChatStory, "findOne", (async () => ({ _id: storyId, authorId: actor })) as any);
  mock.method(User, "exists", (async () => ({ _id: actor })) as any);
  const update = mock.method(ChatStoryView, "updateOne");
  await viewStory(request(), { json: () => undefined } as unknown as Response, fail);
  assert.equal(update.mock.callCount(), 0);
});

test("expired statuses cannot accept views", async () => {
  mock.method(ChatStory, "findOne", (async () => null) as any);
  const update = mock.method(ChatStoryView, "updateOne");
  let caught: any;
  await viewStory(request(), {} as Response, (error) => { caught = error; });
  assert.equal(caught.statusCode, 404);
  assert.equal(update.mock.callCount(), 0);
});

test("status deletion is restricted to its author", async () => {
  mock.method(ChatStory, "findOneAndDelete", (async (filter: any) => {
    assert.equal(String(filter.authorId), String(actor));
    return null;
  }) as any);
  let caught: any;
  await deleteStory(request(), {} as Response, (error) => { caught = error; });
  assert.equal(caught.statusCode, 404);
});

test("status feed is platform-wide, excludes expired stories and does not disclose foreign view counts", async () => {
  mock.method(ChatStory, "find", ((filter: any) => {
    assert.equal(filter.authorId, undefined);
    assert.ok(filter.expiresAt.$gt instanceof Date);
    return query([{ _id: storyId, authorId: { _id: author, name: "Another department" } }]);
  }) as any);
  mock.method(ChatStoryView, "find", (() => query([])) as any);
  mock.method(ChatStoryView, "aggregate", (async (pipeline: any[]) => { assert.deepEqual(pipeline[0].$match.storyId.$in, []); return []; }) as any);
  let result: any;
  await listStories(request(), { json: (body: unknown) => { result = body; } } as Response, fail);
  assert.equal(result.stories.length, 1);
  assert.equal(result.stories[0].viewCount, undefined);
});

test("call history and stale-call finalization stay scoped to the current participant", async () => {
  mock.method(ChatCallRecord, "updateMany", (async (filter: any, update: unknown, options: any) => {
    assert.equal(String(filter.participantIds), String(actor));
    if (Array.isArray(update)) assert.equal(options.updatePipeline, true);
  }) as any);
  mock.method(ChatCallRecord, "find", ((filter: any) => {
    assert.equal(String(filter.participantIds), String(actor));
    return query([]);
  }) as any);
  let result: any;
  await listCallHistory(request(), { json: (body: unknown) => { result = body; } } as Response, fail);
  assert.deepEqual(result.calls, []);
});

test("status upload rejects unsupported or oversized media before storage", async () => {
  for (const file of [{ size: 1, mimetype: "application/pdf" }, { size: 21 * 1024 * 1024, mimetype: "image/png" }]) {
    let caught: any;
    await createStory(request({ files: { file }, body: {} }), {} as Response, (error) => { caught = error; });
    assert.ok([413, 415].includes(caught.statusCode));
  }
});

test("JSON-serialized files cannot silently become text-only statuses", async () => {
  let caught: any;
  await createStory(request({ body: { text: "Caption", file: {} } }), {} as Response, (error) => { caught = error; });
  assert.equal(caught.statusCode, 400);
});

test("text status lifetime is assigned by the server, not the client", async () => {
  mock.method(ChatStory, "countDocuments", (async () => 0) as any);
  mock.method(ChatStory, "create", (async (data: any) => {
    assert.equal(String(data.authorId), String(actor));
    assert.ok(Math.abs(+data.expiresAt - Date.now() - 86400000) < 1000);
    return data;
  }) as any);
  const response = { status() { return this; }, json() {} } as unknown as Response;
  await createStory(request({ body: { text: "Update", authorId: author, expiresAt: "2100-01-01" } }), response, fail);
});

test("status inputs restrict length and background values", () => {
  assert.equal(storyInputSchema.parse({ text: "  Update  " }).text, "Update");
  assert.equal(storyInputSchema.safeParse({ text: "a".repeat(701) }).success, false);
  assert.equal(storyInputSchema.safeParse({ background: "url(evil)" }).success, false);
});

test("activity pages are bounded and reject malformed cursors", () => {
  assert.equal(activityPageSchema.parse({}).limit, 30);
  for (const input of [{ limit: 0 }, { limit: 51 }, { limit: 1.5 }, { cursor: "bad" }]) {
    assert.equal(activityPageSchema.safeParse(input).success, false);
  }
});

test("call outcomes distinguish missed, declined, cancelled and completed", () => {
  assert.equal(finishedCallState(true, true, "timeout"), "ENDED");
  assert.equal(finishedCallState(false, true, "timeout"), "MISSED");
  assert.equal(finishedCallState(false, true, "ended"), "CANCELLED");
  assert.equal(finishedCallState(false, false, "declined"), "DECLINED");
  assert.equal(finishedCallState(false, false, "busy"), "BUSY");
});