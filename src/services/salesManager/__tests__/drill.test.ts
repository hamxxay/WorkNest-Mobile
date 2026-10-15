// Sales Manager drill-down routing: each chart element / row opens the breakdown or records the contract names,
// with the right keys; tour inquiries carry the dashboard's location filter like every other list.

import {
  SM_BREAKDOWN_ROOTS,
  isCompleteSmBreakdown,
  isPeriodFreeList,
  smComplaintRecords,
  smDesksMonthLists,
  smExpiringLeasesRecords,
  smLocationText,
  smScopeNotes,
  smSecondaryRecordsForBreakdownRow,
  smShowsComplaintBranches,
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

describe("desks-month: bookings made and leases ending that month", () => {
  const q = (month: string) => ({ metric: "desks-month" as const, month, period: "month" as const, locationId: null });
  const desksRow = (value: number, value2: number | null): SmBreakdownRow => ({ key: "1", label: "I-8", value, value2, count: null });

  it("a future month opens the leases ending then (nothing can be booked in it yet), with no second list", () => {
    // Nov 2026 seen on 14 Oct 2026: 0 desks booked, 3 ending (the QA case: the bookings list was empty).
    expect(smDesksMonthLists("2026-11", desksRow(0, 3), TODAY)).toEqual({ primary: "leases", secondary: null });
    expect(smRecordsForBreakdownRow(q("2026-11"), desksRow(0, 3), TODAY)).toEqual({ kind: "leases", params: { month: "2026-11", locationId: 1 } });
    expect(smRecordsForBreakdownRow(q("2027-01"), desksRow(0, 0), TODAY)?.kind).toBe("leases");
    expect(smSecondaryRecordsForBreakdownRow(q("2026-11"), desksRow(0, 3), TODAY)).toBeNull();
  });

  it("no desks booked but desks ending: the leases, offering the month's bookings too", () => {
    expect(smRecordsForBreakdownRow(q("2026-09"), desksRow(0, 4), TODAY)?.kind).toBe("leases");
    expect(smSecondaryRecordsForBreakdownRow(q("2026-09"), desksRow(0, 4), TODAY)).toEqual({
      title: "Bookings made in Sep 2026",
      subtitle: "0 desks booked",
      records: { kind: "bookings", params: { month: "2026-09", locationId: 1 } },
    });
  });

  it("desks booked: the bookings, offering the leases ending that month when there are any", () => {
    expect(smRecordsForBreakdownRow(q("2026-10"), desksRow(82, 3), TODAY)).toEqual({ kind: "bookings", params: { month: "2026-10", locationId: 1 } });
    expect(smSecondaryRecordsForBreakdownRow(q("2026-10"), desksRow(82, 3), TODAY)).toEqual({
      title: "Leases ending in Oct 2026",
      subtitle: "3 desks ending",
      records: { kind: "leases", params: { month: "2026-10", locationId: 1 } },
    });
    expect(smSecondaryRecordsForBreakdownRow(q("2026-10"), desksRow(82, 0), TODAY)).toBeNull();
    // A past month with nothing at all: its bookings (meeting rooms hold 0 desks).
    expect(smRecordsForBreakdownRow(q("2026-08"), desksRow(0, 0), TODAY)?.kind).toBe("bookings");
  });

  it("other metrics and rows without a location offer no second list", () => {
    expect(smSecondaryRecordsForBreakdownRow({ metric: "funnel-month", month: "2026-10", period: "month" }, desksRow(5, 3), TODAY)).toBeNull();
    expect(smSecondaryRecordsForBreakdownRow(q("2026-10"), { ...desksRow(5, 3), key: "none" }, TODAY)).toBeNull();
  });
});

describe("leases expiring: the full list", () => {
  it("the next 90 days (the API's default window), or the next 30 as from / to; with the location filter", () => {
    expect(smExpiringLeasesRecords({ locationId: 2 })).toEqual({ kind: "leases", params: { locationId: 2 } });
    expect(smExpiringLeasesRecords({})).toEqual({ kind: "leases", params: {} });
    expect(smExpiringLeasesRecords({ locationId: null }, 30, TODAY)).toEqual({ kind: "leases", params: { from: "2026-10-14", to: "2026-11-13" } });
    expect(smExpiringLeasesRecords({ locationId: 1 }, 30, new Date(2026, 11, 20))).toEqual({
      kind: "leases",
      params: { from: "2026-12-20", to: "2027-01-19", locationId: 1 },
    });
  });

  it("lists not bound to the period name only the location", () => {
    expect(isPeriodFreeList(smExpiringLeasesRecords({}))).toBe(true);
    expect(isPeriodFreeList({ kind: "leases", params: { month: "2026-11" } })).toBe(false);
    expect(isPeriodFreeList(smComplaintRecords({ status: "open" }, { period: "month" })!)).toBe(true);
    expect(isPeriodFreeList(smComplaintRecords({ branch: "" }, { period: "month" })!)).toBe(true);
    expect(isPeriodFreeList(smComplaintRecords({ category: "Cleaning" }, { period: "month" })!)).toBe(false);
    expect(isPeriodFreeList(smComplaintRecords({ status: "new_period" }, { period: "month" })!)).toBe(false);
    expect(isPeriodFreeList({ kind: "bookings", params: {} })).toBe(false);
  });
});

describe("complaints by branch", () => {
  const b = (branch: string) => ({ branch, label: branch || "No branch", open: 1, inProgress: 0, total: 2 });
  it("shown for more than one branch or complaints without a branch; a branch opens its complaints (none = no branch)", () => {
    expect(smShowsComplaintBranches([b("I-8"), b("F-7")])).toBe(true);
    expect(smShowsComplaintBranches([b("")])).toBe(true);
    expect(smShowsComplaintBranches([b("I-8"), b("")])).toBe(true);
    expect(smShowsComplaintBranches([b("I-8")])).toBe(false);
    expect(smShowsComplaintBranches([])).toBe(false);
    expect(smComplaintRecords({ branch: "" }, { period: "month" })).toEqual({ kind: "complaints", params: { branch: "none", period: "month" } });
    expect(smComplaintRecords({ branch: "I-8" }, { period: "month", locationId: 1 })).toEqual({
      kind: "complaints",
      params: { branch: "I-8", locationId: 1, period: "month" },
    });
  });
});

describe("scope wording", () => {
  const one = [{ locationId: 1, name: "I-8" }];
  const two = [...one, { locationId: 2, name: "F-7" }];

  it("a manager with one location: its name, and inquiry / complaint lists include the items without a branch", () => {
    expect(smLocationText({ locations: one })).toBe("I-8");
    expect(smLocationText({ locations: one, kind: "bookings" })).toBe("I-8");
    expect(smLocationText({ locations: one, kind: "inquiries" })).toBe("I-8 (plus items without a branch)");
    expect(smLocationText({ locations: one, kind: "inquiries-type" })).toBe("I-8 (plus items without a branch)");
    expect(smLocationText({ locations: one, kind: "complaints" })).toBe("I-8 (plus items without a branch)");
    // A list of one branch already is that branch's only.
    expect(smLocationText({ locations: one, kind: "complaints", narrowedToBranch: true })).toBe("I-8");
  });

  it("several locations: All my locations, or the chosen one (then only its branch's items)", () => {
    expect(smLocationText({ locations: two })).toBe("All my locations");
    expect(smLocationText({ locations: two, kind: "complaints" })).toBe("All my locations (plus items without a branch)");
    expect(smLocationText({ locations: two, locationId: 2, kind: "inquiries" })).toBe("F-7");
    expect(smLocationText({ locations: two, locationId: 9 })).toBe("One location");
  });

  it("notes: no reference to a picker a one-location manager cannot see; BR_02 not run says every branch", () => {
    expect(smScopeNotes({ singleLocation: true, inquiriesAllBranches: false })).toEqual({
      inquiries: "Includes inquiries without a branch",
      complaints: "Includes complaints without a branch (WhatsApp)",
    });
    expect(smScopeNotes({ singleLocation: false, inquiriesAllBranches: false })).toEqual({
      inquiries: "Inquiries without a branch show under All my locations",
      complaints: "Complaints without a branch (WhatsApp) show under All my locations",
    });
    expect(smScopeNotes({ singleLocation: true, inquiriesAllBranches: true }).inquiries).toBe(
      "Counts inquiries from every branch until database update BR_02 is run",
    );
    expect(smScopeNotes({ singleLocation: false, inquiriesAllBranches: true }).inquiries).toBe(
      "Counts inquiries from every branch until database update BR_02 is run",
    );
  });
});
