// Role -> navigator routing (RootNavigator): a CEO gets the CEO navigator and a Sales Manager the Sales Manager
// navigator, never the customer, staff (or each other's) ones.

import { STAFF_ROLES, isStaffRole, resolveRole, type UserRole } from "../context/roles";
import { navigatorForRole } from "./roleNavigator";
import { STAFF_ROUTE_ROLES, moreMenuFor, routesFor, tabsFor, canOpenRoute } from "./staff/access";
import { staffLinkTarget } from "./staff/links";
import type { StaffRouteName } from "./staffTypes";

describe("navigatorForRole", () => {
  it("sends each role to its own navigator", () => {
    expect(navigatorForRole("ceo")).toBe("ceo");
    expect(navigatorForRole("sales_manager")).toBe("sales_manager");
    expect(navigatorForRole("super_admin")).toBe("super_admin");
    expect(navigatorForRole("admin")).toBe("admin");
    expect(navigatorForRole("sales_executive")).toBe("sales_executive");
    expect(navigatorForRole("general")).toBe("customer");
    expect(navigatorForRole(null)).toBe("customer");
    expect(navigatorForRole(undefined)).toBe("customer");
  });

  it("a CEO never gets the customer or a staff navigator", () => {
    const nav = navigatorForRole("ceo");
    expect(nav).not.toBe("customer");
    for (const staff of STAFF_ROLES) expect(nav).not.toBe(staff);
  });

  it.each([
    [{ role: "ceo" }],
    [{ role: "CEO" }],
    [{ role: "17" }],
    [{ roles: ["ceo"] }],
    [{ roles: "general, ceo" }],
    [{ role: "general", roles: ["ceo"] }],
    [{ roles: ["super_admin", "ceo"] }],
    [{ role: "admin", isAdmin: true, userType: "CEO" }],
  ])("a signed-in CEO (%p) lands in the CEO navigator", (user) => {
    expect(navigatorForRole(resolveRole(user))).toBe("ceo");
  });

  it("only the staff roles reach a staff navigator, and the customer app is everyone else's", () => {
    const roles: UserRole[] = ["general", "sales_executive", "admin", "super_admin", "sales_manager", "ceo"];
    for (const role of roles) {
      const nav = navigatorForRole(role);
      expect(nav === "sales_executive" || nav === "admin" || nav === "super_admin").toBe(isStaffRole(role));
    }
    expect(isStaffRole("ceo")).toBe(false);
    expect(isStaffRole("sales_manager")).toBe(false);
  });

  it("each role reaches exactly one navigator, and only sales_manager reaches the Sales Manager one", () => {
    const roles: UserRole[] = ["general", "sales_executive", "admin", "super_admin", "sales_manager", "ceo"];
    for (const role of roles) expect(navigatorForRole(role) === "sales_manager").toBe(role === "sales_manager");
  });
});

describe("the Sales Manager navigator", () => {
  it("a Sales Manager never gets the customer, a staff or the CEO navigator", () => {
    const nav = navigatorForRole("sales_manager");
    expect(nav).not.toBe("customer");
    expect(nav).not.toBe("ceo");
    for (const staff of STAFF_ROLES) expect(nav).not.toBe(staff);
  });

  it.each([
    [{ role: "sales_manager" }],
    [{ role: "Sales Manager" }],
    [{ role: "18" }],
    [{ roles: ["sales_manager"] }],
    [{ roles: "general, Sales Manager" }],
    [{ role: "general", roles: ["sales_manager"] }],
    [{ roles: ["super_admin", "sales_manager"] }],
    [{ roles: ["admin", "sales_executive", "18"] }],
    [{ role: "admin", isAdmin: true, userType: "SalesManager" }],
  ])("a signed-in Sales Manager (%p) lands in the Sales Manager navigator", (user) => {
    expect(navigatorForRole(resolveRole(user))).toBe("sales_manager");
  });

  it("an account that is also the CEO gets the CEO app", () => {
    expect(navigatorForRole(resolveRole({ roles: ["sales_manager", "ceo"] }))).toBe("ceo");
  });
});

describe("the staff navigators' access rules give a Sales Manager nothing", () => {
  // StaffRole excludes "sales_manager" at compile time; this checks the runtime tables as well.
  const salesManager = "sales_manager" as unknown as (typeof STAFF_ROLES)[number];

  it("no tab, pushed screen or More menu", () => {
    expect(tabsFor(salesManager)).toEqual([]);
    expect(routesFor(salesManager)).toEqual([]);
    expect(moreMenuFor(salesManager)).toEqual([]);
    for (const route of Object.keys(STAFF_ROUTE_ROLES) as StaffRouteName[]) expect(canOpenRoute(salesManager, route)).toBe(false);
  });

  it("no staff screen from a link", () => {
    for (const path of ["dashboard", "quotation/12", "bookings", "customers", "inquiries", "invoice/3", "admin/kyc", "profile", ""]) {
      expect(staffLinkTarget(path, salesManager)).toBeNull();
    }
  });
});

describe("the staff navigators' access rules give a CEO nothing", () => {
  // StaffRole excludes "ceo" at compile time; this checks the runtime tables as well.
  const ceo = "ceo" as unknown as (typeof STAFF_ROLES)[number];

  it("no tab, pushed screen or More menu", () => {
    expect(tabsFor(ceo)).toEqual([]);
    expect(routesFor(ceo)).toEqual([]);
    expect(moreMenuFor(ceo)).toEqual([]);
    for (const route of Object.keys(STAFF_ROUTE_ROLES) as StaffRouteName[]) expect(canOpenRoute(ceo, route)).toBe(false);
  });

  it("no staff screen from a link", () => {
    for (const path of ["dashboard", "quotation/12", "bookings", "customers", "invoice/3", "admin/kyc", "profile", ""]) {
      expect(staffLinkTarget(path, ceo)).toBeNull();
    }
  });
});
