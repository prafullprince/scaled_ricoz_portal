import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { OrganizationAssignment, SalesLead, User } from "../../models/index.js";
import { addSalesActivity, completeSalesActivity, createSalesLead, getSalesReports, listImportedSalesLeads, listSalesLeads, rescheduleSalesActivity, saveSalesPipeline, updateSalesLead } from "./sales.controller.js";
import { SalesPipeline } from "../../models/salesPipeline.models.js";
import { defaultPipeline } from "./sales.pipeline.js";
import { saveSalesPipelineSchema } from "./sales.validation.js";
import { createSalesActivitySchema, listSalesLeadsSchema, updateSalesLeadSchema } from "./sales.validation.js";
import { runWithCompany, scopeFor, setDefaultCompanyId } from "../company/company.context.js";

afterEach(() => mock.restoreAll());
beforeEach(() => mock.method(SalesPipeline, "findOne", (() => ({ lean: async () => null })) as any));
const actorId = new Types.ObjectId();
const leadId = new Types.ObjectId();
const activityId = new Types.ObjectId();
const query = (value: unknown): any => ({
  populate() { return Promise.resolve(value); },
});
async function run(handler: (req: Request, res: Response, next: (error?: unknown) => void) => unknown, request: object = {}, scope = "OWN") {
  let body: any;
  let error: any;
  let code = 200;
  const response = { locals: { salesAccess: { scope } }, status(value: number) { code = value; return this; }, json(value: unknown) { body = value; return this; } } as unknown as Response;
  await handler({ authUser: { _id: actorId }, params: { leadId: String(leadId), activityId: String(activityId) }, query: {}, body: {}, ...request } as unknown as Request, response, (caught) => { error = caught; });
  return { body, error, code };
}

test("CRM validates bounded pagination, probability and dated follow-ups", () => {
  for (const page of ["NaN", "0", "-1", "1.5"]) assert.equal(listSalesLeadsSchema.safeParse({ query: { page } }).success, false);
  assert.equal(listSalesLeadsSchema.parse({ query: {} }).query.pageSize, 20);
  assert.equal(updateSalesLeadSchema.safeParse({ body: { probability: 101 } }).success, false);
  assert.equal(createSalesActivitySchema.safeParse({ body: { kind: "FOLLOW_UP", text: "Call again" } }).success, false);
  assert.equal(createSalesActivitySchema.safeParse({ body: { kind: "STAGE", text: "Fake stage event" } }).success, false);
});

test("CRM filter queries validate allowlisted properties, operators, values, and dates", () => {
  const filters = JSON.stringify([{ property: "Client Name", operator: "contains", value: "Ada" }]);
  assert.deepEqual(listSalesLeadsSchema.parse({ query: { filters } }).query.filters, [
    { property: "Client Name", operator: "contains", value: "Ada" },
  ]);
  assert.equal(listSalesLeadsSchema.safeParse({ query: { filters: "not json" } }).success, false);
  assert.equal(listSalesLeadsSchema.safeParse({ query: { filters: JSON.stringify([{ property: "Company Name.$where", operator: "contains", value: "x" }]) } }).success, false);
  assert.equal(listSalesLeadsSchema.safeParse({ query: { filters: JSON.stringify([{ property: "Touched Records", operator: "before", value: "2025-01-01" }]) } }).success, false);
  assert.equal(listSalesLeadsSchema.safeParse({ query: { filters: JSON.stringify([{ property: "Created Time", operator: "is", value: "2025-02-30" }]) } }).success, false);
});

test("CRM advanced filters constrain paginated results and preserve the owner scope", async () => {
  const filter = JSON.stringify([{ property: "Client Name", operator: "contains", value: "Ada" }]);
  mock.method(SalesLead, "find", ((query: any) => {
    assert.deepEqual(query.ownerId.$in, [actorId]);
    assert.ok(query.$and.some((condition: any) => condition.$or?.some((entry: any) => entry.name instanceof RegExp && entry.name.test("Ada Lovelace"))));
    return { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [] };
  }) as any);
  mock.method(SalesLead, "countDocuments", (async (query: any) => {
    assert.deepEqual(query.ownerId.$in, [actorId]);
    assert.ok(query.$and.some((condition: any) => condition.$or?.some((entry: any) => entry.name instanceof RegExp && entry.name.test("Ada Lovelace"))));
    return 0;
  }) as any);
  const result = await run(listSalesLeads, { query: { filters: filter } });
  assert.equal(result.error, undefined);
  assert.equal(result.body.pagination.total, 0);
});

