import assert from "node:assert/strict";
import test from "node:test";
import { RevenueGrowthType, type IRevenueStream } from "../../models/finance-forecast.models.js";
import { buildRevenueProjection } from "./revenue-projections.js";

const stream = (overrides: Partial<IRevenueStream> = {}): IRevenueStream => ({
  streamId: "partner-fees",
  name: "Partner fees",
  description: "",
  unitRevenue: 2_000_000,
  baseUnits: 10,
  marginPercent: 100,
  growthType: RevenueGrowthType.MULTIPLIER,
  growthMultiplier: 2,
  color: "#3478F6",
  startMonth: 3,
  endMonth: 5,
  ...overrides,
});

test("projects multiplier streams from their start month and leaves inactive months at zero", () => {
  const projection = buildRevenueProjection([stream()]);
  const projectedStream = projection.streams[0];
  assert.ok(projectedStream);

  assert.deepEqual(
    projectedStream.months.slice(2, 7).map((month) => [month.units, month.revenue, month.margin]),
    [
      [0, 0, 0],
      [10, 20_000_000, 20_000_000],
      [20, 40_000_000, 40_000_000],
      [40, 80_000_000, 80_000_000],
      [0, 0, 0],
    ],
  );
  assert.equal(projection.annualRevenue, 140_000_000);
  assert.equal(projection.annualMargin, 140_000_000);
  assert.equal(projection.grossMarginPercent, 100);
  assert.deepEqual(projection.months, ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]);
});

test("fixed streams repeat base units and aggregate annual gross margin across streams", () => {
  const projection = buildRevenueProjection([
    stream(),
    stream({
      streamId: "subscriptions",
      unitRevenue: 3_500_000,
      baseUnits: 2,
      marginPercent: 10,
      growthType: RevenueGrowthType.FIXED,
      growthMultiplier: 1,
      startMonth: 9,
      endMonth: 10,
    }),
  ]);
  const projectedStream = projection.streams[1];
  assert.ok(projectedStream);

  assert.equal(projectedStream.months[9]?.units, 2);
  assert.equal(projectedStream.months[10]?.units, 2);
  assert.equal(projectedStream.months[11]?.units, 0);
  assert.equal(projection.annualRevenue, 154_000_000);
  assert.equal(projection.annualMargin, 141_400_000);
  assert.equal(projection.grossMarginPercent, 141_400_000 / 154_000_000 * 100);
  assert.equal(projection.activeStreams, 2);
});

test("empty forecasts return zero totals without a margin percentage", () => {
  const projection = buildRevenueProjection([]);

  assert.equal(projection.annualRevenue, 0);
  assert.equal(projection.annualMargin, 0);
  assert.equal(projection.grossMarginPercent, 0);
  assert.equal(projection.activeStreams, 0);
  assert.equal(projection.monthlyTotals.length, 12);
});
