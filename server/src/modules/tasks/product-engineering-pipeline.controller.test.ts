import assert from "node:assert/strict";
import { test } from "node:test";
import { OrganizationDepartment, OrganizationLevel } from "../../models/organization.models.js";
import { ProductEngineeringPipelineDepartment } from "../../models/product-engineering-pipeline.models.js";
import { UserRole } from "../auth/authorization.js";
import { canMoveProductEngineeringPipelineStage } from "./product-engineering-pipeline.controller.js";

test("only the matching department head or an executive can move stages", () => {
  const productHead = { level: OrganizationLevel.HEAD, department: OrganizationDepartment.PRODUCT };
  const engineeringHead = { level: OrganizationLevel.HEAD, department: OrganizationDepartment.ENGINEERING };

  assert.equal(canMoveProductEngineeringPipelineStage(
    [UserRole.PRODUCT_HEAD],
    productHead,
    ProductEngineeringPipelineDepartment.PRODUCT,
  ), true);
  assert.equal(canMoveProductEngineeringPipelineStage(
    [UserRole.PRODUCT_HEAD],
    productHead,
    ProductEngineeringPipelineDepartment.ENGINEERING,
  ), false);
  assert.equal(canMoveProductEngineeringPipelineStage(
    [UserRole.ENGINEERING_HEAD],
    engineeringHead,
    ProductEngineeringPipelineDepartment.ENGINEERING,
  ), true);
  assert.equal(canMoveProductEngineeringPipelineStage(
    [UserRole.ENGINEERING_MANAGER],
    { ...engineeringHead, level: OrganizationLevel.MANAGER },
    ProductEngineeringPipelineDepartment.ENGINEERING,
  ), false);
  assert.equal(canMoveProductEngineeringPipelineStage(
    [UserRole.CEO],
    null,
    ProductEngineeringPipelineDepartment.PRODUCT,
  ), true);
  assert.equal(canMoveProductEngineeringPipelineStage(
    [UserRole.ADMIN],
    null,
    ProductEngineeringPipelineDepartment.ENGINEERING,
  ), true);
});
