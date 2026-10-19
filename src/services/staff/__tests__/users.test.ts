// Users create / edit (CMS manage.ts "users", API UserController / UserService): who may do what, the form rules
// and messages, and the request bodies. The transport is mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn() }));
jest.mock("../../apiClient", () => {
  class ApiError extends Error {
    status: number;
    details?: unknown;
    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }
  return {
    ApiError,
    apiRequest: jest.fn(),
    friendlyApiMessage: (_status: number, payload: any) => payload?.message ?? "Something went wrong. Please try again.",
    serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
  };
});

import { apiRequest, ApiError } from "../../apiClient";
import {
  assignableLocations,
  buildCreateUserPayload,
  buildUpdateUserPayload,
  canChangeUserStatus,
  canEditUser,
  canManageUsers,
  createUser,
  editsOwnAccountAsAdmin,
  fallbackRoleOptions,
  getRoleOptions,
  isLocationRole,
  locationRoleNames,
  newUserInput,
  normalizeRoleOptions,
  normalizeUser,
  resolveUserLocations,
  roleOptionLabel,
  rolesICanAssign,
  setUserActive,
  toggleUserLocation,
  updateUser,
  userLocationLocked,
  userToInput,
  validateUserInput,
  withRole,
  type RoleOption,
  type UserFormContext,
  type UserInput,
} from "../users";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());
const lastCall = () => {
  const [path, options] = api.mock.calls[api.mock.calls.length - 1];
  return { path, ...options };
};

const ROLES_RESPONSE = {
  isSuccessful: true,
  data: [
    { id: 1, roleName: "super_admin", displayName: "Super Administrator" },
    { id: 2, roleName: "admin", displayName: "Branch Admin" },
    { id: 14, roleName: "general", displayName: "General User" },
    { id: 16, roleName: "sales_executive", displayName: "Sales Exec" },
    { id: 17, roleName: "ceo", displayName: "Chief Executive" },
    { id: 18, roleName: "sales_manager", displayName: "" },
    { id: 99, roleName: "receptionist", displayName: "Front Desk" },
    { id: 2, roleName: "Admin", displayName: "Duplicate" },
  ],
};
const OPTIONS: RoleOption[] = normalizeRoleOptions(ROLES_RESPONSE);

const SUPER = { role: "super_admin" as const, email: "boss@worknest.pk" };
const ADMIN = { role: "admin" as const, email: "Admin@WorkNest.pk " };

const row = (over: Partial<Record<string, unknown>> = {}) =>
  normalizeUser({ publicId: "c0ffee00-0000-4000-8000-000000000001", email: "sara@x.pk", name: "Sara", role: "sales_executive", locationId: 2, locationIds: [2, 4], ...over });

const ctxFor = (over: Partial<UserFormContext> = {}): UserFormContext => {
  const callerRole = over.callerRole ?? "super_admin";
  return {
    callerRole,
    editing: false,
    ownAccount: false,
    assignableLocationIds: [2, 4, 7],
    assignableRoles: rolesICanAssign(callerRole, OPTIONS),
    roleOptions: OPTIONS,
    ...over,
  };
};

const input = (over: Partial<UserInput> = {}): UserInput => ({
  name: "Sara Khan",
  email: "sara@x.pk",
  password: "secret1",
  role: "general",
  locationId: null,
  locationIds: [],
  phone: "",
  cnicOrPassport: "",
  cityId: null,
  address: "",
  notes: "",
  ...over,
});

