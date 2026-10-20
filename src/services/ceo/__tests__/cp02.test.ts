// CP_02 (CEO dashboard fixes, 20 Oct 2026): the new API fields are read when sent and left out (null / []) by an older
// API; the new drill-downs (Received, Security deposits, occupancy by room category, sales bookings) ask for the right
// lists; the record cards show the new figures.

import {
  breakdownParams,
  categoryKey,
  categorySpacesRecords,
  depositRecords,
  isCompleteBreakdown,
  receivedRecords,
  recordsForBreakdownRow,
  recordsForPersonBookings,
  revenueTarget,
  salesBookingsRecords,
} from "../drill";
import { funnelStepText } from "../format";
import { normalizeCeoDashboard, normalizeCeoRecords } from "../normalize";
import { recordCards, recordsSummaryText } from "../records";
import type { CeoBreakdownRow } from "../types";

const TODAY = new Date(2026, 9, 20);
const row = (key: string, label = key): CeoBreakdownRow => ({ key, label, value: 1, value2: 2, count: null });

describe("CP_02 dashboard fields", () => {
  it("reads room categories (Private Office first), seats and the 'No location' row", () => {
    const d = normalizeCeoDashboard({
      occupancy: {
        totalSeats: 434,
        seatsSold: 61,
        seatOccupancyPct: 14.1,
        categories: [
          { categoryCode: "SharedSpace", label: "Shared Space", rooms: 74, occupied: 0, occupancyPct: 0, seats: 74, seatsSold: 0, seatOccupancyPct: 0 },
          { CategoryCode: "PrivateOffice", Label: "Private Office", Rooms: 87, Occupied: 13, OccupancyPct: 14.9, OccupancyPctPrev: 10, Seats: 360, SeatsSold: 61, SeatOccupancyPct: 16.9 },
        ],
        byLocation: [{ locationId: 0, total: 1, occupied: 0 }],
        months: [{ month: "2026-10", occupancyPct: 8.1, categories: [{ categoryCode: "SharedSpace", label: "Shared Space", rooms: 74 }, { categoryCode: "PrivateOffice", label: "Private Office", rooms: 87, occupied: 13, occupancyPct: 14.9 }] }],
      },
    });
    const o = d.occupancy!;
    expect(o.categories.map((c) => [c.categoryCode, c.label, c.occupied, c.rooms, c.occupancyPctPrev])).toEqual([
      ["PrivateOffice", "Private Office", 13, 87, 10],
      ["SharedSpace", "Shared Space", 0, 74, null],
    ]);
    expect(o).toMatchObject({ totalSeats: 434, seatsSold: 61, seatOccupancyPct: 14.1 });
    expect(o.months[0].categories.map((c) => c.categoryCode)).toEqual(["PrivateOffice", "SharedSpace"]);
    expect(o.byLocation[0]).toMatchObject({ locationId: 0, name: "No location", categories: [], seats: null });
  });

  it("reads the money, sales and team additions", () => {
    const d = normalizeCeoDashboard({
      money: { securityDeposits: 17154400, securityDepositsCount: 9, received: 12586743.55, receivedPrev: 0, receivedCount: 18, receivedSeries: [{ month: "2026-10", received: 12586743.55, count: 18 }, { month: "2026-09", received: 0, count: 0 }] },
      sales: { funnel: [], bookingValueBasis: "Contract", bookingsFromQuotations: 7, inquiriesNoBranch: 1 },
      team: { revenueBasis: "bookings", perLocation: [{ locationId: 1, name: "I-8", salesExecutivesOnly: true }], people: [{ userId: 4, name: "Hamza", revenue: 5, bookings: 2 }] },
    });
    expect(d.money).toMatchObject({ securityDeposits: 17154400, securityDepositsPrev: null, securityDepositsCount: 9, received: 12586743.55, receivedPrev: 0, receivedCount: 18 });
    expect(d.money!.receivedSeries.map((x) => x.month)).toEqual(["2026-09", "2026-10"]);
    expect(d.sales).toMatchObject({ bookingValueBasis: "contract", bookingsFromQuotations: 7, inquiriesNoBranch: 1 });
    expect(d.team).toMatchObject({ revenueBasis: "bookings", perLocation: [{ salesExecutivesOnly: true }], people: [{ bookings: 2 }] });
  });
});

