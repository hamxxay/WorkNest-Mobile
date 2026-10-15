// Sales Manager drill-down routing: each chart element / row opens the breakdown or records the contract names,
// with the right keys; tour inquiries carry the dashboard's location filter like every other list.

import {
  SM_BREAKDOWN_ROOTS,
  isCompleteSmBreakdown,
  smBreakdownParams,
  smBreakdownRowDetail,
  smBreakdownRowFigure,
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
    expect(smBreakdownParams({ metric: "desks-month", month: "2026-09", period: "year" })).toEqual({
      metric: "desks-month",
      month: "2026-09",
      period: "year",
      locationId: null,
    });
    expect(smBreakdownParams({ metric: "staff", userId: 7, period: "month", locationId: 3 })).toEqual({
      metric: "staff",
      userId: 7,
      period: "month",
      locationId: 3,
    });
  });

  it("narrows inquiries to the chosen location (none = all the manager's locations)", () => {
    expect(smBreakdownParams({ metric: "inquiries-type", type: "WalkIn", period: "month", locationId: 4 })).toEqual({
      metric: "inquiries-type",
      type: "WalkIn",
      period: "month",
      locationId: 4,
    });
    expect(smBreakdownParams({ metric: "inquiries-type", type: "WalkIn", period: "month", locationId: null })).toEqual({
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
    expect(isCompleteSmBreakdown({ metric: "desks-month", month: "2026-13", period: "month" })).toBe(false);
    expect(isCompleteSmBreakdown({ metric: "desks-month", month: "2026-12", period: "month" })).toBe(true);
    // The money metric is gone.
    expect(isCompleteSmBreakdown({ metric: "revenue-month" as SmBreakdownMetric, month: "2026-10", period: "month" })).toBe(false);
    expect(isCompleteSmBreakdown({ metric: "staff", userId: 0, period: "month" })).toBe(false);
    expect(isCompleteSmBreakdown({ metric: "staff", userId: 5, period: "month" })).toBe(true);
    expect(isCompleteSmBreakdown({ metric: "inquiries-type", type: "", period: "month" })).toBe(false);
    expect(isCompleteSmBreakdown({ metric: "inquiries-type", type: "Website", period: "month" })).toBe(true);
    expect(isCompleteSmBreakdown({ metric: "unknown" as SmBreakdownMetric, period: "month" })).toBe(false);
  });

  it("has a trail root and units for every metric, and no money anywhere", () => {
    const metrics: SmBreakdownMetric[] = ["funnel-month", "staff", "inquiries-type", "renewals-month", "desks-month"];
    for (const m of metrics) expect(SM_BREAKDOWN_ROOTS[m]).toBeTruthy();
    expect(SM_BREAKDOWN_ROOTS["desks-month"]).toBe("Desks");
    // Desks booked / bookings; quotations / desks sold; leases ending / desks; desks booked / desks ending.
    expect(smMetricUnits("funnel-month")).toEqual({ value: "desks", value2: "count" });
    expect(smMetricUnits("staff")).toEqual({ value: "count", value2: "desks" });
    expect(smMetricUnits("renewals-month")).toEqual({ value: "count", value2: "desks" });
    expect(smMetricUnits("desks-month")).toEqual({ value: "desks", value2: "desks" });
    expect(smMetricUnits("inquiries-type")).toEqual({ value: "count", value2: null });
    for (const m of metrics) expect(Object.values(smMetricUnits(m))).not.toContain("money");
  });
});

describe("breakdown row wording", () => {
  const r = (value: number, value2: number | null, count: number | null = null): SmBreakdownRow => ({ key: "1", label: "I-8", value, value2, count });

  it("shows the desks on the right, with the unit word", () => {
    expect(smBreakdownRowFigure("funnel-month", r(91, 17))).toBe("91 desks");
    expect(smBreakdownRowFigure("desks-month", r(1, 6))).toBe("1 desk");
    // Staff and renewals: desks are the second value (desks sold, the leases' desks).
    expect(smBreakdownRowFigure("staff", r(6, 4))).toBe("4 desks");
    expect(smBreakdownRowFigure("renewals-month", r(2, 1))).toBe("1 desk");
    expect(smBreakdownRowFigure("renewals-month", r(2, null))).toBeUndefined();
    // No desks: the plain count.
    expect(smBreakdownRowFigure("inquiries-type", r(1250, null))).toBe("1,250");
  });

  it("lists both values under the name, the labels carrying the words", () => {
    expect(smBreakdownRowDetail({ valueLabel: "Desks booked", value2Label: "Bookings" }, r(91, 17))).toBe("Desks booked 91 · Bookings 17");
    expect(smBreakdownRowDetail({ valueLabel: "Leases ending", value2Label: "Desks" }, r(2, 6, 9))).toBe("Leases ending 2 · Desks 6 · 9 in total");
    expect(smBreakdownRowDetail({ valueLabel: "Inquiries", value2Label: null }, r(3, 5))).toBe("Inquiries 3");
    expect(smBreakdownRowDetail({ valueLabel: "Desks booked", value2Label: "Desks ending" }, r(4, null))).toBe("Desks booked 4");
    expect(smBreakdownRowDetail({ valueLabel: "Desks booked", value2Label: "Bookings" }, r(91, 17))).not.toMatch(/PKR/);
  });
});

