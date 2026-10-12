import {
  hasRole,
  isAdminOrAbove,
  isLocationBound,
  isStaffRole,
  isSuperAdmin,
  normalizeRoleName,
  resolveRole,
  roleLabel,
  rolesOf,
} from "./roles";

describe("normalizeRoleName", () => {
  it.each([
    ["super_admin", "super_admin"],
    ["SuperAdmin", "super_admin"],
    ["superadmin", "super_admin"],
    ["Super Admin", "super_admin"],
    ["super-admin", "super_admin"],
    ["1", "super_admin"],
    ["admin", "admin"],
    ["Admin", "admin"],
    ["Administrator", "admin"],
    ["2", "admin"],
    ["sales_executive", "sales_executive"],
    ["SalesExecutive", "sales_executive"],
    ["Sales Executive", "sales_executive"],
    ["16", "sales_executive"],
    ["general", "general"],
    ["general_user", "general"],
    ["customer", "general"],
    ["14", "general"],
    ["Receptionist", "general"],
    ["receptionist", "general"],
  ])("maps %p to %p", (input, expected) => {
    expect(normalizeRoleName(input)).toBe(expected);
  });

  it("returns null for unknown or empty values", () => {
    expect(normalizeRoleName("")).toBeNull();
    expect(normalizeRoleName("   ")).toBeNull();
    expect(normalizeRoleName(null)).toBeNull();
    expect(normalizeRoleName(undefined)).toBeNull();
    expect(normalizeRoleName("manager")).toBeNull();
    expect(normalizeRoleName("99")).toBeNull();
  });
});

describe("resolveRole", () => {
  it("is general for no user or a user without a role", () => {
    expect(resolveRole(null)).toBe("general");
    expect(resolveRole(undefined)).toBe("general");
    expect(resolveRole({})).toBe("general");
    expect(resolveRole({ role: "something-else" })).toBe("general");
  });

  it("keeps super admin distinct from admin", () => {
    expect(resolveRole({ role: "super_admin" })).toBe("super_admin");
    expect(resolveRole({ role: "SuperAdmin" })).toBe("super_admin");
    expect(resolveRole({ role: "admin" })).toBe("admin");
    expect(resolveRole({ role: "Admin" })).toBe("admin");
  });

  it("reads the sales executive role in both spellings", () => {
    expect(resolveRole({ role: "sales_executive" })).toBe("sales_executive");
    expect(resolveRole({ role: "SalesExecutive" })).toBe("sales_executive");
  });

  it("reads roles from a roles array, a comma list, userType and userRole", () => {
    expect(resolveRole({ roles: ["super_admin"] })).toBe("super_admin");
    expect(resolveRole({ roles: "general, SalesExecutive" })).toBe("sales_executive");
    expect(resolveRole({ userType: "Admin" })).toBe("admin");
    expect(resolveRole({ userRole: "SuperAdmin" })).toBe("super_admin");
  });

  it("picks the highest role when several are present (as the CMS guard does)", () => {
    expect(resolveRole({ roles: ["sales_executive", "admin"] })).toBe("admin");
    expect(resolveRole({ role: "admin", roles: ["super_admin"] })).toBe("super_admin");
    expect(resolveRole({ role: "general", roles: ["sales_executive"] })).toBe("sales_executive");
  });

  it("treats the legacy isAdmin flag as admin", () => {
    expect(resolveRole({ isAdmin: true })).toBe("admin");
    expect(resolveRole({ isAdmin: "true" })).toBe("admin");
    expect(resolveRole({ isAdmin: false })).toBe("general");
    expect(resolveRole({ isAdmin: "true", role: "super_admin" })).toBe("super_admin");
  });

  it("gives a receptionist the customer app", () => {
    expect(resolveRole({ role: "receptionist" })).toBe("general");
  });
});

describe("rolesOf / hasRole", () => {
  it("lists every known role, highest first, without duplicates", () => {
    expect(rolesOf({ role: "admin", roles: ["Admin", "sales_executive", "x"] })).toEqual(["admin", "sales_executive"]);
    expect(rolesOf(null)).toEqual([]);
  });

  it("matches an exact role", () => {
    const user = { role: "super_admin" };
    expect(hasRole(user, "super_admin")).toBe(true);
    expect(hasRole(user, "admin")).toBe(false);
    expect(hasRole({ roles: ["SalesExecutive"] }, "sales_executive")).toBe(true);
  });
});

describe("role predicates", () => {
  it("isStaffRole", () => {
    expect(isStaffRole("sales_executive")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("super_admin")).toBe(true);
    expect(isStaffRole("general")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });

  it("isAdminOrAbove", () => {
    expect(isAdminOrAbove("admin")).toBe(true);
    expect(isAdminOrAbove("super_admin")).toBe(true);
    expect(isAdminOrAbove("sales_executive")).toBe(false);
    expect(isAdminOrAbove("general")).toBe(false);
  });

  it("isSuperAdmin", () => {
    expect(isSuperAdmin("super_admin")).toBe(true);
    expect(isSuperAdmin("admin")).toBe(false);
  });

  it("isLocationBound: admins and sales executives, not super admins", () => {
    expect(isLocationBound("sales_executive")).toBe(true);
    expect(isLocationBound("admin")).toBe(true);
    expect(isLocationBound("super_admin")).toBe(false);
    expect(isLocationBound("general")).toBe(false);
  });

  it("roleLabel", () => {
    expect(roleLabel("super_admin")).toBe("Super Admin");
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("sales_executive")).toBe("Sales Executive");
    expect(roleLabel("general")).toBe("Customer");
  });
});
