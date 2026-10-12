import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { PDFDocument } from "pdf-lib";
import {
  Company,
  EmployeeSalaryProfile,
  OrganizationAssignment,
  PayrollAdjustment,
  Payslip,
  SystemRoleAssignment,
  User,
} from "../../models/index.js";
import { runWithCompany } from "../company/company.context.js";
import {
  downloadMyPayslip,
  generatePayslip,
  getEmployeeFinance,
  listFinanceEmployees,
  listMyPayslips,
} from "./hr-finance.controller.js";

const employeeId = new Types.ObjectId();
const publishedPayslipId = new Types.ObjectId();
const query = (value: unknown) => ({
  select() { return this; },
  sort() { return this; },
  exec: async () => value,
  lean: async () => value,
});

afterEach(() => mock.restoreAll());

function employeeRequest(payslipId?: Types.ObjectId) {
  return {
    authUser: { _id: employeeId, roles: ["EMPLOYEE"] },
    params: payslipId ? { payslipId: String(payslipId) } : {},
  } as unknown as Request;
}

test("employee payslip listing is restricted to published payslips owned by the signed-in employee", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => query({ _id: new Types.ObjectId() })) as any);
  mock.method(Payslip, "find", ((filter: any) => {
    assert.equal(filter.employeeId, employeeId);
    assert.ok(filter.publishedAt.$lte instanceof Date);
    return query([{
      _id: publishedPayslipId,
      payPeriod: "2026-04",
      currency: "INR",
      fileName: "april-2026.pdf",
      fileSize: 1024,
      publishedAt: new Date("2026-05-01T00:00:00.000Z"),
    }]);
  }) as any);
  let response: any;
  let error: unknown;
  const res = { json(value: unknown) { response = value; return this; } } as unknown as Response;

  await listMyPayslips(employeeRequest(), res, (caught) => { error = caught; });

  assert.equal(error, undefined);
  assert.equal(response.payslips.length, 1);
  assert.equal(response.payslips[0].id, String(publishedPayslipId));
  assert.equal("fileData" in response.payslips[0], false);
});

test("employee payslip downloads query by both payslip and signed-in employee ids", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => query({ _id: new Types.ObjectId() })) as any);
  const fileData = Buffer.from("%PDF-1.7");
  mock.method(Payslip, "findOne", ((filter: any) => {
    assert.equal(String(filter._id), String(publishedPayslipId));
    assert.equal(filter.employeeId, employeeId);
    assert.ok(filter.publishedAt.$lte instanceof Date);
    return query({ fileName: "april-2026.pdf", fileData });
  }) as any);
  let headers: Record<string, string> | undefined;
  let downloaded: Buffer | undefined;
  let error: unknown;
  const res = {
    set(value: Record<string, string>) { headers = value; return this; },
    send(value: Buffer) { downloaded = value; return this; },
  } as unknown as Response;

  await downloadMyPayslip(employeeRequest(publishedPayslipId), res, (caught) => { error = caught; });

  assert.equal(error, undefined);
  assert.deepEqual(downloaded, fileData);
  assert.equal(headers?.["Cache-Control"], "private, no-store");
  assert.equal(headers?.["Content-Type"], "application/pdf");
});

test("employees without an active company assignment cannot access payslips", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  const findPayslips = mock.method(Payslip, "find");
  let error: any;

  await listMyPayslips(employeeRequest(), {} as Response, (caught) => { error = caught; });

  assert.equal(error?.statusCode, 403);
  assert.equal(findPayslips.mock.callCount(), 0);
});

