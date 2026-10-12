import assert from "node:assert/strict";
import test from "node:test";
import { registerSchema } from "./auth.validation.js";

test("public signup strips self-assigned roles and account types", () => {
  const parsed = registerSchema.parse({
    body: {
      name: "Normal User",
      email: "normal@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      otp: "123456",
      accountType: "investor",
      roles: ["ADMIN", "CEO"],
      status: "ACTIVE",
      department: "FINANCE",
    },
  });

  assert.deepEqual(parsed.body, {
    name: "Normal User",
    email: "normal@example.com",
    password: "Password123",
    confirmPassword: "Password123",
    otp: "123456",
  });
});