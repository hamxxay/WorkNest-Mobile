// The CEO dashboard's Discounts section (GET api/ceo/discounts, records/{bookings|invoices}): the contract's answer read
// as typed data, partial / PascalCase answers read without failing, `available: false` kept as the server's message
// only, the drill-down queries (the dashboard's period and location, custom range as periodFrom / periodTo) and the
// texts the section shows. apiClient / config / authStorage are mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token"), getUser: jest.fn(async () => null) }));
jest.mock("../../apiClient", () => {
  class ApiError extends Error {
    status: number;
    details?: unknown;
    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }
  return {
    ApiError,
    apiRequest: jest.fn(),
    errorMessage: (error: unknown, fallback = "Something went wrong.") => (error instanceof ApiError ? error.message : fallback),
    serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
  };
});

import { ApiError, apiRequest } from "../../apiClient";
import {
  DISCOUNTS_UNAVAILABLE_MESSAGE,
  bookingDetail,
  discountMakeUp,
  discountRecordsParams,
  discountsErrorView,
  getCeoDiscountRecords,
  getCeoDiscounts,
  groupDetail,
  groupFilter,
  invoiceDetail,
  normalizeCeoDiscounts,
  normalizeDiscountRecords,
  priceLine,
  recordsSummary,
  sellerText,
  toDiscountBooking,
} from "../discounts";
import { ceoErrorView } from "../errors";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());
const lastPath = () => api.mock.calls[api.mock.calls.length - 1][0];

const BOOKING = {
  bookingId: 557,
  customer: "Acme Traders",
  room: "Office 309",
  locationId: 1,
  location: "I-8",
  shift: "24/7",
  seats: 3,
  startOn: "2026-11-05",
  endOn: "2027-11-05",
  startedInPeriod: false,
  listSeatPrice: 35000,
  shiftDiscountCapPct: 10,
  expectedMonthly: 105000,
  rentMonthly: 94500,
  soldMonthly: 94500,
  pricing: "under",
  belowPriceMonthly: 10500,
  fixedMonthly: 0,
  discountMonthly: 10500,
  discountPct: 10,
  baseMonthly: 105000,
  sellerId: 2,
  seller: "Luqman Ahmad",
  sellerRole: "Super Admin",
};

const ANSWER = {
  available: true,
  period: "month",
  periodLabel: "October 2026",
  summary: {
    bookings: 15, priced: 15, unpriced: 0, discounted: 2, expectedMonthly: 2345000, baseMonthly: 2345000, soldMonthly: 2333500,
    discountMonthly: 11500, discountPct: 0.5, averageDiscountPct: 6.6, belowPriceMonthly: 10500, belowPriceBookings: 1,
    fixedMonthly: 1000, fixedBookings: 1, newBookings: 11, newDiscounted: 0, newDiscountMonthly: 0,
    invoiceDiscount: 482491.95, invoicesDiscounted: 16, invoiceDiscountPaid: 212741.94,
  },
  byLocation: [{ key: "1", name: "I-8", bookings: 15, discounted: 2, baseMonthly: 2345000, discountMonthly: 11500, discountPct: 0.5, largestMonthly: 10500, invoiceDiscount: 482491.95, invoicesDiscounted: 16 }],
  bySeller: [
    { key: "2", name: "Luqman Ahmad", role: "Super Admin", bookings: 1, discounted: 1, baseMonthly: 105000, discountMonthly: 10500, discountPct: 10 },
    { key: null, name: "No salesperson recorded", role: null, bookings: 2, discounted: 0, baseMonthly: 280000, discountMonthly: 0, discountPct: 0 },
  ],
  byShift: [{ key: "Morning", name: "Morning", bookings: 0 }, { key: "24/7", name: "24/7", bookings: 15, discounted: 2, discountMonthly: 11500, baseMonthly: 2345000 }],
  biggest: [
    { ...BOOKING, bookingId: 542, customer: "Beta", room: "Office 351", seats: 2, discountMonthly: 1000, discountPct: 1.4, belowPriceMonthly: 0, fixedMonthly: 1000, expectedMonthly: 70000, soldMonthly: 69000, sellerId: 4, seller: "Muhammad Hamza" },
    BOOKING,
  ],
};

