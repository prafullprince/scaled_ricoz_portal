import { Schema, type Aggregate, type MongooseQueryMiddleware, type Query } from "mongoose";
import { companyCondition, currentScope, type CompanyScope } from "./company.context.js";

const queryMiddleware: MongooseQueryMiddleware[] = [
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "distinct",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
];

// Accounts are shared by every company; only the work attached to them is scoped.
// The stamp records where a person signed up so they land there when they log in.
export function companyHomeStamp(schema: Schema) {
  schema.add({ companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null, index: true } });

  schema.pre("save", function () {
    const scope = currentScope();
    if (scope && this.isNew && !this.get("companyId")) this.set("companyId", scope.companyId);
  });
}

const scopedSchemas = new Set<Schema>();

export function isCompanyScoped(schema: Schema) {
  return scopedSchemas.has(schema);
}

export function companyScoped(schema: Schema) {
  schema.add({ companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null, index: true } });
  scopedSchemas.add(schema);

  const activeScope = () => currentScope();

  const condition = (scope: CompanyScope) => companyCondition(scope);

  schema.pre(queryMiddleware, { document: false, query: true }, function (this: Query<unknown, unknown>) {
    const scope = activeScope();
    if (scope) this.and([condition(scope)]);
  });

  // An upsert never reaches the save hook, and setDefaultsOnInsert would write a null company.
  schema.pre(["findOneAndUpdate", "updateOne", "updateMany"], { document: false, query: true }, function (this: Query<unknown, unknown>) {
    const scope = activeScope();
    if (!scope || !this.getOptions().upsert) return;
    const update = this.getUpdate();
    if (!update || Array.isArray(update)) return;
    this.setUpdate({ ...update, $setOnInsert: { ...(update as Record<string, any>).$setOnInsert, companyId: scope.companyId } });
  });

  schema.pre("aggregate", function (this: Aggregate<unknown>) {
    const scope = activeScope();
    if (!scope) return;
    const [first] = this.pipeline() as unknown as Array<Record<string, unknown>>;
    if (first && ("$geoNear" in first || "$search" in first || "$vectorSearch" in first)) return;
    this.pipeline().unshift({ $match: condition(scope) });
  });

  schema.pre("save", function () {
    const scope = currentScope();
    if (scope && this.isNew && !this.get("companyId")) this.set("companyId", scope.companyId);
  });

  schema.pre("insertMany", function (docs: unknown) {
    const scope = currentScope();
    if (!scope) return;
    for (const doc of (Array.isArray(docs) ? docs : [docs]) as Array<Record<string, unknown>>) {
      if (doc && !doc.companyId) doc.companyId = scope.companyId;
    }
  });
}
