// Dashboard chart drill-down service (GET dashboard/overview-details/{kind}): each kind's path and query (period
// and locationIds as the overview sends them, then the kind's own parameter), and the answer normalised per row
// shape. apiClient / config / authStorage are mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn(async () => null) }));
jest.mock("../../apiClient", () => {
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
    friendlyApiMessage: (_status: number, payload: any) => payload?.message ?? "Something went wrong. Please try again.",
    serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
  };
});

import { ApiError, apiRequest } from "../../apiClient";
import { getDashboardOverview } from "../dashboard";
import {
  AGING_BUCKET_KEYS,
  OVERVIEW_DETAIL_RECORDS,
  getOverviewDetails,
  normalizeOverviewDetails,
  overviewDetailsPath,
  type OverviewDetailRequest,
} from "../dashboardDetails";
import { STAFF_ENDPOINTS } from "../endpoints";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());

describe("overviewDetailsPath: kind and parameters", () => {
  const scope = { period: "quarter" as const, locationIds: [3, 5] };

  it("sends the period and locations as the overview call does, then the kind's parameter", async () => {
    // The overview call, for comparison.
    api.mockResolvedValueOnce({});
    await getDashboardOverview(scope);
    const overviewQuery = (api.mock.calls[0][0] as string).split("?")[1];
    expect(overviewQuery).toBe("period=quarter&locationIds=3%2C5");

    expect(overviewDetailsPath({ kind: "revenue-month", month: "2026-10" }, scope)).toBe(
      `/dashboard/overview-details/revenue-month?${overviewQuery}&month=2026-10`,
    );
  });

  it.each<[OverviewDetailRequest, string]>([
    [{ kind: "revenue-month", month: "2026-09" }, "/dashboard/overview-details/revenue-month?period=month&month=2026-09"],
    [{ kind: "new-bookings", month: "2026-09" }, "/dashboard/overview-details/new-bookings?period=month&month=2026-09"],
    [{ kind: "leases-ending", month: "2026-11" }, "/dashboard/overview-details/leases-ending?period=month&month=2026-11"],
    [{ kind: "occupied-month", month: "2026-10" }, "/dashboard/overview-details/occupied-month?period=month&month=2026-10"],
    [{ kind: "aging-bucket", bucket: "31_60" }, "/dashboard/overview-details/aging-bucket?period=month&bucket=31_60"],
    [{ kind: "space-type", spaceType: "Private Office" }, "/dashboard/overview-details/space-type?period=month&spaceType=Private%20Office"],
    [{ kind: "top-customer", customer: "Acme & Co" }, "/dashboard/overview-details/top-customer?period=month&customer=Acme%20%26%20Co"],
  ])("%j -> %s (no locations = all the user may see)", (request, path) => {
    expect(overviewDetailsPath(request)).toBe(path);
    expect(overviewDetailsPath(request, { locationIds: [] })).toBe(path);
  });

  it("drops invalid location ids and keeps the dashboard's period", () => {
    expect(overviewDetailsPath({ kind: "space-type", spaceType: "Desk" }, { period: "year", locationIds: [0, 7, -1] })).toBe(
      "/dashboard/overview-details/space-type?period=year&locationIds=7&spaceType=Desk",
    );
  });

  it("covers every API kind and aging bucket", () => {
    expect(Object.keys(OVERVIEW_DETAIL_RECORDS).sort()).toEqual(
      ["aging-bucket", "leases-ending", "new-bookings", "occupied-month", "revenue-month", "space-type", "top-customer"],
    );
    expect(AGING_BUCKET_KEYS).toEqual(["not_due", "1_30", "31_60", "61_90", "90_plus"]);
    expect(STAFF_ENDPOINTS.dashboard.overviewDetails("revenue-month")).toBe("/dashboard/overview-details/revenue-month");
  });
});