describe("normalizeCeoDiscounts", () => {
  it("reads the contract's answer, shifts always 24/7, Morning, Evening, biggest first", () => {
    const d = normalizeCeoDiscounts({ isSuccessful: true, data: ANSWER }, "month");
    if (!d.available) throw new Error("expected the report");
    expect(d.periodLabel).toBe("October 2026");
    expect(d.summary.discountMonthly).toBe(11500);
    expect(d.summary.invoiceDiscountPaid).toBe(212741.94);
    expect(d.byLocation[0]).toMatchObject({ key: "1", name: "I-8", discounted: 2, invoicesDiscounted: 16 });
    expect(d.bySeller[0].role).toBe("Super Admin");
    expect(d.bySeller[1].key).toBeNull();
    expect(d.byShift.map((g) => g.key)).toEqual(["24/7", "Morning", "Evening"]);
    expect(d.byShift[0].discountMonthly).toBe(11500);
    expect(d.byShift[0].discountPct).toBe(0.5);   // worked out when the server leaves it out
    expect(d.byShift[2].bookings).toBe(0);
    expect(d.biggest.map((b) => b.bookingId)).toEqual([557, 542]);
  });

  it("keeps only the server's message before the database update", () => {
    const msg = "Database update needed: run the script DD_01_ceo_discounts_TEST (DD_01_ceo_discounts_LIVE on the live database) to see the discounts.";
    const d = normalizeCeoDiscounts({ isSuccessful: true, data: { available: false, message: msg, period: "quarter" } }, "month");
    expect(d).toMatchObject({ available: false, message: msg, period: "quarter" });
    expect(normalizeCeoDiscounts({ isSuccessful: true, data: { available: false } }, "month")).toMatchObject({ available: false, message: DISCOUNTS_UNAVAILABLE_MESSAGE });
    expect(normalizeCeoDiscounts(null, "year")).toMatchObject({ available: false, period: "year" });
    expect(DISCOUNTS_UNAVAILABLE_MESSAGE.toLowerCase()).not.toContain("sql");
  });

  it("reads a partial, PascalCase answer without failing", () => {
    const d = normalizeCeoDiscounts({ Available: true, Summary: { DiscountMonthly: "1200", Bookings: 3 }, From: "2026-10-01", To: "2026-10-15", Period: "custom" }, "month");
    if (!d.available) throw new Error("expected the report");
    expect(d.summary.discountMonthly).toBe(1200);
    expect(d.summary.discounted).toBe(0);
    expect(d.range).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(d.period).toBe("custom");
    expect(d.byLocation).toEqual([]);
    expect(d.byShift).toHaveLength(3);
  });

  it("a booking: seller left out when there is none, the shift spelled any way, the discount worked out", () => {
    const b = toDiscountBooking({ bookingId: 9, shift: "shift_morning", seller: "Someone", belowPriceMonthly: 2000, fixedMonthly: 500, baseMonthly: 50000 });
    expect(b.shift).toBe("Morning");
    expect(b.seller).toBeNull();
    expect(b.discountMonthly).toBe(2500);
    expect(b.discountPct).toBe(5);
    expect(b.customer).toBe("Customer");
  });
});

describe("records", () => {
  it("reads bookings and invoices lists", () => {
    const r = normalizeDiscountRecords("bookings", { isSuccessful: true, data: { title: "Discounted bookings: running in October 2026", total: 2, discountTotal: 11500, baseTotal: 175000, discountPct: 6.6, rows: [BOOKING] } });
    expect(r.bookings).toHaveLength(1);
    expect(r.invoices).toEqual([]);
    expect(recordsSummary(r)).toBe("Showing the biggest 1 of 2 · PKR 11,500 a month off PKR 175,000 expected (6.6%)");

    const inv = normalizeDiscountRecords("invoices", { isSuccessful: true, data: { total: 1, discountTotal: 3000, baseTotal: 252428.57, discountPct: 1.2, rows: [{ invoiceId: 395, invoiceNumber: "INV-2026-00395", customer: "Beta", room: "Office 351", location: "I-8", issuedOn: "2026-10-07", subTotal: 252428.57, discount: 3000, total: 386348.57, status: "Paid", paid: true }] } });
    expect(inv.invoices[0]).toMatchObject({ invoiceId: 395, paid: true, discount: 3000 });
    expect(invoiceDetail(inv.invoices[0])).toBe("Issued 7 Oct 2026 · Office 351 · I-8");
    expect(recordsSummary(inv)).toBe("1 invoice · PKR 3,000 off PKR 252,429 (1.2%)");
  });

  it("asks for the dashboard's period and location, a custom range as periodFrom / periodTo", () => {
    expect(discountRecordsParams({ period: "month", locationId: 3 })).toEqual({ period: "month", locationId: 3, sellerId: null, shift: null, newOnly: null });
    const custom = discountRecordsParams({ period: "custom", range: { from: "2026-10-01", to: "2026-10-15" } }, { sellerId: "none", shift: "Morning", newOnly: true });
    expect(custom).toMatchObject({ period: "custom", periodFrom: "2026-10-01", periodTo: "2026-10-15", locationId: null, sellerId: "none", shift: "Morning", newOnly: true });
    expect(discountRecordsParams({ period: "year", locationId: 3 }, { locationId: "none" }).locationId).toBe("none");
    expect(discountRecordsParams({ period: "year", locationId: 3 }, { locationId: 5 }).locationId).toBe(5);
  });

  it("a breakdown row opens its filter (none for no location / no salesperson)", () => {
    const g = { key: null, name: "No salesperson recorded", role: null, bookings: 1, discounted: 0, baseMonthly: 0, discountMonthly: 0, discountPct: 0, largestMonthly: 0, invoiceDiscount: 0, invoicesDiscounted: 0 };
    expect(groupFilter("seller", g)).toEqual({ sellerId: "none" });
    expect(groupFilter("location", g)).toEqual({ locationId: "none" });
    expect(groupFilter("location", { ...g, key: "2" })).toEqual({ locationId: 2 });
    expect(groupFilter("shift", { ...g, key: "Evening", name: "Evening" })).toEqual({ shift: "Evening" });
  });
});

