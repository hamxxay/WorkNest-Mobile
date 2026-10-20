// Records (drill level 3) as read-only cards, and the "Showing x of total" line.

import { billingPeriodText, daysLeftText, invoiceHeadline, recordCards, showingText } from "../records";

describe("recordCards", () => {
  it("builds an invoice card with its figures, leaving out missing fields", () => {
    const [card] = recordCards({
      kind: "invoices",
      title: "Invoices",
      total: 1,
      rows: [
        {
          invoiceId: 5,
          invoiceNumber: "INV-5",
          customer: "Acme",
          location: "I-8",
          issuedOn: "2026-10-01",
          periodStart: null,
          periodEnd: null,
          dueOn: null,
          total: 100000,
          paid: 40000,
          balance: 60000,
          status: "Overdue",
        },
      ],
    });
    expect(card).toMatchObject({
      title: "INV-5",
      // No billing period sent (an older API): the issue date alone under the number.
      headline: { text: "Issued 1 Oct 2026", note: null },
      subtitle: "Acme · I-8",
      status: "Overdue",
      amount: "PKR 100,000",
      fields: [
        { label: "Paid", value: "PKR 40,000" },
        { label: "Balance", value: "PKR 60,000" },
      ],
    });
    expect(card.accessibilityLabel).toContain("INV-5, Issued 1 Oct 2026, Acme · I-8, Overdue, PKR 100,000");
  });

  it("shows an invoice's billing period under its number, with the issue date under it", () => {
    const [card] = recordCards({
      kind: "invoices",
      title: "Billed in advance",
      total: 1,
      rows: [
        {
          invoiceId: 58,
          invoiceNumber: "INV-REC-58-20261101",
          customer: "Acme",
          location: "I-8",
          issuedOn: "2026-10-17",
          periodStart: "2026-11-01",
          periodEnd: "2026-11-30",
          dueOn: "2026-11-05",
          total: 90000,
          paid: 0,
          balance: 90000,
          status: "Unpaid",
        },
      ],
    });
    expect(card.headline).toEqual({ text: "1 Nov - 30 Nov 2026", note: "Issued 17 Oct 2026" });
    expect(card.fields.map((f) => f.label)).toEqual(["Due", "Paid", "Balance"]);
    expect(card.accessibilityLabel).toContain("INV-REC-58-20261101, 1 Nov - 30 Nov 2026, Issued 17 Oct 2026, Acme · I-8");
  });

  it("other lists have no headline", () => {
    const [card] = recordCards({
      kind: "leases",
      title: "Leases",
      total: 1,
      rows: [{ bookingId: 7, customer: "Acme", space: "Office 4", location: "I-8", endOn: "2026-11-02", monthlyAmount: 50000, daysLeft: 18 }],
    });
    expect(card.headline).toBeUndefined();
  });
});

