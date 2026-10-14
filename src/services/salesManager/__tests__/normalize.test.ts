// Sales Manager API normalisers: the contract's shapes are read as typed data, and partial / missing answers become
// empty sections and lists instead of errors (the screens then show their empty states).

import {
  normalizeSalesManagerBreakdown,
  normalizeSalesManagerDashboard,
  normalizeSalesManagerRecords,
  rankPeople,
} from "../normalize";

const FULL = {
  isSuccessful: true,
  data: {
    period: "quarter",
    periodLabel: "Q4 2026",
    generatedAt: "2026-10-14T12:00:00Z",
    locations: [
      { locationId: 1, name: "I-8" },
      { locationId: 2, name: "F-7" },
    ],
    funnel: {
      stages: [
        { stage: "inquiries", label: "Tour inquiries", count: 20 },
        { stage: "quotations", label: "Quotations", count: 10 },
        { stage: "accepted", label: "Accepted", count: 4 },
        { stage: "bookings", label: "Bookings", count: 3 },
      ],
      conversionRate: 30,
      conversionRatePrev: 25,
      quotedValue: 2000000,
      bookedValue: 600000,
      bookedValuePrev: 400000,
      months: [
        { month: "2026-10", quotations: 10, accepted: 4, bookings: 3, bookedValue: 600000 },
        { month: "2025-11", quotations: 2, accepted: 1, bookings: 1, bookedValue: 100000 },
      ],
    },
    team: {
      people: [
        { userId: 5, name: "Sara", role: "Sales Executive", locations: "I-8", inquiriesHandled: 6, quotations: 6, accepted: 3, converted: 2, convertedValue: 300000, conversionRate: 33.3, followUpsDue: 2 },
        { userId: 6, name: "Omar", role: "Admin", locations: "F-7", inquiriesHandled: 1, quotations: 4, accepted: 2, converted: 2, convertedValue: 500000, conversionRate: 50, followUpsDue: 0 },
      ],
      perLocation: [{ locationId: 1, name: "I-8", salesExecutives: 2, quotations: 6, converted: 2, convertedValue: 300000 }],
    },
    inquiries: {
      total: 20,
      totalPrev: 15,
      followedUp: 8,
      notInterested: 4,
      converted: 3,
      followUpsDue: 5,
      byType: [
        { type: "Website", label: "Website", count: 8 },
        { type: "WalkIn", label: "Walk-In", count: 5 },
        { type: "NotSet", label: "Not set", count: 2 },
      ],
      notInterestedReasons: [
        { reason: "Budget", count: 3 },
        { reason: "Location", count: 1 },
      ],
      months: [
        { month: "2026-10", website: 8, whatsApp: 3, walkIn: 5, reference: 2, notSet: 2 },
        { month: "2026-09", website: 1, whatsApp: 0, walkIn: 0, reference: 0, notSet: 0 },
      ],
    },
    renewals: {
      expiring: [{ bookingId: 77, customer: "Acme", space: "Office 4", location: "I-8", endOn: "2026-11-30", monthlyAmount: 90000, daysLeft: 47 }],
      expiringCount: 4,
      expiringMonthlyValue: 250000,
      newBookingRevenue: 800000,
      newBookingRevenuePrev: 500000,
      months: [
        { month: "2026-11", newBookingRevenue: 0, expiring: 2 },
        { month: "2026-10", newBookingRevenue: 800000, expiring: 1 },
      ],
    },
  },
};

