// KPI cards -> drill-down (owner's request, 16 Oct 2026): every major CEO card opens a breakdown, a list built from
// the dashboard's own figures (no API call) or records, with the period, the location and the right filters; the
// next level of each list row, and the texts of those rows.

import {
  ALL_TIME_FROM,
  activeBookingsRecords,
  agingTarget,
  drillListFormat,
  drillListRowDetail,
  occupancyTarget,
  periodMonths,
  recordsForBreakdownRow,
  recordsForFunnelStage,
  revenueTarget,
} from "../drill";
import { normalizeAging } from "../normalize";
import type { CeoBreakdownRow, CeoDrillList, CeoDrillTarget } from "../types";

const TODAY = new Date(2026, 9, 16); // 16 Oct 2026
const MONTHS = [
  { month: "2025-12", invoiced: 50, collected: 40 },
  { month: "2026-08", invoiced: 300, collected: 250 },
  { month: "2026-10", invoiced: 900, collected: 600 },
];

const listOf = (t: CeoDrillTarget): CeoDrillList => {
  if (t.kind !== "list") throw new Error(`expected a list, got ${t.kind}`);
  return t.list;
};

describe("periodMonths", () => {
  it("the months of the period to date", () => {
    expect(periodMonths("month", TODAY)).toEqual(["2026-10"]);
    expect(periodMonths("quarter", TODAY)).toEqual(["2026-10"]);
    expect(periodMonths("quarter", new Date(2026, 7, 3))).toEqual(["2026-07", "2026-08"]);
    expect(periodMonths("year", new Date(2026, 2, 31))).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
});

describe("Invoiced / Collected", () => {
  it("this month: straight to this month by location (Collected: the paid invoices next)", () => {
    expect(revenueTarget({ months: MONTHS }, "invoiced", { period: "month", locationId: 3 }, TODAY)).toEqual({
      kind: "breakdown",
      query: { metric: "revenue", month: "2026-10", period: "month", locationId: 3 },
      recordsParams: undefined,
    });
    expect(revenueTarget({ months: MONTHS }, "collected", { period: "month" }, TODAY)).toEqual({
      kind: "breakdown",
      query: { metric: "revenue", month: "2026-10", period: "month", locationId: null },
      recordsParams: { status: "paid" },
    });
  });

  it("quarter / year: the months of the period from the dashboard, missing ones as zero, each by location", () => {
    const list = listOf(revenueTarget({ months: MONTHS }, "invoiced", { period: "year", locationId: 2 }, TODAY));
    expect(list).toMatchObject({
      title: "Invoiced by month",
      subtitle: "Invoiced and collected this year. Tap a month to see it by location.",
      valueLabel: "Invoiced",
      value2Label: "Collected",
      unit: "money",
      rowHint: "Opens this month by location",
    });
    expect(list.rows).toHaveLength(10);
    expect(list.rows.map((r) => [r.key, r.label, r.value, r.value2]).filter((r) => r[2])).toEqual([
      ["2026-08", "Aug 2026", 300, 250],
      ["2026-10", "Oct 2026", 900, 600],
    ]);
    expect(list.rows[0]).toMatchObject({ key: "2026-01", value: 0, value2: 0 });
    expect(list.rows[9].open).toEqual({ kind: "breakdown", query: { metric: "revenue", month: "2026-10", period: "year", locationId: 2 }, recordsParams: undefined });

    const collected = listOf(revenueTarget({ months: MONTHS }, "collected", { period: "quarter" }, new Date(2026, 7, 20)));
    expect(collected).toMatchObject({ title: "Collected by month", valueLabel: "Collected", value2Label: "Invoiced" });
    expect(collected.rows.map((r) => [r.label, r.value, r.value2])).toEqual([
      ["Jul 2026", 0, 0],
      ["Aug 2026", 250, 300],
    ]);
    expect(collected.rows[1].open).toMatchObject({ recordsParams: { status: "paid" } });
  });

  it("the breakdown's rows then open that month's invoices for the location (paid ones from Collected)", () => {
    const query = { metric: "revenue" as const, month: "2026-10", period: "month" as const };
    const row: CeoBreakdownRow = { key: "4", label: "I-8", value: 1, value2: 1, count: 2 };
    expect(recordsForBreakdownRow(query, row, { status: "paid" })).toEqual({ kind: "invoices", params: { month: "2026-10", locationId: 4, status: "paid" } });
    expect(recordsForBreakdownRow(query, row)).toEqual({ kind: "invoices", params: { month: "2026-10", locationId: 4 } });
    expect(recordsForBreakdownRow(query, { ...row, key: "Other" }, { status: "paid" })).toBeNull();
  });
});

describe("Outstanding", () => {
  it("the aging buckets, each opening that bucket by location (then its open invoices)", () => {
    const aging = normalizeAging([
      { bucket: "1_30", amount: 5000, count: 2 },
      { bucket: "90_plus", amount: 9000, count: 1 },
    ]);
    const list = listOf(agingTarget({ aging }, { period: "quarter", locationId: 5 }));
    expect(list).toMatchObject({ title: "Outstanding by age", valueLabel: "Amount", value2Label: null, unit: "money", rowHint: "Opens this bucket by location" });
    expect(list.rows.map((r) => [r.key, r.label, r.value, r.count])).toEqual([
      ["not_due", "Not due", 0, 0],
      ["1_30", "1-30 days", 5000, 2],
      ["31_60", "31-60 days", 0, 0],
      ["61_90", "61-90 days", 0, 0],
      ["90_plus", "Over 90 days", 9000, 1],
    ]);
    expect(list.rows[4].open).toEqual({ kind: "breakdown", query: { metric: "aging", bucket: "90_plus", period: "quarter", locationId: 5 } });
    expect(drillListRowDetail(list, list.rows[1])).toBe("Amount PKR 5K · 2 invoices");
    expect(drillListRowDetail(list, list.rows[4])).toBe("Amount PKR 9K · 1 invoice");
  });

  it("without buckets from the server: the unpaid invoices", () => {
    expect(agingTarget({ aging: [] }, { period: "month", locationId: 2 })).toEqual({
      kind: "records",
      query: { kind: "invoices", params: { status: "open", locationId: 2 } },
      title: "Outstanding invoices",
    });
  });
});

describe("Occupancy", () => {
  const byLocation = [
    { locationId: 1, name: "I-8", total: 20, occupied: 15 },
    { locationId: 2, name: "F-7", total: 10, occupied: 4 },
    { locationId: 3, name: "Empty", total: 0, occupied: 0 },
  ];

  it("by location (locations with spaces), each opening that location by space type", () => {
    const list = listOf(occupancyTarget({ byLocation }, { period: "month" }));
    expect(list).toMatchObject({ title: "Occupancy by location", valueLabel: "Occupied", value2Label: "Total spaces", unit: "occupancy" });
    expect(list.rows.map((r) => [r.key, r.label, r.value, r.value2])).toEqual([
      ["1", "I-8", 15, 20],
      ["2", "F-7", 4, 10],
    ]);
    expect(list.rows[1].open).toEqual({ kind: "breakdown", query: { metric: "occupancy-location", period: "month", locationId: 2 } });
    expect(drillListRowDetail(list, list.rows[0])).toBe("75% · 15 of 20 spaces in use");
    expect(drillListFormat(list)(15)).toBe("15");
  });

  it("one location chosen on the dashboard: that location by space type straight away", () => {
    expect(occupancyTarget({ byLocation }, { period: "year", locationId: 2 })).toEqual({
      kind: "breakdown",
      query: { metric: "occupancy-location", period: "year", locationId: 2 },
    });
  });
});

describe("cards that open records", () => {
  it("Active bookings: bookings running today, made at any time, for the chosen location", () => {
    expect(activeBookingsRecords({ locationId: 4 })).toEqual({ kind: "bookings", params: { status: "active", from: ALL_TIME_FROM, locationId: 4 } });
    expect(activeBookingsRecords({ locationId: null })).toEqual({ kind: "bookings", params: { status: "active", from: "2000-01-01" } });
  });

  it("Conversion: the quotations converted to bookings in the period", () => {
    expect(recordsForFunnelStage("converted", { period: "month", locationId: 2 }, TODAY)).toEqual({
      kind: "quotations",
      params: { stage: "converted", period: "month", from: "2026-10-01", to: "2026-10-16", locationId: 2 },
    });
  });

  it("money list rows read both values", () => {
    const list = listOf(revenueTarget({ months: MONTHS }, "invoiced", { period: "year" }, TODAY));
    expect(drillListRowDetail(list, list.rows[9])).toBe("Invoiced PKR 900 · Collected PKR 600");
  });
});