test("finance employee listing includes active company employees without organization assignments", async () => {
  const companyId = new Types.ObjectId();
  const companyEmployeeId = new Types.ObjectId();
  const companyInternId = new Types.ObjectId();
  mock.method(SystemRoleAssignment, "exists", (async () => ({ _id: new Types.ObjectId() })) as any);
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  mock.method(User, "find", ((filter: any) => {
    assert.deepEqual(filter.$or, [
      { companyId, roles: { $in: ["EMPLOYEE", "INTERN"] } },
      { _id: { $in: [] } },
    ]);
    return query([
      { _id: companyEmployeeId, name: "Company Employee", email: "employee@example.com", roles: ["USER", "EMPLOYEE"] },
      { _id: companyInternId, name: "Company Intern", email: "intern@example.com", roles: ["USER", "INTERN"] },
    ]);
  }) as any);
  mock.method(EmployeeSalaryProfile, "find", (() => query([])) as any);
  let response: any;
  let error: unknown;
  const req = {
    authUser: { _id: new Types.ObjectId(), roles: ["HR"] },
    companyRoles: ["HR"],
  } as unknown as Request;
  const res = { json(value: unknown) { response = value; return this; } } as unknown as Response;

  await runWithCompany({ companyId, isDefault: false }, () =>
    listFinanceEmployees(req, res, (caught) => { error = caught; }),
  );

  assert.equal(error, undefined);
  assert.deepEqual(response.employees.map((employee: { id: string; role: string }) => employee.role), ["EMPLOYEE", "INTERN"]);
  assert.deepEqual(response.employees.map((employee: { id: string }) => employee.id), [
    String(companyEmployeeId),
    String(companyInternId),
  ]);
});

test("finance employee listing recognizes employment roles stored on company assignments", async () => {
  const companyId = new Types.ObjectId();
  const employeeId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const assignment = {
    userId: employeeId,
    department: "ENGINEERING",
    employmentType: "INTERN",
    roleKeys: ["INTERN"],
  };
  mock.method(SystemRoleAssignment, "exists", (async () => ({ _id: new Types.ObjectId() })) as any);
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  mock.method(OrganizationAssignment, "find", (() => query([assignment])) as any);
  mock.method(User, "find", ((filter: any) => {
    assert.deepEqual(filter.$or[1], { _id: { $in: [String(employeeId)] } });
    return query([{
      _id: employeeId,
      name: "Assigned Intern",
      email: "intern@example.com",
      roles: ["USER"],
    }]);
  }) as any);
  mock.method(EmployeeSalaryProfile, "find", (() => query([])) as any);
  let response: any;
  let error: unknown;
  const req = {
    authUser: { _id: actorId, roles: ["HR"] },
    companyRoles: ["HR"],
  } as unknown as Request;
  const res = { json(value: unknown) { response = value; return this; } } as unknown as Response;

  await runWithCompany({ companyId, isDefault: false }, () =>
    listFinanceEmployees(req, res, (caught) => { error = caught; }),
  );

  assert.equal(error, undefined);
  assert.equal(response.employees.length, 1);
  assert.equal(response.employees[0].role, "INTERN");
  assert.equal(response.employees[0].department, "ENGINEERING");
});

test("finance employee listing includes everyone with an active company organization assignment", async () => {
  const companyId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const assignments = [
    { userId: new Types.ObjectId(), level: "CEO", department: "HR", roleKeys: ["CEO"] },
    { userId: new Types.ObjectId(), level: "HEAD", department: "PRODUCT", roleKeys: ["PRODUCT_HEAD"] },
    { userId: new Types.ObjectId(), level: "MANAGER", department: "ENGINEERING", roleKeys: ["ENGINEERING_MANAGER"] },
    { userId: new Types.ObjectId(), level: "HR", department: "HR", roleKeys: ["HR"] },
    { userId: new Types.ObjectId(), level: "MEMBER", department: "SALES", employmentType: "EMPLOYEE", roleKeys: ["EMPLOYEE"] },
  ];
  mock.method(SystemRoleAssignment, "exists", (async () => ({ _id: new Types.ObjectId() })) as any);
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  mock.method(OrganizationAssignment, "find", (() => query(assignments)) as any);
  mock.method(User, "find", (() => query(assignments.map((assignment, index) => ({
    _id: assignment.userId,
    name: `Person ${index}`,
    email: `person-${index}@example.com`,
    roles: ["USER"],
  })))) as any);
  mock.method(EmployeeSalaryProfile, "find", (() => query([])) as any);
  let response: any;
  let error: unknown;
  const req = {
    authUser: { _id: actorId, roles: ["HR"] },
    companyRoles: ["HR"],
  } as unknown as Request;
  const res = { json(value: unknown) { response = value; return this; } } as unknown as Response;

  await runWithCompany({ companyId, isDefault: false }, () =>
    listFinanceEmployees(req, res, (caught) => { error = caught; }),
  );

  assert.equal(error, undefined);
  assert.deepEqual(response.employees.map((employee: { role: string }) => employee.role), [
    "CEO",
    "PRODUCT_HEAD",
    "ENGINEERING_MANAGER",
    "HR",
    "EMPLOYEE",
  ]);
});