describe("normalizeSalesManagerDashboard", () => {
  it("reads the full contract shape", () => {
    const d = normalizeSalesManagerDashboard(FULL);
    expect(d.period).toBe("quarter");
    expect(d.periodLabel).toBe("Q4 2026");
    expect(d.generatedAt).toBe("2026-10-14T12:00:00Z");
    expect(d.locations).toEqual([
      { locationId: 1, name: "I-8" },
      { locationId: 2, name: "F-7" },
    ]);

    expect(d.funnel?.stages.map((s) => [s.stage, s.count])).toEqual([
      ["inquiries", 20],
      ["quotations", 10],
      ["accepted", 4],
      ["bookings", 3],
    ]);
    expect(d.funnel).toMatchObject({ conversionRate: 30, conversionRatePrev: 25, quotedValue: 2000000, bookedValue: 600000, bookedValuePrev: 400000 });
    // Months oldest first.
    expect(d.funnel?.months.map((m) => m.month)).toEqual(["2025-11", "2026-10"]);

    // People ranked by converted value.
    expect(d.team?.people.map((p) => p.name)).toEqual(["Omar", "Sara"]);
    expect(d.team?.people[1]).toEqual({
      userId: 5,
      name: "Sara",
      role: "Sales Executive",
      locations: "I-8",
      inquiriesHandled: 6,
      quotations: 6,
      accepted: 3,
      converted: 2,
      convertedValue: 300000,
      conversionRate: 33.3,
      followUpsDue: 2,
    });
    expect(d.team?.perLocation).toEqual([{ locationId: 1, name: "I-8", salesExecutives: 2, quotations: 6, converted: 2, convertedValue: 300000 }]);

    expect(d.inquiries).toMatchObject({ total: 20, totalPrev: 15, followedUp: 8, notInterested: 4, converted: 3, followUpsDue: 5 });
    expect(d.inquiries?.byType.map((t) => [t.type, t.label, t.count])).toEqual([
      ["Website", "Website", 8],
      ["WalkIn", "Walk-In", 5],
      ["NotSet", "Not set", 2],
    ]);
    expect(d.inquiries?.notInterestedReasons).toEqual([
      { reason: "Budget", count: 3 },
      { reason: "Location", count: 1 },
    ]);
    expect(d.inquiries?.months).toEqual([
      { month: "2026-09", counts: { Website: 1, WhatsApp: 0, WalkIn: 0, Reference: 0, NotSet: 0 } },
      { month: "2026-10", counts: { Website: 8, WhatsApp: 3, WalkIn: 5, Reference: 2, NotSet: 2 } },
    ]);

    expect(d.renewals?.expiring).toEqual([
      { bookingId: 77, customer: "Acme", space: "Office 4", location: "I-8", endOn: "2026-11-30", monthlyAmount: 90000, daysLeft: 47 },
    ]);
    expect(d.renewals).toMatchObject({ expiringCount: 4, expiringMonthlyValue: 250000, newBookingRevenue: 800000, newBookingRevenuePrev: 500000 });
    expect(d.renewals?.months.map((m) => m.month)).toEqual(["2026-10", "2026-11"]);
  });

  it("accepts a bare object (no envelope) and PascalCase fields", () => {
    const d = normalizeSalesManagerDashboard({ Period: "year", Funnel: { QuotedValue: 5 }, Inquiries: { Total: 3 } });
    expect(d.period).toBe("year");
    expect(d.funnel?.quotedValue).toBe(5);
    expect(d.inquiries?.total).toBe(3);
  });

  it("turns missing sections into null and missing figures into 0 / [] / null", () => {
    const d = normalizeSalesManagerDashboard({ isSuccessful: true, data: { funnel: {}, team: {}, inquiries: {}, renewals: {} } }, "month");
    expect(d.period).toBe("month");
    expect(d.periodLabel).toBe("");
    expect(d.generatedAt).toBeNull();
    expect(d.locations).toEqual([]);
    expect(d.funnel).toEqual({
      stages: [],
      conversionRate: null,
      conversionRatePrev: null,
      quotedValue: 0,
      bookedValue: 0,
      bookedValuePrev: null,
      months: [],
    });
    expect(d.team).toEqual({ people: [], perLocation: [] });
    expect(d.inquiries).toEqual({
      total: 0,
      totalPrev: null,
      followedUp: 0,
      notInterested: 0,
      converted: 0,
      followUpsDue: 0,
      byType: [],
      notInterestedReasons: [],
      months: [],
    });
    expect(d.renewals).toEqual({
      expiring: [],
      expiringCount: 0,
      expiringMonthlyValue: 0,
      newBookingRevenue: 0,
      newBookingRevenuePrev: null,
      months: [],
    });
  });

  it.each([null, undefined, "oops", 42, [], { isSuccessful: true, data: null }])("never throws on %p", (raw) => {
    const d = normalizeSalesManagerDashboard(raw, "year");
    expect(d).toEqual({
      period: "year",
      periodLabel: "",
      generatedAt: null,
      locations: [],
      funnel: null,
      team: null,
      inquiries: null,
      renewals: null,
    });
  });

  it("fills partial rows: missing stages as zero, a missing rate from quotations, a person without a name", () => {
    const d = normalizeSalesManagerDashboard({
      funnel: { stages: [{ stage: "quotations", count: 4 }] },
      team: { people: [{ quotations: 4, converted: 1 }, { userId: "x", name: "  " }, "junk"] },
      inquiries: { notInterestedReasons: [{ count: 2 }], months: [{ month: "2026-10", WhatsApp: 4, walk_in: 1 }] },
      renewals: { expiring: [{ monthlyAmount: 10 }, { monthlyAmount: 20, customer: "B" }] },
    });
    expect(d.funnel?.stages.map((s) => [s.stage, s.label, s.count])).toEqual([
      ["inquiries", "Tour inquiries", 0],
      ["quotations", "Quotations", 4],
      ["accepted", "Accepted", 0],
      ["bookings", "Bookings", 0],
    ]);
    expect(d.team?.people[0]).toMatchObject({ userId: null, name: "Team member", conversionRate: 25, followUpsDue: 0 });
    expect(d.team?.people[1]).toMatchObject({ userId: null, name: "Team member", conversionRate: null });
    expect(d.team?.people).toHaveLength(2);
    expect(d.inquiries?.notInterestedReasons).toEqual([{ reason: "No reason given", count: 2 }]);
    expect(d.inquiries?.months[0].counts).toEqual({ Website: 0, WhatsApp: 4, WalkIn: 1, Reference: 0, NotSet: 0 });
    // Count and value from the list when the totals are not sent.
    expect(d.renewals).toMatchObject({ expiringCount: 2, expiringMonthlyValue: 30 });
    expect(d.renewals?.expiring[0]).toMatchObject({ customer: "Customer", bookingId: null, daysLeft: null, endOn: null });
  });
});