describe("smRecordsForBreakdownRow (level 2 -> 3)", () => {
  it("funnel-month and desks-month: a location row opens that month's bookings there", () => {
    for (const metric of ["funnel-month", "desks-month"] as const) {
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

  it("inquiries-type: a month row opens that type's inquiries that month, with the location filter", () => {
    expect(smRecordsForBreakdownRow({ metric: "inquiries-type", type: "WhatsApp", period: "month", locationId: 4 }, row("2026-08"))).toEqual({
      kind: "inquiries",
      params: { type: "WhatsApp", month: "2026-08", locationId: 4 },
    });
    expect(smRecordsForBreakdownRow({ metric: "inquiries-type", type: "WhatsApp", period: "month", locationId: null }, row("2026-08"))).toEqual({
      kind: "inquiries",
      params: { type: "WhatsApp", month: "2026-08" },
    });
  });

  it("rows without a usable key open nothing", () => {
    expect(smRecordsForBreakdownRow({ metric: "funnel-month", month: "2026-10", period: "month" }, row("none", "Other"))).toBeNull();
    expect(smRecordsForBreakdownRow({ metric: "renewals-month", month: "2026-10", period: "month" }, row("2026-10"))).toBeNull();
    expect(smRecordsForBreakdownRow({ metric: "staff", userId: 5, period: "month" }, row("3"))).toBeNull();
    expect(smRecordsForBreakdownRow({ metric: "inquiries-type", type: "", period: "month" }, row("2026-08"))).toBeNull();
    expect(smRecordsForBreakdownRow({ metric: "desks-month", period: "month" }, row("2"))).toBeNull();
  });
});

describe("direct-to-records clicks", () => {
  it("funnel stages open the period's records", () => {
    expect(smRecordsForFunnelStage("inquiries", { period: "month", locationId: 2 }, TODAY)).toEqual({
      kind: "inquiries",
      params: { period: "month", from: "2026-10-01", to: "2026-10-14", locationId: 2 },
    });
    expect(smRecordsForFunnelStage("inquiries", { period: "month", locationId: null }, TODAY)).toEqual({
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

  it("follow-ups due: open prospects due now (no period), with the location filter", () => {
    expect(smFollowUpsDueRecords()).toEqual({ kind: "inquiries", params: { outcome: "followup_due" } });
    expect(smFollowUpsDueRecords({ locationId: null })).toEqual({ kind: "inquiries", params: { outcome: "followup_due" } });
    expect(smFollowUpsDueRecords({ locationId: 3 })).toEqual({
      kind: "inquiries",
      params: { outcome: "followup_due", locationId: 3 },
    });
  });

  it("a not-interested reason: the period's not-interested inquiries, with the reason", () => {
    expect(smNotInterestedRecords("Budget", { period: "month", locationId: 2 }, TODAY)).toEqual({
      kind: "inquiries",
      params: { outcome: "not_interested", period: "month", from: "2026-10-01", to: "2026-10-14", locationId: 2, reason: "Budget" },
    });
    expect(smNotInterestedRecords("  ", { period: "month" }, TODAY).params).not.toHaveProperty("reason");
  });

  it("inquiry outcomes and months", () => {
    expect(smInquiryOutcomeRecords("converted", { period: "quarter", locationId: 9 }, TODAY)).toEqual({
      kind: "inquiries",
      params: { outcome: "converted", period: "quarter", from: "2026-10-01", to: "2026-10-14", locationId: 9 },
    });
    expect(smInquiryOutcomeRecords("open", { period: "month", locationId: null }, TODAY)).toEqual({
      kind: "inquiries",
      params: { outcome: "open", period: "month", from: "2026-10-01", to: "2026-10-14" },
    });
    expect(smInquiryMonthRecords("2026-07")).toEqual({ kind: "inquiries", params: { month: "2026-07" } });
    expect(smInquiryMonthRecords("2026-07", { locationId: 5 })).toEqual({ kind: "inquiries", params: { month: "2026-07", locationId: 5 } });
    expect(smInquiryMonthRecords("July", { locationId: 5 })).toBeNull();
    expect(smInquiryMonthRecords("July")).toBeNull();
    expect(smInquiryMonthRecords(undefined)).toBeNull();
  });
});
