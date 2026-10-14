// Records (drill level 3) as read-only cards, and the "Showing x of total" line.

import { recordCards, showingText } from "../records";

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
      subtitle: "Acme · I-8",
      status: "Overdue",
      amount: "PKR 100,000",
      fields: [
        { label: "Issued", value: "1 Oct 2026" },
        { label: "Paid", value: "PKR 40,000" },
        { label: "Balance", value: "PKR 60,000" },
      ],
    });
    expect(card.accessibilityLabel).toContain("INV-5, Acme · I-8, Overdue, PKR 100,000");
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

describe("showingText", () => {
  it("says how many of the total are listed", () => {
    expect(showingText(200, 340)).toBe("Showing 200 of 340");
    expect(showingText(12, 12)).toBe("Showing 12 of 12");
    expect(showingText(5, 0)).toBe("Showing 5 of 5");
    expect(showingText(0, 10)).toBe("");
    expect(showingText(1200, 1500)).toBe("Showing 1,200 of 1,500");
  });
});
