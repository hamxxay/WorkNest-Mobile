// Sales Manager complaints (GET api/sales-manager/complaints, records/complaints): the contract's JSON read as typed
// data, partial answers turned into 0 / null / [] instead of errors, the drill-down queries, the record cards and
// the display helpers. No money anywhere.

import { isCurrentComplaintsList, smComplaintRecords } from "../drill";
import {
  SM_COMPLAINT_STATUSES,
  SM_COMPLAINT_STATUS_LABELS,
  avgResolutionText,
  complaintAgeText,
  complaintAgeTone,
  complaintSourceLabel,
  complaintStatusTone,
} from "../format";
import { normalizeSalesManagerComplaints, normalizeSalesManagerRecords, normalizeSmComplaintStatus, toComplaintRecord } from "../normalize";
import { complaintCard, smRecordCards } from "../records";
import type { SmComplaintRecord } from "../types";

const FULL = {
  isSuccessful: true,
  data: {
    period: "quarter",
    periodLabel: "Q4 2026",
    status: { open: 4, inProgress: 3, resolved: 2, closed: 10 },
    activeTotal: 7,
    newInPeriod: 9,
    newInPeriodPrev: 6,
    resolvedInPeriod: 5,
    reopenedInPeriod: 1,
    avgResolutionDays: 1.54,
    byCategory: [
      { category: "Internet / WiFi", open: 2, inProgress: 1, total: 4 },
      { category: null, open: 1, inProgress: 0, total: 2 },
    ],
    byBranch: [
      { branch: "I-8", label: "I-8", open: 3, inProgress: 2, total: 6 },
      { branch: "", open: 1, inProgress: 1, total: 3 },
    ],
    months: [
      { month: "2026-10", created: 5, resolved: 3 },
      { month: "2025-11", created: 1, resolved: 0 },
    ],
    oldestActive: [
      {
        complaintId: 12,
        complaintNo: "CMP-0012",
        customerName: "Ali Khan",
        category: "Cleaning",
        branch: "I-8",
        status: "In Progress",
        createdOn: "2026-10-01T09:00:00",
        ageDays: 14,
      },
    ],
  },
};

describe("normalizeSalesManagerComplaints", () => {
  it("reads the contract's shape (envelope unwrapped, months oldest first)", () => {
    const c = normalizeSalesManagerComplaints(FULL, "month");
    expect(c.period).toBe("quarter");
    expect(c.periodLabel).toBe("Q4 2026");
    expect(c.status).toEqual({ open: 4, inProgress: 3, resolved: 2, closed: 10 });
    expect(c.activeTotal).toBe(7);
    expect(c).toMatchObject({ newInPeriod: 9, newInPeriodPrev: 6, resolvedInPeriod: 5, reopenedInPeriod: 1 });
    expect(c.avgResolutionDays).toBe(1.5);
    expect(c.byCategory).toEqual([
      { category: "Internet / WiFi", open: 2, inProgress: 1, total: 4 },
      { category: "Other", open: 1, inProgress: 0, total: 2 },
    ]);
    expect(c.byBranch).toEqual([
      { branch: "I-8", label: "I-8", open: 3, inProgress: 2, total: 6 },
      { branch: "", label: "No branch", open: 1, inProgress: 1, total: 3 },
    ]);
    expect(c.months.map((m) => m.month)).toEqual(["2025-11", "2026-10"]);
    expect(c.oldestActive).toEqual([
      {
        complaintId: 12,
        complaintNo: "CMP-0012",
        customerName: "Ali Khan",
        category: "Cleaning",
        branch: "I-8",
        status: "in_progress",
        createdOn: "2026-10-01T09:00:00",
        ageDays: 14,
      },
    ]);
    expect(JSON.stringify(c)).not.toMatch(/PKR|amount/i);
  });

  it("turns missing fields into 0, null and empty lists", () => {
    const c = normalizeSalesManagerComplaints({ isSuccessful: true, data: {} }, "year");
    expect(c).toEqual({
      period: "year",
      periodLabel: "",
      status: { open: 0, inProgress: 0, resolved: 0, closed: 0 },
      activeTotal: 0,
      newInPeriod: 0,
      newInPeriodPrev: null,
      resolvedInPeriod: 0,
      reopenedInPeriod: 0,
      avgResolutionDays: null,
      byCategory: [],
      byBranch: [],
      months: [],
      oldestActive: [],
    });
    // Garbage instead of an object: the same empty figures.
    expect(normalizeSalesManagerComplaints(null).status.open).toBe(0);
    expect(normalizeSalesManagerComplaints("oops").months).toEqual([]);
  });

  it("works the active total out from the status counts when it is not sent, and reads PascalCase", () => {
    const c = normalizeSalesManagerComplaints({ Status: { Open: "2", InProgress: 5 }, NewInPeriod: "3", AvgResolutionDays: -1 });
    expect(c.status).toEqual({ open: 2, inProgress: 5, resolved: 0, closed: 0 });
    expect(c.activeTotal).toBe(7);
    expect(c.newInPeriod).toBe(3);
    expect(c.avgResolutionDays).toBeNull();
  });

  it("skips rows that are not objects and fills a row's missing fields", () => {
    const c = normalizeSalesManagerComplaints({ byCategory: [null, 3, {}], oldestActive: [{}], months: [{ month: "2026-09" }] });
    expect(c.byCategory).toEqual([{ category: "Other", open: 0, inProgress: 0, total: 0 }]);
    expect(c.oldestActive).toEqual([
      { complaintId: null, complaintNo: null, customerName: null, category: "Other", branch: null, status: null, createdOn: null, ageDays: null },
    ]);
    expect(c.months).toEqual([{ month: "2026-09", created: 0, resolved: 0 }]);
  });
});

