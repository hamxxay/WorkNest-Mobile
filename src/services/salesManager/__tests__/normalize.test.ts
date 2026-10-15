// Sales Manager API normalisers: the contract's shapes are read as typed data (desks, never money), and partial /
// missing answers become empty sections, lists and 0 desks instead of errors (the screens then show their empty
// states).

import {
  normalizeSalesManagerBreakdown,
  normalizeSalesManagerDashboard,
  normalizeSalesManagerRecords,
  rankPeople,
} from "../normalize";
import type { SmPerson } from "../types";

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
      quotedDesks: 182,
      bookedDesks: 91,
      bookedDesksPrev: 80,
      months: [
        { month: "2026-10", quotations: 10, accepted: 4, bookings: 3, bookedDesks: 91 },
        { month: "2025-11", quotations: 2, accepted: 1, bookings: 1, bookedDesks: 6 },
      ],
    },
    team: {
      people: [
        { userId: 5, name: "Sara", role: "Sales Executive", locations: "I-8", inquiriesHandled: 6, quotations: 6, accepted: 3, converted: 2, desksSold: 7, conversionRate: 33.3, followUpsDue: 2 },
        { userId: 6, name: "Omar", role: "Admin", locations: "F-7", inquiriesHandled: 1, quotations: 4, accepted: 2, converted: 2, desksSold: 9, conversionRate: 50, followUpsDue: 0 },
      ],
      perLocation: [{ locationId: 1, name: "I-8", salesExecutives: 2, quotations: 6, converted: 2, desksSold: 7 }],
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
      expiring: [{ bookingId: 77, customer: "Acme", space: "Office 4", location: "I-8", endOn: "2026-11-30", desks: 6, daysLeft: 47 }],
      expiringCount: 4,
      expiringDesks: 14,
      expiring30Count: 2,
      expiring30Desks: 5,
      endedDesks: 6,
      netDesks: 85,
      netDesksPrev: 70,
      months: [
        { month: "2026-11", bookedDesks: 0, endingDesks: 6, expiring: 2 },
        { month: "2026-10", bookedDesks: 91, endingDesks: 6, expiring: 1 },
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
    expect(d.funnel).toMatchObject({ conversionRate: 30, conversionRatePrev: 25, quotedDesks: 182, bookedDesks: 91, bookedDesksPrev: 80 });
    // Months oldest first.
    expect(d.funnel?.months).toEqual([
      { month: "2025-11", quotations: 2, accepted: 1, bookings: 1, bookedDesks: 6 },
      { month: "2026-10", quotations: 10, accepted: 4, bookings: 3, bookedDesks: 91 },
    ]);

    // People ranked by desks sold.
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
      desksSold: 7,
      conversionRate: 33.3,
      followUpsDue: 2,
    });
    expect(d.team?.perLocation).toEqual([{ locationId: 1, name: "I-8", salesExecutives: 2, quotations: 6, converted: 2, desksSold: 7 }]);

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
      { bookingId: 77, customer: "Acme", space: "Office 4", location: "I-8", endOn: "2026-11-30", desks: 6, daysLeft: 47 },
    ]);
    expect(d.renewals).toMatchObject({
      expiringCount: 4,
      expiringDesks: 14,
      expiring30Count: 2,
      expiring30Desks: 5,
      // From the funnel (the renewals section does not repeat it).
      bookedDesks: 91,
      endedDesks: 6,
      netDesks: 85,
      netDesksPrev: 70,
    });
    expect(d.renewals?.months).toEqual([
      { month: "2026-10", bookedDesks: 91, endingDesks: 6, expiring: 1 },
      { month: "2026-11", bookedDesks: 0, endingDesks: 6, expiring: 2 },
    ]);
  });

  it("keeps no money: amounts an older API still sends are dropped", () => {
    const d = normalizeSalesManagerDashboard({
      funnel: { quotedValue: 2000000, bookedValue: 600000, bookedValuePrev: 1, months: [{ month: "2026-10", bookedValue: 600000 }] },
      team: { people: [{ name: "Sara", convertedValue: 300000 }], perLocation: [{ name: "I-8", convertedValue: 300000 }] },
      renewals: {
        expiring: [{ customer: "Acme", monthlyAmount: 90000, daysLeft: 3 }],
        expiringMonthlyValue: 90000,
        newBookingRevenue: 800000,
        newBookingRevenuePrev: 500000,
        months: [{ month: "2026-10", newBookingRevenue: 800000, expiring: 1 }],
      },
    });
    const json = JSON.stringify(d);
    for (const key of ["Value", "Revenue", "Amount", "monthly"]) expect(json).not.toContain(key);
    expect(d.funnel).toMatchObject({ quotedDesks: 0, bookedDesks: 0, bookedDesksPrev: null });
    expect(d.funnel?.months[0].bookedDesks).toBe(0);
    expect(d.team?.people[0].desksSold).toBe(0);
    expect(d.team?.perLocation[0].desksSold).toBe(0);
    expect(d.renewals?.expiring[0].desks).toBe(0);
    expect(d.renewals?.months[0]).toEqual({ month: "2026-10", bookedDesks: 0, endingDesks: 0, expiring: 1 });
  });

  it("accepts a bare object (no envelope) and PascalCase fields", () => {
    const d = normalizeSalesManagerDashboard({ Period: "year", Funnel: { QuotedDesks: 5, BookedDesks: 4 }, Inquiries: { Total: 3 }, Renewals: { EndedDesks: 1 } });
    expect(d.period).toBe("year");
    expect(d.funnel?.quotedDesks).toBe(5);
    expect(d.inquiries?.total).toBe(3);
    expect(d.renewals).toMatchObject({ bookedDesks: 4, endedDesks: 1, netDesks: 3 });
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
      quotedDesks: 0,
      bookedDesks: 0,
      bookedDesksPrev: null,
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
      expiringDesks: 0,
      expiring30Count: 0,
      expiring30Desks: 0,
      bookedDesks: 0,
      endedDesks: 0,
      netDesks: 0,
      netDesksPrev: null,
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
      inquiriesAllBranches: false,
      funnel: null,
      team: null,
      inquiries: null,
      renewals: null,
    });
  });

  it("reads inquiriesAllBranches (the server's BR_02 not run: every branch's inquiries count)", () => {
    expect(normalizeSalesManagerDashboard({ inquiriesAllBranches: true }).inquiriesAllBranches).toBe(true);
    expect(normalizeSalesManagerDashboard({ isSuccessful: true, data: { InquiriesAllBranches: true } }).inquiriesAllBranches).toBe(true);
    expect(normalizeSalesManagerDashboard({ inquiriesAllBranches: false }).inquiriesAllBranches).toBe(false);
  });

  it("fills partial rows: missing stages as zero, a missing rate from quotations, a person without a name", () => {
    const d = normalizeSalesManagerDashboard({
      funnel: { stages: [{ stage: "quotations", count: 4 }] },
      team: { people: [{ quotations: 4, converted: 1 }, { userId: "x", name: "  " }, "junk"] },
      inquiries: { notInterestedReasons: [{ count: 2 }], months: [{ month: "2026-10", WhatsApp: 4, walk_in: 1 }] },
      renewals: {
        expiring: [
          { desks: 1, daysLeft: 5 },
          { desks: 6, customer: "B", daysLeft: 30 },
          { desks: 3, daysLeft: 31 },
          { desks: "2", daysLeft: null },
        ],
      },
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
    // Counts and desks from the list when the totals are not sent (within 30 days: daysLeft up to 30).
    expect(d.renewals).toMatchObject({ expiringCount: 4, expiringDesks: 12, expiring30Count: 2, expiring30Desks: 7 });
    expect(d.renewals?.expiring[0]).toMatchObject({ customer: "Customer", bookingId: null, endOn: null, desks: 1 });
    expect(d.renewals?.expiring[3]).toMatchObject({ desks: 2, daysLeft: null });
    // No funnel and no figures: nothing booked, nothing ended, net 0.
    expect(d.renewals).toMatchObject({ bookedDesks: 0, endedDesks: 0, netDesks: 0, netDesksPrev: null });
  });

  it("net desks: as sent, else desks booked minus desks ended (may be negative)", () => {
    const sent = normalizeSalesManagerDashboard({ funnel: { bookedDesks: 91 }, renewals: { endedDesks: 6, netDesks: 85, netDesksPrev: -2 } });
    expect(sent.renewals).toMatchObject({ bookedDesks: 91, endedDesks: 6, netDesks: 85, netDesksPrev: -2 });

    const derived = normalizeSalesManagerDashboard({ funnel: { bookedDesks: 2 }, renewals: { endedDesks: 9 } });
    expect(derived.renewals).toMatchObject({ bookedDesks: 2, endedDesks: 9, netDesks: -7 });

    // The section's own desks booked wins; without a funnel, booked = net + ended.
    expect(normalizeSalesManagerDashboard({ funnel: { bookedDesks: 5 }, renewals: { bookedDesks: 8, endedDesks: 1 } }).renewals).toMatchObject({
      bookedDesks: 8,
      netDesks: 7,
    });
    expect(normalizeSalesManagerDashboard({ renewals: { netDesks: 4, endedDesks: 3 } }).renewals).toMatchObject({ bookedDesks: 7, netDesks: 4 });

    // Totals sent by the server win over the (possibly cut short) list.
    const totals = normalizeSalesManagerDashboard({
      renewals: { expiring: [{ desks: 1, daysLeft: 2 }], expiringCount: 10, expiringDesks: 40, expiring30Count: 3, expiring30Desks: 9 },
    });
    expect(totals.renewals).toMatchObject({ expiringCount: 10, expiringDesks: 40, expiring30Count: 3, expiring30Desks: 9 });
    // A count below the rows held is raised to the rows.
    expect(normalizeSalesManagerDashboard({ renewals: { expiring: [{ daysLeft: 1 }, { daysLeft: 2 }], expiring30Count: 1 } }).renewals?.expiring30Count).toBe(2);
  });
});

