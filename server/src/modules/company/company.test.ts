import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose, { Schema, Types } from "mongoose";
import { currentScope, runWithCompany, scopeFor, setDefaultCompanyId } from "./company.context.js";
import { companyHomeStamp, companyScoped } from "./company.plugin.js";
import { hasOtherCompanyAssignment, isGroupExecutive, resolveUserCompany, clearCompanyCache } from "./company.service.js";
import { Company, HRCompanyAssignment, InvestorCompanyAccess, OrganizationAssignment, SystemRoleAssignment } from "../../models/index.js";
import { requireCompanyCreator } from "./company.controller.js";
import { companySearchGrams, companySearchScore } from "./company.search.js";

const defaultId = new Types.ObjectId();
const invoiceId = new Types.ObjectId();
setDefaultCompanyId(defaultId);

const recordSchema = new Schema({ title: String });
companyScoped(recordSchema);
const Record = mongoose.model("CompanyScopedTestRecord", recordSchema);

const personSchema = new Schema({ name: String, roles: [String] });
companyHomeStamp(personSchema);
const Person = mongoose.model("CompanyScopedTestPerson", personSchema);

type Hooks = { execPre: (name: string, context: unknown, args: unknown[]) => Promise<unknown> };
const hooks = (schema: Schema) => (schema as unknown as { s: { hooks: Hooks } }).s.hooks;

async function filterFor(model: mongoose.Model<any>, schema: Schema) {
  const query = model.find({ title: "x" });
  await hooks(schema).execPre("find", query, []);
  return query.getFilter();
}

afterEach(() => {
  mock.restoreAll();
  clearCompanyCache();
});

describe("company categories and creation access", () => {
  it("indexes company names and categories for search and filtering", () => {
    const indexes = Company.schema.indexes();
    assert.ok(indexes.some(([fields]) => fields.name === "text" && fields.category === "text"));
    assert.ok(indexes.some(([fields]) => fields.category === 1 && fields.active === 1));
    assert.ok(indexes.some(([fields]) => fields.industry === 1 && fields.active === 1));
    assert.ok(indexes.some(([fields]) => fields.searchGrams === 1 && fields.active === 1));
  });

  it("matches small spelling errors in company names and categories", () => {
    const grams = companySearchGrams("Ricoz Innovation", "Technology");
    assert.ok(grams.includes("nn"));
    assert.ok(companySearchScore("Ricoz Innovatoin", "Ricoz Innovation", "Technology") > 0);
    assert.ok(companySearchScore("tecnology", "Ricoz Innovation", "Technology") > 0);
    assert.equal(companySearchScore("finance", "Ricoz Innovation", "Technology"), 0);
  });

  it("allows the Ricoz CEO, Admin, or designated HR to create companies and categories", async () => {
    let adminError: unknown;
    await requireCompanyCreator({ authUser: { _id: new Types.ObjectId(), roles: ["ADMIN"] } } as any, {} as any, (error) => { adminError = error; });
    assert.equal(adminError, undefined);

    let ceoError: unknown;
    await requireCompanyCreator({ authUser: { _id: new Types.ObjectId(), roles: ["CEO"], companyId: defaultId } } as any, {} as any, (error) => { ceoError = error; });
    assert.equal(ceoError, undefined);

    mock.method(SystemRoleAssignment, "exists", (async () => ({ _id: new Types.ObjectId() })) as any);
    let hrError: unknown;
    await requireCompanyCreator({ authUser: { _id: new Types.ObjectId(), roles: ["USER"] } } as any, {} as any, (error) => { hrError = error; });
    assert.equal(hrError, undefined);

    mock.restoreAll();
    mock.method(SystemRoleAssignment, "exists", (async () => null) as any);
    let otherCompanyCeoError: any;
    await requireCompanyCreator({ authUser: { _id: new Types.ObjectId(), roles: ["CEO"], companyId: invoiceId } } as any, {} as any, (error) => { otherCompanyCeoError = error; });
    assert.equal(otherCompanyCeoError?.statusCode, 403);

    let memberError: any;
    await requireCompanyCreator({ authUser: { _id: new Types.ObjectId(), roles: ["EMPLOYEE"] } } as any, {} as any, (error) => { memberError = error; });
    assert.equal(memberError?.statusCode, 403);
  });
});

