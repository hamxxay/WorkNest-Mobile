// Deep links and tapped push notifications in the CEO app always open the CEO dashboard.

jest.mock("../../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

import { CEO_LINK_PREFIXES, ceoStateFromPath } from "./links";
import { STAFF_LINK_PREFIXES } from "../staff/links";
import { linking } from "../linking";
import { ceoTransition } from "../transitions";

describe("CEO links", () => {
  it.each([
    "",
    "/",
    "dashboard",
    "quotation/QUO-1001",
    "bookings",
    "payments",
    "admin/invoices",
    "customer/12",
    "notifications",
    "unknown/path?x=1#y",
  ])("%p opens only the dashboard", (path) => {
    expect(ceoStateFromPath(path)).toEqual({ index: 0, routes: [{ name: "CeoDashboard" }] });
  });

  it("accepts the same link prefixes as the customer and staff apps", () => {
    expect(CEO_LINK_PREFIXES).toEqual(STAFF_LINK_PREFIXES);
    expect(CEO_LINK_PREFIXES).toEqual(linking.prefixes);
  });
});

describe("CEO transitions", () => {
  it("the dashboard fades in, drill screens and the profile push", () => {
    expect(ceoTransition("CeoDashboard")).toBe("fade");
    expect(ceoTransition("CeoBreakdown")).toBe("push");
    expect(ceoTransition("CeoRecords")).toBe("push");
    expect(ceoTransition("CeoProfile")).toBe("push");
  });
});