describe("rankPeople", () => {
  it("highest converted value first, ties in the server's order", () => {
    const p = (name: string, convertedValue: number) => ({
      userId: null,
      name,
      role: "",
      locations: null,
      inquiriesHandled: 0,
      quotations: 0,
      accepted: 0,
      converted: 0,
      convertedValue,
      conversionRate: null,
      followUpsDue: 0,
    });
    expect(rankPeople([p("a", 1), p("b", 5), p("c", 1), p("d", 0)]).map((x) => x.name)).toEqual(["b", "a", "c", "d"]);
  });
});

describe("normalizeSalesManagerBreakdown", () => {
  it("reads the CEO breakdown shape", () => {
    const b = normalizeSalesManagerBreakdown(
      {
        isSuccessful: true,
        data: {
          title: "Oct 2026 by location",
          subtitle: "Bookings created in October",
          valueLabel: "Bookings",
          value2Label: "Quotations",
          rows: [{ key: "1", label: "I-8", value: 3, value2: 10, count: null }],
        },
      },
      "funnel-month",
    );
    expect(b).toEqual({
      title: "Oct 2026 by location",
      subtitle: "Bookings created in October",
      valueLabel: "Bookings",
      value2Label: "Quotations",
      rows: [{ key: "1", label: "I-8", value: 3, value2: 10, count: null }],
    });
  });

  it("uses each metric's defaults when labels are missing; month rows sorted oldest first with month labels", () => {
    const staff = normalizeSalesManagerBreakdown({ rows: [{ key: "2026-10", value: 2 }, { key: "2026-05", value: 1, value2: 1 }] }, "staff");
    expect(staff.title).toBe("Quotations by month");
    expect(staff.valueLabel).toBe("Quotations");
    expect(staff.value2Label).toBe("Converted");
    expect(staff.rows.map((r) => [r.key, r.label])).toEqual([
      ["2026-05", "May 2026"],
      ["2026-10", "Oct 2026"],
    ]);

    expect(normalizeSalesManagerBreakdown({}, "renewals-month")).toEqual({
      title: "Expiring leases by location",
      subtitle: null,
      valueLabel: "Expiring leases",
      value2Label: "Monthly value",
      rows: [],
    });
    expect(normalizeSalesManagerBreakdown(null, "revenue-month").value2Label).toBeNull();
    expect(normalizeSalesManagerBreakdown({ value2Label: null }, "funnel-month").value2Label).toBeNull();
    expect(normalizeSalesManagerBreakdown({ rows: [{ value: 1 }] }, "inquiries-type").rows[0]).toEqual({ key: "", label: "", value: 1, value2: null, count: null });
  });
});

