// Drill-down routing: each chart element opens the breakdown / records the contract names, with the right keys.

import {
  breakdownParams,
  isCompleteBreakdown,
  newBookingsRecords,
  overdueInvoicesRecords,
  periodRange,
  positiveId,
  recordsForBreakdownRow,
  recordsForCustomer,
  recordsForFunnelStage,
  trailForSpeech,
  trailOf,
} from "../drill";
import type { CeoBreakdownRow } from "../types";

const row = (key: string, label = key): CeoBreakdownRow => ({ key, label, value: 1, value2: null, count: null });
const TODAY = new Date(2026, 9, 14); // 14 Oct 2026

describe("positiveId", () => {
  it("accepts positive whole numbers, also as text", () => {
    expect(positiveId(3)).toBe(3);
    expect(positiveId("12")).toBe(12);
    expect(positiveId(0)).toBeNull();
    expect(positiveId(-2)).toBeNull();
    expect(positiveId("2026-10")).toBeNull();
    expect(positiveId(null)).toBeNull();
    expect(positiveId(1.5)).toBeNull();
  });
});

describe("breakdownParams", () => {
  it("sends the metric, its key, the period and the location filter", () => {
    expect(breakdownParams({ metric: "revenue", month: "2026-10", period: "month", locationId: 2 })).toEqual({
      metric: "revenue",
      month: "2026-10",
      period: "month",
      locationId: 2,
    });
    expect(breakdownParams({ metric: "aging", bucket: "31_60", period: "year", locationId: null })).toEqual({
      metric: "aging",
      bucket: "31_60",
      period: "year",
      locationId: null,
    });
    expect(breakdownParams({ metric: "occupancy-location", period: "quarter", locationId: 4 })).toEqual({
      metric: "occupancy-location",
      period: "quarter",
      locationId: 4,
    });
    expect(breakdownParams({ metric: "staff", userId: 7, period: "month" })).toMatchObject({ userId: 7 });
    expect(breakdownParams({ metric: "inquiries-type", type: "WalkIn", period: "month" })).toMatchObject({ type: "WalkIn" });
    expect(breakdownParams({ metric: "occupancy-type", spaceTypeId: 3, period: "month" })).toMatchObject({ spaceTypeId: 3 });
  });

  it("knows when a query lacks its key", () => {
    expect(isCompleteBreakdown({ metric: "revenue", month: "2026-10", period: "month" })).toBe(true);
    expect(isCompleteBreakdown({ metric: "revenue", month: "Oct", period: "month" })).toBe(false);
    expect(isCompleteBreakdown({ metric: "occupancy-location", period: "month", locationId: null })).toBe(false);
    expect(isCompleteBreakdown({ metric: "staff", period: "month" })).toBe(false);
    expect(isCompleteBreakdown({ metric: "aging", bucket: "", period: "month" })).toBe(false);
  });
});

