// Staff dashboard chart drill-down (./drill): which chart element opens which kind with which parameter, the
// totals line as the CMS words it, the record cards and what they open, and the error wording (the API's own
// message before the database update DASH_02). Pure: apiClient / config / authStorage are mocked.

jest.mock("../../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn(async () => null) }));
jest.mock("../../../../services/apiClient", () => {
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
    errorMessage: (e: any, fallback = "Something went wrong. Please try again.") => (e instanceof Error && e.message ? e.message : fallback),
    serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
  };
});

import { ApiError } from "../../../../services/apiClient";
import { normalizeOverviewDetails, type OverviewDetails } from "../../../../services/staff/dashboardDetails";
import {
  DASHBOARD_DETAILS_DB_MESSAGE,
  currentMonthOf,
  detailCards,
  detailsCountText,
  detailsSummary,
  detailsTotalsLine,
  occupancyNowTarget,
  overviewDetailsErrorView,
  relatedTarget,
  revenueMonthTarget,
  spaceTypeTarget,
  spacesInUseLabel,
} from "./drill";

const invoices = (extra: Record<string, unknown> = {}): OverviewDetails =>
  normalizeOverviewDetails(
    {
      kind: "revenue-month",
      records: "invoices",
      title: "Invoices issued in Oct 2026",
      total: 2,
      amount: 300000,
      paidAmount: 100000,
      balance: 150000,
      rows: [
        { invoiceId: 41, invoiceNumber: "INV-41", bookingId: 9, customer: "Acme", space: "Office 2", location: "Gulberg", issuedOn: "2026-10-01", dueOn: "2026-10-10", total: 200000, paid: 50000, wht: 10000, balance: 140000, isOpen: true, daysOverdue: 9, status: "Partial" },
        { invoiceId: 0, customer: "Beta", total: 100000, paid: 100000, isOpen: false, isPaid: true, status: "Paid" },
      ],
      ...extra,
    },
    "revenue-month",
  );

describe("chart element -> kind and parameter", () => {
  it("a month of Invoiced and paid opens revenue-month for that month", () => {
    expect(revenueMonthTarget("2026-10")).toEqual({
      request: { kind: "revenue-month", month: "2026-10" },
      trail: ["Invoiced and paid", "Oct 2026"],
      title: "Invoices issued in Oct 2026",
    });
    expect(revenueMonthTarget("")).toBeNull();
    expect(revenueMonthTarget("2026-13")).toBeNull();
  });

  it("a space type bar opens space-type with the name as the chart shows it; a blank type opens nothing", () => {
    expect(spaceTypeTarget("Private Office")).toEqual({
      request: { kind: "space-type", spaceType: "Private Office" },
      trail: ["Occupancy by space type", "Private Office"],
      title: "Private Office spaces",
    });
    expect(spaceTypeTarget("  ")).toBeNull();
  });

  it("the occupancy ring opens occupied-month for the server's current month (spaces in use now)", () => {
    const overview = { generatedAt: "2026-11-01T00:30:00", months: [{ month: "2026-10", invoiced: 0, paid: 0, occupancyPct: 0, newBookings: 0 }] };
    expect(occupancyNowTarget(overview)).toEqual({
      request: { kind: "occupied-month", month: "2026-11" },
      trail: ["Occupancy", "In use now"],
      title: "Spaces in use now",
    });
    // No generatedAt: the latest trend month; nothing at all: the device's month.
    expect(currentMonthOf({ generatedAt: "", months: overview.months })).toBe("2026-10");
    expect(currentMonthOf({ generatedAt: "", months: [] }, new Date(2026, 0, 15))).toBe("2026-01");
  });

  it("spaces in use: now for this month, at the end of an earlier month", () => {
    expect(spacesInUseLabel("2026-10", "2026-10")).toBe("Spaces in use now");
    expect(spacesInUseLabel("2026-09", "2026-10")).toBe("Spaces in use at the end of September 2026");
  });

  it("related lists (CMS): spaces in use <-> new bookings of the month, one step only", () => {
    const trail = ["Occupancy", "In use now"];
    expect(relatedTarget({ kind: "occupied-month", month: "2026-10" }, trail, null, false)).toEqual({
      label: "New bookings made in October 2026",
      request: { kind: "new-bookings", month: "2026-10" },
      trail: ["Occupancy", "In use now", "New bookings"],
      title: "Bookings made in Oct 2026",
    });
    expect(relatedTarget({ kind: "new-bookings", month: "2026-09" }, ["x"], { generatedAt: "2026-10-19T10:00:00" }, false)).toMatchObject({
      label: "Spaces in use at the end of September 2026",
      request: { kind: "occupied-month", month: "2026-09" },
    });
    expect(relatedTarget({ kind: "occupied-month", month: "2026-10" }, trail, null, true)).toBeNull();
    expect(relatedTarget({ kind: "revenue-month", month: "2026-10" }, trail, null, false)).toBeNull();
    expect(relatedTarget({ kind: "space-type", spaceType: "Desk" }, trail, null, false)).toBeNull();
  });
});

