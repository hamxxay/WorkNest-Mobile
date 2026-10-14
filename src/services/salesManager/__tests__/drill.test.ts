// Sales Manager drill-down routing: each chart element / row opens the breakdown or records the contract names,
// with the right keys; tour inquiries never carry a location (they cover every branch).

import {
  SM_BREAKDOWN_ROOTS,
  isCompleteSmBreakdown,
  smBreakdownParams,
  smFollowUpsDueRecords,
  smInquiryMonthRecords,
  smInquiryOutcomeRecords,
  smMetricUnits,
  smNotInterestedRecords,
  smRecordsForBreakdownRow,
  smRecordsForFunnelStage,
} from "../drill";
import type { SmBreakdownMetric, SmBreakdownRow } from "../types";

const row = (key: string, label = key): SmBreakdownRow => ({ key, label, value: 1, value2: null, count: null });
const TODAY = new Date(2026, 9, 14); // 14 Oct 2026

describe("smBreakdownParams", () => {
  it("sends the metric, its key, the period and the location filter", () => {
    expect(smBreakdownParams({ metric: "funnel-month", month: "2026-10", period: "month", locationId: 2 })).toEqual({
      metric: "funnel-month",
      month: "2026-10",
      period: "month",
      locationId: 2,
    });
    expect(smBreakdownParams({ metric: "renewals-month", month: "2026-11", period: "quarter", locationId: null })).toEqual({
      metric: "renewals-month",
      month: "2026-11",
      period: "quarter",
      locationId: null,
    });
    expect(smBreakdownParams({ metric: "revenue-month", month: "2026-09", period: "year" })).toMatchObject({ month: "2026-09" });
    expect(smBreakdownParams({ metric: "staff", userId: 7, period: "month", locationId: 3 })).toEqual({
      metric: "staff",
      userId: 7,
      period: "month",
      locationId: 3,
    });
  });

  it("never narrows inquiries to a location", () => {
    expect(smBreakdownParams({ metric: "inquiries-type", type: "WalkIn", period: "month", locationId: 4 })).toEqual({
      metric: "inquiries-type",
      type: "WalkIn",
      period: "month",
      locationId: null,
    });
  });

  it("knows when a query lacks its key", () => {
    expect(isCompleteSmBreakdown({ metric: "funnel-month", month: "2026-10", period: "month" })).toBe(true);
    expect(isCompleteSmBreakdown({ metric: "funnel-month", month: "Oct", period: "month" })).toBe(false);
    expect(isCompleteSmBreakdown({ metric: "renewals-month", period: "month" })).toBe(false);
    expect(isCompleteSmBreakdown({ metric: "revenue-month", month: "2026-13", period: "month" })).toBe(false);
    expect(isCompleteSmBreakdown({ metric: "staff", userId: 0, period: "month" })).toBe(false);
    expect(isCompleteSmBreakdown({ metric: "staff", userId: 5, period: "month" })).toBe(true);
    expect(isCompleteSmBreakdown({ metric: "inquiries-type", type: "", period: "month" })).toBe(false);
    expect(isCompleteSmBreakdown({ metric: "inquiries-type", type: "Website", period: "month" })).toBe(true);
    expect(isCompleteSmBreakdown({ metric: "unknown" as SmBreakdownMetric, period: "month" })).toBe(false);
  });

  it("has a trail root and units for every metric", () => {
    const metrics: SmBreakdownMetric[] = ["funnel-month", "staff", "inquiries-type", "renewals-month", "revenue-month"];
    for (const m of metrics) expect(SM_BREAKDOWN_ROOTS[m]).toBeTruthy();
    expect(smMetricUnits("renewals-month")).toEqual({ value: "count", value2: "money" });
    expect(smMetricUnits("revenue-month")).toEqual({ value: "money", value2: null });
    expect(smMetricUnits("funnel-month")).toEqual({ value: "count", value2: "count" });
    expect(smMetricUnits("staff")).toEqual({ value: "count", value2: "count" });
    expect(smMetricUnits("inquiries-type")).toEqual({ value: "count", value2: null });
  });
});

