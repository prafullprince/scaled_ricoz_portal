import assert from "node:assert/strict";
import { test } from "node:test";
import { OpportunityType, WorkMode } from "../../models/opportunity.models.js";
import { candidateImportSchema, candidateSourceImportSchema, createDirectApplicationSchema, opportunitySchema } from "./recruitment.validation.js";
import { pipelineFinalSelectionSchema } from "./recruitment-pipeline.validation.js";

for (const type of [OpportunityType.JOB, OpportunityType.INTERNSHIP]) {
  test(`${type} posting accepts omitted compensation and alternate phone`, () => {
    const result = opportunitySchema.parse({
      body: {
        type,
        title: "Product Designer",
        description: "Design and improve clear product experiences.",
        workMode: WorkMode.REMOTE,
      },
    });

    assert.equal(result.body.fixedPayMin, undefined);
    assert.equal(result.body.fixedPayMax, undefined);
    assert.equal(result.body.alternatePhone, undefined);
  });
}

test("opportunity posting accepts nullable compensation and an alternate phone", () => {
  const result = opportunitySchema.parse({
    body: {
      type: OpportunityType.INTERNSHIP,
      title: "Product Designer",
      description: "Design and improve clear product experiences.",
      workMode: WorkMode.REMOTE,
      fixedPayMin: null,
      fixedPayMax: null,
      alternatePhone: "+91 98765 43210",
    },
  });

  assert.equal(result.body.fixedPayMin, null);
  assert.equal(result.body.fixedPayMax, null);
  assert.equal(result.body.alternatePhone, "+91 98765 43210");
});

test("direct candidate intake normalizes email and comma-separated skills", () => {
  const result = createDirectApplicationSchema.parse({
    body: {
      opportunityId: "65b123abcdeffedcba123456",
      name: "Taylor Candidate",
      email: "TAYLOR@example.com",
      phoneNumber: "+91 98765 43210",
      address: "Mumbai, Maharashtra",
      experienceYears: "2.5",
      skills: "React, TypeScript,, Product design ",
      portfolioUrl: "https://portfolio.example.com",
    },
  });

  assert.equal(result.body.email, "taylor@example.com");
  assert.equal(result.body.experienceYears, 2.5);
  assert.deepEqual(result.body.skills, ["React", "TypeScript", "Product design"]);
});

test("direct candidate intake rejects insecure portfolio URLs and malformed opportunity ids", () => {
  const body = {
    opportunityId: "not-an-id",
    name: "Taylor Candidate",
    email: "taylor@example.com",
    phoneNumber: "+91 98765 43210",
    address: "Mumbai, Maharashtra",
    portfolioUrl: "http://portfolio.example.com",
  };

  assert.equal(createDirectApplicationSchema.safeParse({ body }).success, false);
});

test("candidate import requires an applied opportunity and source platform without requiring an address", () => {
  const body = {
    opportunityId: "65b123abcdeffedcba123456",
    name: "Taylor Candidate",
    email: "TAYLOR@example.com",
    phoneNumber: "+91 98765 43210",
    sourcePlatform: "Internshala",
  };
  assert.equal(candidateImportSchema.parse({ body }).body.email, "taylor@example.com");
  assert.equal(candidateImportSchema.safeParse({ body: { ...body, sourcePlatform: "" } }).success, false);
});

test("candidate source import accepts bounded rows and rejects oversized sheets", () => {
  const row = { sheet: "Candidates", rowNumber: 2, values: { name: "Taylor Candidate", email: "taylor@example.com", phoneNumber: "+91 98765 43210", sourcePlatform: "Referral" } };
  assert.equal(candidateSourceImportSchema.parse({
    body: { rows: [row] },
  }).body.rows.length, 1);
  const tooManyColumns = Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`Column ${index + 1}`, "value"]));
  assert.equal(candidateSourceImportSchema.safeParse({
    body: { rows: [{ ...row, values: tooManyColumns }] },
  }).success, false);
  assert.equal(candidateSourceImportSchema.safeParse({
    body: { rows: Array.from({ length: 501 }, (_, index) => ({ ...row, rowNumber: index + 2 })) },
  }).success, false);
});

test("final-selection compensation accepts free-form text and trims it", () => {
  const result = pipelineFinalSelectionSchema.parse({
    params: { pipelineId: "65b123abcdeffedcba123456" },
    body: {
      compensationAmount: " performance based ",
      annualCtc: "3000 anything",
      monthlyGrossSalary: " 50000 ",
      salaryStructureReference: " Performance-based incentive plan ",
    },
  });

  assert.equal(result.body.compensationAmount, "performance based");
  assert.equal(result.body.annualCtc, "3000 anything");
  assert.equal(result.body.monthlyGrossSalary, "50000");
  assert.equal(result.body.salaryStructureReference, "Performance-based incentive plan");
});
