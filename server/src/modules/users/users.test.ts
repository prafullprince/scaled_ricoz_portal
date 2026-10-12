import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { OrganizationAssignment, Session, User } from "../../models/index.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { categoryOf, deleteUser, requireDirectoryAccess, updateUserStatus, updateUserProfile } from "./users.controller.js";

const actorId = new Types.ObjectId();
const targetId = new Types.ObjectId();

function response() {
  const payload: { status?: number; body?: unknown } = {};
  return {
    locals: {},
    json(body: unknown) {
      payload.body = body;
      return this;
    },
    status(code: number) {
      payload.status = code;
      return this;
    },
    payload,
  } as any;
}

function request(target: Record<string, unknown>, actorRoles: string[] = [UserRole.CEO]) {
  return {
    params: { id: String(targetId) },
    body: target,
    authUser: { _id: actorId, roles: actorRoles },
    query: {},
  } as any;
}

function targetUser(roles: string[], id = targetId) {
  return { _id: id, name: "Target", roles, status: UserStatus.ACTIVE, save: mock.fn(async () => {}) };
}

afterEach(() => mock.restoreAll());

describe("profile edits", () => {
  for (const role of [UserRole.CEO, UserRole.ADMIN]) {
    it(`${role} can edit name and about without changing access roles`, async () => {
      const user = { ...targetUser([UserRole.EMPLOYEE]), about: "Before" };
      mock.method(User, "findById", async () => user);
      let error: unknown;
      await updateUserProfile(request({ name: "Updated", about: "New profile" }, [role]), response(), (value) => { error = value; });
      assert.equal(error, undefined);
      assert.equal(user.name, "Updated");
      assert.equal(user.about, "New profile");
      assert.deepEqual(user.roles, [UserRole.EMPLOYEE]);
    });
  }
  it("HR directory access does not permit profile edits", async () => {
    const load = mock.method(User, "findById");
    let error: any;
    await updateUserProfile(request({ name: "Updated", about: "" }, [UserRole.HR_HEAD]), response(), (value) => { error = value; });
    assert.equal(error?.statusCode, 403);
    assert.equal(load.mock.callCount(), 0);
  });
});

describe("user categories", () => {
  it("treats group executives as department people everywhere", () => {
    assert.equal(categoryOf([UserRole.CEO]), "department");
    assert.equal(categoryOf([UserRole.ADMIN]), "department");
  });

  it("only counts a lead as department staff inside the company that placed them", () => {
    assert.equal(categoryOf([UserRole.PRODUCT_HEAD], "HEAD"), "department");
    assert.equal(categoryOf([UserRole.EMPLOYEE, UserRole.PRODUCT_HEAD], null), "employee");
    assert.equal(categoryOf([UserRole.PRODUCT_HEAD], null), "user");
  });

  it("separates employees, interns, and plain users", () => {
    assert.equal(categoryOf([UserRole.USER, UserRole.EMPLOYEE], "MEMBER"), "employee");
    assert.equal(categoryOf([UserRole.USER, UserRole.INTERN], "MEMBER"), "intern");
    assert.equal(categoryOf([UserRole.USER]), "user");
    assert.equal(categoryOf([UserRole.INVESTOR]), "user");
  });
});

describe("directory access", () => {
  it("allows executives", async () => {
    let passed = false;
    await requireDirectoryAccess(request({}, [UserRole.ADMIN]), response(), () => {
      passed = true;
    });
    assert.equal(passed, true);
  });

  it("rejects managers outside HR", async () => {
    mock.method(OrganizationAssignment, "findOne", () => ({ select: () => ({ lean: async () => null }) }));
    const error = await new Promise((resolve) =>
      requireDirectoryAccess(request({}, [UserRole.SALES_MANAGER]), response(), resolve),
    );
    assert.equal((error as { statusCode: number }).statusCode, 403);
  });
});

describe("status and deletion guards", () => {
  it("suspends an account and clears its sessions", async () => {
    const user = targetUser([UserRole.USER, UserRole.EMPLOYEE]);
    mock.method(User, "findById", async () => user);
    const clear = mock.method(Session, "deleteMany", async () => ({ deletedCount: 2 }));
    const res = response();
    await updateUserStatus(request({ status: UserStatus.SUSPENDED }), res, () => {});
    assert.equal(user.status, UserStatus.SUSPENDED);
    assert.equal(clear.mock.callCount(), 1);
    assert.deepEqual((res.payload.body as { user: unknown }).user, {
      id: String(targetId),
      name: "Target",
      status: UserStatus.SUSPENDED,
    });
  });

  it("protects CEO and Admin accounts", async () => {
    mock.method(User, "findById", async () => targetUser([UserRole.ADMIN]));
    const error = await new Promise((resolve) =>
      updateUserStatus(request({ status: UserStatus.SUSPENDED }), response(), resolve),
    );
    assert.equal((error as { statusCode: number }).statusCode, 403);
  });

  it("refuses to change your own account", async () => {
    mock.method(User, "findById", async () => targetUser([UserRole.EMPLOYEE], actorId));
    const error = await new Promise((resolve) =>
      updateUserStatus(request({ status: UserStatus.SUSPENDED }), response(), resolve),
    );
    assert.equal((error as { statusCode: number }).statusCode, 400);
  });

  it("blocks deletion while the person still has active reports", async () => {
    mock.method(User, "findById", async () => targetUser([UserRole.PRODUCT_MANAGER]));
    mock.method(OrganizationAssignment, "exists", async () => ({ _id: new Types.ObjectId() }));
    const error = await new Promise((resolve) => deleteUser(request({}), response(), resolve));
    assert.equal((error as { statusCode: number }).statusCode, 409);
  });
});