describe("role options (GET roles, labels from WN_Roles.DisplayName)", () => {
  it("keeps the API's order and labels, drops unknown roles and repeats, and keeps the ones it left out", () => {
    expect(OPTIONS.map((o) => o.value)).toEqual(["super_admin", "admin", "general", "sales_executive", "ceo", "sales_manager", "access_officer"]);
    expect(OPTIONS.find((o) => o.value === "admin")?.label).toBe("Branch Admin");
    // A blank display name and a role the API did not send: the app's own label as a fallback.
    expect(OPTIONS.find((o) => o.value === "sales_manager")?.label).toBe("Sales Manager");
    expect(OPTIONS.find((o) => o.value === "access_officer")?.label).toBe("Access Officer");
    expect(OPTIONS.some((o) => o.label === "Front Desk")).toBe(false);
  });

  it("works from a bare array, and falls back to the app's labels", () => {
    expect(normalizeRoleOptions([{ Id: 16, RoleName: "SalesExecutive", DisplayName: "Sales Team" }])[0]).toEqual({ value: "sales_executive", label: "Sales Team" });
    expect(fallbackRoleOptions().map((o) => o.value)).toEqual(normalizeRoleOptions(null).map((o) => o.value));
  });

  it("GET roles", async () => {
    api.mockResolvedValueOnce(ROLES_RESPONSE);
    const options = await getRoleOptions();
    expect(lastCall()).toMatchObject({ path: "/roles", method: "GET", requiresAuth: true });
    expect(options[0]).toEqual({ value: "super_admin", label: "Super Administrator" });
  });

  it("labels and the location-bound role names come from the options", () => {
    expect(roleOptionLabel(OPTIONS, "SalesExecutive")).toBe("Sales Exec");
    expect(locationRoleNames(OPTIONS)).toBe("Branch Admin, Sales Exec, Sales Manager and Access Officer");
    expect(["admin", "sales_executive", "sales_manager", "access_officer"].every(isLocationRole)).toBe(true);
    expect(["super_admin", "ceo", "general", "receptionist"].some(isLocationRole)).toBe(false);
  });
});

describe("who may do what (CMS rolesICanAssign / canEditUser / canLockOrDeleteUser)", () => {
  it("only admins and super admins manage users", () => {
    expect(canManageUsers("super_admin")).toBe(true);
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("sales_executive")).toBe(false);
  });

  it("a super admin gives every role; an admin only Sales Executive and General User; others none", () => {
    expect(rolesICanAssign("super_admin", OPTIONS)).toHaveLength(OPTIONS.length);
    expect(rolesICanAssign("admin", OPTIONS).map((o) => o.value)).toEqual(["general", "sales_executive"]);
    expect(rolesICanAssign("sales_executive", OPTIONS)).toEqual([]);
  });

  it("an admin edits their own account and the users below them, never a protected account", () => {
    expect(canEditUser(ADMIN, row())).toBe(true);
    expect(canEditUser(ADMIN, row({ role: "general" }))).toBe(true);
    for (const role of ["admin", "super_admin", "ceo", "sales_manager", "access_officer"]) {
      expect(canEditUser(ADMIN, row({ role, email: "other@x.pk" }))).toBe(false);
      expect(canEditUser(SUPER, row({ role, email: "other@x.pk" }))).toBe(true);
    }
    // Own account: matched on the email, case and spaces ignored.
    expect(canEditUser(ADMIN, row({ role: "admin", email: "admin@worknest.pk" }))).toBe(true);
    expect(canEditUser({ role: "sales_executive", email: "s@x.pk" }, row({ role: "general" }))).toBe(false);
  });

  it("nobody turns their own account off; an admin can't turn off protected accounts", () => {
    expect(canChangeUserStatus(ADMIN, row())).toBe(true);
    expect(canChangeUserStatus(ADMIN, row({ role: "admin", email: "admin@worknest.pk" }))).toBe(false);
    expect(canChangeUserStatus(ADMIN, row({ role: "ceo" }))).toBe(false);
    expect(canChangeUserStatus(SUPER, row({ role: "ceo" }))).toBe(true);
    expect(canChangeUserStatus(SUPER, row({ role: "super_admin", email: "boss@worknest.pk" }))).toBe(false);
  });

  it("editing your own account as an admin (not as a super admin) leaves out role and locations", () => {
    const me = row({ role: "admin", email: "admin@worknest.pk" });
    expect(editsOwnAccountAsAdmin(ADMIN, me)).toBe(true);
    expect(editsOwnAccountAsAdmin(ADMIN, row())).toBe(false);
    expect(editsOwnAccountAsAdmin(ADMIN, null)).toBe(false);
    expect(editsOwnAccountAsAdmin(SUPER, row({ role: "super_admin", email: "boss@worknest.pk" }))).toBe(false);
  });
});