describe("getOverviewDetails", () => {
  it("GETs with the login token and the raw payload, and unwraps the ApiResponse envelope (invoices)", async () => {
    api.mockResolvedValueOnce({
      isSuccessful: true,
      message: "Success",
      data: {
        kind: "revenue-month",
        records: "invoices",
        title: "Invoices issued in Oct 2026",
        total: 2,
        amount: 300000,
        paidAmount: 100000,
        balance: 150000,
        from: "2026-10-01",
        to: "2026-10-31",
        generatedAt: "2026-10-19T10:00:00",
        rows: [
          {
            invoiceId: 41,
            invoiceNumber: "INV-41",
            bookingId: 9,
            customer: "Acme",
            space: "Office 2",
            location: "Gulberg",
            issuedOn: "2026-10-01",
            dueOn: "2026-10-10",
            total: 200000,
            paid: 50000,
            wht: 10000,
            balance: 140000,
            isOpen: true,
            isPaid: false,
            daysOverdue: 9,
            status: "Partial",
          },
          { invoiceId: 42, customer: "", total: 100000, paid: 100000, isOpen: false, isPaid: true, status: "Paid" },
        ],
      },
    });
    const d = await getOverviewDetails({ kind: "revenue-month", month: "2026-10" }, { period: "month", locationIds: [3] });
    expect(api.mock.calls[0][0]).toBe("/dashboard/overview-details/revenue-month?period=month&locationIds=3&month=2026-10");
    expect(api.mock.calls[0][1]).toMatchObject({ method: "GET", requiresAuth: true, unwrapData: false });
    expect(d).toMatchObject({
      kind: "revenue-month",
      records: "invoices",
      title: "Invoices issued in Oct 2026",
      total: 2,
      amount: 300000,
      paidAmount: 100000,
      balance: 150000,
      from: "2026-10-01",
      to: "2026-10-31",
      generatedAt: "2026-10-19T10:00:00",
    });
    if (d.records !== "invoices") throw new Error("expected invoices");
    expect(d.rows[0]).toEqual({
      invoiceId: 41,
      invoiceNumber: "INV-41",
      bookingId: 9,
      customer: "Acme",
      space: "Office 2",
      location: "Gulberg",
      issuedOn: "2026-10-01",
      dueOn: "2026-10-10",
      total: 200000,
      paid: 50000,
      wht: 10000,
      balance: 140000,
      isOpen: true,
      isPaid: false,
      daysOverdue: 9,
      status: "Partial",
    });
    expect(d.rows[1]).toMatchObject({ invoiceId: 42, invoiceNumber: null, bookingId: null, customer: "Customer", isPaid: true, balance: 0 });
  });

  it("passes the API's 503 (database update DASH_02) and 400 errors through", async () => {
    const dbError = new ApiError("Database update needed: run the script DASH_02_main_dashboard_drilldown_TEST.", 503, {
      isSuccessful: false,
      message: "Database update needed: run the script DASH_02_main_dashboard_drilldown_TEST.",
    });
    api.mockRejectedValueOnce(dbError);
    await expect(getOverviewDetails({ kind: "occupied-month", month: "2026-10" })).rejects.toBe(dbError);
    api.mockRejectedValueOnce(new ApiError("month must be yyyy-MM (e.g. 2026-10).", 400));
    await expect(getOverviewDetails({ kind: "new-bookings", month: "bad" })).rejects.toMatchObject({ status: 400 });
  });
});

describe("normalizeOverviewDetails", () => {
  it("bookings: every field, PascalCase too; total never below the rows sent", () => {
    const d = normalizeOverviewDetails(
      {
        Kind: "new-bookings",
        Records: "bookings",
        Title: "Bookings made in Oct 2026",
        Total: 0,
        Amount: 450000,
        Rows: [
          {
            BookingId: 12,
            Customer: "Beta Ltd",
            Space: "Desk 4",
            SpaceType: "Dedicated Desk",
            LocationId: 2,
            Location: "DHA",
            CreatedOn: "2026-10-03T11:20:00",
            StartOn: "2026-10-05T00:00:00",
            EndOn: "2027-10-04T00:00:00",
            StatusId: 2,
            Status: "Confirmed",
            TotalAmount: 450000,
            Seats: 3,
          },
        ],
      },
      "new-bookings",
    );
    expect(d).toMatchObject({ kind: "new-bookings", records: "bookings", title: "Bookings made in Oct 2026", total: 1, amount: 450000 });
    if (d.records !== "bookings") throw new Error("expected bookings");
    expect(d.rows[0]).toEqual({
      bookingId: 12,
      customer: "Beta Ltd",
      space: "Desk 4",
      spaceType: "Dedicated Desk",
      locationId: 2,
      location: "DHA",
      createdOn: "2026-10-03T11:20:00",
      startOn: "2026-10-05T00:00:00",
      endOn: "2027-10-04T00:00:00",
      statusId: 2,
      status: "Confirmed",
      totalAmount: 450000,
      seats: 3,
    });
  });

  it("spaces: name falls back to the code, then the id; booking only on an occupied space", () => {
    const d = normalizeOverviewDetails(
      {
        kind: "space-type",
        records: "spaces",
        title: "Private Office spaces",
        total: 3,
        occupied: 1,
        totalSpaces: 40,
        rows: [
          { spaceId: 1, name: "Office 1", spaceType: "Private Office", capacity: 4, occupied: true, bookingId: 77, customer: "Acme", bookingEndOn: "2027-01-31T00:00:00", status: "Confirmed", bookingCount: 2 },
          { spaceId: 2, spaceCode: "PO-2", spaceType: "Private Office", capacity: 2, occupied: false, bookingCount: 0 },
          { spaceId: 3, occupied: "false" },
        ],
      },
      "space-type",
    );
    expect(d).toMatchObject({ records: "spaces", total: 3, occupied: 1, totalSpaces: 40 });
    if (d.records !== "spaces") throw new Error("expected spaces");
    expect(d.rows.map((r) => r.name)).toEqual(["Office 1", "PO-2", "Space 3"]);
    expect(d.rows[0]).toMatchObject({ occupied: true, bookingId: 77, customer: "Acme", bookingCount: 2, capacity: 4 });
    expect(d.rows[1]).toMatchObject({ occupied: false, bookingId: null, customer: null });
    expect(d.rows[2].occupied).toBe(false);
  });

  it("no records name: the kind's row shape; nothing sent: zeros and no rows", () => {
    expect(normalizeOverviewDetails({ rows: [{ spaceId: 5 }] }, "occupied-month").records).toBe("spaces");
    expect(normalizeOverviewDetails({ rows: [{ bookingId: 5 }] }, "leases-ending").records).toBe("bookings");
    expect(normalizeOverviewDetails(null, "aging-bucket")).toMatchObject({
      kind: "aging-bucket",
      records: "invoices",
      title: "",
      total: 0,
      amount: 0,
      paidAmount: 0,
      balance: 0,
      occupied: 0,
      totalSpaces: 0,
      from: null,
      to: null,
      rows: [],
    });
  });
});