describe("totals line", () => {
  it("revenue-month: invoiced and the part of it paid (CMS wording), with the count", () => {
    const d = invoices();
    expect(detailsSummary("revenue-month", d)).toBe("PKR 300,000 invoiced, PKR 100,000 of it paid");
    expect(detailsTotalsLine("revenue-month", d)).toBe("2 invoices · PKR 300,000 invoiced, PKR 100,000 of it paid");
  });

  it("the other kinds", () => {
    const d = invoices();
    expect(detailsSummary("aging-bucket", d)).toBe("PKR 150,000 owed");
    expect(detailsSummary("top-customer", d)).toBe("PKR 300,000 invoiced");
    const bookings = normalizeOverviewDetails({ records: "bookings", total: 1, amount: 450000, rows: [{ bookingId: 1 }] }, "new-bookings");
    expect(detailsSummary("new-bookings", bookings)).toBe("PKR 450,000 booking value");
    expect(detailsSummary("leases-ending", bookings)).toBe("PKR 450,000 booking value");
    const spaces = normalizeOverviewDetails({ records: "spaces", total: 18, occupied: 18, totalSpaces: 25, rows: [] }, "occupied-month");
    expect(detailsSummary("occupied-month", spaces)).toBe("72% of 25 active spaces");
    expect(detailsSummary("occupied-month", { ...spaces, totalSpaces: 0 })).toBeNull();
    const type = normalizeOverviewDetails({ records: "spaces", total: 6, occupied: 4, totalSpaces: 25, rows: [] }, "space-type");
    expect(detailsTotalsLine("space-type", type)).toBe("6 spaces · 4 of 6 in use");
  });

  it("counts: singular, and 'Showing x of total' when the API sent only the first rows", () => {
    expect(detailsCountText(invoices({ total: 1, rows: [{ invoiceId: 1 }] }))).toBe("1 invoice");
    expect(detailsCountText(invoices({ total: 340 }))).toBe("Showing 2 of 340 invoices");
    expect(detailsCountText(invoices({ total: 0, rows: [] }))).toBe("0 invoices");
  });
});