test("CRM owner filters resolve visible user names into scoped lead IDs", async () => {
  const ownerId = new Types.ObjectId();
  mock.method(User, "find", ((query: any) => {
    assert.ok(query.$or.some((entry: any) => entry.name instanceof RegExp && entry.name.test("Jordan")));
    return { select() { return this; }, lean: async () => [{ _id: ownerId }] };
  }) as any);
  mock.method(SalesLead, "find", ((query: any) => {
    assert.ok(query.$and.some((condition: any) => condition.$or?.some((entry: any) => entry.ownerId?.$in?.some((id: Types.ObjectId) => String(id) === String(ownerId)))));
    return { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [] };
  }) as any);
  mock.method(SalesLead, "countDocuments", (async () => 0) as any);
  const filters = JSON.stringify([{ property: "Pipeline Record Owner", operator: "contains", value: "Jordan" }]);
  const result = await run(listSalesLeads, { query: { filters } }, "DEPARTMENT");
  assert.equal(result.error, undefined);
});

test("legacy leads hydrate CRM defaults without migration", () => {
  const lead = SalesLead.hydrate({ _id: leadId, name: "Existing lead" });
  assert.equal(lead.pipeline, "Sales");
  assert.equal(lead.probability, 10);
  assert.deepEqual([...lead.activities], []);
});

for (const scope of ["OWN", "TEAM", "DEPARTMENT"]) {
  for (const explicitOwner of [false, true]) {
    test(`${scope} creator can own a lead ${explicitOwner ? "explicitly" : "by default"} without a Sales assignment`, async () => {
      mock.method(OrganizationAssignment, "exists", (() => {
        assert.fail("self-ownership must not require a Sales assignment");
      }) as any);
      mock.method(SalesLead, "create", (async (input: any) => {
        assert.equal(input.ownerId, String(actorId));
        assert.equal(String(input.createdBy), String(actorId));
        assert.equal(input.assignmentHistory[0].newOwner, String(actorId));
        return { ...input, populate: async () => undefined };
      }) as any);
      const result = await run(createSalesLead, {
        body: { name: "Self owned lead", ...(explicitOwner ? { ownerId: String(actorId) } : {}) },
      }, scope);
      assert.equal(result.error, undefined);
      assert.equal(result.code, 201);
    });
  }
}

test("lead creation still rejects a different owner without an active Sales assignment", async () => {
  mock.method(OrganizationAssignment, "exists", (async () => null) as any);
  const result = await run(createSalesLead, { body: { ownerId: String(new Types.ObjectId()) } }, "DEPARTMENT");
  assert.equal(result.error?.statusCode, 400);
});

for (const scope of ["OWN", "DEPARTMENT"]) {
  test(`${scope} activity writes atomically preserve owner scope and actor identity`, async () => {
    mock.method(SalesLead, "findOneAndUpdate", ((filter: any, update: any) => {
      assert.equal(String(filter._id), String(leadId));
      assert.equal(filter.department, "SALES");
      if (scope === "OWN") assert.deepEqual(filter.ownerId.$in, [actorId]);
      else assert.equal(filter.ownerId, undefined);
      assert.deepEqual(filter["activities.499"], { $exists: false });
      assert.equal(String(update.$push.activities.actorId), String(actorId));
      return query({ _id: leadId });
    }) as any);
    const result = await run(addSalesActivity, { body: { kind: "CALL", text: "Discussed pricing" } }, scope);
    assert.equal(result.error, undefined);
    assert.equal(result.code, 201);
  });
}

test("inaccessible activity cannot be logged", async () => {
  mock.method(SalesLead, "findOneAndUpdate", (() => query(null)) as any);
  const result = await run(addSalesActivity, { body: { kind: "NOTE", text: "Hidden" } });
  assert.equal(result.error?.statusCode, 404);
});