describe("CP_02 drill-downs", () => {
  it("occupancy by room category: its key, its rows' rooms, and a location's rows by category", () => {
    const q = { metric: "occupancy-category" as const, category: "PrivateOffice", period: "month" as const, locationId: null };
    expect(isCompleteBreakdown(q)).toBe(true);
    expect(isCompleteBreakdown({ ...q, category: "" })).toBe(false);
    expect(breakdownParams(q)).toMatchObject({ metric: "occupancy-category", category: "PrivateOffice" });
    expect(recordsForBreakdownRow(q, row("1", "I-8"), { occupied: true })).toEqual({ kind: "spaces", params: { category: "PrivateOffice", locationId: 1, occupied: true } });
    expect(recordsForBreakdownRow(q, row("none", "No location"))).toEqual({ kind: "spaces", params: { category: "PrivateOffice", locationId: "none" } });
    const loc = { metric: "occupancy-location" as const, period: "month" as const, locationId: 1 };
    expect(recordsForBreakdownRow(loc, row("SharedSpace", "Shared Space"))).toEqual({ kind: "spaces", params: { locationId: 1, category: "SharedSpace" } });
    expect(recordsForBreakdownRow(loc, row("7", "Private Office"))).toEqual({ kind: "spaces", params: { locationId: 1, spaceTypeId: 7 } });
    expect(categoryKey("none")).toBeNull();
    expect(categoryKey("12")).toBeNull();
    expect(categorySpacesRecords(0, "PrivateOffice")).toEqual({ kind: "spaces", params: { locationId: "none", category: "PrivateOffice" } });
    expect(categorySpacesRecords(null, "PrivateOffice")).toBeNull();
  });

  it("Received: the receipts of the period; Security deposits: the invoice window the card counts", () => {
    expect(receivedRecords({ period: "quarter", locationId: 2 })).toEqual({ kind: "receipts", params: { period: "quarter", locationId: 2 } });
    const range = { from: "2026-10-01", to: "2026-10-15" };
    expect(receivedRecords({ period: "custom", range })).toEqual({ kind: "receipts", params: { period: "custom", periodFrom: "2026-10-01", periodTo: "2026-10-15" } });
    expect(depositRecords({ period: "month" }, TODAY).params).toMatchObject({ status: "deposit", from: "2026-10-01", to: "2026-10-31" });
    expect(depositRecords({ period: "quarter" }, TODAY).params).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(depositRecords({ period: "year", locationId: 1 }, TODAY).params).toMatchObject({ from: "2026-01-01", to: "2026-10-31", locationId: 1 });
    expect(depositRecords({ period: "custom", range }, TODAY).params).toMatchObject({ from: "2026-10-01", to: "2026-10-15" });
  });

  it("Collected opens the invoices with payments once the deposits are sent (CP_02), the paid ones before", () => {
    const months = [{ month: "2026-10", invoiced: 1, collected: 1 }];
    expect(revenueTarget({ months, securityDeposits: 0 }, "collected", { period: "month" }, TODAY)).toMatchObject({ recordsParams: { status: "collected" } });
    expect(revenueTarget({ months, securityDeposits: null }, "collected", { period: "month" }, TODAY)).toMatchObject({ recordsParams: { status: "paid" } });
    expect(revenueTarget({ months }, "invoiced", { period: "month" }, TODAY)).toMatchObject({ recordsParams: undefined });
  });

  it("sales bookings and a seller's bookings", () => {
    expect(salesBookingsRecords({ period: "month", locationId: 1 }, TODAY)).toEqual({ kind: "bookings", params: { period: "month", locationId: 1, sales: true } });
    expect(recordsForPersonBookings(4, { period: "year" }, TODAY)).toEqual({ kind: "bookings", params: { period: "year", sellerId: 4 } });
    expect(recordsForPersonBookings(null, { period: "year" }, TODAY)).toBeNull();
  });

  it("the funnel's bookings stage: no share, how many came from quotations", () => {
    const funnel = [
      { stage: "accepted", label: "Accepted", count: 27 },
      { stage: "bookings", label: "Bookings", count: 26 },
    ];
    expect(funnelStepText(funnel, 1)).toBeNull();
    expect(funnelStepText(funnel, 1, 7)).toBe("7 from quotations");
  });
});

