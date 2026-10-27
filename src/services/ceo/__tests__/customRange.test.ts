// A custom date range on the CEO dashboard: every drill-down call carries the same range (period=custom,
// periodFrom / periodTo), Invoiced / Collected open the invoices issued in it by location (from / to), and month /
// quarter / year drill-downs are built exactly as before.

import {
  activeBookingsRecords,
  agingTarget,
  breakdownParams,
  isCompleteBreakdown,
  leasesExpiringRecords,
  newBookingsRecords,
  occupancyTarget,
  overdueInvoicesRecords,
  recordsForBreakdownRow,
  recordsForCustomer,
  recordsForFunnelStage,
  revenueTarget,
  scopedBreakdown,
  withDrillPeriod,
} from "../drill";
import { normalizeCeoDashboard, normalizePeriod } from "../normalize";
import { normalizeCeoRooms } from "../rooms";
import type { CeoBreakdownRow, CeoScope } from "../types";

const RANGE = { from: "2026-10-01", to: "2026-10-15" };
const CUSTOM: CeoScope = { period: "custom", locationId: 2, range: RANGE };
const PERIOD = { period: "custom", periodFrom: "2026-10-01", periodTo: "2026-10-15" };
const TODAY = new Date(2026, 9, 19);
const row = (key: string, label = key): CeoBreakdownRow => ({ key, label, value: 1, value2: null, count: null });

describe("breakdown requests", () => {
  it("revenue for a range: the invoices issued from / to, and the range as periodFrom / periodTo", () => {
    const query = scopedBreakdown({ metric: "revenue" }, CUSTOM);
    expect(query).toEqual({ metric: "revenue", period: "custom", range: RANGE, locationId: 2 });
    expect(isCompleteBreakdown(query)).toBe(true);
    expect(breakdownParams(query)).toEqual({
      metric: "revenue",
      from: "2026-10-01",
      to: "2026-10-15",
      period: "custom",
      periodFrom: "2026-10-01",
      periodTo: "2026-10-15",
      locationId: 2,
    });
  });

  it("a month of the 12-month chart keeps its month, with the range as the period", () => {
    const query = scopedBreakdown({ metric: "revenue", month: "2026-08" }, CUSTOM);
    expect(breakdownParams(query)).toEqual({ metric: "revenue", month: "2026-08", ...PERIOD, locationId: 2 });
    expect(breakdownParams(scopedBreakdown({ metric: "aging", bucket: "1_30" }, CUSTOM, null))).toEqual({
      metric: "aging",
      bucket: "1_30",
      ...PERIOD,
      locationId: null,
    });
  });

  it("month / quarter / year: unchanged (no range, no dates), even with a range kept aside", () => {
    const query = scopedBreakdown({ metric: "revenue", month: "2026-10" }, { period: "month", locationId: 2, range: RANGE });
    expect(query).toEqual({ metric: "revenue", month: "2026-10", period: "month", locationId: 2 });
    expect(breakdownParams(query)).toEqual({ metric: "revenue", month: "2026-10", period: "month", locationId: 2 });
    // Revenue without a month and without a custom range is still incomplete.
    expect(isCompleteBreakdown({ metric: "revenue", period: "quarter" })).toBe(false);
  });
});

describe("records for a breakdown row", () => {
  it("revenue by location for a range -> that location's invoices issued in it (Collected: the paid ones)", () => {
    const query = scopedBreakdown({ metric: "revenue" }, CUSTOM);
    expect(recordsForBreakdownRow(query, row("1", "I-8"))).toEqual({
      kind: "invoices",
      params: { from: "2026-10-01", to: "2026-10-15", locationId: 1, ...PERIOD },
    });
    expect(recordsForBreakdownRow(query, row("none"), { status: "paid" })?.params).toEqual({
      from: "2026-10-01",
      to: "2026-10-15",
      locationId: "none",
      status: "paid",
      ...PERIOD,
    });
  });

  it("every other level carries the range too", () => {
    expect(recordsForBreakdownRow(scopedBreakdown({ metric: "aging", bucket: "31_60" }, CUSTOM), row("3"))).toEqual({
      kind: "invoices",
      params: { bucket: "31_60", locationId: 3, ...PERIOD },
    });
    expect(recordsForBreakdownRow(scopedBreakdown({ metric: "staff", userId: 9 }, CUSTOM), row("2026-08"))).toEqual({
      kind: "quotations",
      params: { userId: 9, month: "2026-08", locationId: 2, ...PERIOD },
    });
  });

  it("a calendar period's records stay as before", () => {
    expect(recordsForBreakdownRow({ metric: "revenue", month: "2026-10", period: "month" }, row("1"))).toEqual({
      kind: "invoices",
      params: { month: "2026-10", locationId: 1 },
    });
    expect(recordsForBreakdownRow({ metric: "revenue", period: "month" }, row("1"))).toBeNull();
  });
});