describe("record cards", () => {
  it("invoices: number, customer / space / location, status, total and dates; opens the invoice", () => {
    const [open, paid] = detailCards(invoices());
    expect(open).toMatchObject({
      title: "INV-41",
      subtitle: "Acme · Office 2 · Gulberg",
      status: "Partial",
      amount: "PKR 200,000",
      target: { route: "InvoiceDetail", invoiceId: 41 },
      hint: "Opens the invoice",
    });
    expect(open.fields).toEqual([
      { label: "Issued", value: "1 Oct 2026" },
      { label: "Due", value: "10 Oct 2026" },
      { label: "Paid", value: "PKR 50,000" },
      { label: "Balance", value: "PKR 140,000" },
      { label: "Overdue", value: "9 days" },
      { label: "Withholding tax", value: "PKR 10,000" },
      { label: "Booking", value: "#9" },
    ]);
    expect(open.accessibilityLabel).toContain("INV-41, Acme · Office 2 · Gulberg, Partial, PKR 200,000");
    // No id: nothing to open; a paid invoice shows no balance.
    expect(paid.target).toBeNull();
    expect(paid.title).toBe("Invoice");
    expect(paid.fields.map((f) => f.label)).not.toContain("Balance");
  });

  it("bookings open the booking detail screen", () => {
    const d = normalizeOverviewDetails(
      {
        records: "bookings",
        total: 2,
        rows: [
          { bookingId: 12, customer: "Beta Ltd", space: "Desk 4", location: "DHA", createdOn: "2026-10-03T11:20:00", startOn: "2026-10-05T00:00:00", endOn: "2027-10-04T00:00:00", status: "Confirmed", totalAmount: 450000, seats: 3, spaceType: "Dedicated Desk" },
          { bookingId: 0, customer: "Gamma" },
        ],
      },
      "new-bookings",
    );
    const [card, noId] = detailCards(d);
    expect(card).toMatchObject({
      title: "Beta Ltd",
      subtitle: "Desk 4 · DHA",
      status: "Confirmed",
      amount: "PKR 450,000",
      target: { route: "BookingDetail", bookingId: 12 },
      hint: "Opens the booking",
    });
    expect(card.fields).toEqual([
      { label: "Booked on", value: "3 Oct 2026" },
      { label: "Starts", value: "5 Oct 2026" },
      { label: "Ends", value: "4 Oct 2027" },
      { label: "Space type", value: "Dedicated Desk" },
      { label: "Seats", value: "3" },
      { label: "Booking", value: "#12" },
    ]);
    expect(noId.target).toBeNull();
  });

  it("spaces: an occupied space opens its booking; a vacant one opens nothing", () => {
    const d = normalizeOverviewDetails(
      {
        records: "spaces",
        total: 2,
        rows: [
          { spaceId: 1, name: "Office 1", spaceType: "Private Office", location: "Gulberg", capacity: 4, occupied: true, bookingId: 77, customer: "Acme", bookingEndOn: "2027-01-31T00:00:00", bookingCount: 2 },
          { spaceId: 2, name: "Office 2", spaceType: "Private Office", location: "Gulberg", capacity: 1, occupied: false, bookingId: 5, customer: "Old" },
        ],
      },
      "space-type",
    );
    const [busy, vacant] = detailCards(d);
    expect(busy).toMatchObject({ title: "Office 1", subtitle: "Private Office · Gulberg", status: "Occupied", amount: null, target: { route: "BookingDetail", bookingId: 77 } });
    expect(busy.fields).toEqual([
      { label: "Capacity", value: "4 people" },
      { label: "Customer", value: "Acme" },
      { label: "Booked until", value: "31 Jan 2027" },
      { label: "Bookings", value: "2" },
      { label: "Booking", value: "#77" },
    ]);
    expect(vacant).toMatchObject({ status: "Available", target: null });
    expect(vacant.fields).toEqual([{ label: "Capacity", value: "1 person" }]);
  });
});

describe("errors", () => {
  it("503 before the database update: the API's own message (it names the script)", () => {
    const message = "Database update needed: run the script DASH_02_main_dashboard_drilldown_TEST (on LIVE: DASH_02_main_dashboard_drilldown_LIVE).";
    const view = overviewDetailsErrorView(new ApiError(message, 503, { isSuccessful: false, message }));
    expect(view).toEqual({ title: "Database update needed", message, icon: "construct-outline", databaseUpdate: true });
    // The message kept only on the error itself.
    expect(overviewDetailsErrorView(new ApiError(message, 503)).message).toBe(message);
  });

  it("a 503 that names no database update is an outage, not the update", () => {
    const view = overviewDetailsErrorView(new ApiError("The service is temporarily unavailable. Please try again in a few minutes.", 503));
    expect(view).toMatchObject({ databaseUpdate: false, message: "The service is temporarily unavailable. Please try again in a few minutes." });
    expect(DASHBOARD_DETAILS_DB_MESSAGE).toContain("DASH_02_main_dashboard_drilldown_TEST");
  });

  it("403, offline and a bad parameter (the API's message)", () => {
    expect(overviewDetailsErrorView(new ApiError("Forbidden", 403))).toMatchObject({ title: "Not available for your account", databaseUpdate: false });
    expect(overviewDetailsErrorView(new ApiError("Can't reach the server.", 0))).toMatchObject({ icon: "cloud-offline-outline" });
    expect(overviewDetailsErrorView(new ApiError("month must be yyyy-MM (e.g. 2026-10).", 400)).message).toBe("month must be yyyy-MM (e.g. 2026-10).");
  });
});