describe("smRecordsForBreakdownRow (level 2 -> 3)", () => {
  it("funnel-month and revenue-month: a location row opens that month's bookings there", () => {
    for (const metric of ["funnel-month", "revenue-month"] as const) {
      expect(smRecordsForBreakdownRow({ metric, month: "2026-10", period: "month", locationId: null }, row("2", "F-7"))).toEqual({
        kind: "bookings",
        params: { month: "2026-10", locationId: 2 },
      });
    }
  });

  it("renewals-month: a location row opens the leases expiring that month there", () => {
    expect(smRecordsForBreakdownRow({ metric: "renewals-month", month: "2026-11", period: "month" }, row("1", "I-8"))).toEqual({
      kind: "leases",
      params: { month: "2026-11", locationId: 1 },
    });
  });

  it("staff: a month row opens that person's quotations that month (within the location filter)", () => {
    expect(smRecordsForBreakdownRow({ metric: "staff", userId: 5, period: "month", locationId: 3 }, row("2026-09"))).toEqual({
      kind: "quotations",
      params: { userId: 5, month: "2026-09", locationId: 3 },
    });
    expect(smRecordsForBreakdownRow({ metric: "staff", userId: 5, period: "month", locationId: null }, row("2026-09"))).toEqual({
      kind: "quotations",
      params: { userId: 5, month: "2026-09" },
    });
  });

  it("inquiries-type: a month row opens that type's inquiries that month, never with a location", () => {
    expect(smRecordsForBreakdownRow({ metric: "inquiries-type", type: "WhatsApp", period: "month", locationId: 4 }, row("2026-08"))).toEqual({
      kind: "inquiries",
      params: { type: "WhatsApp", month: "2026-08" },
    });
  });

  it("rows without a usable key open nothing", () => {
    expect(smRecordsForBreakdownRow({ metric: "funnel-month", month: "2026-10", period: "month" }, row("none", "Other"))).toBeNull();
    expect(smRecordsForBreakdownRow({ metric: "renewals-month", month: "2026-10", period: "month" }, row("2026-10"))).toBeNull();
    expect(smRecordsForBreakdownRow({ metric: "staff", userId: 5, period: "month" }, row("3"))).toBeNull();
    expect(smRecordsForBreakdownRow({ metric: "inquiries-type", type: "", period: "month" }, row("2026-08"))).toBeNull();
    expect(smRecordsForBreakdownRow({ metric: "revenue-month", period: "month" }, row("2"))).toBeNull();
  });
});

describe("direct-to-records clicks", () => {
  it("funnel stages open the period's records", () => {
    expect(smRecordsForFunnelStage("inquiries", { period: "month", locationId: 2 }, TODAY)).toEqual({
      kind: "inquiries",
      params: { period: "month", from: "2026-10-01", to: "2026-10-14" },
    });
    expect(smRecordsForFunnelStage("quotations", { period: "quarter", locationId: 2 }, TODAY)).toEqual({
      kind: "quotations",
      params: { stage: "quotations", period: "quarter", from: "2026-10-01", to: "2026-10-14", locationId: 2 },
    });
    expect(smRecordsForFunnelStage("accepted", { period: "year", locationId: null }, TODAY)).toEqual({
      kind: "quotations",
      params: { stage: "accepted", period: "year", from: "2026-01-01", to: "2026-10-14" },
    });
    expect(smRecordsForFunnelStage("bookings", { period: "month", locationId: 1 }, TODAY)).toEqual({
      kind: "bookings",
      params: { period: "month", from: "2026-10-01", to: "2026-10-14", locationId: 1 },
    });
    expect(smRecordsForFunnelStage("lost", { period: "month" }, TODAY)).toBeNull();
  });

  it("follow-ups due: open prospects due now (no period, no location)", () => {
    expect(smFollowUpsDueRecords()).toEqual({ kind: "inquiries", params: { outcome: "followup_due" } });
  });

  it("a not-interested reason: the period's not-interested inquiries, with the reason", () => {
    expect(smNotInterestedRecords("Budget", { period: "month", locationId: 2 }, TODAY)).toEqual({
      kind: "inquiries",
      params: { outcome: "not_interested", period: "month", from: "2026-10-01", to: "2026-10-14", reason: "Budget" },
    });
    expect(smNotInterestedRecords("  ", { period: "month" }, TODAY).params).not.toHaveProperty("reason");
  });

  it("inquiry outcomes and months", () => {
    expect(smInquiryOutcomeRecords("converted", { period: "quarter", locationId: 9 }, TODAY)).toEqual({
      kind: "inquiries",
      params: { outcome: "converted", period: "quarter", from: "2026-10-01", to: "2026-10-14" },
    });
    expect(smInquiryMonthRecords("2026-07")).toEqual({ kind: "inquiries", params: { month: "2026-07" } });
    expect(smInquiryMonthRecords("July")).toBeNull();
    expect(smInquiryMonthRecords(undefined)).toBeNull();
  });
});