test("manager activity scope includes self and only direct active Sales executives", async () => {
  const reportId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "find", ((filter: any) => {
    assert.deepEqual(filter, { reportsTo: actorId, department: "SALES", level: "MEMBER", active: true });
    return { select() { return this; }, lean: async () => [{ userId: reportId }] };
  }) as any);
  mock.method(SalesLead, "findOneAndUpdate", ((filter: any) => {
    assert.deepEqual(filter.ownerId.$in, [actorId, reportId]);
    return query({ _id: leadId });
  }) as any);
  assert.equal((await run(addSalesActivity, { body: { kind: "NOTE", text: "Team note" } }, "TEAM")).error, undefined);
});

test("completion targets only the owned pending non-system activity", async () => {
  const dueAt = new Date("2026-10-10T08:00:00.000Z");
  const lead = new SalesLead({
    _id: leadId,
    ownerId: actorId,
    nextFollowUpAt: dueAt,
    activities: [{ _id: activityId, kind: "FOLLOW_UP", text: "Call customer", actorId, dueAt, completedAt: null }],
  });
  mock.method(SalesLead, "findOne", (async (filter: any) => {
    assert.equal(String(filter._id), String(leadId));
    assert.equal(filter.department, "SALES");
    assert.deepEqual(filter.ownerId.$in, [actorId]);
    assert.equal(String(filter.activities.$elemMatch._id), String(activityId));
    assert.equal(filter.activities.$elemMatch.completedAt, null);
    assert.deepEqual(filter.activities.$elemMatch.kind, { $ne: "STAGE" });
    return lead;
  }) as any);
  mock.method(lead, "save", (async () => lead) as any);
  mock.method(lead, "populate", (async () => lead) as any);
  assert.equal((await run(completeSalesActivity)).error, undefined);
  assert.ok(lead.activities[0]?.completedAt instanceof Date);
  assert.equal(lead.nextFollowUpAt, null);
});

test("rescheduling updates a pending activity and its matching lead follow-up date", async () => {
  const previousDueAt = new Date("2026-10-10T08:00:00.000Z");
  const nextDueAt = new Date("2026-10-11T08:00:00.000Z");
  const lead = new SalesLead({
    _id: leadId,
    ownerId: actorId,
    nextFollowUpAt: previousDueAt,
    activities: [{ _id: activityId, kind: "FOLLOW_UP", text: "Call customer", actorId, dueAt: previousDueAt, completedAt: null }],
  });
  mock.method(SalesLead, "findOne", (async (filter: any) => {
    assert.equal(String(filter._id), String(leadId));
    assert.equal(filter.department, "SALES");
    assert.deepEqual(filter.ownerId.$in, [actorId]);
    assert.equal(String(filter.activities.$elemMatch._id), String(activityId));
    return lead;
  }) as any);
  mock.method(lead, "save", (async () => lead) as any);
  mock.method(lead, "populate", (async () => lead) as any);

  const result = await run(rescheduleSalesActivity, { body: { dueAt: nextDueAt.toISOString() } });
  assert.equal(result.error, undefined);
  assert.equal(lead.activities[0]?.dueAt?.toISOString(), nextDueAt.toISOString());
  assert.equal(lead.nextFollowUpAt?.toISOString(), nextDueAt.toISOString());
});

test("stage changes record history and require a lost reason", async () => {
  const lead = new SalesLead({ _id: leadId, ownerId: actorId, status: "PROPOSAL" });
  mock.method(SalesLead, "findById", (async () => lead) as any);
  const save = mock.method(lead, "save", (async () => lead) as any);
  mock.method(lead, "populate", (async () => lead) as any);
  const denied = await run(updateSalesLead, { body: { status: "LOST" } });
  assert.equal(denied.error?.statusCode, 400);
  assert.equal(save.mock.callCount(), 0);
  const accepted = await run(updateSalesLead, { body: { status: "LOST", lostReason: "Budget withdrawn" } });
  assert.equal(accepted.error, undefined);
  assert.equal(lead.probability, 0);
  assert.equal(lead.activities[0]?.text, "Sales / PROPOSAL -> Sales / LOST");
});

test("owner filters cannot widen an executive's OWN scope", async () => {
  const result = await run(listSalesLeads, { query: { ownerId: String(new Types.ObjectId()) } });
  assert.equal(result.error?.statusCode, 403);
});