describe("records straight from the dashboard", () => {
  it("funnel stages: the range as periodFrom / periodTo, no from / to (the API counts the range's days)", () => {
    expect(recordsForFunnelStage("inquiries", CUSTOM, TODAY)).toEqual({ kind: "inquiries", params: { locationId: 2, ...PERIOD } });
    expect(recordsForFunnelStage("converted", CUSTOM, TODAY)).toEqual({ kind: "quotations", params: { stage: "converted", locationId: 2, ...PERIOD } });
    expect(recordsForFunnelStage("bookings", { period: "custom", range: RANGE }, TODAY)).toEqual({ kind: "bookings", params: PERIOD });
    expect(recordsForFunnelStage("lost", CUSTOM, TODAY)).toBeNull();
  });

  it("the cards' lists carry the range too", () => {
    expect(newBookingsRecords(CUSTOM)).toEqual({ kind: "bookings", params: { locationId: 2, ...PERIOD } });
    expect(overdueInvoicesRecords(CUSTOM)).toEqual({ kind: "invoices", params: { status: "overdue", locationId: 2, ...PERIOD } });
    expect(recordsForCustomer(9, CUSTOM)).toEqual({ kind: "invoices", params: { customerId: 9, locationId: 2, ...PERIOD } });
    expect(activeBookingsRecords(CUSTOM)).toEqual({ kind: "bookings", params: { status: "active", from: "2000-01-01", locationId: 2, ...PERIOD } });
    expect(leasesExpiringRecords(CUSTOM)).toEqual({ kind: "leases", params: { locationId: 2, ...PERIOD } });
  });

  it("a calendar period with a range kept aside: exactly as before", () => {
    const month: CeoScope = { period: "month", locationId: 2, range: RANGE };
    expect(newBookingsRecords(month)).toEqual({ kind: "bookings", params: { period: "month", locationId: 2 } });
    expect(recordsForFunnelStage("inquiries", month, TODAY)).toEqual({
      kind: "inquiries",
      params: { period: "month", from: "2026-10-01", to: "2026-10-19", locationId: 2 },
    });
    expect(withDrillPeriod({ status: "overdue" }, month)).toEqual({ status: "overdue" });
  });
});

describe("KPI drill-downs for a range", () => {
  it("Invoiced / Collected open the range's invoices by location, not its months", () => {
    expect(revenueTarget({ months: [] }, "collected", CUSTOM, TODAY)).toEqual({
      kind: "breakdown",
      query: { metric: "revenue", period: "custom", range: RANGE, locationId: 2 },
      recordsParams: { status: "paid" },
    });
  });

  it("Outstanding's buckets and Occupancy's locations open breakdowns with the range", () => {
    const aging = agingTarget({ aging: [{ bucket: "1_30", label: "1-30 days", amount: 5, count: 1 }] }, CUSTOM);
    expect(aging.kind === "list" && aging.list.rows[0].open).toEqual({
      kind: "breakdown",
      query: { metric: "aging", bucket: "1_30", period: "custom", range: RANGE, locationId: 2 },
    });
    const occupancy = occupancyTarget({ byLocation: [{ locationId: 2, name: "I-8", total: 10, occupied: 4 }] }, CUSTOM);
    expect(occupancy).toEqual({
      kind: "breakdown",
      query: { metric: "occupancy-location", period: "custom", range: RANGE, locationId: 2 },
      recordsParams: { occupied: true },
    });
  });
});

describe("answers for a range", () => {
  it("custom is a period; the range and the previous range are read when sent", () => {
    expect(normalizePeriod("custom")).toBe("custom");
    const d = normalizeCeoDashboard({
      isSuccessful: true,
      data: { period: "custom", periodLabel: "1 Oct - 15 Oct 2026", from: "2026-10-01", to: "2026-10-15", previousFrom: "2026-09-16", previousTo: "2026-09-30" },
    });
    expect(d).toMatchObject({ period: "custom", periodLabel: "1 Oct - 15 Oct 2026", range: RANGE, previousRange: { from: "2026-09-16", to: "2026-09-30" } });
    expect(normalizeCeoRooms({ available: true, period: "custom", from: "2026-10-01", to: "2026-10-15", rooms: [] })).toMatchObject({
      period: "custom",
      range: RANGE,
    });
  });

  it("a calendar period's answer keeps its shape (from / to are null there)", () => {
    const d = normalizeCeoDashboard({ period: "month", from: null, to: null, previousFrom: null, previousTo: null });
    expect("range" in d).toBe(false);
    expect("previousRange" in d).toBe(false);
  });
});
