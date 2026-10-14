// Role -> navigator routing (RootNavigator): a CEO gets the CEO navigator and never the customer or staff ones.

import { STAFF_ROLES, isStaffRole, resolveRole, type UserRole } from "../context/roles";
import { navigatorForRole } from "./roleNavigator";
import { STAFF_ROUTE_ROLES, moreMenuFor, routesFor, tabsFor, canOpenRoute } from "./staff/access";
import { staffLinkTarget } from "./staff/links";
import type { StaffRouteName } from "./staffTypes";

describe("navigatorForRole", () => {
  it("sends each role to its own navigator", () => {
    expect(navigatorForRole("ceo")).toBe("ceo");
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
    const roles: UserRole[] = ["general", "sales_executive", "admin", "super_admin", "ceo"];
    for (const role of roles) {
      const nav = navigatorForRole(role);
      expect(nav === "sales_executive" || nav === "admin" || nav === "super_admin").toBe(isStaffRole(role));
    }
    expect(isStaffRole("ceo")).toBe(false);
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