test("lead queries escape search patterns and retain pagination", async () => {
  mock.method(SalesLead, "find", ((filter: any) => {
    assert.equal(filter.$or[0].name.source, "Acme\\+Corp");
    assert.deepEqual(filter.$and, [
      { $or: [{ pipeline: "Sales" }, { pipeline: { $exists: false } }] },
      { "assignmentHistory.reason": { $ne: "Lead spreadsheet import" } },
    ]);
    assert.deepEqual(filter.ownerId.$in, [actorId]);
    return { populate() { return this; }, sort() { return this; }, skip(value: number) { assert.equal(value, 20); return this; }, limit() { return this; }, lean: async () => [] };
  }) as any);
  mock.method(SalesLead, "countDocuments", (async () => 21) as any);
  const result = await run(listSalesLeads, { query: { search: "Acme+Corp", page: "2", pipeline: "Sales" } });
  assert.equal(result.error, undefined);
  assert.equal(result.body.pagination.totalPages, 2);
});

test("activity update hook restricts writes to the active company", async () => {
  setDefaultCompanyId(new Types.ObjectId());
  const companyId = new Types.ObjectId();
  const update = SalesLead.findOneAndUpdate({ _id: leadId }, { $push: { activities: { kind: "NOTE", text: "Private", actorId } } });
  const hooks = (SalesLead.schema as any).s.hooks;
  await runWithCompany(scopeFor(companyId), () => hooks.execPre("findOneAndUpdate", update, []));
  assert.deepEqual(update.getFilter().$and, [{ companyId }]);
});

test("reports retain owner scope and group values by currency", async () => {
  mock.method(SalesLead, "aggregate", (async (pipeline: any[]) => {
    assert.deepEqual(pipeline[0].$match.ownerId.$in, [actorId]);
    assert.equal(pipeline[1].$facet.stages[0].$group._id.currency, "$currency");
    assert.equal(pipeline[1].$facet.owners[0].$group._id.key, "$ownerId");
    return [{ stages: [], owners: [], sources: [] }];
  }) as any);
  const result = await run(getSalesReports);
  assert.equal(result.error, undefined);
  assert.equal(result.body.report.scope, "OWN");
});

test("report aggregation hook retains company isolation", async () => {
  setDefaultCompanyId(new Types.ObjectId());
  const companyId = new Types.ObjectId();
  const aggregate = SalesLead.aggregate([{ $match: { department: "SALES" } }]);
  await runWithCompany(scopeFor(companyId), () => (SalesLead.schema as any).s.hooks.execPre("aggregate", aggregate, []));
  assert.deepEqual(aggregate.pipeline()[0], { $match: { companyId } });
});

test("closed deal probability cannot drift when editing the same stage", async () => {
  const lead = new SalesLead({ _id: leadId, ownerId: actorId, status: "WON", probability: 100 });
  mock.method(SalesLead, "findById", (async () => lead) as any);
  mock.method(lead, "save", (async () => lead) as any);
  mock.method(lead, "populate", (async () => lead) as any);
  assert.equal((await run(updateSalesLead, { body: { status: "WON", probability: 5 } })).error, undefined);
  assert.equal(lead.probability, 100);
  assert.equal(lead.activities.length, 0);
});

test("pipeline settings reject duplicate IDs and missing outcomes", () => {
  const pipeline = defaultPipeline();
  assert.equal(saveSalesPipelineSchema.safeParse({ body: pipeline }).success, true);
  pipeline.stages[0]!.key = "WON";
  assert.equal(saveSalesPipelineSchema.safeParse({ body: pipeline }).success, false);
  pipeline.stages = pipeline.stages.filter((stage) => stage.status !== "LOST");
  assert.equal(saveSalesPipelineSchema.safeParse({ body: pipeline }).success, false);
});

test("managers cannot change department pipeline settings", async () => {
  assert.equal((await run(saveSalesPipeline, { params: { key: "Sales" }, body: defaultPipeline() }, "TEAM")).error?.statusCode, 403);
});

test("pipeline settings use compare-and-swap revision protection", async () => {
  const existing = { ...defaultPipeline(), revision: 2 };
  mock.method(SalesPipeline, "findOne", (() => ({ lean: async () => existing })) as any);
  mock.method(SalesPipeline, "findOneAndUpdate", (async (filter: any) => {
    assert.deepEqual(filter, { key: "Sales", revision: 2 });
    return null;
  }) as any);
  const result = await run(saveSalesPipeline, { params: { key: "Sales" }, body: existing }, "DEPARTMENT");
  assert.equal(result.error?.statusCode, 409);
});