describe("locations (admins give only their own)", () => {
  const locations = [{ id: 2, name: "Gulberg" }, { id: 4, name: "DHA" }, { id: 7, name: "Johar Town" }];

  it("super admin: every location; admin: their own; admin without known ids: the API's (already scoped) list", () => {
    expect(assignableLocations("super_admin", [2], locations)).toHaveLength(3);
    expect(assignableLocations("admin", [4, 9], locations).map((l) => l.id)).toEqual([4]);
    expect(assignableLocations("admin", [], locations)).toHaveLength(3);
    expect(assignableLocations("admin", null, locations)).toHaveLength(3);
  });

  it("an admin with one location is locked to it", () => {
    expect(userLocationLocked("admin", [4])).toBe(true);
    expect(userLocationLocked("admin", [2, 4])).toBe(false);
    expect(userLocationLocked("super_admin", [4])).toBe(false);
  });

  it("a new user starts as a customer with the admin's location ready", () => {
    expect(newUserInput("admin", [4])).toMatchObject({ role: "general", locationId: 4, locationIds: [4], password: "" });
    expect(newUserInput("admin", [2, 4], 4)).toMatchObject({ locationId: 4, locationIds: [4] });
    expect(newUserInput("admin", [2, 4], 9)).toMatchObject({ locationId: null, locationIds: [] });
    expect(newUserInput("super_admin", [2, 4], 2)).toMatchObject({ locationId: null, locationIds: [] });
  });

  it("changing the role clears the locations of a role without them, and fixes the only one when locked", () => {
    const start = input({ role: "sales_executive", locationId: 2, locationIds: [2, 4] });
    expect(withRole(start, "general", ctxFor())).toMatchObject({ role: "general", locationId: null, locationIds: [] });
    expect(withRole(start, "admin", ctxFor())).toMatchObject({ role: "admin", locationIds: [2, 4] });
    expect(withRole(input(), "sales_executive", { callerRole: "admin", assignableLocationIds: [7] })).toMatchObject({ locationId: 7, locationIds: [7] });
  });

  it("ticking and unticking; nothing changes while locked", () => {
    const ctx = ctxFor();
    const one = toggleUserLocation(input({ role: "admin" }), 4, true, ctx);
    expect(one.locationIds).toEqual([4]);
    expect(toggleUserLocation(toggleUserLocation(one, 7, true, ctx), 4, false, ctx).locationIds).toEqual([7]);
    const locked = { callerRole: "admin" as const, assignableLocationIds: [4] };
    expect(toggleUserLocation(one, 4, false, locked)).toBe(one);
  });

  it("resolves the primary location and keeps an admin to their own", () => {
    expect(resolveUserLocations(input({ role: "admin", locationId: 4, locationIds: [2, 4] }), ctxFor())).toEqual({ locationId: 4, locationIds: [2, 4] });
    expect(resolveUserLocations(input({ role: "admin", locationId: 9, locationIds: [7, 2] }), ctxFor())).toEqual({ locationId: 7, locationIds: [7, 2] });
    expect(resolveUserLocations(input({ role: "general", locationId: 2, locationIds: [2] }), ctxFor())).toEqual({ locationId: null, locationIds: [] });
    const admin = ctxFor({ callerRole: "admin", assignableLocationIds: [2, 4] });
    expect(resolveUserLocations(input({ role: "sales_executive", locationId: 5, locationIds: [5, 4] }), admin)).toEqual({ locationId: 4, locationIds: [4] });
    const locked = ctxFor({ callerRole: "admin", assignableLocationIds: [4] });
    expect(resolveUserLocations(input({ role: "sales_executive", locationIds: [] }), locked)).toEqual({ locationId: 4, locationIds: [4] });
  });
});

