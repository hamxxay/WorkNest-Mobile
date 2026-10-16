// CEO API normalisers: the contract's shapes are read as typed data, and partial / missing answers become empty
// sections and lists instead of errors (the screens then show their empty states).

import {
  agingKey,
  normalizeAging,
  normalizeCeoBreakdown,
  normalizeCeoDashboard,
  normalizeCeoRecords,
  normalizeFunnel,
  normalizeInquiryTypes,
  normalizeLocations,
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
    money: {
      invoiced: 1200000,
      invoicedPrev: 1000000,
      collected: 900000,
      collectedPrev: 800000,
      outstanding: 500000,
      outstandingCount: 7,
      overdue: 200000,
      overdueCount: 3,
      collectionRate: 75,
      months: [
        { month: "2026-10", invoiced: 300, collected: 200 },
        { month: "2025-11", invoiced: 100, collected: 50 },
      ],
      aging: [
        { bucket: "90_plus", label: "Over 90 days", amount: 50, count: 1 },
        { bucket: "not_due", label: "Not due", amount: 100, count: 2 },
      ],
      topCustomers: [{ customerId: 9, name: "Acme", amount: 400000, invoices: 4 }],
    },
    occupancy: {
      totalSpaces: 40,
      occupiedSpaces: 30,
      occupancyPct: 75,
      occupancyPctPrev: 70,
      activeBookings: 28,
      newBookings: 5,
      newBookingsPrev: 2,
      months: [{ month: "2026-10", occupancyPct: 75, newBookings: 5 }],
      byType: [{ spaceTypeId: 3, name: "Private Office", total: 10, occupied: 8 }],
      byLocation: [{ locationId: 1, name: "I-8", total: 20, occupied: 15 }],
      leasesExpiring: [{ bookingId: 77, customer: "Acme", space: "Office 4", location: "I-8", endOn: "2026-11-30", monthlyAmount: 90000 }],
    },
    sales: {
      funnel: [
        { stage: "inquiries", label: "Tour inquiries", count: 20 },
        { stage: "quotations", label: "Quotations", count: 10 },
        { stage: "accepted", label: "Accepted", count: 4 },
        { stage: "bookings", label: "Bookings", count: 3 },
      ],
      conversionRate: 20,
      quotationsBooked: 2,
      inquiriesByType: [
        { type: "Website", label: "Website", count: 8 },
        { type: "WalkIn", label: "Walk-In", count: 5 },
      ],
      quotationValue: 2000000,
      bookingValue: 600000,
    },
    team: {
      perLocation: [{ locationId: 1, name: "I-8", admins: 1, salesExecutives: 2, quotations: 6, converted: 2 }],
      people: [{ userId: 5, name: "Sara", role: "Sales Executive", locations: "I-8", quotations: 6, converted: 2, convertedValue: 300000 }],
    },
  },
};

