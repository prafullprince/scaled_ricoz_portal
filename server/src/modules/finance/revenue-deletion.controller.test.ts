import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { OTP, RevenueForecast } from "../../models/index.js";
import { OtpPurpose } from "../../models/otp.models.js";
import { otpStorageValue } from "../../utils/otp.utils.js";
import { deleteRevenueStreams, requestRevenueStreamDeletionOtp, saveRevenueForecast } from "./finance.controller.js";

const actorId = new Types.ObjectId();
const companyId = new Types.ObjectId();
const email = "finance.user@example.com";
const streams = Array.from({ length: 6 }, (_, index) => ({
  streamId: `stream-${index}`,
  name: `Stream ${index}`,
  description: "",
  unitRevenue: 100,
  baseUnits: 1,
  marginPercent: 50,
  growthType: "FIXED" as const,
  growthMultiplier: 1,
  color: "#3478F6",
  startMonth: 0,
  endMonth: 11,
}));

function query(value: unknown) {
  return {
    select() { return this; },
    lean: async () => value,
  };
}

async function invoke(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  body: Record<string, unknown>,
) {
  let status = 200;
  let response: unknown;
  let error: unknown;
  const req = {
    params: { fiscalYearStart: "2026" },
    body,
    authUser: { _id: actorId, email, companyId },
    company: { _id: companyId },
  } as unknown as Request;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { response = value; return this; },
  } as unknown as Response;
  await handler(req, res, (caught) => { error = caught; });
  return { status, response: response as Record<string, unknown> | undefined, error: error as { statusCode?: number; message?: string } | undefined };
}

afterEach(() => mock.restoreAll());

test("deleting five or fewer streams does not send an OTP", async () => {
  mock.method(RevenueForecast, "findOne", (() => query({ streams: streams.slice(0, 5) })) as never);
  const saveOtp = mock.method(OTP, "findOneAndUpdate");

  const result = await invoke(requestRevenueStreamDeletionOtp, {
    streamIds: streams.slice(0, 5).map((stream) => stream.streamId),
  });

  assert.equal(result.error?.statusCode, 400);
  assert.equal(saveOtp.mock.callCount(), 0);
});

test("more-than-five deletion requires the correct single-use OTP", async () => {
  const otp = "482916";
  const otpId = new Types.ObjectId();
  let otpConsumed = false;
  let attempts = 0;
  let contextHash = "";
  let deletedOtp = false;
  mock.method(RevenueForecast, "findOne", (() => query({ streams })) as never);
  mock.method(OTP, "findOne", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.email, email);
    assert.equal(filter.purpose, OtpPurpose.REVENUE_STREAM_DELETION);
    contextHash = String(filter.contextHash);
    if (otpConsumed) return null;
    return {
      _id: otpId,
      expiresAt: new Date(Date.now() + 60_000),
      otpHash: otpStorageValue(otp),
      get attempts() { return attempts; },
      set attempts(value: number) { attempts = value; },
      async save() {},
    };
  }) as never);
  mock.method(OTP, "findOneAndDelete", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.otpHash, otpStorageValue(otp));
    assert.equal(filter.contextHash, contextHash);
    deletedOtp = true;
    otpConsumed = true;
    return { _id: filter._id };
  }) as never);
  mock.method(RevenueForecast, "findOneAndUpdate", ((_filter: unknown, update: Record<string, unknown>) => {
    assert.deepEqual(update.$pull, { streams: { streamId: { $in: streams.map((stream) => stream.streamId) } } });
    const updated = { fiscalYearStart: 2026, streams: [], updatedAt: new Date() };
    return query(updated);
  }) as never);

  const target = { streamIds: streams.map((stream) => stream.streamId) };
  const missingOtp = await invoke(deleteRevenueStreams, target);
  assert.equal(missingOtp.error?.statusCode, 428);

  const invalid = await invoke(deleteRevenueStreams, { ...target, otp: "000000" });
  assert.equal(invalid.error?.statusCode, 400);
  assert.equal(deletedOtp, false);
  assert.equal(attempts, 1);

  const deleted = await invoke(deleteRevenueStreams, { ...target, otp });
  assert.equal(deleted.error, undefined);
  assert.equal(deleted.response?.deletedCount, streams.length);
  assert.equal(deletedOtp, true);

  const replay = await invoke(deleteRevenueStreams, { ...target, otp });
  assert.equal(replay.error?.statusCode, 400);
});

test("saving newly uploaded streams preserves existing forecast streams", async () => {
  const existingStreams = [streams[0]!];
  const submittedStreams = [streams[1]!];
  const updatedAt = new Date();
  mock.method(RevenueForecast, "findOne", (() => query({ streams: existingStreams })) as never);
  mock.method(RevenueForecast, "findOneAndUpdate", ((_filter: unknown, update: { $set: { streams: unknown[] } }) => {
    assert.deepEqual(update.$set.streams, [...existingStreams, ...submittedStreams]);
    return query({ fiscalYearStart: 2026, streams: update.$set.streams, updatedAt });
  }) as never);

  const result = await invoke(saveRevenueForecast, { streams: submittedStreams });

  assert.equal(result.error, undefined);
  const forecast = result.response?.forecast as { streams: Array<{ streamId: string }> };
  assert.deepEqual(forecast.streams.map((stream) => stream.streamId), ["stream-0", "stream-1"]);
});

test("omitting saved streams from a save request does not delete them", async () => {
  mock.method(RevenueForecast, "findOne", (() => query({ streams: [streams[0]] })) as never);
  mock.method(RevenueForecast, "findOneAndUpdate", ((_filter: unknown, update: { $set: { streams: unknown[] } }) => {
    assert.deepEqual(update.$set.streams, [streams[0]]);
    return query({ fiscalYearStart: 2026, streams: update.$set.streams, updatedAt: new Date() });
  }) as never);

  const result = await invoke(saveRevenueForecast, { streams: [] });

  assert.equal(result.error, undefined);
  const forecast = result.response?.forecast as { streams: Array<{ streamId: string }> };
  assert.deepEqual(forecast.streams.map((stream) => stream.streamId), ["stream-0"]);
});

test("additive saves enforce the 1,000-stream forecast limit", async () => {
  const existingStreams = Array.from({ length: 1_000 }, (_, index) => ({
    ...streams[index % streams.length]!,
    streamId: `existing-${index}`,
  }));
  mock.method(RevenueForecast, "findOne", (() => query({ streams: existingStreams })) as never);
  const update = mock.method(RevenueForecast, "findOneAndUpdate");

  const result = await invoke(saveRevenueForecast, { streams: [streams[0]] });

  assert.equal(result.error?.statusCode, 400);
  assert.match(result.error?.message ?? "", /at most 1,000 revenue streams/);
  assert.equal(update.mock.callCount(), 0);
});
