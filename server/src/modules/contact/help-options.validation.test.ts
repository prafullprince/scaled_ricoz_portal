import assert from "node:assert/strict";
import test from "node:test";
import { helpOptionsSchema } from "./help-options.validation.js";

const link = {
  id: "guide",
  title: "Getting started",
  description: "Learn how to use the workspace.",
  url: "/dashboard/my-work",
};

test("help options accept internal dashboard paths and secure external links", () => {
  const parsed = helpOptionsSchema.parse({
    body: {
      selfHelp: [link],
      usefulLinks: [{ ...link, id: "docs", url: "https://docs.example.com" }],
    },
  });
  assert.equal(parsed.body.selfHelp[0]?.url, "/dashboard/my-work");
  assert.equal(parsed.body.usefulLinks[0]?.url, "https://docs.example.com");
});

test("help options reject unsafe external URLs", () => {
  for (const url of ["javascript:alert(1)", "//malicious.example/path", "http://docs.example.com"]) {
    const result = helpOptionsSchema.safeParse({
      body: { selfHelp: [{ ...link, url }], usefulLinks: [] },
    });
    assert.equal(result.success, false, `${url} should not be accepted`);
  }
});

test("help options cap links in each section", () => {
  const result = helpOptionsSchema.safeParse({
    body: { selfHelp: Array.from({ length: 21 }, (_, index) => ({ ...link, id: `guide-${index}` })), usefulLinks: [] },
  });
  assert.equal(result.success, false);
});