describe("validation (CMS messages)", () => {
  it("create: name, email and a password of 6 to 128 characters", () => {
    expect(validateUserInput(input({ name: " ", email: "", password: "" }), ctxFor())).toEqual({
      name: "Full Name is required.",
      email: "Email address is required.",
      password: "Password is required for new users.",
    });
    expect(validateUserInput(input({ email: "sara@x" }), ctxFor()).email).toBe("Please enter a valid email address (e.g. user@example.com).");
    expect(validateUserInput(input({ password: "12345" }), ctxFor()).password).toBe("The password must be 6 to 128 characters.");
    expect(validateUserInput(input({ password: "x".repeat(129) }), ctxFor()).password).toBe("The password must be 6 to 128 characters.");
    expect(validateUserInput(input({ password: "123456" }), ctxFor())).toEqual({});
    expect(validateUserInput(input({ password: "x".repeat(128) }), ctxFor())).toEqual({});
  });

  it("edit: a blank password keeps the current one; a typed one follows the same rule; the email is not checked", () => {
    const edit = ctxFor({ editing: true });
    expect(validateUserInput(input({ password: "", email: "" }), edit)).toEqual({});
    expect(validateUserInput(input({ password: "   " }), edit)).toEqual({});
    expect(validateUserInput(input({ password: "abc" }), edit).password).toBe("The password must be 6 to 128 characters.");
  });

  it("phone and CNIC follow the shared rules when given", () => {
    const errors = validateUserInput(input({ phone: "0300", cnicOrPassport: "123" }), ctxFor());
    expect(errors.phone).toMatch(/at least 11 digits/);
    expect(errors.cnicOrPassport).toMatch(/13 digits/);
  });

  it("the role must be one the signed-in user may give", () => {
    const admin = ctxFor({ callerRole: "admin", assignableLocationIds: [2, 4] });
    expect(validateUserInput(input({ role: "admin", locationIds: [2] }), admin).role).toBe("Choose a role.");
    expect(validateUserInput(input({ role: "ceo" }), admin).role).toBe("Choose a role.");
    expect(validateUserInput(input({ role: "ceo" }), ctxFor())).toEqual({});
  });

  it("location-bound roles need a location (worded for the admin, or with the role's database label)", () => {
    expect(validateUserInput(input({ role: "sales_executive" }), ctxFor()).locationIds).toBe("Location is required for Sales Exec role.");
    const admin = ctxFor({ callerRole: "admin", assignableLocationIds: [2, 4] });
    expect(validateUserInput(input({ role: "sales_executive", locationIds: [9] }), admin).locationIds).toBe("Choose at least one of your locations.");
    expect(validateUserInput(input({ role: "sales_executive", locationIds: [4] }), admin)).toEqual({});
  });

  it("your own account as an admin: role and locations are not checked", () => {
    const own = ctxFor({ callerRole: "admin", editing: true, ownAccount: true, assignableLocationIds: [] });
    expect(validateUserInput(input({ role: "admin", password: "" }), own)).toEqual({});
  });
});

describe("request bodies", () => {
  it("POST user: the CMS body, blanks as null, trimmed", () => {
    const body = buildCreateUserPayload(
      input({ name: " Sara Khan ", email: " sara@x.pk ", password: " secret1 ", role: "sales_executive", locationId: 4, locationIds: [2, 4], phone: " ", cityId: 0, notes: " VIP " }),
      ctxFor(),
    );
    expect(body).toEqual({
      name: "Sara Khan",
      email: "sara@x.pk",
      password: "secret1",
      role: "sales_executive",
      locationId: 4,
      locationIds: [2, 4],
      cityId: null,
      phone: null,
      cnicOrPassport: null,
      address: null,
      notes: "VIP",
    });
  });

  it("PUT user: no email; the password only when typed; no role or locations on your own account as an admin", () => {
    const edit = ctxFor({ editing: true });
    const kept = buildUpdateUserPayload(input({ password: "", role: "general", cityId: 3, cnicOrPassport: "35202-1234567-1" }), edit);
    expect(kept).toEqual({ name: "Sara Khan", role: "general", locationId: null, locationIds: [], cityId: 3, phone: null, cnicOrPassport: "35202-1234567-1", address: null, notes: null });
    expect("email" in kept).toBe(false);
    expect("password" in kept).toBe(false);
    expect(buildUpdateUserPayload(input({ password: "newpass" }), edit)).toMatchObject({ password: "newpass" });
    const own = buildUpdateUserPayload(input({ password: "newpass", role: "admin" }), ctxFor({ callerRole: "admin", editing: true, ownAccount: true }));
    expect(own).toEqual({ name: "Sara Khan", cityId: null, phone: null, cnicOrPassport: null, address: null, notes: null, password: "newpass" });
  });

  it("userToInput: the row's values; CNIC, city, address and notes blank (kept on save); no password", () => {
    expect(userToInput(row({ phone: "03001234567" }))).toEqual({
      name: "Sara",
      email: "sara@x.pk",
      password: "",
      role: "sales_executive",
      locationId: 2,
      locationIds: [2, 4],
      phone: "03001234567",
      cnicOrPassport: "",
      cityId: null,
      address: "",
      notes: "",
    });
    expect(userToInput(row({ locationIds: [], locationId: 7 })).locationIds).toEqual([7]);
    expect(userToInput(row({ role: "Receptionist" })).role).toBe("general");
  });
});

