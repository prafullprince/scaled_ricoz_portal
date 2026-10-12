import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { Types } from "mongoose";
import { SalesLead } from "../../models/salesLead.models.js";
import { getSalesAssistantOverview, type SalesAssistantContext } from "./sales-assistant.service.js";

afterEach(() => mock.restoreAll());

test("Sales assistant overview uses only the signed-in user's visible Sales leads", async () => {
  const actorId = new Types.ObjectId();
  const reportId = new Types.ObjectId();
  const context: SalesAssistantContext = {
    userId: String(actorId),
    scope: "TEAM",
    visibleUserIds: [String(actorId), String(reportId)],
  };
  mock.method(SalesLead, "aggregate", (async (pipeline: Array<Record<string, unknown>>) => {
    assert.deepEqual(pipeline[0], {
      $match: {
        department: "SALES",
        ownerId: { $in: [actorId, reportId] },
      },
    });
    assert.ok("$facet" in pipeline[1]!);
    return [{
      totals: [{ totalLeads: 2, openLeads: 1, hotLeads: 1, overdueFollowUps: 1, dueToday: 0 }],
      pipeline: [{ _id: "INR", pipelineValue: 250000, weightedForecast: 125000 }],
      stages: [{ _id: "PROPOSAL", count: 1 }, { _id: "WON", count: 1 }],
    }];
  }) as never);

  const overview = await getSalesAssistantOverview(context);
  assert.equal(overview.scope, "TEAM");
  assert.equal(overview.totalLeads, 2);
  assert.equal(overview.hotLeads, 1);
  assert.deepEqual(overview.pipeline, [{ _id: "INR", pipelineValue: 250000, weightedForecast: 125000 }]);
});
