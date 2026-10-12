import assert from "node:assert/strict";
import { test } from "node:test";
import { SalesLeadStatus } from "../../models/salesLead.models.js";
import { assertPipelineRevision, assertSalesStageEvidence, defaultPipeline, pipelineDestination } from "./sales.pipeline.js";

test("custom stages keep distinct identity with compatible report categories", () => {
  const pipeline = defaultPipeline("Renewals");
  pipeline.stages.unshift({ key: "discovery", name: "Discovery call", status: SalesLeadStatus.CONTACTED, probability: 35, archived: false });
  assert.equal(pipelineDestination(pipeline, "discovery").stageId, "discovery");
  assert.equal(pipelineDestination(pipeline, "discovery").status, SalesLeadStatus.CONTACTED);
  assert.equal(pipelineDestination(pipeline, "CONTACTED").stageId, "CONTACTED");
  assert.equal(pipelineDestination(pipeline).probability, 35);
});

test("archived stages and pipelines reject new placements", () => {
  const pipeline = defaultPipeline();
  pipeline.stages[0]!.archived = true;
  assert.throws(() => pipelineDestination(pipeline, "NEW"));
  assert.throws(() => pipelineDestination(pipeline, "unknown"));
  pipeline.archived = true;
  assert.throws(() => pipelineDestination(pipeline));
});

test("stage rename and reorder preserve history; deletion or category changes are rejected", () => {
  const previous = defaultPipeline();
  const next = defaultPipeline();
  next.stages.reverse();
  next.stages[0]!.name = "Closed lost";
  assert.doesNotThrow(() => assertPipelineRevision(previous, next));
  next.stages.pop();
  assert.throws(() => assertPipelineRevision(previous, next));
  const changed = defaultPipeline();
  changed.stages[0]!.status = SalesLeadStatus.WON;
  assert.throws(() => assertPipelineRevision(previous, changed));
});

test("stage evidence is required for qualification, activities, meetings and closing outcomes", () => {
  assert.throws(() => assertSalesStageEvidence({ status: SalesLeadStatus.QUALIFIED }, {}));
  assert.doesNotThrow(() => assertSalesStageEvidence({ status: SalesLeadStatus.QUALIFIED }, { qualification: { need: "CRM", budget: "Approved", authority: "Director", timeline: "October" } }));
  assert.throws(() => assertSalesStageEvidence({ status: SalesLeadStatus.WON }, { expectedValue: 0 }));
  assert.doesNotThrow(() => assertSalesStageEvidence({ status: SalesLeadStatus.WON }, { expectedValue: 100_000_000 }));
  assert.throws(() => assertSalesStageEvidence({ status: SalesLeadStatus.LOST }, {}));
  assert.throws(() => assertSalesStageEvidence({ status: SalesLeadStatus.CONTACTED, stageId: "DEMO_SCHEDULED" }, {}));
  assert.doesNotThrow(() => assertSalesStageEvidence({ status: SalesLeadStatus.CONTACTED, stageId: "DEMO_SCHEDULED" }, { activities: [{ kind: "MEETING", dueAt: new Date() }] }));
  assert.throws(() => assertSalesStageEvidence({ status: SalesLeadStatus.NEW, stageId: "CONTACT_ATTEMPTED" }, { activities: [{ kind: "STAGE" }] }));
  assert.throws(() => assertSalesStageEvidence({ status: SalesLeadStatus.NEW, stageId: "CONTACT_ATTEMPTED" }, { activities: [{ kind: "CALL" }] }));
  assert.doesNotThrow(() => assertSalesStageEvidence({ status: SalesLeadStatus.NEW, stageId: "CONTACT_ATTEMPTED" }, { activities: [{ kind: "CALL", completedAt: new Date() }] }));
});