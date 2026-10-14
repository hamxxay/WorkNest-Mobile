// Deep links and tapped push notifications in the Sales Manager app always open the sales dashboard.

jest.mock("../../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

import { SALES_MANAGER_LINK_PREFIXES, salesManagerStateFromPath } from "./links";
import { ceoStateFromPath } from "../ceo/links";
import { STAFF_LINK_PREFIXES } from "../staff/links";
import { linking } from "../linking";
import { salesManagerTransition } from "../transitions";

describe("Sales Manager links", () => {
  it.each([
    "",
    "/",
    "dashboard",
    "quotation/QUO-1001",
    "bookings",
    "payments",
    "admin/inquiries",
    "admin/ceo",
    "customer/12",
    "notifications",
    "unknown/path?x=1#y",
  ])("%p opens only the sales dashboard", (path) => {
    expect(salesManagerStateFromPath(path)).toEqual({ index: 0, routes: [{ name: "SalesManagerDashboard" }] });
  });

  it("never names a CEO screen", () => {
    expect(JSON.stringify(salesManagerStateFromPath("dashboard"))).not.toContain("Ceo");
    expect(JSON.stringify(ceoStateFromPath("dashboard"))).not.toContain("SalesManager");
  });

  it("accepts the same link prefixes as the customer, staff and CEO apps", () => {
    expect(SALES_MANAGER_LINK_PREFIXES).toEqual(STAFF_LINK_PREFIXES);
    expect(SALES_MANAGER_LINK_PREFIXES).toEqual(linking.prefixes);
  });
});

describe("Sales Manager transitions", () => {
  it("the dashboard fades in, drill screens and the profile push", () => {
    expect(salesManagerTransition("SalesManagerDashboard")).toBe("fade");
    expect(salesManagerTransition("SalesManagerBreakdown")).toBe("push");
    expect(salesManagerTransition("SalesManagerRecords")).toBe("push");
    expect(salesManagerTransition("SalesManagerProfile")).toBe("push");
  });
});
