import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { Company, OrganizationAssignment, OTP } from "../../models/index.js";
import { OtpPurpose } from "../../models/otp.models.js";
import { otpStorageValue } from "../../utils/otp.utils.js";
import { currentScope, setDefaultCompanyId } from "./company.context.js";
import { confirmCompanyOrganizationRemoval } from "./company.controller.js";

afterEach(() => mock.restoreAll());

const actorId = new Types.ObjectId();
setDefaultCompanyId(new Types.ObjectId());

async function invoke(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  companyId: Types.ObjectId,
  body: Record<string, unknown> = {},
) {
  let status = 200;
  let response: unknown;
  let error: unknown;
  const req = {
    params: { id: String(companyId) },
    body,
    authUser: {
      _id: actorId,
      email: "ceo@example.com",
    },
  } as unknown as Request;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      response = value;
      return this;
    },
  } as unknown as Response;
  await handler(req, res, (caught) => {
    error = caught;
  });
  return {
    status,
    response: response as Record<string, unknown> | undefined,
    error: error as { statusCode?: number; message?: string } | undefined,
  };
}

test("company removal OTP deactivates only that company's active assignments and unlinks it", async () => {
  const companyId = new Types.ObjectId();
  const parentCompanyId = new Types.ObjectId();
  const company = {
    _id: companyId,
    isDefault: false,
    name: "Design Demo",
    organizationParentCompanyId: parentCompanyId,
  };
  mock.method(Company, "findOne", (async () => company) as never);
  const validOtp = "123456";
  const otpDoc = {
    _id: new Types.ObjectId(),
    otpHash: otpStorageValue(validOtp),
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    async save() {},
  };
  mock.method(OTP, "findOne", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.purpose, OtpPurpose.COMPANY_ORGANIZATION_REMOVAL);
    assert.equal(filter.subjectId, actorId);
    return otpDoc;
  }) as never);
  mock.method(OTP, "findOneAndDelete", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.otpHash, otpStorageValue(validOtp));
    assert.equal(filter.purpose, OtpPurpose.COMPANY_ORGANIZATION_REMOVAL);
    return { _id: otpDoc._id };
  }) as never);
  const deactivate = mock.method(
    OrganizationAssignment,
    "updateMany",
    ((filter: Record<string, unknown>, update: Record<string, any>) => ({
      then(resolve: (value: { modifiedCount: number }) => unknown) {
        assert.deepEqual(filter, { active: true });
        assert.equal(update.$set.active, false);
        assert.ok(update.$set.effectiveTo instanceof Date);
        assert.equal(String(currentScope()?.companyId), String(companyId));
        resolve({ modifiedCount: 3 });
      },
    })) as never,
  );
  const unlink = mock.method(
    Company,
    "updateOne",
    (async (filter: Record<string, unknown>, update: Record<string, any>) => {
      assert.equal(String(filter.organizationParentCompanyId), String(parentCompanyId));
      assert.equal(update.$set.organizationParentCompanyId, null);
      assert.equal(update.$set.organizationAnchorUserId, null);
      return { modifiedCount: 1 };
    }) as never,
  );

  const removed = await invoke(confirmCompanyOrganizationRemoval, companyId, {
    otp: validOtp,
  });

  assert.equal(removed.error, undefined);
  assert.equal(removed.response?.removedAssignments, 3);
  assert.equal(deactivate.mock.callCount(), 1);
  assert.equal(unlink.mock.callCount(), 1);
});