describe("CP_02 records", () => {
  it("money received: receipts and payments, with the total of every row", () => {
    const r = normalizeCeoRecords("receipts", {
      isSuccessful: true,
      data: {
        title: "Money received: in October 2026",
        total: 2,
        amount: 1500,
        rows: [
          { kind: "receipt", refId: 9, reference: "FR-0009", receivedOn: "2026-10-12", customer: "SAC", location: "I-8", invoiceNumber: "INV-2026-00401", amount: 1000, method: "Bank" },
          { kind: "payment", refId: 3, reference: null, receivedOn: "2026-10-13", amount: 500, method: "Online Payment", bookingId: 546 },
        ],
      },
    });
    expect(r.kind).toBe("receipts");
    expect(recordsSummaryText(r)).toBe("PKR 1,500 received in all");
    const cards = recordCards(r);
    expect(cards.map((c) => [c.title, c.status, c.amount])).toEqual([
      ["FR-0009", "Receipt", "PKR 1,000"],
      ["Payment 3", "Payment", "PKR 500"],
    ]);
    expect(cards[0].fields.map((f) => f.label)).toEqual(["Received", "Method", "Invoice"]);
    expect(cards[1].fields.map((f) => f.label)).toEqual(["Received", "Method", "Booking"]);
  });

  it("invoices: deposit and WHT fields, and the totals line (none from an older API)", () => {
    const r = normalizeCeoRecords("invoices", {
      title: "Invoices",
      invoiceTotals: { billed: 900, collected: 300, balance: 550 },
      rows: [{ invoiceId: 1, invoiceNumber: "INV-1", total: 1000, paid: 400, balance: 550, wht: 50, deposit: 100, billed: 900, collected: 360 }],
    });
    expect(recordsSummaryText(r)).toBe("Billed PKR 900 · Collected PKR 300 · Owed PKR 550, without security deposits");
    expect(recordCards(r)[0].fields).toEqual([
      { label: "Paid", value: "PKR 400" },
      { label: "Balance", value: "PKR 550" },
      { label: "Security deposit", value: "incl. PKR 100" },
      { label: "WHT", value: "PKR 50" },
    ]);
    const old = normalizeCeoRecords("invoices", { rows: [{ invoiceId: 1, total: 10, paid: 0, balance: 10 }] });
    expect(recordsSummaryText(old)).toBeNull();
    expect(recordCards(old)[0].fields.map((f) => f.label)).toEqual(["Paid", "Balance"]);
  });

  it("sales bookings show their seller; spaces their category and seats sold", () => {
    const b = normalizeCeoRecords("bookings", { rows: [{ bookingId: 546, customer: "SAC", totalAmount: 2104800, seller: "Muhammad Hamza", sellerId: 4, fromQuotation: true }] });
    expect(recordCards(b)[0].fields).toContainEqual({ label: "Sold by", value: "Muhammad Hamza" });
    expect(recordCards(b)[0].fields).toContainEqual({ label: "Made", value: "From a quotation" });
    const s = normalizeCeoRecords("spaces", { rows: [{ spaceId: 301, name: "Office 301", occupied: true, capacity: 5, seatsSold: 5, category: "Private Office", categoryCode: "PrivateOffice" }] });
    expect(recordCards(s)[0].fields).toEqual(expect.arrayContaining([{ label: "Category", value: "Private Office" }, { label: "Seats sold", value: "5" }]));
  });
});