test("finance details can be opened for an active employee account without an organization assignment", async () => {
  const companyId = new Types.ObjectId();
  const employeeId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  mock.method(SystemRoleAssignment, "exists", (async () => ({ _id: new Types.ObjectId() })) as any);
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  mock.method(User, "findOne", ((filter: any) => {
    assert.deepEqual(filter.$or, [
      { companyId, roles: { $in: ["EMPLOYEE", "INTERN"] } },
    ]);
    return query({
      _id: employeeId,
      name: "Company Employee",
      email: "employee@example.com",
      roles: ["USER", "EMPLOYEE"],
    });
  }) as any);
  mock.method(EmployeeSalaryProfile, "findOne", (() => query(null)) as any);
  mock.method(PayrollAdjustment, "find", (() => query([])) as any);
  mock.method(Payslip, "find", (() => query([])) as any);
  let response: any;
  let error: unknown;
  const req = {
    authUser: { _id: actorId, roles: ["HR"] },
    companyRoles: ["HR"],
    params: { employeeId: String(employeeId) },
  } as unknown as Request;
  const res = { json(value: unknown) { response = value; return this; } } as unknown as Response;

  await runWithCompany({ companyId, isDefault: false }, () =>
    getEmployeeFinance(req, res, (caught) => { error = caught; }),
  );

  assert.equal(error, undefined);
  assert.equal(response.employee.id, String(employeeId));
  assert.equal(response.employee.department, null);
  assert.equal(response.salaryStructure, null);
});

test("finance details honor intern role assignments even when the user account has only USER", async () => {
  const companyId = new Types.ObjectId();
  const employeeId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const assignment = {
    userId: employeeId,
    department: "ENGINEERING",
    employmentType: "INTERN",
    roleKeys: ["INTERN"],
  };
  mock.method(SystemRoleAssignment, "exists", (async () => ({ _id: new Types.ObjectId() })) as any);
  mock.method(OrganizationAssignment, "findOne", ((filter: any) =>
    query(String(filter.userId) === String(employeeId) ? assignment : null)) as any);
  mock.method(OrganizationAssignment, "find", (() => query([assignment])) as any);
  mock.method(User, "findOne", ((filter: any) => {
    assert.equal(filter.roles, undefined);
    assert.deepEqual(filter.$or, [
      { companyId, roles: { $in: ["EMPLOYEE", "INTERN"] } },
      { _id: employeeId },
    ]);
    return query({
      _id: employeeId,
      name: "Assigned Intern",
      email: "intern@example.com",
      roles: ["USER"],
    });
  }) as any);
  mock.method(EmployeeSalaryProfile, "findOne", (() => query(null)) as any);
  mock.method(PayrollAdjustment, "find", (() => query([])) as any);
  mock.method(Payslip, "find", (() => query([])) as any);
  let response: any;
  let error: unknown;
  const req = {
    authUser: { _id: actorId, roles: ["HR"] },
    companyRoles: ["HR"],
    params: { employeeId: String(employeeId) },
  } as unknown as Request;
  const res = { json(value: unknown) { response = value; return this; } } as unknown as Response;

  await runWithCompany({ companyId, isDefault: false }, () =>
    getEmployeeFinance(req, res, (caught) => { error = caught; }),
  );

  assert.equal(error, undefined);
  assert.equal(response.employee.role, "INTERN");
  assert.equal(response.employee.department, "ENGINEERING");
});

