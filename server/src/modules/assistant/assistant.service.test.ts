import assert from "node:assert/strict";
import { test } from "node:test";
import { isWebsiteBuildQuestion, wordLimited } from "./assistant.service.js";

test("recognizes educational website build questions", () => {
  assert.equal(isWebsiteBuildQuestion("How to make any website?"), true);
  assert.equal(isWebsiteBuildQuestion("How do I create a web application?"), true);
  assert.equal(isWebsiteBuildQuestion("Show me my pending tasks"), false);
});

test("limits website guides to no more than 800 words", () => {
  const text = Array.from({ length: 805 }, (_, index) => `word${index}`).join(" ");
  const limited = wordLimited(text, 800);
  assert.equal(limited.split(/\s+/).length, 800);
  assert.equal(limited.endsWith("word799"), true);
});