describe("rankPeople", () => {
  const p = (name: string, desksSold: number, converted = 0, quotations = 0): SmPerson => ({
    userId: null,
    name,
    role: "",
    locations: null,
    inquiriesHandled: 0,
    quotations,
    accepted: 0,
    converted,
    desksSold,
    conversionRate: null,
    followUpsDue: 0,
  });

  it("most desks sold first", () => {
    expect(rankPeople([p("a", 1), p("b", 5), p("c", 0)]).map((x) => x.name)).toEqual(["b", "a", "c"]);
  });

  it("ties: more converted, then more quotations, then by name, then the server's order", () => {
    expect(rankPeople([p("Zed", 4, 1, 9), p("Amy", 4, 2, 1), p("Bob", 4, 1, 3), p("Cal", 4, 1, 9), p("Cal", 4, 1, 9)]).map((x) => x.name)).toEqual([
      "Amy",
      "Cal",
      "Cal",
      "Zed",
      "Bob",
    ]);
    const first = p("Cal", 4, 1, 9);
    const second = p("Cal", 4, 1, 9);
    const ranked = rankPeople([second, p("Ann", 0), first]);
    expect(ranked[0]).toBe(second);
    expect(ranked[1]).toBe(first);
  });

  it("the dashboard ranks the server's people this way", () => {
    const d = normalizeSalesManagerDashboard({
      team: {
        people: [
          { name: "Low", desksSold: 1, converted: 5 },
          { name: "High", desksSold: 9, converted: 1 },
          { name: "Mid", desksSold: 4, converted: 2, quotations: 3 },
          { name: "Mid2", desksSold: 4, converted: 2, quotations: 8 },
        ],
      },
    });
    expect(d.team?.people.map((x) => x.name)).toEqual(["High", "Mid2", "Mid", "Low"]);
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
          valueLabel: "Desks booked",
          value2Label: "Bookings",
          rows: [{ key: "1", label: "I-8", value: 91, value2: 17, count: null }],
        },
      },
      "funnel-month",
    );
    expect(b).toEqual({
      title: "Oct 2026 by location",
      subtitle: "Bookings created in October",
      valueLabel: "Desks booked",
      value2Label: "Bookings",
      rows: [{ key: "1", label: "I-8", value: 91, value2: 17, count: null }],
    });
  });

  it("uses each metric's defaults when labels are missing; month rows sorted oldest first with month labels", () => {
    const staff = normalizeSalesManagerBreakdown({ rows: [{ key: "2026-10", value: 2 }, { key: "2026-05", value: 1, value2: 1 }] }, "staff");
    expect(staff.title).toBe("Quotations by month");
    expect(staff.valueLabel).toBe("Quotations");
    expect(staff.value2Label).toBe("Desks sold");
    expect(staff.rows.map((r) => [r.key, r.label])).toEqual([
      ["2026-05", "May 2026"],
      ["2026-10", "Oct 2026"],
    ]);

    expect(normalizeSalesManagerBreakdown({}, "renewals-month")).toEqual({
      title: "Leases ending by location",
      subtitle: null,
      valueLabel: "Leases ending",
      value2Label: "Desks",
      rows: [],
    });
    expect(normalizeSalesManagerBreakdown(null, "desks-month")).toEqual({
      title: "Desks booked and ending by location",
      subtitle: null,
      valueLabel: "Desks booked",
      value2Label: "Desks ending",
      rows: [],
    });
    expect(normalizeSalesManagerBreakdown({}, "funnel-month")).toMatchObject({ valueLabel: "Desks booked", value2Label: "Bookings" });
    // Location rows keep the server's order (not sorted as months).
    expect(normalizeSalesManagerBreakdown({ rows: [{ key: "2", value: 1 }, { key: "1", value: 5 }] }, "desks-month").rows.map((r) => r.key)).toEqual(["2", "1"]);
    expect(normalizeSalesManagerBreakdown({ value2Label: null }, "funnel-month").value2Label).toBeNull();
    expect(normalizeSalesManagerBreakdown({ rows: [{ value: 1 }] }, "inquiries-type").rows[0]).toEqual({ key: "", label: "", value: 1, value2: null, count: null });
  });
});

