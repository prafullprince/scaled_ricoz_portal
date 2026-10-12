import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../../utils/apiError.utils.js";
import { ApplicationStatus } from "../../models/application.models.js";
import { RecruitmentPipelineStage as Stage } from "../../models/recruitment-pipeline.models.js";
import {
  allChecksResolved,
  applicationStatusForRecruitmentStage,
  assertRecruitmentStageTransition,
  recruitmentStageOrder,
} from "./recruitment-pipeline.service.js";

test("recruitment candidates can only advance one stage at a time", () => {
  for (let index = 0; index < recruitmentStageOrder.length - 1; index += 1) {
    assert.doesNotThrow(() => assertRecruitmentStageTransition(
      recruitmentStageOrder[index]!,
      recruitmentStageOrder[index + 1]!,
    ));
  }
  assert.throws(
    () => assertRecruitmentStageTransition(Stage.NEW_APPLICATION, Stage.SHORTLISTED),
    (error: unknown) => error instanceof ApiError && error.statusCode === 409,
  );
  assert.throws(
    () => assertRecruitmentStageTransition(Stage.ACTIVE, Stage.REJECTED),
    (error: unknown) => error instanceof ApiError && error.statusCode === 409,
  );
});

test("rejection is available before activation and always requires a reason at the route", () => {
  assert.doesNotThrow(() => assertRecruitmentStageTransition(Stage.SCREENING, Stage.REJECTED));
  assert.throws(
    () => assertRecruitmentStageTransition(Stage.REJECTED, Stage.NEW_APPLICATION),
    (error: unknown) => error instanceof ApiError && error.statusCode === 409,
  );
});

test("application review status follows the recruitment stage", () => {
  assert.equal(applicationStatusForRecruitmentStage(Stage.NEW_APPLICATION), ApplicationStatus.APPLIED);
  assert.equal(applicationStatusForRecruitmentStage(Stage.SCREENING), ApplicationStatus.APPLIED);
  assert.equal(applicationStatusForRecruitmentStage(Stage.INTERVIEW), ApplicationStatus.UNDER_REVIEW);
  assert.equal(applicationStatusForRecruitmentStage(Stage.OFFER), ApplicationStatus.ACCEPTED);
  assert.equal(applicationStatusForRecruitmentStage(Stage.REJECTED), ApplicationStatus.DECLINED);
});

test("checklist gates require each item to be completed or explicitly waived", () => {
  assert.equal(allChecksResolved(["COMPLETE", "WAIVED"]), true);
  assert.equal(allChecksResolved(["COMPLETE", "PENDING"]), false);
  assert.equal(allChecksResolved([]), true);
});