test("custom stage movement derives reporting status and probability server-side", async () => {
  const pipeline = defaultPipeline();
  pipeline.stages.unshift({ key: "discovery", name: "Discovery", status: "CONTACTED" as any, probability: 35, archived: false });
  mock.method(SalesPipeline, "findOne", (() => ({ lean: async () => pipeline })) as any);
  const lead = new SalesLead({ _id: leadId, ownerId: actorId, status: "NEW" });
  mock.method(SalesLead, "findById", (async () => lead) as any);
  mock.method(lead, "save", (async () => lead) as any);
  mock.method(lead, "populate", (async () => lead) as any);
  assert.equal((await run(updateSalesLead, { body: { stageId: "discovery", status: "WON", probability: 100 } })).error, undefined);
  assert.equal(lead.stageId, "discovery");
  assert.equal(lead.status, "CONTACTED");
  assert.equal(lead.probability, 35);
});

test("board column filtering includes legacy stages and scope-wide currency totals", async () => {
  mock.method(SalesLead, "find", ((filter: any) => {
    assert.equal(filter.status, "NEW");
    assert.deepEqual(filter.$and[1], { $or: [{ stageId: "NEW" }, { stageId: { $exists: false }, status: "NEW" }] });
    return { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [] };
  }) as any);
  mock.method(SalesLead, "countDocuments", (async () => 53) as any);
  mock.method(SalesLead, "aggregate", (async (pipeline: any[]) => {
    assert.deepEqual(pipeline[0].$match.ownerId.$in, [actorId]);
    return [{ _id: "INR", value: 123000 }];
  }) as any);
  const result = await run(listSalesLeads, { query: { pipeline: "Sales", stageId: "NEW", status: "NEW", board: "true" } });
  assert.equal(result.body.pagination.total, 53);
  assert.deepEqual(result.body.amounts, [{ _id: "INR", value: 123000 }]);
});

test("Sales CRM pipeline results exclude spreadsheet imports reserved for Client Lists", async () => {
  mock.method(SalesLead, "find", ((filter: any) => {
    assert.ok(filter.$and.some((condition: any) => condition["assignmentHistory.reason"]?.$ne === "Lead spreadsheet import"));
    return { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [] };
  }) as any);
  mock.method(SalesLead, "countDocuments", (async () => 0) as any);

  const result = await run(listSalesLeads, { query: { pipeline: "Sales", stageId: "NEW", status: "NEW" } });

  assert.equal(result.error, undefined);
});

test("Client Lists reloads saved imports, including archived rows and source location", async () => {
  const createdAt = new Date("2026-10-01T10:00:00.000Z");
  mock.method(SalesLead, "find", ((filter: any) => {
    assert.equal(filter.department, "SALES");
    assert.equal(filter["assignmentHistory.reason"], "Lead spreadsheet import");
    assert.deepEqual(filter.ownerId.$in, [actorId]);
    return {
      setOptions(options: any) { assert.deepEqual(options, { includeArchived: true }); return this; },
      select(selection: string) { assert.equal(selection, "+externalPayload"); return this; },
      populate() { return this; },
      sort(sort: any) { assert.deepEqual(sort, { createdAt: -1 }); return this; },
      lean: async () => [{
        _id: leadId,
        name: "Saved client",
        company: "Acme",
        email: "client@example.com",
        phone: "+15551234567",
        source: "REFERRAL",
        sourceCategory: "Partner",
        status: "NEW",
        pipeline: "Client Lists",
        expectedValue: 0,
        ownerId: { name: "Sales owner" },
        createdBy: { name: "Importer" },
        lastModifiedBy: { name: "Editor" },
        filterOverrides: { feedback1: "Updated feedback", ref: "REF-2026" },
        externalPayload: {
          "Feedback 1": "Interested",
          "First Name": "Ada",
          "Last Name": "Lovelace",
          "Description": "Wants a demo",
          "Related Record Action": "Imported",
          "Unsubscribed Time": "2026-09-30",
          "Company Address": "42 Analytical Engine Way",
        },
        assignmentHistory: [{ reason: "Lead spreadsheet import", sourceSheet: "Clients", sourceRow: 7 }],
        activities: [],
        createdAt,
        updatedAt: createdAt,
        archivedAt: createdAt,
      }],
    };
  }) as any);

  const result = await run(listImportedSalesLeads);

  assert.equal(result.error, undefined);
  assert.equal(result.body.leads[0].sheet, "Clients");
  assert.equal(result.body.leads[0].row, 7);
  assert.equal(result.body.leads[0].archivedAt, createdAt.toISOString());
  assert.equal(result.body.leads[0].filterValues.feedback1, "Updated feedback");
  assert.equal(result.body.leads[0].filterValues.ref, "REF-2026");
  assert.equal(result.body.leads[0].filterValues.firstname, "Ada");
  assert.equal(result.body.leads[0].filterValues.lastname, "Lovelace");
  assert.equal(result.body.leads[0].filterValues.description, "Wants a demo");
  assert.equal(result.body.leads[0].filterValues.relatedrecordaction, "Imported");
  assert.equal(result.body.leads[0].filterValues.unsubscribedtime, "2026-09-30");
  assert.equal(result.body.leads[0].filterValues.companyaddress, "42 Analytical Engine Way");
  assert.equal(result.body.leads[0].filterValues.modifiedby, "Editor");
});