describe("normalizeSmComplaintStatus", () => {
  it.each([
    ["open", "open"],
    ["New", "open"],
    [" OPEN ", "open"],
    ["in_progress", "in_progress"],
    ["In Progress", "in_progress"],
    ["inprogress", "in_progress"],
    ["in-progress", "in_progress"],
    ["Resolved", "resolved"],
    ["closed", "closed"],
    ["done", null],
    ["", null],
    [null, null],
    [undefined, null],
  ])("%p is %p", (input, expected) => {
    expect(normalizeSmComplaintStatus(input)).toBe(expected);
  });
});

describe("records/complaints", () => {
  const ROW = {
    complaintId: 7,
    complaintNo: "CMP-0007",
    customerName: "Sara",
    phone: "0300 1234567",
    category: "Noise",
    branch: "F-7",
    status: "resolved",
    source: "whatsapp",
    isFollowUp: 1,
    createdOn: "2026-10-02T10:00:00",
    updatedOn: "2026-10-05T10:00:00",
    ageDays: 13,
    description: "Loud music next door",
  };

  it("reads the rows, newest first as sent, with the full count", () => {
    const r = normalizeSalesManagerRecords("complaints", { isSuccessful: true, data: { title: "Open complaints", total: 40, rows: [ROW] } });
    expect(r.kind).toBe("complaints");
    expect(r.title).toBe("Open complaints");
    expect(r.total).toBe(40);
    expect(r.rows).toEqual([
      {
        complaintId: 7,
        complaintNo: "CMP-0007",
        customerName: "Sara",
        phone: "0300 1234567",
        category: "Noise",
        branch: "F-7",
        status: "resolved",
        statusText: "resolved",
        source: "whatsapp",
        isFollowUp: true,
        createdOn: "2026-10-02T10:00:00",
        updatedOn: "2026-10-05T10:00:00",
        ageDays: 13,
        description: "Loud music next door",
      },
    ]);
  });

  it("defaults the title and total, and fills a row's missing fields", () => {
    const r = normalizeSalesManagerRecords("complaints", { rows: [{}] });
    expect(r.title).toBe("Complaints");
    expect(r.total).toBe(1);
    expect(toComplaintRecord({ status: "Escalated", isFollowUp: "false" })).toMatchObject({
      complaintId: null,
      category: "Other",
      branch: null,
      status: null,
      statusText: "Escalated",
      isFollowUp: false,
      ageDays: null,
    });
  });

  it("shows a complaint as a card: status in the status bar colours, reopened, category, branch, age, description", () => {
    const record = toComplaintRecord(ROW);
    const card = complaintCard(record, 0);
    expect(card.key).toBe("complaint-7-0");
    expect(card.title).toBe("CMP-0007");
    expect(card.subtitle).toBe("Sara · 0300 1234567");
    expect(card.status).toBe("Resolved");
    expect(card.statusTone).toBe("success");
    expect(card.amount).toBe("Reopened");
    expect(card.fields).toEqual([
      { label: "Category", value: "Noise" },
      { label: "Branch", value: "F-7" },
      { label: "Received", value: "2 Oct 2026" },
      { label: "Age", value: "13 days" },
      { label: "Updated", value: "5 Oct 2026" },
      { label: "Source", value: "WhatsApp" },
      { label: "Description", value: "Loud music next door" },
    ]);
    expect(card.accessibilityLabel).toContain("Reopened");
    expect(card.accessibilityLabel).not.toMatch(/PKR/);
  });

  it("names a complaint without a number, branch or known status sensibly", () => {
    const bare: SmComplaintRecord = {
      complaintId: null,
      complaintNo: null,
      customerName: null,
      phone: null,
      category: "Other",
      branch: null,
      status: null,
      statusText: "Escalated",
      source: null,
      isFollowUp: false,
      createdOn: null,
      updatedOn: "2026-10-05",
      ageDays: null,
      description: null,
    };
    const card = complaintCard(bare, 3);
    expect(card).toMatchObject({ key: "complaint-3-3", title: "Complaint", subtitle: null, status: "Escalated", statusTone: "neutral", amount: null });
    expect(card.fields).toEqual([
      { label: "Category", value: "Other" },
      { label: "Branch", value: "No branch" },
    ]);
    expect(complaintCard({ ...bare, complaintId: 4, status: "open" }, 0)).toMatchObject({ title: "Complaint 4", status: "Open", statusTone: "warning" });
    const [first] = smRecordCards({ kind: "complaints", title: "x", total: 1, rows: [{ ...bare, status: "in_progress" }] });
    expect(first).toMatchObject({ status: "In progress", statusTone: "info" });
  });
});

