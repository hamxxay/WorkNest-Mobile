// Sales Manager records as read-only cards (the CEO dashboard's card shape), with desks on the right, never money.

import { daysLeftText, leaseCard, smBookingCard, smQuotationCard, smRecordCards } from "../records";
import type { SmRecords } from "../types";

describe("smRecordCards", () => {
  it("shows an inquiry's follow-up date after when it was received", () => {
    const records: SmRecords = {
      kind: "inquiries",
      title: "Follow-ups due",
      total: 1,
      rows: [
        {
          inquiryId: 9,
          name: "Ali",
          phone: "0300 1234567",
          type: "WalkIn",
          typeText: "WalkIn",
          referenceName: null,
          status: "FutureProspect",
          createdOn: "2026-10-01T10:00:00",
          feedback: "Call back next week",
          followUpOn: "2026-10-10",
        },
      ],
    };
    const [card] = smRecordCards(records);
    expect(card.title).toBe("Ali");
    expect(card.subtitle).toBe("0300 1234567 · Walk-In");
    expect(card.fields.map((f) => f.label)).toEqual(["Received", "Follow up on", "Feedback"]);
    expect(card.accessibilityLabel).toContain("Follow up on");
  });

  it("leaves the follow-up out when there is none", () => {
    const [card] = smRecordCards({
      kind: "inquiries",
      title: "x",
      total: 1,
      rows: [{ inquiryId: null, name: null, phone: null, type: null, typeText: "Fair", referenceName: "Zed", status: null, createdOn: null, feedback: null, followUpOn: null }],
    });
    expect(card.title).toBe("Visitor");
    expect(card.subtitle).toBe("Fair");
    expect(card.fields.map((f) => f.label)).toEqual(["Reference"]);
  });

  it("shows quotations with their desks instead of an amount", () => {
    const [q] = smRecordCards({
      kind: "quotations",
      title: "x",
      total: 1,
      rows: [{ quotationId: 4, quotationNumber: null, customer: "Acme", location: "I-8", createdBy: "Sara", status: "Accepted", desks: 6, createdOn: "2026-10-02" }],
    });
    expect(q.key).toBe("quotation-4-0");
    expect(q.title).toBe("Quotation 4");
    expect(q.subtitle).toBe("Acme · I-8");
    expect(q.status).toBe("Accepted");
    expect(q.amount).toBe("6 desks");
    expect(q.fields.map((f) => f.label)).toEqual(["Created", "Created by"]);
    expect(q.accessibilityLabel).toContain("6 desks");
    expect(q.accessibilityLabel).not.toMatch(/PKR/);

    expect(smQuotationCard({ quotationId: null, quotationNumber: "QUO-9", customer: null, location: null, createdBy: null, status: null, desks: 1, createdOn: null }, 2)).toMatchObject({
      key: "quotation-2-2",
      title: "QUO-9",
      subtitle: null,
      amount: "1 desk",
      fields: [],
    });
  });

  it("shows bookings with their desks instead of an amount (a meeting room: 0 desks)", () => {
    const [b] = smRecordCards({
      kind: "bookings",
      title: "x",
      total: 1,
      rows: [{ bookingId: 5, customer: "Acme", space: "Office 4", location: "I-8", startOn: "2026-10-01", endOn: "2027-09-30", status: "Confirmed", desks: 6 }],
    });
    expect(b.title).toBe("Acme");
    expect(b.subtitle).toBe("Office 4 · I-8");
    expect(b.amount).toBe("6 desks");
    expect(b.fields.map((f) => f.label)).toEqual(["Starts", "Ends", "Booking"]);

    expect(smBookingCard({ bookingId: null, customer: null, space: "Board room", location: null, startOn: null, endOn: null, status: null, desks: 0 }, 0)).toMatchObject({
      title: "Customer",
      subtitle: "Board room",
      amount: "0 desks",
      fields: [],
    });
  });

  it("shows an expiring lease with its desks, end date and days left", () => {
    const card = leaseCard({ bookingId: 77, customer: "Acme", space: "Office 4", location: "I-8", endOn: "2026-11-30", desks: 6, daysLeft: 47 }, 0);
    expect(card.key).toBe("lease-77-0");
    expect(card.subtitle).toBe("Office 4 · I-8");
    expect(card.status).toBeNull();
    expect(card.amount).toBe("6 desks");
    expect(card.fields).toEqual([
      expect.objectContaining({ label: "Ends" }),
      { label: "Days left", value: "47 days" },
      { label: "Booking", value: "#77" },
    ]);
    expect(smRecordCards({ kind: "leases", title: "x", total: 1, rows: [{ bookingId: null, customer: "", space: null, location: null, endOn: null, desks: 1, daysLeft: null }] })[0]).toMatchObject({
      title: "Customer",
      subtitle: null,
      amount: "1 desk",
      fields: [],
    });
  });
});

describe("daysLeftText", () => {
  it.each([
    [47, "47 days"],
    [1, "1 day"],
    [0, "Today"],
    [-1, "Ended 1 day ago"],
    [-3, "Ended 3 days ago"],
    [null, null],
    [NaN, null],
  ])("%p -> %p", (days, text) => {
    expect(daysLeftText(days as number | null)).toBe(text);
  });
});