describe("texts", () => {
  const b = toDiscountBooking(BOOKING);
  it("say how much, against what and who sold it", () => {
    expect(bookingDetail(b)).toBe("Office 309 · 24/7 · 3 seats · I-8");
    expect(bookingDetail(b, false)).toBe("Office 309 · 24/7 · 3 seats");
    expect(priceLine(b)).toBe("Expected PKR 105K, sold PKR 94.5K");
    expect(sellerText(b)).toBe("Sold by Luqman Ahmad (Super Admin)");
    expect(sellerText({ seller: null, sellerRole: null })).toBe("No salesperson recorded");
    expect(discountMakeUp(b)).toBe("PKR 10,500 below the price");
    expect(discountMakeUp({ ...b, shift: "Morning", fixedMonthly: 1000 })).toBe("PKR 10,500 below the shift price + PKR 1,000 fixed discount");
    expect(priceLine({ ...b, expectedMonthly: null })).toBe("No list price, sold PKR 94.5K");
  });

  it("group lines", () => {
    const d = normalizeCeoDiscounts(ANSWER, "month");
    if (!d.available) throw new Error("expected the report");
    expect(groupDetail(d.byLocation[0])).toBe("2 of 15 discounted · 0.5%");
    expect(groupDetail(d.bySeller[1])).toBe("0 of 2 discounted");
    expect(groupDetail(d.byShift[1])).toBe("No bookings");
  });
});

describe("requests", () => {
  it("GET ceo/discounts with the period and location (custom: from / to)", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: ANSWER });
    const d = await getCeoDiscounts({ period: "quarter", locationId: 2 });
    expect(lastPath()).toBe("/ceo/discounts?period=quarter&locationId=2");
    expect(d.available).toBe(true);
    api.mockResolvedValueOnce({ isSuccessful: true, data: ANSWER });
    await getCeoDiscounts({ period: "custom", locationId: null, range: { from: "2026-10-01", to: "2026-10-15" } });
    expect(lastPath()).toBe("/ceo/discounts?period=custom&from=2026-10-01&to=2026-10-15");
  });

  it("GET ceo/discounts/records/{kind} with the filter", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: { rows: [BOOKING], total: 1 } });
    await getCeoDiscountRecords("bookings", { period: "month", locationId: 1 }, { sellerId: 2 });
    expect(lastPath()).toBe("/ceo/discounts/records/bookings?period=month&locationId=1&sellerId=2");
    api.mockResolvedValueOnce({ isSuccessful: true, data: { rows: [], total: 0 } });
    await getCeoDiscountRecords("invoices", { period: "month" });
    expect(lastPath()).toBe("/ceo/discounts/records/invoices?period=month");
  });

  it("a 503 names the database update DD_01", async () => {
    api.mockRejectedValueOnce(new ApiError("Database update needed: run the script DD_01_ceo_discounts_TEST (DD_01_ceo_discounts_LIVE on the live database) to see the discounts.", 503));
    const error = await getCeoDiscountRecords("bookings", { period: "month" }).catch((e) => e);
    const view = discountsErrorView(error);
    expect(view.databaseUpdate).toBe(true);
    expect(view.title).toBe("Database update needed");
    expect(view.message).toBe("Database update needed: run the script DD_01_ceo_discounts_TEST (DD_01_ceo_discounts_LIVE on the live database) to see the discounts.");
    // Anything else: as the other CEO screens.
    expect(discountsErrorView(new ApiError("Nope", 403)).title).toBe(ceoErrorView(new ApiError("Nope", 403)).title);
  });
});
