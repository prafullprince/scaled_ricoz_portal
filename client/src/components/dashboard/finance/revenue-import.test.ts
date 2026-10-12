import assert from "node:assert/strict";
import test from "node:test";
import type { RevenueStreamInput } from "../../../services/finance-forecast.service.js";
import { parseRevenueCsv, parseRevenueSheets, type RevenueImportSheet } from "./revenue-import.js";

const headers = [
  "streamId",
  "name",
  "description",
  "unitRevenue",
  "baseUnits",
  "marginPercent",
  "growthType",
  "growthMultiplier",
  "color",
  "startMonth",
  "endMonth",
];

const row = (overrides: Record<string, string | number> = {}) => {
  const values: Record<string, string | number> = {
    streamId: "partner-fees",
    name: "Partner fees",
    description: "Monthly partner onboarding",
    unitRevenue: 1200,
    baseUnits: 10,
    marginPercent: 65,
    growthType: "MULTIPLIER",
    growthMultiplier: 1.25,
    color: "#3478F6",
    startMonth: "Apr",
    endMonth: "Mar",
    ...overrides,
  };
  return headers.map((header) => values[header] ?? "");
};

const existingStream: RevenueStreamInput = {
  streamId: "existing",
  name: "Existing",
  description: "",
  unitRevenue: 1,
  baseUnits: 1,
  marginPercent: 50,
  growthType: "FIXED",
  growthMultiplier: 1,
  color: "#3478F6",
  startMonth: 0,
  endMonth: 11,
};

test("parses streams from every worksheet and normalizes fiscal month names", () => {
  const sheets: RevenueImportSheet[] = [
    { sheet: "Subscriptions", data: [headers, row()] },
    { sheet: "Services", data: [headers, row({ streamId: "service-fees", name: "Service fees", startMonth: "Jan", endMonth: "Mar" })] },
  ];

  const preview = parseRevenueSheets(sheets, [existingStream]);

  assert.deepEqual(preview.issues, []);
  assert.equal(preview.rowsRead, 2);
  assert.deepEqual(preview.sheets, ["Subscriptions", "Services"]);
  assert.deepEqual(preview.streams.map((stream) => [stream.streamId, stream.startMonth, stream.endMonth]), [
    ["partner-fees", 0, 11],
    ["service-fees", 9, 11],
  ]);
  assert.equal(preview.streams[0]?.growthMultiplier, 1.25);
});

test("generates IDs and colors when optional columns are absent", () => {
  const requiredHeaders = ["name", "unitRevenue", "baseUnits", "marginPercent", "growthType", "startMonth", "endMonth"];
  const preview = parseRevenueSheets([{
    sheet: "Revenue",
    data: [
      requiredHeaders,
      ["Licensing", "₹1,200", "2", 0.45, "Fixed (same every month)", "0", "11"],
    ],
  }], []);
  const stream = preview.streams[0];

  assert.equal(preview.issues.length, 0);
  assert.ok(stream?.streamId);
  assert.equal(stream?.color, "#3478F6");
  assert.equal(stream?.unitRevenue, 1200);
  assert.equal(stream?.marginPercent, 45);
  assert.equal(stream?.growthType, "FIXED");
  assert.equal(stream?.growthMultiplier, 1);
});

test("blocks import when the existing forecast would exceed its stream limit", () => {
  const existingStreams = Array.from({ length: 1000 }, (_, index) => ({
    ...existingStream,
    streamId: `existing-${index}`,
  }));
  const preview = parseRevenueSheets([{ sheet: "Revenue", data: [headers, row()] }], existingStreams);

  assert.equal(preview.streams.length, 1);
  assert.ok(preview.issues.some((issue) => issue.message.includes("at most 1,000")));
});

test("rejects duplicate IDs and invalid month ranges before import", () => {
  const preview = parseRevenueSheets([{
    sheet: "Revenue",
    data: [
      headers,
      row({ streamId: "existing" }),
      row({ streamId: "other", startMonth: "Mar", endMonth: "Apr" }),
    ],
  }], [existingStream]);

  assert.equal(preview.streams.length, 0);
  assert.equal(preview.issues.length, 2);
  assert.match(preview.issues[0]?.message ?? "", /already exists/);
  assert.match(preview.issues[1]?.message ?? "", /on or after/);
});

test("reads Excel-compatible CSV content with quoted commas", () => {
  const csv = [
    headers.join(","),
    '"csv-stream","Consulting, retained","Description",1000,3,55,FIXED,1,#3478F6,Apr,Mar',
  ].join("\r\n");

  const preview = parseRevenueCsv(csv, "revenue.csv", []);

  assert.equal(preview.issues.length, 0);
  assert.equal(preview.streams[0]?.name, "Consulting, retained");
  assert.equal(preview.streams[0]?.startMonth, 0);
});
