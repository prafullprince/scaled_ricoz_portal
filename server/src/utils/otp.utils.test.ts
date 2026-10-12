import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { otpMatches, otpStorageValue } from "./otp.utils.js";
import { hashToken } from "./tokens.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

test("OTP values are stored as plain text outside production", () => {
  process.env.NODE_ENV = "development";
  assert.equal(otpStorageValue("123456"), "123456");
  assert.equal(otpMatches("123456", "123456"), true);
  assert.equal(otpMatches("123456", "654321"), false);
});

test("OTP values are hashed in production", () => {
  process.env.NODE_ENV = "production";
  assert.equal(otpStorageValue("123456"), hashToken("123456"));
  assert.equal(otpMatches(hashToken("123456"), "123456"), true);
  assert.equal(otpMatches(hashToken("123456"), "654321"), false);
});