describe("normalizeCeoDashboard", () => {
  it("reads the contract's full answer (inside the envelope)", () => {
    const d = normalizeCeoDashboard(FULL, "month");
    expect(d.period).toBe("quarter");
    expect(d.periodLabel).toBe("Q4 2026");
    expect(d.locations).toEqual([
      { locationId: 1, name: "I-8" },
      { locationId: 2, name: "F-7" },
    ]);
    expect(d.money).toMatchObject({ invoiced: 1200000, invoicedPrev: 1000000, collectionRate: 75, overdueCount: 3 });
    // Months are put oldest first.
    expect(d.money?.months.map((m) => m.month)).toEqual(["2025-11", "2026-10"]);
    expect(d.money?.topCustomers).toEqual([{ customerId: 9, name: "Acme", amount: 400000, invoices: 4 }]);
    expect(d.occupancy).toMatchObject({ occupancyPct: 75, occupancyPctPrev: 70, newBookingsPrev: 2 });
    expect(d.occupancy?.byType[0]).toEqual({ spaceTypeId: 3, name: "Private Office", total: 10, occupied: 8 });
    expect(d.occupancy?.leasesExpiring[0]).toMatchObject({ bookingId: 77, endOn: "2026-11-30", monthlyAmount: 90000 });
    // An API from before QA_07 sends no full count: only the list is known.
    expect(d.occupancy?.leasesExpiringCount).toBeNull();
    expect(d.occupancy?.leasesExpiringMonthly).toBeNull();
    expect(d.sales?.funnel.map((f) => f.count)).toEqual([20, 10, 4, 3]);
    // No inquiriesAllLocations sent (an older API): its inquiry figures never followed the location.
    expect(d.sales?.inquiriesAllLocations).toBe(true);
    // Conversion = this period's quotations that were booked / its quotations (2 of 10), not bookings / quotations.
    expect(d.sales?.conversionRate).toBe(20);
    expect(d.sales?.quotationsBooked).toBe(2);
    expect(d.team?.people[0]).toMatchObject({ userId: 5, name: "Sara", convertedValue: 300000 });
  });

  it("turns an empty or broken answer into empty sections, never an error", () => {
    for (const raw of [null, undefined, "", "oops", [], { isSuccessful: true, data: null }, {}]) {
      const d = normalizeCeoDashboard(raw, "year");
      expect(d).toEqual({
        period: "year",
        periodLabel: "",
        generatedAt: null,
        locations: [],
        money: null,
        occupancy: null,
        sales: null,
        team: null,
      });
    }
  });

  it("fills missing fields of a present section with zeros / empty lists, and missing previous figures with null", () => {
    const d = normalizeCeoDashboard({ money: {}, occupancy: { occupancyPct: "61.5" }, sales: { funnel: "x" }, team: { people: [null, 3] } });
    expect(d.money).toEqual({
      invoiced: 0,
      invoicedPrev: null,
      collected: 0,
      collectedPrev: null,
      outstanding: 0,
      outstandingCount: 0,
      overdue: 0,
      overdueCount: 0,
      collectionRate: null,
      months: [],
      aging: [],
      topCustomers: [],
    });
    expect(d.occupancy?.occupancyPct).toBe(61.5);
    expect(d.occupancy?.occupancyPctPrev).toBeNull();
    expect(d.occupancy?.months).toEqual([]);
    expect(d.sales?.funnel).toEqual([]);
    expect(d.sales?.conversionRate).toBeNull();
    expect(d.sales?.quotationsBooked).toBe(0);
    expect(d.team).toEqual({ perLocation: [], people: [] });
  });

  it("conversion never passes 100%: an older API (all bookings / quotations, no quotationsBooked) is capped", () => {
    const stages = [
      { stage: "quotations", count: 10 },
      { stage: "bookings", count: 12 },
    ];
    const old = normalizeCeoDashboard({ sales: { funnel: stages, conversionRate: 120 } });
    expect(old.sales).toMatchObject({ conversionRate: 100, quotationsBooked: 10 });
    // No rate either: the screen works it out from quotationsBooked / quotations (10 of 10).
    expect(normalizeCeoDashboard({ sales: { funnel: stages } }).sales).toMatchObject({ conversionRate: null, quotationsBooked: 10 });
    // Fewer bookings than quotations: the bookings stand in.
    const fewer = [
      { stage: "quotations", count: 10 },
      { stage: "bookings", count: 4 },
    ];
    expect(normalizeCeoDashboard({ sales: { funnel: fewer } }).sales?.quotationsBooked).toBe(4);
    // A sent count is kept within 0 and the quotations.
    expect(normalizeCeoDashboard({ sales: { funnel: stages, quotationsBooked: 15, conversionRate: 150 } }).sales).toMatchObject({
      conversionRate: 100,
      quotationsBooked: 10,
    });
    expect(normalizeCeoDashboard({ sales: { funnel: stages, quotationsBooked: -1, conversionRate: -5 } }).sales).toMatchObject({
      conversionRate: 0,
      quotationsBooked: 0,
    });
  });

  it("gives rows without names a readable fallback and drops invalid ids", () => {
    const d = normalizeCeoDashboard({
      money: { topCustomers: [{ customerId: 0, amount: 5 }] },
      occupancy: { byLocation: [{ locationId: "x", total: 3, occupied: 1 }], leasesExpiring: [{}] },
      team: { people: [{ userId: -1 }] },
    });
    expect(d.money?.topCustomers[0]).toEqual({ customerId: null, name: "Customer", amount: 5, invoices: 0 });
    expect(d.occupancy?.byLocation[0]).toMatchObject({ locationId: null, name: "Location" });
    expect(d.occupancy?.leasesExpiring[0]).toEqual({ bookingId: null, customer: "Customer", space: null, location: null, endOn: null, monthlyAmount: null });
    expect(d.team?.people[0]).toMatchObject({ userId: null, name: "Team member" });
  });

  it("reads the full number of leases expiring (QA_07), never below the list it came with", () => {
    const lease = { bookingId: 1, customer: "Acme", endOn: "2026-11-02" };
    const d = normalizeCeoDashboard({ occupancy: { leasesExpiring: [lease], leasesExpiringCount: 64, leasesExpiringMonthly: 3200000 } });
    expect(d.occupancy).toMatchObject({ leasesExpiringCount: 64, leasesExpiringMonthly: 3200000 });
    expect(normalizeCeoDashboard({ occupancy: { leasesExpiring: [lease, lease], leasesExpiringCount: 1 } }).occupancy?.leasesExpiringCount).toBe(2);
    expect(normalizeCeoDashboard({ occupancy: { leasesExpiringCount: 0 } }).occupancy?.leasesExpiringCount).toBe(0);
  });

  it("reads whether the inquiry figures count every location (a location chosen before QA_07)", () => {
    expect(normalizeCeoDashboard({ sales: { inquiriesAllLocations: false } }).sales?.inquiriesAllLocations).toBe(false);
    expect(normalizeCeoDashboard({ sales: { InquiriesAllLocations: true } }).sales?.inquiriesAllLocations).toBe(true);
  });

  it("reads PascalCase fields too", () => {
    const d = normalizeCeoDashboard({ Period: "year", Money: { Invoiced: 10, InvoicedPrev: 5 } });
    expect(d.period).toBe("year");
    expect(d.money?.invoiced).toBe(10);
    expect(d.money?.invoicedPrev).toBe(5);
  });
});