test("HR generates and publishes a PDF payslip from salary and period adjustments", async () => {
  const companyId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const employeeId = new Types.ObjectId();
  const payslipId = new Types.ObjectId();
  const effectiveFrom = new Date("2026-01-01T00:00:00.000Z");
  const salaryProfile = {
    effectiveFrom,
    currency: "INR",
    components: [{
      type: "BASE",
      label: "Base salary",
      amount: 30_000,
      cadence: "MONTHLY",
    }],
    history: [{
      effectiveFrom,
      changedAt: effectiveFrom,
      currency: "INR",
      components: [{
        type: "BASE",
        label: "Base salary",
        amount: 30_000,
        cadence: "MONTHLY",
      }],
    }],
  };
  const assignment = {
    userId: employeeId,
    level: "MEMBER",
    department: "PRODUCT",
    employmentType: "EMPLOYEE",
    roleKeys: ["EMPLOYEE"],
  };
  const adjustment = {
    _id: new Types.ObjectId(),
    type: "BONUS",
    label: "Performance bonus",
    amount: 2_000,
    currency: "INR",
    payPeriod: "2026-09",
  };
  mock.method(SystemRoleAssignment, "exists", (async () => ({ _id: new Types.ObjectId() })) as any);
  mock.method(OrganizationAssignment, "findOne", ((filter: any) =>
    query(String(filter.userId) === String(employeeId) ? assignment : null)) as any);
  mock.method(OrganizationAssignment, "find", (() => query([assignment])) as any);
  mock.method(User, "findOne", (() => query({
    _id: employeeId,
    name: "Finance Test Employee",
    email: "employee@example.com",
    roles: ["USER"],
  })) as any);
  mock.method(EmployeeSalaryProfile, "findOne", (() => query(salaryProfile)) as any);
  mock.method(PayrollAdjustment, "find", (() => query([adjustment])) as any);
  mock.method(Company, "findById", (() => query({ name: "Ricoz Innovation" })) as any);
  let storedFile: Buffer | undefined;
  mock.method(Payslip, "findOneAndUpdate", ((filter: any, update: any) => {
    assert.equal(String(filter.employeeId), String(employeeId));
    assert.equal(filter.payPeriod, "2026-09");
    storedFile = update.$set.fileData;
    return {
      select() { return this; },
      async lean() {
        const document = await PDFDocument.load(storedFile!);
        assert.equal(document.getTitle(), "Payslip 2026-09 - Finance Test Employee");
        return {
          _id: payslipId,
          payPeriod: "2026-09",
          currency: "INR",
          fileName: update.$set.fileName,
          fileSize: update.$set.fileSize,
          publishedAt: update.$set.publishedAt,
        };
      },
    };
  }) as any);
  const req = {
    authUser: { _id: actorId, roles: ["HR"] },
    companyRoles: ["HR"],
    params: { employeeId: String(employeeId) },
    body: { payPeriod: "2026-09" },
  } as unknown as Request;
  let statusCode = 200;
  let response: any;
  let error: unknown;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { response = value; return this; },
  } as unknown as Response;

  await runWithCompany({ companyId, isDefault: false }, () =>
    generatePayslip(req, res, (caught) => { error = caught; }),
  );

  assert.equal(error, undefined);
  assert.equal(statusCode, 201);
  assert.ok(storedFile?.subarray(0, 5).equals(Buffer.from("%PDF-")));
  assert.equal(response.payslip.id, String(payslipId));
  assert.equal(response.payslip.currency, "INR");
});