describe("billingPeriodText / invoiceHeadline", () => {
  it("one year, across years, without an end, without a start", () => {
    expect(billingPeriodText("2026-11-01", "2026-11-30")).toBe("1 Nov - 30 Nov 2026");
    expect(billingPeriodText("2026-10-21", "2027-01-31")).toBe("21 Oct 2026 - 31 Jan 2027");
    expect(billingPeriodText("2026-11-01T00:00:00", null)).toBe("From 1 Nov 2026");
    expect(billingPeriodText(null, "2026-11-30")).toBeNull();
    expect(billingPeriodText("not a date", "2026-11-30")).toBeNull();
  });

  it("falls back to the issue date, or nothing", () => {
    expect(invoiceHeadline({ periodStart: "2026-11-01", periodEnd: "2026-11-30", issuedOn: null })).toEqual({ text: "1 Nov - 30 Nov 2026", note: null });
    expect(invoiceHeadline({ periodStart: null, periodEnd: null, issuedOn: "2026-10-17" })).toEqual({ text: "Issued 17 Oct 2026", note: null });
    expect(invoiceHeadline({ periodStart: null, periodEnd: null, issuedOn: null })).toBeNull();
  });

  it("shows a free space without a customer", () => {
    const [card] = recordCards({
      kind: "spaces",
      title: "Spaces",
      total: 1,
      rows: [{ spaceId: 2, name: null, spaceType: "Desk", location: "F-7", capacity: 1, occupied: false, customer: "Old", bookingEndOn: "2026-01-01" }],
    });
    expect(card).toMatchObject({ title: "Space 2", status: "Available", amount: null, fields: [{ label: "Capacity", value: "1 person" }] });
  });

  it("labels inquiry types and has fallbacks for blank rows", () => {
    const cards = recordCards({
      kind: "inquiries",
      title: "Tour inquiries",
      total: 2,
      rows: [
        { inquiryId: 1, name: "Ali", phone: "0300", type: "WalkIn", typeText: "WalkIn", referenceName: null, status: "New", createdOn: null, feedback: null },
        { inquiryId: null, name: null, phone: null, type: null, typeText: "Billboard", referenceName: "Bilal", status: null, createdOn: null, feedback: null },
      ],
    });
    expect(cards[0]).toMatchObject({ title: "Ali", subtitle: "0300 · Walk-In", status: "New" });
    expect(cards[1]).toMatchObject({ title: "Visitor", subtitle: "Billboard", fields: [{ label: "Reference", value: "Bilal" }] });
    expect(new Set(cards.map((c) => c.key)).size).toBe(2);
  });

  it("covers bookings and quotations", () => {
    expect(
      recordCards({
        kind: "bookings",
        title: "Bookings",
        total: 1,
        rows: [{ bookingId: 8, customer: null, space: "Office 1", location: null, startOn: "2026-10-01", endOn: null, status: "Confirmed", totalAmount: null }],
      })[0],
    ).toMatchObject({ title: "Customer", subtitle: "Office 1", amount: null, fields: [{ label: "Starts", value: "1 Oct 2026" }, { label: "Booking", value: "#8" }] });
    expect(
      recordCards({
        kind: "quotations",
        title: "Quotations",
        total: 1,
        rows: [{ quotationId: 3, quotationNumber: null, customer: "Acme", location: "I-8", createdBy: "Sara", status: "Accepted", total: 5000, createdOn: "2026-10-02" }],
      })[0],
    ).toMatchObject({ title: "Quotation 3", amount: "PKR 5,000", fields: [{ label: "Created", value: "2 Oct 2026" }, { label: "Created by", value: "Sara" }] });
  });
});

describe("lease cards (records/leases)", () => {
  it("customer, space and location, monthly rent, end date and days left", () => {
    const [card] = recordCards({
      kind: "leases",
      title: "Leases",
      total: 1,
      rows: [{ bookingId: 7, customer: "Acme", space: "Office 4", location: "I-8", endOn: "2026-11-02", monthlyAmount: 50000, daysLeft: 18 }],
    });
    expect(card).toMatchObject({
      title: "Acme",
      subtitle: "Office 4 · I-8",
      status: null,
      amount: "PKR 50,000/mo",
      fields: [
        { label: "Ends", value: "2 Nov 2026" },
        { label: "Days left", value: "18 days" },
        { label: "Booking", value: "#7" },
      ],
    });
    expect(daysLeftText(0)).toBe("Today");
    expect(daysLeftText(-1)).toBe("Ended 1 day ago");
    expect(daysLeftText(null)).toBeNull();
  });
});

describe("showingText", () => {
  it("says how many of the total are listed", () => {
    expect(showingText(200, 340)).toBe("Showing 200 of 340");
    expect(showingText(12, 12)).toBe("Showing 12 of 12");
    expect(showingText(5, 0)).toBe("Showing 5 of 5");
    expect(showingText(0, 10)).toBe("");
    expect(showingText(1200, 1500)).toBe("Showing 1,200 of 1,500");
  });
});
