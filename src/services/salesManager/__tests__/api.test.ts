// Sales Manager service calls against a mocked transport: the right GET path and query, authenticated, answers
// normalised, and a 503 ("needs the database update SM_01 / SM_02") turned into a clear message. apiClient / config /
// authStorage are mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({
  getToken: jest.fn(async () => "token"),
  getUser: jest.fn(async () => ({ email: "sm@worknest.test" })),
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
import { CEO_DB_UPDATE_MESSAGE, ceoErrorView } from "../../ceo/errors";
import { getSalesManagerBreakdown, getSalesManagerComplaints, getSalesManagerDashboard, getSalesManagerRecords } from "../api";
import {
  SM_COMPLAINTS_DB_UPDATE,
  SM_DB_UPDATE_MESSAGE,
  SM_FORBIDDEN_MESSAGE,
  SM_LATEST_DB_UPDATE,
  salesManagerComplaintsErrorView,
  salesManagerErrorView,
  smComplaintsDatabaseUpdateMessage,
  smDatabaseUpdateMessage,
  smDatabaseUpdateOf,
  toSalesManagerError,
} from "../errors";

const api = apiRequest as jest.Mock;

beforeEach(() => api.mockReset());

const lastCall = () => {
  const [path, options] = api.mock.calls[api.mock.calls.length - 1];
  return { path, ...options };
};

describe("requests", () => {
  it("GET sales-manager/dashboard with period and location, authenticated, envelope kept and unwrapped", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { period: "year", funnel: { quotedDesks: 5 } } });
    const d = await getSalesManagerDashboard({ period: "year", locationId: 3 });
    expect(lastCall()).toMatchObject({
      path: "/sales-manager/dashboard?period=year&locationId=3",
      method: "GET",
      requiresAuth: true,
      unwrapData: false,
    });
    expect(d.funnel?.quotedDesks).toBe(5);
    expect(d.team).toBeNull();
  });

  it("leaves the location out for all the manager's locations", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: {} });
    await getSalesManagerDashboard({ period: "month", locationId: null });
    expect(lastCall().path).toBe("/sales-manager/dashboard?period=month");
    api.mockResolvedValueOnce({ isSuccessful: true, data: {} });
    await getSalesManagerDashboard({ period: "month", locationId: 0 });
    expect(lastCall().path).toBe("/sales-manager/dashboard?period=month");
  });

  it("GET sales-manager/breakdown with the metric's key", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { rows: [{ key: "1", label: "I-8", value: 2, value2: 6 }] } });
    const b = await getSalesManagerBreakdown({ metric: "renewals-month", month: "2026-11", period: "month", locationId: 1 });
    expect(lastCall().path).toBe("/sales-manager/breakdown?metric=renewals-month&month=2026-11&period=month&locationId=1");
    expect(b.rows).toEqual([{ key: "1", label: "I-8", value: 2, value2: 6, count: null }]);
    expect(b.title).toBe("Leases ending by location");

    api.mockResolvedValueOnce({ isSuccessful: true, data: {} });
    const desks = await getSalesManagerBreakdown({ metric: "desks-month", month: "2026-12", period: "month", locationId: null });
    expect(lastCall().path).toBe("/sales-manager/breakdown?metric=desks-month&month=2026-12&period=month");
    expect(desks).toMatchObject({ valueLabel: "Desks booked", value2Label: "Desks ending" });

    api.mockResolvedValueOnce({ isSuccessful: true, data: {} });
    await getSalesManagerBreakdown({ metric: "inquiries-type", type: "WalkIn", period: "quarter", locationId: 1 });
    expect(lastCall().path).toBe("/sales-manager/breakdown?metric=inquiries-type&type=WalkIn&period=quarter&locationId=1");
  });

  it("GET sales-manager/records/{kind} with its filters", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { title: "Follow-ups due", total: 2, rows: [{ inquiryId: 1 }] } });
    const r = await getSalesManagerRecords({ kind: "inquiries", params: { outcome: "followup_due" } });
    expect(lastCall().path).toBe("/sales-manager/records/inquiries?outcome=followup_due");
    expect(r).toMatchObject({ kind: "inquiries", title: "Follow-ups due", total: 2 });

    api.mockResolvedValueOnce({ isSuccessful: true, data: { rows: [] } });
    await getSalesManagerRecords({ kind: "leases", params: { month: "2026-11", locationId: 2 } });
    expect(lastCall().path).toBe("/sales-manager/records/leases?month=2026-11&locationId=2");
  });

  it("refuses an unknown records list (e.g. the CEO's invoices) without calling the API", async () => {
    await expect(getSalesManagerRecords({ kind: "invoices" as any, params: {} })).rejects.toThrow("Unknown list.");
    expect(api).not.toHaveBeenCalled();
  });
});

