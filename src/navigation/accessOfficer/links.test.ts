// Deep links and tapped push notifications in the Access Officer app always open the Access screen.

jest.mock("../../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

import { ACCESS_OFFICER_LINK_PREFIXES, accessOfficerStateFromPath } from "./links";
import { STAFF_LINK_PREFIXES } from "../staff/links";
import { linking } from "../linking";
import { accessOfficerTransition } from "../transitions";

describe("Access Officer links", () => {
  it.each([
    "",
    "/",
    "admin/access",
    "access",
    "dashboard",
    "quotation/QUO-1001",
    "bookings",
    "payments",
    "admin/inquiries",
    "admin/ceo",
    "customer/12",
    "notifications",
    "unknown/path?x=1#y",
  ])("%p opens only the Access screen", (path) => {
    expect(accessOfficerStateFromPath(path)).toEqual({ index: 0, routes: [{ name: "AccessOfficerAccess" }] });
  });

  it("never names a CEO, Sales Manager or staff screen", () => {
    const state = JSON.stringify(accessOfficerStateFromPath("dashboard"));
    expect(state).not.toContain("Ceo");
    expect(state).not.toContain("SalesManager");
    expect(state).not.toContain("Staff");
  });

  it("accepts the same link prefixes as the customer, staff, CEO and Sales Manager apps", () => {
    expect(ACCESS_OFFICER_LINK_PREFIXES).toEqual(STAFF_LINK_PREFIXES);
    expect(ACCESS_OFFICER_LINK_PREFIXES).toEqual(linking.prefixes);
  });
});

describe("Access Officer transitions", () => {
  it("the Access screen fades in, the profile pushes", () => {
    expect(accessOfficerTransition("AccessOfficerAccess")).toBe("fade");
    expect(accessOfficerTransition("AccessOfficerProfile")).toBe("push");
  });
});