describe("aging", () => {
  it.each([
    ["not_due", "not_due"],
    ["Not due", "not_due"],
    ["1-30", "1_30"],
    ["1_30", "1_30"],
    ["31-60 days", "31_60"],
    ["90+", "90_plus"],
    ["90_plus", "90_plus"],
    ["weird", null],
  ])("bucket %p is %p", (input, expected) => {
    expect(agingKey(input)).toBe(expected);
  });

  it("puts the buckets in order and adds missing ones as zero", () => {
    const rows = normalizeAging([
      { bucket: "61_90", amount: 3, count: 1 },
      { bucket: "not_due", amount: 1, count: 1 },
    ]);
    expect(rows.map((r) => [r.bucket, r.label, r.amount])).toEqual([
      ["not_due", "Not due", 1],
      ["1_30", "1-30 days", 0],
      ["31_60", "31-60 days", 0],
      ["61_90", "61-90 days", 3],
      ["90_plus", "Over 90 days", 0],
    ]);
  });

  it("is empty when no aging was sent", () => {
    expect(normalizeAging(undefined)).toEqual([]);
    expect(normalizeAging([])).toEqual([]);
  });
});

describe("funnel and inquiry types", () => {
  it("orders the funnel stages and fills missing ones", () => {
    expect(normalizeFunnel([{ stage: "bookings", count: 2 }, { stage: "inquiries", count: 9 }])).toEqual([
      { stage: "inquiries", label: "Tour inquiries", count: 9 },
      { stage: "quotations", label: "Quotations", count: 0 },
      { stage: "accepted", label: "Accepted", count: 0 },
      { stage: "bookings", label: "Bookings", count: 2 },
    ]);
    expect(normalizeFunnel(null)).toEqual([]);
  });

  it("merges inquiry type spellings and keeps the CMS order (Website, WhatsApp, Walk-In, Reference, Not set)", () => {
    const rows = normalizeInquiryTypes([
      { type: "NotSet", count: 1 },
      { type: "Walk-In", count: 2 },
      { type: "walkin", count: 3 },
      { type: "Website", count: 4 },
      { type: null, count: 5 },
      { type: "Billboard", label: "Billboard", count: 1 },
    ]);
    expect(rows).toEqual([
      { type: "Website", key: "Website", label: "Website", count: 4 },
      { type: "WalkIn", key: "WalkIn", label: "Walk-In", count: 5 },
      { type: "NotSet", key: "NotSet", label: "Not set", count: 6 },
      { type: null, key: "Billboard", label: "Billboard", count: 1 },
    ]);
  });

  it("keeps only valid, distinct locations", () => {
    expect(normalizeLocations([{ locationId: 1, name: "I-8" }, { locationId: 1, name: "dup" }, { id: 4 }, { name: "no id" }])).toEqual([
      { locationId: 1, name: "I-8" },
      { locationId: 4, name: "Location 4" },
    ]);
  });
});

