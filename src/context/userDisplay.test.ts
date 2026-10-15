// Names and role labels come from the database (GET auth/me: name, roleDisplayName); the app's own words are only a
// fallback when a field is missing.

import { emailPrefixName, greetingName, realName, userDisplayName, userRoleLabel } from "./userDisplay";

describe("names", () => {
  it("shows the real name as it is (no digits stripped, no case change)", () => {
    const user = { name: "CEO1", email: "ceo1@worknest.test" };
    expect(realName(user)).toBe("CEO1");
    expect(userDisplayName(user)).toBe("CEO1");
    expect(greetingName(user)).toBe("CEO1");
  });

  it("greets with the first word of a full name, and shows the full name elsewhere", () => {
    const user = { name: "  Sara Khan  ", email: "sara@worknest.test" };
    expect(userDisplayName(user)).toBe("Sara Khan");
    expect(greetingName(user)).toBe("Sara");
  });

  it("falls back to the email prefix (trailing digits stripped, capitalised) only without a name", () => {
    expect(userDisplayName({ email: "ceo1@worknest.test" })).toBe("Ceo");
    expect(greetingName({ name: "  ", email: "sales.manager2@worknest.test" })).toBe("Sales");
    expect(emailPrefixName("12345@x.test")).toBe("12345");
    expect(emailPrefixName(undefined)).toBe("");
  });

  it("uses the fallback when there is neither", () => {
    expect(userDisplayName(null, "Sales Manager")).toBe("Sales Manager");
    expect(userDisplayName({ name: 42 }, "CEO")).toBe("CEO");
    expect(greetingName(undefined)).toBe("");
  });
});

describe("userRoleLabel", () => {
  it("shows WN_Roles.DisplayName from auth/me", () => {
    expect(userRoleLabel({ roleDisplayName: "Sales Manager" }, "sales_manager")).toBe("Sales Manager");
    expect(userRoleLabel({ roleDisplayName: "Chief Executive" }, "ceo")).toBe("Chief Executive");
    expect(userRoleLabel({ roleDisplayName: "Head of Sales" }, "sales_manager")).toBe("Head of Sales");
    expect(userRoleLabel({ roleDisplayName: " Super Admin " }, "super_admin")).toBe("Super Admin");
    expect(userRoleLabel({ roleDisplayName: "Access Officer" }, "access_officer")).toBe("Access Officer");
    expect(userRoleLabel({ roleDisplayName: "Door Desk" }, "access_officer")).toBe("Door Desk");
  });

  it("falls back to the app's label when the field is missing or names another role", () => {
    expect(userRoleLabel({}, "ceo")).toBe("CEO");
    expect(userRoleLabel(null, "sales_manager")).toBe("Sales Manager");
    expect(userRoleLabel({ roleDisplayName: "" }, "admin")).toBe("Admin");
    // Stale: the role changed since auth/me last answered.
    expect(userRoleLabel({ roleDisplayName: "Admin" }, "sales_manager")).toBe("Sales Manager");
    expect(userRoleLabel({}, "access_officer")).toBe("Access Officer");
    expect(userRoleLabel({ roleDisplayName: "Sales Manager" }, "access_officer")).toBe("Access Officer");
  });
});