describe("calls (the API's messages as they are)", () => {
  it("createUser: POST user; an account turned back on keeps the API's message", async () => {
    const restored = "This email had a deleted account. It has been turned back on with these details.";
    api.mockResolvedValueOnce({ isSuccessful: true, message: restored, data: { id: 41, publicId: "g-41", email: "sara@x.pk", restored: true } });
    const result = await createUser(input(), ctxFor());
    expect(lastCall()).toMatchObject({ path: "/user", method: "POST", body: expect.objectContaining({ email: "sara@x.pk", password: "secret1", role: "general" }) });
    expect(result).toEqual({ message: restored, data: { id: 41, publicId: "g-41", restored: true } });

    api.mockResolvedValueOnce({ isSuccessful: true, message: "User created successfully.", data: { id: 42, publicId: "g-42" } });
    expect((await createUser(input(), ctxFor())).data.restored).toBe(false);
  });

  it("createUser checks the form before calling the API", async () => {
    await expect(createUser(input({ password: "" }), ctxFor())).rejects.toThrow("Password is required for new users.");
    expect(api).not.toHaveBeenCalled();
  });

  it("updateUser: PUT user/{publicId} and the API's message", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "User updated. Password changed.", data: null });
    const user = row();
    const result = await updateUser(user.id, input({ password: "newpass", role: "sales_executive", locationIds: [2] }), ctxFor({ editing: true }));
    expect(lastCall()).toMatchObject({
      path: "/user/c0ffee00-0000-4000-8000-000000000001",
      method: "PUT",
      body: expect.objectContaining({ password: "newpass", role: "sales_executive", locationIds: [2], locationId: 2 }),
    });
    expect(result.message).toBe("User updated. Password changed.");
  });

  it("updateUser passes the API's refusal on as it is (e.g. the PW_01 database update note)", async () => {
    const note =
      "Database update needed: run the script PW_01_user_password_TEST (PW_01_user_password_LIVE on the live database). The other changes were saved; the password was not changed.";
    api.mockRejectedValueOnce(new ApiError(note, 200, { isSuccessful: false, message: note }));
    await expect(updateUser(5, input({ password: "newpass" }), ctxFor({ editing: true }))).rejects.toThrow(note);
    expect(lastCall().path).toBe("/user/5");
  });

  it("updateUser rejects a short new password without calling the API", async () => {
    await expect(updateUser(5, input({ password: "abc" }), ctxFor({ editing: true }))).rejects.toThrow("The password must be 6 to 128 characters.");
    expect(api).not.toHaveBeenCalled();
  });

  it("setUserActive: PATCH activate / deactivate with an empty body", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "User deactivated." });
    expect((await setUserActive("g-1", false)).message).toBe("User deactivated.");
    expect(lastCall()).toMatchObject({ path: "/user/g-1/deactivate", method: "PATCH", body: {} });
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Success" });
    expect((await setUserActive(7, true)).message).toBe("User activated.");
    expect(lastCall().path).toBe("/user/7/activate");
  });
});
