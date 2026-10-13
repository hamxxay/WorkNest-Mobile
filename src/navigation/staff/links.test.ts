import { linkSegments, staffLinkTarget, staffStateFromPath } from "./links";

describe("staff deep links / tapped pushes", () => {
  it("reads paths from either prefix style, without query or the CMS admin/ segment", () => {
    expect(linkSegments("quotation/12")).toEqual(["quotation", "12"]);
    expect(linkSegments("/quotation/12?from=push#x")).toEqual(["quotation", "12"]);
    expect(linkSegments("/admin/bookings")).toEqual(["bookings"]);
    expect(linkSegments("")).toEqual([]);
  });

  it("opens a quotation over the tabs, so back returns to them", () => {
    expect(staffStateFromPath("quotation/238", "sales_executive")).toEqual({
      index: 1,
      routes: [{ name: "StaffTabs" }, { name: "QuotationDetail", params: { quotationId: 238 } }],
    });
  });

  it("a quotation number (not an id) opens the quotations instead", () => {
    expect(staffLinkTarget("quotation/QUO-1001", "sales_executive")).toEqual({ kind: "tab", tab: "Quotations" });
    expect(staffLinkTarget("quotation/QUO-1001", "admin")).toEqual({ kind: "screen", route: "QuotationList", params: undefined });
  });

  it("uses the role's tab when it has one, otherwise the pushed list", () => {
    expect(staffStateFromPath("bookings", "admin")).toEqual({
      routes: [{ name: "StaffTabs", state: { routes: [{ name: "Bookings" }] } }],
    });
    expect(staffStateFromPath("bookings", "sales_executive")).toEqual({
      index: 1,
      routes: [{ name: "StaffTabs" }, { name: "BookingList" }],
    });
    expect(staffLinkTarget("inquiries", "sales_executive")).toEqual({ kind: "tab", tab: "Inquiries" });
    expect(staffLinkTarget("inquiries", "admin")).toMatchObject({ kind: "screen", route: "TourInquiries" });
  });

  it("maps the customer app's push paths to staff screens", () => {
    expect(staffLinkTarget("notifications", "admin")).toMatchObject({ route: "StaffNotifications" });
    expect(staffLinkTarget("payments", "admin")).toMatchObject({ route: "InvoiceList" });
    expect(staffLinkTarget("invoice/411", "admin")).toMatchObject({ route: "InvoiceDetail", params: { invoiceId: 411 } });
    expect(staffLinkTarget("agreements", "super_admin")).toMatchObject({ route: "AgreementList" });
    expect(staffLinkTarget("booking/558", "sales_executive")).toMatchObject({ route: "BookingDetail", params: { bookingId: 558 } });
    expect(staffLinkTarget("home", "admin")).toEqual({ kind: "tab", tab: "Dashboard" });
    expect(staffLinkTarget("profile", "admin")).toMatchObject({ route: "StaffProfile" });
  });

  it("never opens a screen the role may not open, nor an unknown path", () => {
    expect(staffLinkTarget("challan-validity", "admin")).toBeNull();
    expect(staffLinkTarget("challan-validity", "super_admin")).toMatchObject({ route: "ChallanValidity" });
    expect(staffLinkTarget("access-activity", "sales_executive")).toBeNull();
    expect(staffLinkTarget("approvals", "sales_executive")).toBeNull();
    expect(staffLinkTarget("approvals", "admin")).toEqual({ kind: "tab", tab: "Approvals" });
    expect(staffStateFromPath("gallery", "admin")).toBeUndefined();
  });
});