describe("normalizeCeoBreakdown", () => {
  it("reads the contract shape", () => {
    const b = normalizeCeoBreakdown(
      {
        isSuccessful: true,
        data: {
          title: "Revenue, Oct 2026",
          subtitle: "By location",
          valueLabel: "Invoiced",
          value2Label: "Collected",
          rows: [{ key: 1, label: "I-8", value: 100, value2: 80, count: 4 }],
        },
      },
      "revenue",
    );
    expect(b).toEqual({
      title: "Revenue, Oct 2026",
      subtitle: "By location",
      valueLabel: "Invoiced",
      value2Label: "Collected",
      rows: [{ key: "1", label: "I-8", value: 100, value2: 80, count: 4 }],
    });
  });

  it("falls back to the metric's labels and keeps an explicit null value2Label", () => {
    expect(normalizeCeoBreakdown(null, "aging")).toEqual({
      title: "Receivables by location",
      subtitle: null,
      valueLabel: "Amount",
      value2Label: null,
      rows: [],
    });
    expect(normalizeCeoBreakdown({ value2Label: null }, "staff").value2Label).toBeNull();
    expect(normalizeCeoBreakdown({}, "staff").value2Label).toBe("Converted");
  });

  it("labels month rows and sorts them oldest first", () => {
    const b = normalizeCeoBreakdown({ rows: [{ key: "2026-10", value: 2 }, { key: "2026-05", value: 1 }] }, "inquiries-type");
    expect(b.rows.map((r) => [r.key, r.label, r.value2])).toEqual([
      ["2026-05", "May 2026", null],
      ["2026-10", "Oct 2026", null],
    ]);
  });
});

describe("normalizeCeoRecords", () => {
  it("reads invoices with title and total", () => {
    const r = normalizeCeoRecords("invoices", {
      isSuccessful: true,
      data: {
        title: "Overdue invoices",
        total: 340,
        rows: [{ invoiceId: 5, invoiceNumber: "INV-5", customer: "Acme", total: 100, paid: 40, balance: 60, status: "Overdue" }],
      },
    });
    expect(r.kind).toBe("invoices");
    expect(r.title).toBe("Overdue invoices");
    expect(r.total).toBe(340);
    expect(r.rows[0]).toMatchObject({ invoiceId: 5, invoiceNumber: "INV-5", balance: 60, status: "Overdue", dueOn: null });
  });

  it("uses a default title, counts the rows when no total is sent, and never reports fewer than shown", () => {
    const r = normalizeCeoRecords("spaces", { rows: [{ spaceId: 1, occupied: "true" }, { spaceId: 2 }], total: 1 });
    expect(r.title).toBe("Spaces");
    expect(r.total).toBe(2);
    if (r.kind !== "spaces") throw new Error("kind");
    expect(r.rows.map((x) => x.occupied)).toEqual([true, false]);
    expect(normalizeCeoRecords("bookings", null)).toEqual({ kind: "bookings", title: "Bookings", total: 0, rows: [] });
  });

  it("accepts a bare array of rows and reads inquiry types", () => {
    const r = normalizeCeoRecords("inquiries", [{ inquiryId: 3, name: "Ali", type: "walk_in" }, { inquiryId: 4, type: "Billboard" }]);
    expect(r.total).toBe(2);
    if (r.kind !== "inquiries") throw new Error("kind");
    expect(r.rows[0]).toMatchObject({ inquiryId: 3, type: "WalkIn", typeText: "walk_in" });
    expect(r.rows[1]).toMatchObject({ type: null, typeText: "Billboard" });
  });

  it("reads leases (records/leases) with their days left", () => {
    const r = normalizeCeoRecords("leases", {
      isSuccessful: true,
      data: {
        title: "Leases: ending in the next 90 days",
        total: 64,
        rows: [{ bookingId: 7, customer: "Acme", space: "Office 4", location: "I-8", endOn: "2026-11-02", monthlyAmount: 50000, daysLeft: 18 }, {}],
      },
    });
    expect(r).toMatchObject({ kind: "leases", title: "Leases: ending in the next 90 days", total: 64 });
    if (r.kind !== "leases") throw new Error("kind");
    expect(r.rows[0]).toEqual({ bookingId: 7, customer: "Acme", space: "Office 4", location: "I-8", endOn: "2026-11-02", monthlyAmount: 50000, daysLeft: 18 });
    expect(r.rows[1]).toEqual({ bookingId: null, customer: "Customer", space: null, location: null, endOn: null, monthlyAmount: null, daysLeft: null });
    expect(normalizeCeoRecords("leases", null)).toEqual({ kind: "leases", title: "Leases expiring", total: 0, rows: [] });
  });
});