describe("normalizeSalesManagerRecords", () => {
  it("reads each list", () => {
    const q = normalizeSalesManagerRecords("quotations", {
      isSuccessful: true,
      data: { title: "Sara: Oct 2026", total: 340, rows: [{ quotationId: 4, quotationNumber: "QUO-4", customer: "Acme", location: "I-8", createdBy: "Sara", status: "Accepted", total: 1000, createdOn: "2026-10-02" }] },
    });
    expect(q).toEqual({
      kind: "quotations",
      title: "Sara: Oct 2026",
      total: 340,
      rows: [{ quotationId: 4, quotationNumber: "QUO-4", customer: "Acme", location: "I-8", createdBy: "Sara", status: "Accepted", total: 1000, createdOn: "2026-10-02" }],
    });

    const i = normalizeSalesManagerRecords("inquiries", {
      rows: [{ inquiryId: 9, name: "Ali", phone: "0300", type: "walk_in", referenceName: null, status: "FutureProspect", createdOn: "2026-10-01T10:00:00", feedback: "Call back", followUpOn: "2026-10-10" }],
    });
    expect(i.kind).toBe("inquiries");
    expect(i.title).toBe("Tour inquiries");
    expect(i.rows[0]).toMatchObject({ inquiryId: 9, type: "WalkIn", typeText: "walk_in", followUpOn: "2026-10-10", feedback: "Call back" });

    const l = normalizeSalesManagerRecords("leases", [{ bookingId: 3, customer: "Acme", endOn: "2026-11-30", monthlyAmount: 9, daysLeft: 47 }]);
    expect(l).toEqual({
      kind: "leases",
      title: "Expiring leases",
      total: 1,
      rows: [{ bookingId: 3, customer: "Acme", space: null, location: null, endOn: "2026-11-30", monthlyAmount: 9, daysLeft: 47 }],
    });

    const b = normalizeSalesManagerRecords("bookings", { total: 1, rows: [{ id: 5, customerName: "Acme", status: "Confirmed", totalAmount: 5 }] });
    expect(b.rows[0]).toMatchObject({ bookingId: 5, customer: "Acme", status: "Confirmed", totalAmount: 5 });
  });

  it("never reports fewer than the rows it holds, and survives junk", () => {
    expect(normalizeSalesManagerRecords("bookings", { total: 0, rows: [{}, {}] }).total).toBe(2);
    expect(normalizeSalesManagerRecords("leases", "nope")).toEqual({ kind: "leases", title: "Expiring leases", total: 0, rows: [] });
    expect(normalizeSalesManagerRecords("inquiries", { isSuccessful: true, data: null }).rows).toEqual([]);
  });
});
