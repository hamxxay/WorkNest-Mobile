// CEO service calls against a mocked transport: the right GET path and query, authenticated, answers normalised,
// and a 503 ("needs the database update") turned into a clear message. apiClient / config / authStorage are
// mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({
  getToken: jest.fn(async () => "token"),
  getUser: jest.fn(async () => ({ email: "ceo@worknest.test" })),
}));
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
    errorMessage: (error: unknown, fallback = "Something went wrong. Please try again.") =>
      error instanceof ApiError ? error.message : fallback,
    friendlyApiMessage: (_status: number, payload: any) => payload?.message ?? "Something went wrong. Please try again.",
    serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
  };
});

import { ApiError, apiRequest } from "../../apiClient";
import { getCeoBreakdown, getCeoDashboard, getCeoForecast, getCeoRecords, getCeoRooms } from "../api";
import { CEO_DB_UPDATE_MESSAGE, CEO_DB_UPDATE_TITLE, ceoErrorView, needsDatabaseUpdate, toCeoError } from "../errors";

const api = apiRequest as jest.Mock;

beforeEach(() => api.mockReset());

const lastCall = () => {
  const [path, options] = api.mock.calls[api.mock.calls.length - 1];
  return { path, ...options };
};

describe("requests", () => {
  it("GET ceo/dashboard with period and location, authenticated, envelope kept and unwrapped", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { period: "year", money: { invoiced: 5 } } });
    const d = await getCeoDashboard({ period: "year", locationId: 3 });
    expect(lastCall()).toMatchObject({ path: "/ceo/dashboard?period=year&locationId=3", method: "GET", requiresAuth: true, unwrapData: false });
    expect(d.money?.invoiced).toBe(5);
    expect(d.occupancy).toBeNull();
  });

  it("leaves the location out for all locations", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: {} });
    await getCeoDashboard({ period: "month", locationId: null });
    expect(lastCall().path).toBe("/ceo/dashboard?period=month");
    api.mockResolvedValueOnce({ isSuccessful: true, data: {} });
    await getCeoDashboard({ period: "month", locationId: 0 });
    expect(lastCall().path).toBe("/ceo/dashboard?period=month");
  });

  it("GET ceo/breakdown with the metric's key", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { rows: [{ key: "1", label: "I-8", value: 9 }] } });
    const b = await getCeoBreakdown({ metric: "revenue", month: "2026-10", period: "month", locationId: null });
    expect(lastCall().path).toBe("/ceo/breakdown?metric=revenue&month=2026-10&period=month");
    expect(b.rows).toEqual([{ key: "1", label: "I-8", value: 9, value2: null, count: null }]);
    expect(b.title).toBe("Revenue by location");
  });

  it("GET ceo/records/{kind} with its filters", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { title: "Overdue invoices", total: 2, rows: [{ invoiceId: 1 }] } });
    const r = await getCeoRecords({ kind: "invoices", params: { status: "overdue", locationId: 2 } });
    expect(lastCall().path).toBe("/ceo/records/invoices?status=overdue&locationId=2");
    expect(r).toMatchObject({ kind: "invoices", title: "Overdue invoices", total: 2 });
  });

  it("refuses an unknown records list without calling the API", async () => {
    await expect(getCeoRecords({ kind: "payments" as any, params: {} })).rejects.toThrow("Unknown list.");
    expect(api).not.toHaveBeenCalled();
  });

  it("GET ceo/rooms with period and location (all locations: no location), the report normalised", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { available: true, period: "quarter", rooms: [{ spaceId: 3, name: "Office 3", sales: [] }] } });
    const r = await getCeoRooms("quarter", 2);
    expect(lastCall()).toMatchObject({ path: "/ceo/rooms?period=quarter&locationId=2", method: "GET", requiresAuth: true });
    expect(r).toMatchObject({ available: true, period: "quarter" });
    expect(r.available && r.rooms.map((x) => x.name)).toEqual(["Office 3"]);
    api.mockResolvedValueOnce({ isSuccessful: true, data: { available: false, message: "Run CEO_02_room_report on the database to see the room report." } });
    expect(await getCeoRooms("month", 0)).toEqual({ available: false, message: "Run CEO_02_room_report on the database to see the room report." });
    expect(lastCall().path).toBe("/ceo/rooms?period=month");
  });

  it("GET dashboard/forecast for 3 months, narrowed to the chosen location", async () => {
    api.mockResolvedValueOnce({ months: 3, totals: [{ month: "2026-11", expectedRent: 10 }] });
    const f = await getCeoForecast(4);
    expect(lastCall().path).toBe("/dashboard/forecast?months=3&locationIds=4");
    expect(f.totals[0].expectedRent).toBe(10);
    api.mockResolvedValueOnce({});
    await getCeoForecast(null);
    expect(lastCall().path).toBe("/dashboard/forecast?months=3");
  });
});

