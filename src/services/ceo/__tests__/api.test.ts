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
import { getCeoBreakdown, getCeoDashboard, getCeoForecast, getCeoRecords } from "../api";
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