test("default stage changes remain valid when an older API strips stageId and pipeline", () => {
  const legacyBody = z.object({
    status: z.enum(["NEW", "QUALIFIED", "CONTACTED", "REQUIREMENT", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]).optional(),
  }).refine((value) => Object.keys(value).length > 0, "Provide at least one field");
  for (const stage of defaultPipeline().stages) {
    const body = { pipeline: "Sales", stageId: stage.key, status: stage.status };
    assert.equal(updateSalesLeadSchema.safeParse({ body }).success, true);
    assert.deepEqual(legacyBody.parse(body), { status: stage.status });
  }
  assert.equal(legacyBody.safeParse({ stageId: "QUALIFIED" }).success, false);
});

test("default stage updates persist one destination and record one transition", async () => {
  const lead = new SalesLead({ _id: leadId, ownerId: actorId, status: "NEW" });
  mock.method(SalesLead, "findById", (async () => lead) as any);
  mock.method(lead, "save", (async () => lead) as any);
  mock.method(lead, "populate", (async () => lead) as any);
  const result = await run(updateSalesLead, {
    body: { pipeline: "Sales", stageId: "QUALIFIED", status: "QUALIFIED", qualification: { need: "CRM", budget: "Approved", authority: "Director", timeline: "October" } },
  });
  assert.equal(result.error, undefined);
  assert.equal(lead.stageId, "QUALIFIED");
  assert.equal(lead.status, "QUALIFIED");
  assert.equal(lead.activities.length, 1);
});

test("pipeline settings queries and unique keys are company-scoped", async () => {
  setDefaultCompanyId(new Types.ObjectId());
  const companyId = new Types.ObjectId();
  const query = SalesPipeline.find({ key: "Sales" });
  await runWithCompany(scopeFor(companyId), () => (SalesPipeline.schema as any).s.hooks.execPre("find", query, []));
  assert.deepEqual(query.getFilter().$and, [{ companyId }]);
  assert.ok(SalesPipeline.schema.indexes().some(([keys, options]) => keys.companyId === 1 && keys.key === 1 && options.unique));
});

test("cross-pipeline movement resets to the destination first open stage", async () => {
  const pipeline = defaultPipeline("renewals");
  pipeline.stages[0]!.name = "Renewal enquiry";
  mock.method(SalesPipeline, "findOne", (() => ({ lean: async () => pipeline })) as any);
  const lead = new SalesLead({ _id: leadId, ownerId: actorId, status: "WON", probability: 100 });
  mock.method(SalesLead, "findById", (async () => lead) as any);
  mock.method(lead, "save", (async () => lead) as any);
  mock.method(lead, "populate", (async () => lead) as any);
  assert.equal((await run(updateSalesLead, { body: { pipeline: "renewals" } })).error, undefined);
  assert.equal(lead.pipeline, "renewals");
  assert.equal(lead.stageId, "NEW");
  assert.equal(lead.probability, 10);
});