describe("503: the CEO database update has not been run", () => {
  it("every CEO call turns it into the clear message", async () => {
    const calls = [
      () => getCeoDashboard({ period: "month" }),
      () => getCeoBreakdown({ metric: "aging", bucket: "1_30", period: "month" }),
      () => getCeoRecords({ kind: "spaces", params: {} }),
      () => getCeoForecast(null),
      () => getCeoRooms("month", null),
    ];
    for (const call of calls) {
      api.mockRejectedValueOnce(new ApiError("The service is temporarily unavailable.", 503, { message: "Run CEO_01.txt" }));
      const error = await call().catch((e) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(503);
      expect(error.message).toBe(CEO_DB_UPDATE_MESSAGE);
      expect(needsDatabaseUpdate(error)).toBe(true);
    }
  });

  it("a later update the server names (QA_07: the full list of leases expiring) is named", async () => {
    api.mockRejectedValueOnce(new ApiError("Unavailable", 503, { message: "The full list of leases expiring needs the database update QA_07." }));
    const error = await getCeoRecords({ kind: "leases", params: {} }).catch((e) => e);
    expect(lastCall().path).toBe("/ceo/records/leases");
    expect(error.status).toBe(503);
    expect(error.message).toMatch(/^This part of the CEO dashboard needs the database update QA_07 on the server/);
    expect(ceoErrorView(error).message).toBe(error.message);
    expect(ceoErrorView(new ApiError("x", 503, { message: "needs CEO_01" })).message).toBe(CEO_DB_UPDATE_MESSAGE);
  });

  it("other errors pass through unchanged", async () => {
    const forbidden = new ApiError("You don't have permission to do this.", 403);
    api.mockRejectedValueOnce(forbidden);
    await expect(getCeoDashboard({ period: "month" })).rejects.toBe(forbidden);
    expect(toCeoError(forbidden)).toBe(forbidden);
    expect(needsDatabaseUpdate(forbidden)).toBe(false);
  });
});

describe("ceoErrorView", () => {
  it("explains the database update, without a 'try again later' message", () => {
    const view = ceoErrorView(new ApiError("x", 503));
    expect(view).toEqual({ title: CEO_DB_UPDATE_TITLE, message: CEO_DB_UPDATE_MESSAGE, icon: "construct-outline", databaseUpdate: true });
    expect(view.message).toMatch(/database update/);
  });

  it("explains a refused role, offline, and passes readable API messages through", () => {
    expect(ceoErrorView(new ApiError("Forbidden", 403))).toMatchObject({ title: "Not available for your account", databaseUpdate: false });
    expect(ceoErrorView(new ApiError("Can't reach the server.", 0))).toMatchObject({ title: "Could not reach WorkNest", message: "Can't reach the server." });
    expect(ceoErrorView(new ApiError("Something went wrong on our side.", 500))).toMatchObject({
      title: "Could not load this",
      message: "Something went wrong on our side.",
    });
    expect(ceoErrorView(new TypeError("undefined is not a function")).message).toBe("Could not load the figures. Please try again.");
  });
});

describe("a custom date range (CS_01)", () => {
  const range = { from: "2026-10-01", to: "2026-10-15" };
  const CS_01 =
    "Database update needed: run the script CS_01_ceo_sales_dates_TEST (CS_01_ceo_sales_dates_LIVE on the live database) to use a custom date range.";

  it("dashboard and rooms send from / to; the breakdown sends periodFrom / periodTo", async () => {
    api.mockResolvedValue({ isSuccessful: true, data: {} });
    await getCeoDashboard({ period: "custom", locationId: 3, range });
    expect(lastCall().path).toBe("/ceo/dashboard?period=custom&from=2026-10-01&to=2026-10-15&locationId=3");
    await getCeoRooms("custom", null, range);
    expect(lastCall().path).toBe("/ceo/rooms?period=custom&from=2026-10-01&to=2026-10-15");
    await getCeoBreakdown({ metric: "revenue", period: "custom", range, locationId: null });
    expect(lastCall().path).toBe(
      "/ceo/breakdown?metric=revenue&from=2026-10-01&to=2026-10-15&period=custom&periodFrom=2026-10-01&periodTo=2026-10-15",
    );
    await getCeoBreakdown({ metric: "inquiries-type", type: "Website", period: "custom", range, locationId: 2 });
    expect(lastCall().path).toBe("/ceo/breakdown?metric=inquiries-type&type=Website&period=custom&periodFrom=2026-10-01&periodTo=2026-10-15&locationId=2");
    api.mockReset();
  });

  it("month / quarter / year requests are unchanged, also with a range kept aside", async () => {
    api.mockResolvedValue({ isSuccessful: true, data: {} });
    await getCeoDashboard({ period: "quarter", locationId: 3, range });
    expect(lastCall().path).toBe("/ceo/dashboard?period=quarter&locationId=3");
    await getCeoRooms("year", 2, range);
    expect(lastCall().path).toBe("/ceo/rooms?period=year&locationId=2");
    await getCeoBreakdown({ metric: "revenue", month: "2026-10", period: "month", range, locationId: null });
    expect(lastCall().path).toBe("/ceo/breakdown?metric=revenue&month=2026-10&period=month");
    api.mockReset();
  });

  it("before CS_01 the 503 shows the API's own message, on the screen and in its drill-downs", async () => {
    for (const call of [
      () => getCeoDashboard({ period: "custom", range }),
      () => getCeoRooms("custom", null, range),
      () => getCeoBreakdown({ metric: "revenue", period: "custom", range }),
    ]) {
      api.mockRejectedValueOnce(new ApiError("The service is temporarily unavailable.", 503, { message: CS_01 }));
      const error = await call().catch((e) => e);
      expect(error.status).toBe(503);
      expect(error.message).toBe(CS_01);
      expect(ceoErrorView(error)).toEqual({ title: CEO_DB_UPDATE_TITLE, message: CS_01, icon: "construct-outline", databaseUpdate: true });
    }
    // The raw error too (e.g. a view of an error that was not thrown by a CEO call).
    expect(ceoErrorView(new ApiError("Unavailable", 503, { message: CS_01 })).message).toBe(CS_01);
  });
});