describe("503: a database update (SM_01 / SM_02) has not been run", () => {
  it("every Sales Manager call turns it into the clear message, SM_02 when the server names none", async () => {
    const calls = [
      () => getSalesManagerDashboard({ period: "month" }),
      () => getSalesManagerBreakdown({ metric: "staff", userId: 3, period: "month" }),
      () => getSalesManagerRecords({ kind: "bookings", params: {} }),
    ];
    for (const call of calls) {
      api.mockRejectedValueOnce(new ApiError("The service is temporarily unavailable.", 503, { message: "Database update missing" }));
      const error = await call().catch((e) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(503);
      expect(error.message).toBe(SM_DB_UPDATE_MESSAGE);
      expect(error.message).toMatch(/needs the database update SM_02/);
      expect(error.details).toEqual({ message: "Database update missing" });
    }
    expect(SM_LATEST_DB_UPDATE).toBe("SM_02");
  });

  it("names the update the server asked for (SM_02 for desks, or SM_01 when even that is missing)", async () => {
    api.mockRejectedValueOnce(new ApiError("The Sales Manager dashboard needs the database update SM_02.", 503, { message: "The Sales Manager dashboard needs the database update SM_02." }));
    const desks = await getSalesManagerDashboard({ period: "month" }).catch((e) => e);
    expect(desks.message).toBe(smDatabaseUpdateMessage("SM_02"));

    api.mockRejectedValueOnce(new ApiError("The service is temporarily unavailable.", 503, { message: "Run SM_01.txt" }));
    const role = await getSalesManagerDashboard({ period: "month" }).catch((e) => e);
    expect(role.message).toBe(smDatabaseUpdateMessage("SM_01"));
    expect(role.message).toMatch(/needs the database update SM_01/);
    // The rewritten error still names it (the error view reads it again).
    expect(salesManagerErrorView(role).message).toBe(role.message);
  });

  it("smDatabaseUpdateOf reads the message, then the server's answer; SM_02 otherwise", () => {
    expect(smDatabaseUpdateOf(new ApiError("needs sm_01 first", 503))).toBe("SM_01");
    expect(smDatabaseUpdateOf(new ApiError("Unavailable", 503, { message: "Please run SM_02" }))).toBe("SM_02");
    expect(smDatabaseUpdateOf(new ApiError("Unavailable", 503))).toBe("SM_02");
    expect(smDatabaseUpdateOf({ status: 503 })).toBe("SM_02");
    expect(smDatabaseUpdateOf(null)).toBe("SM_02");
    expect(smDatabaseUpdateOf(new ApiError("CEO_01 SM_011", 503))).toBe("SM_02");
  });

  it("other errors pass through unchanged", async () => {
    const forbidden = new ApiError("You don't have permission to do this.", 403);
    api.mockRejectedValueOnce(forbidden);
    await expect(getSalesManagerDashboard({ period: "month", locationId: 99 })).rejects.toBe(forbidden);
    expect(toSalesManagerError(forbidden)).toBe(forbidden);
  });
});

describe("salesManagerErrorView", () => {
  it("explains the database update, with its own wording (not the CEO's)", () => {
    const view = salesManagerErrorView(new ApiError("x", 503));
    expect(view).toEqual({ title: "Database update needed", message: SM_DB_UPDATE_MESSAGE, icon: "construct-outline", databaseUpdate: true });
    expect(view.message).toMatch(/SM_02/);
    expect(salesManagerErrorView(new ApiError("Run SM_01", 503)).message).toMatch(/SM_01/);
    expect(view.message).not.toBe(CEO_DB_UPDATE_MESSAGE);
    // The CEO keeps its own wording.
    expect(ceoErrorView(new ApiError("x", 503)).message).toBe(CEO_DB_UPDATE_MESSAGE);
  });

  it("explains a refused role or location, offline, and passes readable API messages through", () => {
    expect(salesManagerErrorView(new ApiError("Forbidden", 403))).toMatchObject({
      title: "Not available for your account",
      message: SM_FORBIDDEN_MESSAGE,
      databaseUpdate: false,
    });
    expect(salesManagerErrorView(new ApiError("Can't reach the server.", 0))).toMatchObject({ title: "Could not reach WorkNest" });
    expect(salesManagerErrorView(new ApiError("Something went wrong on our side.", 500)).message).toBe("Something went wrong on our side.");
    expect(salesManagerErrorView(new TypeError("boom")).message).toBe("Could not load the figures. Please try again.");
  });
});

describe("complaints (own call, database update SM_03)", () => {
  it("GET sales-manager/complaints with period and location, normalised", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { status: { open: 3, inProgress: 1 }, newInPeriod: 2 } });
    const c = await getSalesManagerComplaints({ period: "quarter", locationId: 2 });
    expect(lastCall()).toMatchObject({ path: "/sales-manager/complaints?period=quarter&locationId=2", method: "GET", requiresAuth: true });
    expect(c.status).toEqual({ open: 3, inProgress: 1, resolved: 0, closed: 0 });
    expect(c.activeTotal).toBe(4);
    expect(c.period).toBe("quarter");

    api.mockResolvedValueOnce({ isSuccessful: true, data: {} });
    await getSalesManagerComplaints({ period: "month", locationId: null });
    expect(lastCall().path).toBe("/sales-manager/complaints?period=month");
  });

  it("GET sales-manager/records/complaints with its filters", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { total: 1, rows: [{ complaintId: 5, status: "open" }] } });
    const r = await getSalesManagerRecords({ kind: "complaints", params: { status: "active", locationId: 1, period: "month" } });
    expect(lastCall().path).toBe("/sales-manager/records/complaints?status=active&locationId=1&period=month");
    expect(r).toMatchObject({ kind: "complaints", title: "Complaints", total: 1 });
  });

  it("a 503 names SM_03 (the complaints section's update) when the server names none, on both calls", async () => {
    const calls = [
      () => getSalesManagerComplaints({ period: "month" }),
      () => getSalesManagerRecords({ kind: "complaints", params: { status: "open" } }),
    ];
    for (const call of calls) {
      api.mockRejectedValueOnce(new ApiError("The service is temporarily unavailable.", 503));
      const error = await call().catch((e) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(503);
      expect(error.message).toBe(smComplaintsDatabaseUpdateMessage());
      expect(error.message).toMatch(/^The complaints section needs the database update SM_03/);
    }
    expect(SM_COMPLAINTS_DB_UPDATE).toBe("SM_03");
  });

  it("names the update the server asked for, and the error view keeps the complaints wording", async () => {
    api.mockRejectedValueOnce(
      new ApiError("x", 503, { message: "The complaints section needs the database update SM_03." }),
    );
    const sm03 = await getSalesManagerComplaints({ period: "month" }).catch((e) => e);
    expect(sm03.message).toBe(smComplaintsDatabaseUpdateMessage("SM_03"));
    expect(salesManagerComplaintsErrorView(sm03)).toMatchObject({ title: "Database update needed", databaseUpdate: true, message: sm03.message });

    api.mockRejectedValueOnce(new ApiError("Run SM_01 first", 503));
    const sm01 = await getSalesManagerComplaints({ period: "month" }).catch((e) => e);
    expect(sm01.message).toBe(smComplaintsDatabaseUpdateMessage("SM_01"));

    // Without a named update the view says SM_03 (the dashboard's own view keeps SM_02).
    expect(salesManagerComplaintsErrorView({ status: 503 }).message).toMatch(/SM_03/);
    expect(salesManagerErrorView({ status: 503 }).message).toMatch(/SM_02/);
    expect(salesManagerComplaintsErrorView(new ApiError("Forbidden", 403)).message).toBe(SM_FORBIDDEN_MESSAGE);
    expect(salesManagerComplaintsErrorView(new TypeError("boom")).message).toBe("Could not load the complaints. Please try again.");
  });

  it("other errors pass through unchanged", async () => {
    const offline = new ApiError("Can't reach the server.", 0);
    api.mockRejectedValueOnce(offline);
    await expect(getSalesManagerComplaints({ period: "month" })).rejects.toBe(offline);
  });
});