describe("recordsForBreakdownRow (the contract's next-level column)", () => {
  it("revenue month + location row -> invoices", () => {
    expect(recordsForBreakdownRow({ metric: "revenue", month: "2026-10", period: "month" }, row("1", "I-8"))).toEqual({
      kind: "invoices",
      params: { month: "2026-10", locationId: 1 },
    });
  });

  it("aging bucket + location row -> invoices", () => {
    expect(recordsForBreakdownRow({ metric: "aging", bucket: "90_plus", period: "month" }, row("2"))).toEqual({
      kind: "invoices",
      params: { bucket: "90_plus", locationId: 2 },
    });
  });

  it("occupancy by type + location row -> spaces; by location + type row -> spaces", () => {
    expect(recordsForBreakdownRow({ metric: "occupancy-type", spaceTypeId: 3, period: "month" }, row("1"))).toEqual({
      kind: "spaces",
      params: { spaceTypeId: 3, locationId: 1 },
    });
    expect(recordsForBreakdownRow({ metric: "occupancy-location", locationId: 1, period: "month" }, row("3"))).toEqual({
      kind: "spaces",
      params: { locationId: 1, spaceTypeId: 3 },
    });
  });

  it("new bookings month + location row -> bookings", () => {
    expect(recordsForBreakdownRow({ metric: "bookings-month", month: "2026-09", period: "month" }, row("5"))).toEqual({
      kind: "bookings",
      params: { month: "2026-09", locationId: 5 },
    });
  });

  it("inquiry type + month row -> inquiries; person + month row -> quotations", () => {
    expect(recordsForBreakdownRow({ metric: "inquiries-type", type: "Website", period: "month" }, row("2026-08"))).toEqual({
      kind: "inquiries",
      params: { type: "Website", month: "2026-08" },
    });
    expect(recordsForBreakdownRow({ metric: "staff", userId: 9, period: "month", locationId: 2 }, row("2026-08"))).toEqual({
      kind: "quotations",
      params: { userId: 9, month: "2026-08", locationId: 2 },
    });
    expect(recordsForBreakdownRow({ metric: "staff", userId: 9, period: "month" }, row("2026-08"))).toEqual({
      kind: "quotations",
      params: { userId: 9, month: "2026-08" },
    });
  });

  it("is null for a row without a usable key (e.g. 'Other') or a query without its key", () => {
    expect(recordsForBreakdownRow({ metric: "revenue", month: "2026-10", period: "month" }, row("", "Other"))).toBeNull();
    expect(recordsForBreakdownRow({ metric: "inquiries-type", type: "Website", period: "month" }, row("7"))).toBeNull();
    expect(recordsForBreakdownRow({ metric: "aging", period: "month" }, row("1"))).toBeNull();
  });
});

describe("records straight from the dashboard", () => {
  it("periodRange is the calendar period to date", () => {
    expect(periodRange("month", TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-14" });
    expect(periodRange("quarter", TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-14" });
    expect(periodRange("quarter", new Date(2026, 7, 20))).toEqual({ from: "2026-07-01", to: "2026-08-20" });
    expect(periodRange("year", TODAY)).toEqual({ from: "2026-01-01", to: "2026-10-14" });
  });

  it("funnel stages open their records for the period", () => {
    const scope = { period: "quarter" as const, locationId: 2 };
    expect(recordsForFunnelStage("inquiries", scope, TODAY)).toEqual({
      kind: "inquiries",
      params: { period: "quarter", from: "2026-10-01", to: "2026-10-14" },
    });
    expect(recordsForFunnelStage("accepted", scope, TODAY)).toEqual({
      kind: "quotations",
      params: { stage: "accepted", period: "quarter", from: "2026-10-01", to: "2026-10-14", locationId: 2 },
    });
    expect(recordsForFunnelStage("quotations", { period: "month" }, TODAY)?.params).toEqual({
      stage: "quotations",
      period: "month",
      from: "2026-10-01",
      to: "2026-10-14",
    });
    expect(recordsForFunnelStage("bookings", scope, TODAY)).toEqual({ kind: "bookings", params: { period: "quarter", locationId: 2 } });
    expect(recordsForFunnelStage("lost", scope, TODAY)).toBeNull();
  });

  it("top customer, overdue and new bookings cards", () => {
    expect(recordsForCustomer(9, { period: "month" })).toEqual({ kind: "invoices", params: { customerId: 9 } });
    expect(recordsForCustomer(null, { period: "month" })).toBeNull();
    expect(overdueInvoicesRecords({ period: "year", locationId: 3 })).toEqual({ kind: "invoices", params: { status: "overdue", locationId: 3 } });
    expect(overdueInvoicesRecords({ period: "year", locationId: null })).toEqual({ kind: "invoices", params: { status: "overdue" } });
    expect(newBookingsRecords({ period: "month" })).toEqual({ kind: "bookings", params: { period: "month" } });
  });
});

describe("breadcrumbs", () => {
  it("drops empty parts and reads naturally", () => {
    expect(trailOf("Revenue", " Oct 2026 ", null, "", "I-8")).toEqual(["Revenue", "Oct 2026", "I-8"]);
    expect(trailForSpeech(["Revenue", "Oct 2026", "I-8"])).toBe("Revenue, then Oct 2026, then I-8");
  });
});