describe("normalizeSalesManagerRecords", () => {
  it("reads each list", () => {
    const q = normalizeSalesManagerRecords("quotations", {
      isSuccessful: true,
      data: { title: "Sara: Oct 2026", total: 340, rows: [{ quotationId: 4, quotationNumber: "QUO-4", customer: "Acme", location: "I-8", createdBy: "Sara", status: "Accepted", desks: 6, createdOn: "2026-10-02" }] },
    });
    expect(q).toEqual({
      kind: "quotations",
      title: "Sara: Oct 2026",
      total: 340,
      rows: [{ quotationId: 4, quotationNumber: "QUO-4", customer: "Acme", location: "I-8", createdBy: "Sara", status: "Accepted", desks: 6, createdOn: "2026-10-02" }],
    });

    const i = normalizeSalesManagerRecords("inquiries", {
      rows: [{ inquiryId: 9, name: "Ali", phone: "0300", type: "walk_in", referenceName: null, status: "FutureProspect", createdOn: "2026-10-01T10:00:00", feedback: "Call back", followUpOn: "2026-10-10" }],
    });
    expect(i.kind).toBe("inquiries");
    expect(i.title).toBe("Tour inquiries");
    expect(i.rows[0]).toMatchObject({ inquiryId: 9, type: "WalkIn", typeText: "walk_in", followUpOn: "2026-10-10", feedback: "Call back" });

    const l = normalizeSalesManagerRecords("leases", [{ bookingId: 3, customer: "Acme", endOn: "2026-11-30", desks: 6, daysLeft: 47 }]);
    expect(l).toEqual({
      kind: "leases",
      title: "Expiring leases",
      total: 1,
      rows: [{ bookingId: 3, customer: "Acme", space: null, location: null, endOn: "2026-11-30", desks: 6, daysLeft: 47 }],
    });

    const b = normalizeSalesManagerRecords("bookings", {
      total: 1,
      rows: [{ bookingId: 5, customer: "Acme", space: "Office 4", location: "I-8", startOn: "2026-10-01", endOn: "2027-09-30", status: "Confirmed", desks: 6 }],
    });
    expect(b.rows[0]).toEqual({
      bookingId: 5,
      customer: "Acme",
      space: "Office 4",
      location: "I-8",
      startOn: "2026-10-01",
      endOn: "2027-09-30",
      status: "Confirmed",
      desks: 6,
    });
  });

  it("drops amounts an older API still sends and reads missing desks as 0", () => {
    const q = normalizeSalesManagerRecords("quotations", { rows: [{ id: 4, quotationNo: "QUO-4", total: 1000 }] });
    expect(q.rows[0]).toMatchObject({ quotationId: 4, quotationNumber: "QUO-4", desks: 0 });
    expect(q.rows[0]).not.toHaveProperty("total");

    const b = normalizeSalesManagerRecords("bookings", { rows: [{ id: 5, customerName: "Acme", totalAmount: 5, Desks: 3 }] });
    expect(b.rows[0]).toMatchObject({ bookingId: 5, customer: "Acme", desks: 3 });
    expect(b.rows[0]).not.toHaveProperty("totalAmount");

    const l = normalizeSalesManagerRecords("leases", { rows: [{ bookingId: 3, monthlyAmount: 9 }] });
    expect(l.rows[0]).toMatchObject({ desks: 0 });
    expect(l.rows[0]).not.toHaveProperty("monthlyAmount");
  });

  it("never reports fewer than the rows it holds, and survives junk", () => {
    expect(normalizeSalesManagerRecords("bookings", { total: 0, rows: [{}, {}] }).total).toBe(2);
    expect(normalizeSalesManagerRecords("leases", "nope")).toEqual({ kind: "leases", title: "Expiring leases", total: 0, rows: [] });
    expect(normalizeSalesManagerRecords("inquiries", { isSuccessful: true, data: null }).rows).toEqual([]);
  });
});
