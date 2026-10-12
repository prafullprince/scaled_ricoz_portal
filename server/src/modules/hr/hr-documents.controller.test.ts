import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { HrDocument, HrDocumentStatus, HrDocumentType } from "../../models/index.js";
import { runWithCompany } from "../company/company.context.js";
import { downloadMyHrDocument, publishHrDocument } from "./hr-documents.controller.js";

const query = (value: unknown) => ({
  select() { return this; },
  exec: async () => value,
});

afterEach(() => mock.restoreAll());

test("HR document queries are restricted to the active company", async () => {
  const companyId = new Types.ObjectId();
  const query = HrDocument.find({ status: HrDocumentStatus.DRAFT });
  type Hooks = { execPre: (name: string, context: unknown, args: unknown[]) => Promise<unknown> };
  const hooks = (HrDocument.schema as unknown as { s: { hooks: Hooks } }).s.hooks;

  await runWithCompany({ companyId, isDefault: false }, () => hooks.execPre("find", query, []));

  assert.deepEqual(query.getFilter().$and, [{ companyId }]);
});

function ownDocumentRequest(employeeId: Types.ObjectId, documentId: Types.ObjectId) {
  return {
    authUser: { _id: employeeId, roles: ["EMPLOYEE"] },
    companyRoles: ["EMPLOYEE"],
    params: { documentId: String(documentId) },
  } as unknown as Request;
}

test("employees cannot download another person's published HR document", async () => {
  const employeeId = new Types.ObjectId();
  const documentId = new Types.ObjectId();
  mock.method(HrDocument, "findById", (() => query({
    _id: documentId,
    employeeId: new Types.ObjectId(),
    status: HrDocumentStatus.PUBLISHED,
    publishedAt: new Date(),
    fileName: "private-document.pdf",
    fileData: Buffer.from("%PDF-1.7"),
  })) as any);
  let downloaded = false;
  let error: unknown;
  const res = {
    set() { return this; },
    send() { downloaded = true; return this; },
  } as unknown as Response;

  await downloadMyHrDocument(ownDocumentRequest(employeeId, documentId), res, (caught) => { error = caught; });

  assert.equal(downloaded, false);
  assert.equal((error as { statusCode?: number } | undefined)?.statusCode, 404);
});

test("employees can download only their own published HR document", async () => {
  const employeeId = new Types.ObjectId();
  const documentId = new Types.ObjectId();
  const fileData = Buffer.from("%PDF-1.7");
  mock.method(HrDocument, "findById", (() => query({
    _id: documentId,
    employeeId,
    status: HrDocumentStatus.PUBLISHED,
    publishedAt: new Date(Date.now() - 1000),
    fileName: "my-document.pdf",
    fileData,
  })) as any);
  let downloaded: Buffer | undefined;
  let error: unknown;
  const res = {
    set() { return this; },
    send(value: Buffer) { downloaded = value; return this; },
  } as unknown as Response;

  await downloadMyHrDocument(ownDocumentRequest(employeeId, documentId), res, (caught) => { error = caught; });

  assert.equal(error, undefined);
  assert.deepEqual(downloaded, fileData);
});

test("publishing a document transitions the draft and records the publisher", async () => {
  const actorId = new Types.ObjectId();
  const documentId = new Types.ObjectId();
  const employeeId = new Types.ObjectId();
  const draft: {
    _id: Types.ObjectId;
    employeeId: Types.ObjectId;
    type: HrDocumentType;
    title: string;
    referenceNumber: string;
    issueDate: Date;
    effectiveDate: Date | null;
    status: HrDocumentStatus;
    fileName: string;
    fileSize: number;
    publishedAt: Date | null;
    publishedBy: Types.ObjectId | null;
    createdAt: Date;
    save: () => Promise<void>;
  } = {
    _id: documentId,
    employeeId,
    type: HrDocumentType.APPOINTMENT_LETTER,
    title: "Appointment Letter",
    referenceNumber: "RICOZ-HR-2026-12345678",
    issueDate: new Date("2026-10-08T00:00:00.000Z"),
    effectiveDate: null,
    status: HrDocumentStatus.DRAFT,
    fileName: "appointment-letter.pdf",
    fileSize: 1024,
    publishedAt: null,
    publishedBy: null,
    createdAt: new Date(),
    save: async () => undefined,
  };
  mock.method(HrDocument, "findById", (() => query(draft)) as any);
  let response: any;
  let error: unknown;
  const req = {
    authUser: { _id: actorId, roles: ["CEO"] },
    companyRoles: ["CEO"],
    params: { documentId: String(documentId) },
  } as unknown as Request;
  const res = { json(value: unknown) { response = value; return this; } } as unknown as Response;

  await publishHrDocument(req, res, (caught) => { error = caught; });

  assert.equal(error, undefined);
  assert.equal(draft.status, HrDocumentStatus.PUBLISHED);
  assert.equal(draft.publishedBy, actorId);
  assert.ok(draft.publishedAt instanceof Date);
  assert.equal(response.document.status, HrDocumentStatus.PUBLISHED);
});