describe("company scoping plugin", () => {
  it("includes legacy records without companyId in the default company", async () => {
    const filter = await runWithCompany(scopeFor(defaultId), () => filterFor(Record, recordSchema));
    assert.deepEqual(filter.$and, [{ companyId: { $in: [null, defaultId] } }]);
  });

  it("restricts other companies to their own records", async () => {
    const filter = await runWithCompany(scopeFor(invoiceId), () => filterFor(Record, recordSchema));
    assert.deepEqual(filter.$and, [{ companyId: invoiceId }]);
  });

  it("does not filter outside a company context", async () => {
    const filter = await runWithCompany(null, () => filterFor(Record, recordSchema));
    assert.equal(filter.$and, undefined);
  });

  it("leaves accounts visible to every company", async () => {
    const filter = await runWithCompany(scopeFor(invoiceId), () => filterFor(Person, personSchema));
    assert.equal(filter.$and, undefined);
  });

  it("stamps a new account with the company it signed up in", async () => {
    const created = new Person({ name: "New joiner", roles: ["USER"] });
    await runWithCompany(scopeFor(invoiceId), () => hooks(personSchema).execPre("save", created, []));
    assert.equal(String(created.get("companyId")), String(invoiceId));
  });

  it("stamps new documents with the active company only", async () => {
    const created = new Record({ title: "new" });
    await runWithCompany(scopeFor(invoiceId), () => hooks(recordSchema).execPre("save", created, []));
    assert.equal(String(created.get("companyId")), String(invoiceId));

    const existing = Record.hydrate({ _id: new Types.ObjectId(), title: "old", companyId: null });
    await runWithCompany(scopeFor(invoiceId), () => hooks(recordSchema).execPre("save", existing, []));
    assert.equal(existing.get("companyId"), null);
  });

  it("prefixes aggregations with the company match", async () => {
    const aggregate = Record.aggregate([{ $group: { _id: null, total: { $sum: 1 } } }]);
    await runWithCompany(scopeFor(invoiceId), () => hooks(recordSchema).execPre("aggregate", aggregate, []));
    assert.deepEqual(aggregate.pipeline()[0], { $match: { companyId: invoiceId } });
  });

  it("stamps the company on an upsert, which never reaches the save hook", async () => {
    const query = Record.findOneAndUpdate({ title: "x" }, { $set: { title: "y" } }, { upsert: true });
    await runWithCompany(scopeFor(invoiceId), () => hooks(recordSchema).execPre("findOneAndUpdate", query, []));
    assert.deepEqual((query.getUpdate() as Record<string, any>).$setOnInsert, { companyId: invoiceId });
  });

  it("leaves plain updates alone", async () => {
    const query = Record.findOneAndUpdate({ title: "x" }, { $set: { title: "y" } });
    await runWithCompany(scopeFor(invoiceId), () => hooks(recordSchema).execPre("findOneAndUpdate", query, []));
    assert.equal((query.getUpdate() as Record<string, any>).$setOnInsert, undefined);
  });
});