describe("smComplaintRecords", () => {
  const scope = { period: "month" as const, locationId: 2 };

  it("sends a status with the period and the location filter", () => {
    expect(smComplaintRecords({ status: "open" }, scope)).toEqual({ kind: "complaints", params: { status: "open", locationId: 2, period: "month" } });
    expect(smComplaintRecords({ status: "new_period" }, { period: "year", locationId: null })).toEqual({
      kind: "complaints",
      params: { status: "new_period", period: "year" },
    });
  });

  it("sends a category, a branch ('' as none) or a month (that month only, no period)", () => {
    expect(smComplaintRecords({ category: " Internet / WiFi " }, scope)?.params).toEqual({ category: "Internet / WiFi", locationId: 2, period: "month" });
    expect(smComplaintRecords({ branch: "" }, scope)?.params).toEqual({ branch: "none", locationId: 2, period: "month" });
    expect(smComplaintRecords({ branch: "I-8" }, scope)?.params).toMatchObject({ branch: "I-8" });
    expect(smComplaintRecords({ month: "2026-09" }, scope)).toEqual({ kind: "complaints", params: { month: "2026-09", locationId: 2 } });
    expect(smComplaintRecords({ month: "Sep" }, scope)).toBeNull();
  });

  it("tells lists of complaints as they are now from the period's lists", () => {
    expect(isCurrentComplaintsList(smComplaintRecords({ status: "open" }, scope)!)).toBe(true);
    expect(isCurrentComplaintsList(smComplaintRecords({ status: "active" }, scope)!)).toBe(true);
    expect(isCurrentComplaintsList(smComplaintRecords({ status: "resolved_period" }, scope)!)).toBe(false);
    expect(isCurrentComplaintsList(smComplaintRecords({ category: "Noise" }, scope)!)).toBe(false);
    expect(isCurrentComplaintsList({ kind: "bookings", params: { status: "open" } })).toBe(false);
  });
});

describe("complaint display helpers", () => {
  it("labels the statuses in the status bar's order", () => {
    expect(SM_COMPLAINT_STATUSES.map((s) => SM_COMPLAINT_STATUS_LABELS[s])).toEqual(["Open", "In progress", "Resolved", "Closed"]);
    expect(SM_COMPLAINT_STATUSES.map(complaintStatusTone)).toEqual(["warning", "info", "success", "neutral"]);
    expect(complaintStatusTone(null)).toBe("neutral");
  });

  it("writes the age and picks its chip tone (amber from 3 days, red from 7)", () => {
    expect(complaintAgeText(0)).toBe("Today");
    expect(complaintAgeText(1)).toBe("1 day");
    expect(complaintAgeText(12.4)).toBe("12 days");
    expect(complaintAgeText(-2)).toBe("Today");
    expect(complaintAgeText(null)).toBeNull();
    expect(complaintAgeText(NaN)).toBeNull();
    expect([0, 2, 3, 6, 7, 30].map(complaintAgeTone)).toEqual(["neutral", "neutral", "warning", "warning", "danger", "danger"]);
    expect(complaintAgeTone(null)).toBe("neutral");
  });

  it("writes the average time to resolve", () => {
    expect(avgResolutionText(1.5)).toBe("avg 1.5 days to resolve");
    expect(avgResolutionText(1)).toBe("avg 1 day to resolve");
    expect(avgResolutionText(0)).toBe("avg 0 days to resolve");
    expect(avgResolutionText(2.04)).toBe("avg 2 days to resolve");
    expect(avgResolutionText(null)).toBeNull();
    expect(avgResolutionText(-1)).toBeNull();
  });

  it("names the source", () => {
    expect(complaintSourceLabel("whatsapp")).toBe("WhatsApp");
    expect(complaintSourceLabel("WhatsApp")).toBe("WhatsApp");
    expect(complaintSourceLabel("manual")).toBe("Staff");
    expect(complaintSourceLabel("email")).toBe("Email");
    expect(complaintSourceLabel("  ")).toBeNull();
    expect(complaintSourceLabel(null)).toBeNull();
  });
});
