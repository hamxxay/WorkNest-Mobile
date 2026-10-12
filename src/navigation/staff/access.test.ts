import { STAFF_ROLES } from "../../context/roles";
import { canOpenRoute, canOpenTab, moreMenuFor, routesFor, STAFF_ROUTE_ROLES, tabsFor } from "./access";

describe("staff tabs", () => {
  it("sales executive: Dashboard, Inquiries, Quotations, Customers, More", () => {
    expect(tabsFor("sales_executive")).toEqual(["Dashboard", "Inquiries", "Quotations", "Customers", "More"]);
  });

  it("admin and super admin: Dashboard, Approvals, Bookings, Customers, More", () => {
    expect(tabsFor("admin")).toEqual(["Dashboard", "Approvals", "Bookings", "Customers", "More"]);
    expect(tabsFor("super_admin")).toEqual(["Dashboard", "Approvals", "Bookings", "Customers", "More"]);
  });

  it("never gives a sales executive the Approvals tab", () => {
    expect(canOpenTab("sales_executive", "Approvals")).toBe(false);
  });
});

describe("route access (mirrors the CMS)", () => {
  it("admin-only screens are closed to sales executives", () => {
    for (const route of ["CapacityRequests", "AccessActivity", "Users", "Locations", "Spaces"] as const) {
      expect(canOpenRoute("sales_executive", route)).toBe(false);
      expect(canOpenRoute("admin", route)).toBe(true);
      expect(canOpenRoute("super_admin", route)).toBe(true);
    }
  });

  it("Challan Validity is super admin only", () => {
    expect(canOpenRoute("sales_executive", "ChallanValidity")).toBe(false);
    expect(canOpenRoute("admin", "ChallanValidity")).toBe(false);
    expect(canOpenRoute("super_admin", "ChallanValidity")).toBe(true);
  });

  it("the sales executive pages of the CMS are open to every staff role", () => {
    const salesPages = [
      "QuotationList",
      "QuotationCreate",
      "BookingList",
      "BookingDetail",
      "TourInquiries",
      "KycList",
      "KycDocuments",
      "AgreementList",
      "InvoiceList",
      "InvoiceDetail",
      "Attendants",
      "Complaints",
      "StaffProfile",
    ] as const;
    for (const role of STAFF_ROLES) {
      for (const route of salesPages) expect(canOpenRoute(role, route)).toBe(true);
    }
  });

  it("routesFor lists exactly the routes the role may open", () => {
    for (const role of STAFF_ROLES) {
      const routes = routesFor(role);
      expect(routes.length).toBeGreaterThan(0);
      for (const route of Object.keys(STAFF_ROUTE_ROLES) as (keyof typeof STAFF_ROUTE_ROLES)[]) {
        expect(routes.includes(route)).toBe(canOpenRoute(role, route));
      }
    }
  });
});

describe("More menu", () => {
  it("only lists screens the role may open, and always the profile", () => {
    for (const role of STAFF_ROLES) {
      const items = moreMenuFor(role).flatMap((section) => section.items);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) expect(canOpenRoute(role, item.route)).toBe(true);
      expect(items.some((item) => item.route === "StaffProfile")).toBe(true);
    }
  });

  it("lists the planned items per role", () => {
    const routes = (role: (typeof STAFF_ROLES)[number]) => moreMenuFor(role).flatMap((s) => s.items.map((i) => i.route));
    expect(routes("sales_executive")).toEqual([
      "BookingList",
      "AgreementList",
      "KycList",
      "Complaints",
      "InvoiceList",
      "Attendants",
      "StaffProfile",
    ]);
    expect(routes("admin")).toEqual([
      "QuotationList",
      "TourInquiries",
      "AgreementList",
      "KycList",
      "Complaints",
      "InvoiceList",
      "Attendants",
      "AccessActivity",
      "Locations",
      "Spaces",
      "Users",
      "StaffProfile",
    ]);
    expect(routes("super_admin")).toContain("ChallanValidity");
    expect(routes("admin")).not.toContain("ChallanValidity");
  });

  it("has no empty sections and no duplicate items", () => {
    for (const role of STAFF_ROLES) {
      const sections = moreMenuFor(role);
      for (const section of sections) expect(section.items.length).toBeGreaterThan(0);
      const routes = sections.flatMap((s) => s.items.map((i) => i.route));
      expect(new Set(routes).size).toBe(routes.length);
    }
  });
});
