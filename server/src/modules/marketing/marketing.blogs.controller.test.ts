import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { MarketingBlog } from "../../models/index.js";
import { currentScope, runWithCompany } from "../company/company.context.js";
import { getPublishedMarketingBlogs } from "./marketing.blogs.controller.js";

afterEach(() => mock.restoreAll());

test("published blog feed includes all companies and is not capped", async () => {
  const defaultCompanyId = new Types.ObjectId();
  const otherCompanyId = new Types.ObjectId();
  const now = new Date("2026-10-08T00:00:00.000Z");
  const records = Array.from({ length: 60 }, (_, index) => ({
    _id: new Types.ObjectId(),
    title: `Story ${index + 1}`,
    description: "Published story",
    thumbnail: "https://example.com/story.jpg",
    details: "",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    companyId: index % 2 ? otherCompanyId : defaultCompanyId,
  }));
  let responseBody: unknown;
  let handlerError: unknown;
  let scopeAtQueryExecution = currentScope();

  mock.method(MarketingBlog, "find", ((filter: Record<string, unknown>) => {
    assert.deepEqual(filter, { published: true });
    assert.equal(currentScope(), null);
    return {
      select() {
        return this;
      },
      sort() {
        return this;
      },
      lean() {
        return {
          then(resolve: (value: typeof records) => void) {
            scopeAtQueryExecution = currentScope();
            resolve(records);
          },
        };
      },
    };
  }) as never);

  const response = {
    json(value: unknown) {
      responseBody = value;
      return this;
    },
  } as unknown as Response;

  await runWithCompany(
    { companyId: defaultCompanyId, isDefault: true },
    () =>
      getPublishedMarketingBlogs(
        {} as Request,
        response,
        (error) => {
          handlerError = error;
        },
      ),
  );
  assert.equal(handlerError, undefined);
  assert.equal(handlerError, undefined);
  const responseBlogs = responseBody as { blogs: Array<{ id: string }> };
  const firstRecord = records.at(0);
  const firstReturnedBlog = responseBlogs.blogs.at(0);
  assert.ok(firstRecord);
  assert.ok(firstReturnedBlog);
  assert.equal(scopeAtQueryExecution, null);
  assert.equal(responseBlogs.blogs.length, records.length);
  assert.equal(firstReturnedBlog.id, String(firstRecord._id));
});
