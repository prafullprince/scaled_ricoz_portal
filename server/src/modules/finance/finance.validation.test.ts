import assert from "node:assert/strict";
import test from "node:test";
import { saveRevenueForecastSchema } from "./finance.validation.js";

const stream = (index: number) => ({
  streamId: `stream-${index}`,
  name: `Stream ${index}`,
  description: "",
  unitRevenue: 100,
  baseUnits: 1,
  marginPercent: 50,
  growthType: "FIXED",
  growthMultiplier: 1,
  color: "#3478F6",
  startMonth: 0,
  endMonth: 11,
});

test("accepts up to 1,000 revenue streams", () => {
  const result = saveRevenueForecastSchema.safeParse({
    params: { fiscalYearStart: 2026 },
    body: { streams: Array.from({ length: 1000 }, (_, index) => stream(index)) },
  });

  assert.equal(result.success, true);
});

test("rejects more than 1,000 revenue streams", () => {
  const result = saveRevenueForecastSchema.safeParse({
    params: { fiscalYearStart: 2026 },
    body: { streams: Array.from({ length: 1001 }, (_, index) => stream(index)) },
  });

  assert.equal(result.success, false);
});
