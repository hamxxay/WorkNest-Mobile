// A custom date range on the Sales Manager dashboard: every drill-down call carries the same range (period=custom,
// periodFrom / periodTo), and month / quarter / year drill-downs are built exactly as before.

import {
  smBreakdownParams,
  smComplaintRecords,
  smExpiringLeasesRecords,
  smFollowUpsDueRecords,
  smInquiryMonthRecords,
  smInquiryOutcomeRecords,
  smNotInterestedRecords,
  smRecordsForBreakdownRow,
  smRecordsForFunnelStage,
  smSecondaryRecordsForBreakdownRow,
} from "../drill";
import { normalizeSalesManagerComplaints, normalizeSalesManagerDashboard } from "../normalize";
import type { SmBreakdownRow, SmScope } from "../types";

const RANGE = { from: "2026-10-01", to: "2026-10-15" };
const CUSTOM: SmScope = { period: "custom", locationId: 3, range: RANGE };
const PERIOD = { period: "custom", periodFrom: "2026-10-01", periodTo: "2026-10-15" };
const TODAY = new Date(2026, 9, 19);
const row = (key: string, value = 4, value2: number | null = 2): SmBreakdownRow => ({ key, label: key, value, value2, count: null });

describe("breakdowns", () => {
  it("send the range as periodFrom / periodTo; calendar periods as before", () => {
    expect(smBreakdownParams({ metric: "desks-month", month: "2026-09", period: "custom", range: RANGE, locationId: 3 })).toEqual({
      metric: "desks-month",
      month: "2026-09",
      ...PERIOD,
      locationId: 3,
    });
    expect(smBreakdownParams({ metric: "staff", userId: 5, period: "month", range: RANGE, locationId: null })).toEqual({
      metric: "staff",
      userId: 5,
      period: "month",
      locationId: null,
    });
  });

  it("their rows' records carry the range (both lists of a desks month too)", () => {
    const query = { metric: "desks-month" as const, month: "2026-09", period: "custom" as const, range: RANGE, locationId: 3 };
    expect(smRecordsForBreakdownRow(query, row("3"), TODAY)).toEqual({ kind: "bookings", params: { month: "2026-09", locationId: 3, ...PERIOD } });
    expect(smSecondaryRecordsForBreakdownRow(query, row("3"), TODAY)?.records).toEqual({
      kind: "leases",
      params: { month: "2026-09", locationId: 3, ...PERIOD },
    });
    expect(smRecordsForBreakdownRow({ metric: "staff", userId: 5, period: "custom", range: RANGE }, row("2026-08"), TODAY)).toEqual({
      kind: "quotations",
      params: { userId: 5, month: "2026-08", ...PERIOD },
    });
    // A calendar period: unchanged.
    expect(smRecordsForBreakdownRow({ metric: "funnel-month", month: "2026-09", period: "month" }, row("3"), TODAY)).toEqual({
      kind: "bookings",
      params: { month: "2026-09", locationId: 3 },
    });
  });
});

describe("records straight from the dashboard", () => {
  it("funnel stages and inquiry outcomes: periodFrom / periodTo instead of from / to", () => {
    expect(smRecordsForFunnelStage("inquiries", CUSTOM, TODAY)).toEqual({ kind: "inquiries", params: { locationId: 3, ...PERIOD } });
    expect(smRecordsForFunnelStage("accepted", CUSTOM, TODAY)).toEqual({ kind: "quotations", params: { stage: "accepted", locationId: 3, ...PERIOD } });
    expect(smRecordsForFunnelStage("bookings", CUSTOM, TODAY)).toEqual({ kind: "bookings", params: { locationId: 3, ...PERIOD } });
    expect(smRecordsForFunnelStage("lost", CUSTOM, TODAY)).toBeNull();
    expect(smInquiryOutcomeRecords("converted", CUSTOM, TODAY)).toEqual({ kind: "inquiries", params: { outcome: "converted", locationId: 3, ...PERIOD } });
    expect(smNotInterestedRecords("Too far", CUSTOM, TODAY)).toEqual({
      kind: "inquiries",
      params: { outcome: "not_interested", reason: "Too far", locationId: 3, ...PERIOD },
    });
  });

  it("the other lists carry the range too", () => {
    expect(smFollowUpsDueRecords(CUSTOM)).toEqual({ kind: "inquiries", params: { outcome: "followup_due", locationId: 3, ...PERIOD } });
    expect(smExpiringLeasesRecords(CUSTOM)).toEqual({ kind: "leases", params: { locationId: 3, ...PERIOD } });
    expect(smExpiringLeasesRecords(CUSTOM, 30, TODAY)).toEqual({ kind: "leases", params: { from: "2026-10-19", to: "2026-11-18", locationId: 3, ...PERIOD } });
    expect(smInquiryMonthRecords("2026-09", CUSTOM)).toEqual({ kind: "inquiries", params: { month: "2026-09", locationId: 3, ...PERIOD } });
  });

  it("complaints: status and category lists with the range; a month list is that month only", () => {
    expect(smComplaintRecords({ status: "new_period" }, CUSTOM)).toEqual({ kind: "complaints", params: { status: "new_period", locationId: 3, ...PERIOD } });
    expect(smComplaintRecords({ category: "Wi-Fi" }, CUSTOM)).toEqual({ kind: "complaints", params: { category: "Wi-Fi", locationId: 3, ...PERIOD } });
    expect(smComplaintRecords({ month: "2026-09" }, CUSTOM)).toEqual({ kind: "complaints", params: { month: "2026-09", locationId: 3 } });
  });

  it("a calendar period with a range kept aside: exactly as before", () => {
    const quarter: SmScope = { period: "quarter", locationId: 3, range: RANGE };
    expect(smRecordsForFunnelStage("bookings", quarter, TODAY)).toEqual({
      kind: "bookings",
      params: { period: "quarter", from: "2026-10-01", to: "2026-10-19", locationId: 3 },
    });
    expect(smComplaintRecords({ status: "new_period" }, quarter)).toEqual({ kind: "complaints", params: { status: "new_period", locationId: 3, period: "quarter" } });
    expect(smFollowUpsDueRecords(quarter)).toEqual({ kind: "inquiries", params: { outcome: "followup_due", locationId: 3 } });
  });
});

describe("answers for a range", () => {
  it("the dashboard and the complaints read the period and the ranges when sent", () => {
    const d = normalizeSalesManagerDashboard({
      period: "custom",
      periodLabel: "1 Oct - 15 Oct 2026",
      from: "2026-10-01",
      to: "2026-10-15",
      previousFrom: "2026-09-16",
      previousTo: "2026-09-30",
    });
    expect(d).toMatchObject({ period: "custom", range: RANGE, previousRange: { from: "2026-09-16", to: "2026-09-30" } });
    expect(normalizeSalesManagerComplaints({ period: "custom", from: "2026-10-01", to: "2026-10-15" })).toMatchObject({ period: "custom", range: RANGE });
    expect("range" in normalizeSalesManagerDashboard({ period: "month", from: null, to: null })).toBe(false);
  });
});
