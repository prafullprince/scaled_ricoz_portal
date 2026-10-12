import assert from "node:assert/strict";
import { test } from "node:test";
import { createMarketingTaskSchema } from "../marketing/marketing.validation.js";
import { createSalesTaskSchema } from "../sales/sales.validation.js";
import { createSalesAccountabilitySchema } from "../sales/sales-accountability.validation.js";
import { createProductEngineeringPipelineItemSchema } from "./product-engineering-pipeline.validation.js";
import { createTaskSchema, createWorkflowTaskSchema, delegateTaskSchema } from "./task.validation.js";

const deadline = new Date(Date.now() + 86_400_000);
const assignedTo = "0123456789abcdef01234567";

test("P1, P2, and P3 are accepted for task assignment across workflows", () => {
  for (const priority of ["P1", "P2", "P3"]) {
    const validations = [
      createTaskSchema.safeParse({ body: {
        title: "Task title",
        description: "Task description",
        deadline,
        assignedTo,
        priority,
      } }),
      createWorkflowTaskSchema.safeParse({ body: {
        title: "Task brief",
        description: "Task description",
        deadline,
        department: "SALES",
        priority,
      } }),
      delegateTaskSchema.safeParse({ body: { subtasks: [{
        title: "Work item",
        description: "Work description",
        deadline,
        assignedToIds: [assignedTo],
        priority,
      }] } }),
      createSalesTaskSchema.safeParse({ body: {
        title: "Sales task",
        description: "Sales task details",
        assignedToIds: [assignedTo],
        deadline,
        priority,
      } }),
      createSalesAccountabilitySchema.safeParse({ body: {
        title: "Sales target",
        description: "Sales target details",
        assignedTo,
        deadline,
        priority,
        kind: "TARGET",
        metric: "REVENUE",
        target: 1000,
        currency: "INR",
        expectedOutcome: "Close revenue",
        leadIds: [],
      } }),
      createMarketingTaskSchema.safeParse({ body: {
        title: "Marketing task",
        description: "Marketing task details",
        assignedToIds: [assignedTo],
        deadline,
        priority,
      } }),
      createProductEngineeringPipelineItemSchema.safeParse({ body: {
        department: "ENGINEERING",
        requestType: "IDEA",
        title: "Engineering request",
        description: "Engineering request details",
        priority,
      } }),
    ];
    assert.ok(validations.every((validation) => validation.success), `Expected ${priority} to be valid for all task assignment flows`);
  }
});

test("legacy task priorities remain accepted during migration to P1/P2/P3", () => {
  for (const priority of ["LOW", "MEDIUM", "HIGH", "URGENT"]) {
    assert.equal(createWorkflowTaskSchema.safeParse({ body: {
      title: "Existing priority",
      description: "Keep legacy tasks compatible",
      deadline,
      priority,
    } }).success, true);
  }
});