describe("company resolution", () => {
  const invoice = { _id: invoiceId, name: "Ricoz Invoice", slug: "ricoz-invoice", isDefault: false, active: true };
  const ricoz = { _id: defaultId, name: "Ricoz Innovation", slug: "ricoz-innovation", isDefault: true, active: true };

  const mockCompanies = () =>
    mock.method(Company, "findOne", (filter: { _id: string }) => ({
      lean: async () => [invoice, ricoz].find((company) => String(company._id) === String(filter._id)) ?? null,
    }));

  const mockNoHrAccess = () => {
    mock.method(SystemRoleAssignment, "exists", (async () => null) as any);
    mock.method(HRCompanyAssignment, "exists", (async () => null) as any);
  };

  it("only global Admin and the Ricoz CEO can switch without an explicit assignment", () => {
    assert.equal(isGroupExecutive({ roles: ["CEO"], companyId: null }), true);
    assert.equal(isGroupExecutive({ roles: ["CEO"], companyId: defaultId }), true);
    assert.equal(isGroupExecutive({ roles: ["ADMIN"], companyId: invoiceId }), true);
    assert.equal(isGroupExecutive({ roles: ["CEO"], companyId: invoiceId }), false);
    assert.equal(isGroupExecutive({ roles: ["HR"], companyId: null }), false);
  });

  it("switches a group executive to the requested company", async () => {
    mockCompanies();
    const { company, scope } = await resolveUserCompany({ roles: ["ADMIN"], companyId: null }, String(invoiceId));
    assert.equal(company.name, "Ricoz Invoice");
    assert.equal(scope.isDefault, false);
  });

  it("lets the Ricoz CEO select another company without an assignment", async () => {
    mockCompanies();
    const { company } = await resolveUserCompany({ roles: ["CEO"], companyId: defaultId }, String(invoiceId));
    assert.equal(String(company._id), String(invoiceId));
  });

  it("does not let another company's CEO select Ricoz without membership", async () => {
    mockCompanies();
    mockNoHrAccess();
    mock.method(OrganizationAssignment, "exists", (async () => null) as any);
    const { company } = await resolveUserCompany({ _id: new Types.ObjectId(), roles: ["CEO"], companyId: invoiceId }, String(defaultId));
    assert.equal(String(company._id), String(invoiceId));
  });

  it("ignores switch requests from other roles", async () => {
    mockCompanies();
    const { company } = await resolveUserCompany({ roles: ["EMPLOYEE"], companyId: null }, String(invoiceId));
    assert.equal(company.name, "Ricoz Innovation");
  });

  it("keeps members of another company in their home company", async () => {
    mockCompanies();
    const { company } = await resolveUserCompany({ roles: ["EMPLOYEE"], companyId: invoiceId }, String(defaultId));
    assert.equal(company.name, "Ricoz Invoice");
  });

  it("lets a user switch to a company with an active organization assignment", async () => {
    mockCompanies();
    mockNoHrAccess();
    const userId = new Types.ObjectId();
    mock.method(OrganizationAssignment, "exists", (async (filter: any) =>
      String(filter.companyId) === String(invoiceId) ? { _id: new Types.ObjectId() } : null) as any);
    const { company } = await resolveUserCompany({ _id: userId, roles: ["EMPLOYEE"], companyId: defaultId }, String(invoiceId));
    assert.equal(company.name, "Ricoz Invoice");
  });

  it("does not let an assigned user switch to an unassigned company", async () => {
    mockCompanies();
    mockNoHrAccess();
    const userId = new Types.ObjectId();
    mock.method(OrganizationAssignment, "exists", (async () => null) as any);
    const { company } = await resolveUserCompany({ _id: userId, roles: ["EMPLOYEE"], companyId: invoiceId }, String(defaultId));
    assert.equal(company.name, "Ricoz Invoice");
  });

  it("keeps investors inside granted companies even when they request another company", async () => {
    mockCompanies();
    const investorId = new Types.ObjectId();
    mock.method(InvestorCompanyAccess, "find", (() => ({
      select() { return this; },
      sort() { return this; },
      lean: async () => [{ companyId: invoiceId }],
    })) as any);

    const { company } = await resolveUserCompany(
      { _id: investorId, roles: ["INVESTOR"], companyId: defaultId },
      String(defaultId),
    );
    assert.equal(String(company._id), String(invoiceId));
  });

  it("selects the requested company when the investor has an active grant", async () => {
    mockCompanies();
    const investorId = new Types.ObjectId();
    mock.method(InvestorCompanyAccess, "find", (() => ({
      select() { return this; },
      sort() { return this; },
      lean: async () => [{ companyId: invoiceId }, { companyId: defaultId }],
    })) as any);

    const { company } = await resolveUserCompany(
      { _id: investorId, roles: ["INVESTOR"], companyId: defaultId },
      String(defaultId),
    );
    assert.equal(String(company._id), String(defaultId));
  });

  it("reads cross-company assignments before leaving the unscoped context", async () => {
    const userId = new Types.ObjectId();
    const query = {
      select() { return this; },
      lean() { return this; },
      then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) {
        try {
          assert.equal(currentScope(), null);
          resolve([{ companyId: invoiceId }]);
        } catch (error) {
          reject(error);
        }
      },
    };
    mock.method(OrganizationAssignment, "find", (() => query) as any);
    const hasOtherAssignment = await runWithCompany(scopeFor(defaultId), () =>
      hasOtherCompanyAssignment(userId, defaultId),
    );
    assert.equal(hasOtherAssignment, true);
  });

  it("allows designated System HR to switch to any active company", async () => {
    mockCompanies();
    const hrId = new Types.ObjectId();
    mock.method(SystemRoleAssignment, "exists", (async () => ({ _id: new Types.ObjectId() })) as any);
    const assigned = await resolveUserCompany({ _id: hrId, roles: ["USER"], companyId: null }, String(invoiceId));
    const anyActiveCompany = await resolveUserCompany({ _id: hrId, roles: ["USER"], companyId: null }, String(defaultId));
    assert.equal(String(assigned.company._id), String(invoiceId));
    assert.equal(String(anyActiveCompany.company._id), String(defaultId));
  });

  it("keeps non-system company HR within their assigned company", async () => {
    mockCompanies();
    mockNoHrAccess();
    mock.method(OrganizationAssignment, "exists", (async () => null) as any);
    const hr = await resolveUserCompany({ _id: new Types.ObjectId(), roles: ["HR"], companyId: defaultId }, String(invoiceId));
    assert.equal(String(hr.company._id), String(defaultId));
  });
});
