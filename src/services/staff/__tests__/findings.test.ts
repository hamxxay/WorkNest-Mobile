// Staff findings (quotation actions, invoice status, customer tax ids, booking company / challan / space type,
// customer quotations paging, forecast location chips) against a mocked transport, with response shapes as the
// API sends them. apiClient / config / authStorage are mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({
  getToken: jest.fn(async () => "token"),
  getUser: jest.fn(async () => ({ email: "staff@worknest.test" })),
}));
jest.mock("../../apiClient", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    apiRequest: jest.fn(),
    friendlyApiMessage: (_status: number, payload: any) => payload?.message ?? "Something went wrong. Please try again.",
    serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
  };
});

import { apiRequest, ApiError } from "../../apiClient";
import { listCustomerQuotations, quotationActions } from "../quotations";
import { deriveInvoiceStatusLabel, getInvoice, normalizeInvoice } from "../invoices";
import { getCustomer, keepExistingTaxIds, normalizeCustomer, withTaxIds, type CustomerInput } from "../customers";
import { bookingSpaceTypeId, getBooking, mergeBookingRow, normalizeBooking } from "../bookings";
import { forecastRowsFor, normalizeDashboardForecast } from "../dashboard";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());
const paths = () => api.mock.calls.map(([path]) => path);

/** Answers by path (exact match first, then prefix); anything else is a 404. */
function route(table: Record<string, unknown>) {
  api.mockImplementation(async (path: string) => {
    const key = Object.keys(table).find((k) => k === path) ?? Object.keys(table).find((k) => path.startsWith(k));
    if (key === undefined) throw new ApiError("Not found", 404);
    const value = table[key];
    if (value instanceof Error) throw value;
    return value;
  });
}

describe("quotation actions (CMS rules)", () => {
  it("sends only a Draft (a missing status counts as Draft)", () => {
    expect(quotationActions("Draft").canSend).toBe(true);
    expect(quotationActions(null).canSend).toBe(true);
    for (const status of ["Active", "Sent", "Declined", "Accepted", "AgreementSent", "Signed", "Converted", "Inactive"]) {
      expect(quotationActions(status).canSend).toBe(false);
    }
  });

  it("offers the agreement for the CMS isQuotationAccepted statuses", () => {
    for (const status of ["Active", "Sent", "Accepted", "Signed", "AgreementSigned", "AgreementSent", "agreement sent"]) {
      expect(quotationActions(status).canSendAgreement).toBe(true);
    }
    for (const status of ["Draft", "Declined", "Converted", "Inactive", "Approved"]) {
      expect(quotationActions(status).canSendAgreement).toBe(false);
    }
    expect(quotationActions("Draft", true).canSendAgreement).toBe(true);
  });

  it("no new version / edit once closed", () => {
    for (const status of ["Converted", "Signed", "AgreementSent", "AgreementSigned", "Inactive"]) {
      expect(quotationActions(status).canRevise).toBe(false);
    }
    for (const status of ["Draft", "Active", "Sent", "Accepted", "Declined"]) {
      expect(quotationActions(status).canRevise).toBe(true);
    }
  });
});

describe("customer quotations (paged)", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 100 - i, quotationNumber: `Q-${i}`, status: "Active" }));

  it("asks for one page and keeps the server's totalCount", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: rows(10), totalCount: 37 });
    const page = await listCustomerQuotations(18, { page: 1, limit: 10 });
    expect(paths()).toEqual(["/quotation/by-customer/18?page=1&limit=10"]);
    expect(page).toMatchObject({ total: 37, hasMore: true });
    expect(page.items).toHaveLength(10);
  });

  it("an API that ignores paging (every row, no total) is cut to the page", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "", data: rows(23), errors: null });
    const page = await listCustomerQuotations(18, { limit: 10 });
    expect(page.items.map((q) => q.id)).toEqual(rows(10).map((r) => r.id));
    expect(page).toMatchObject({ total: 23, hasMore: true, page: 1, limit: 10 });
  });

  it("few rows: all of them, no more pages", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, data: rows(6) });
    const page = await listCustomerQuotations(18);
    expect(page.items).toHaveLength(6);
    expect(page.hasMore).toBe(false);
  });
});

describe("invoice status without statusLabel", () => {
  it("derives it from legacy ids, then the amounts", () => {
    expect(deriveInvoiceStatusLabel({ statusId: 5, grandTotal: 100, paidTotal: 0, balanceDue: 100 })).toBe("Cancelled");
    expect(deriveInvoiceStatusLabel({ statusId: 62, grandTotal: 971760, paidTotal: 971760, balanceDue: 0 })).toBe("Paid");
    expect(deriveInvoiceStatusLabel({ statusId: 12, grandTotal: 470786.25, paidTotal: 459630, balanceDue: 11156.25 })).toBe("Partial");
    expect(deriveInvoiceStatusLabel({ statusId: 61, grandTotal: 1583640, paidTotal: 0, balanceDue: 1583640 })).toBe("Unpaid");
  });

  it("GET invoice/{id} of a paid invoice (no statusLabel) shows Paid, not Unpaid", () => {
    const detail = {
      id: 411,
      invoiceNumber: "INV-2026-00411",
      dueOn: "2020-10-19T00:00:00.000",
      grandTotal: 971760.0,
      paidTotal: 971760.0,
      balanceDue: 0.0,
      statusId: 62,
      whtAmount: 0.0,
    };
    expect(normalizeInvoice(detail)).toMatchObject({ statusLabel: "Paid", status: "Paid" });
  });

  it("a server label always wins", () => {
    expect(normalizeInvoice({ id: 1, statusLabel: "Cancelled", grandTotal: 10, paidTotal: 10, balanceDue: 0 }).statusLabel).toBe("Cancelled");
  });

  it("the row passed from Customer detail carries its label; the detail's amounts win", async () => {
    // customer/{id}/invoices row: label right, amounts not (paidTotal 0 for a paid invoice).
    const row = normalizeInvoice({ id: 375, invoiceNumber: "INV-375", statusId: 62, statusLabel: "Paid", grandTotal: 1955262.58, paidTotal: 0, balanceDue: 1955262.58 });
    api.mockResolvedValueOnce({ isSuccessful: true, data: { id: 375, statusId: 62, grandTotal: 1955262.58, paidTotal: 1955262.58, balanceDue: 0, lines: [] } });
    const inv = await getInvoice(375, row);
    expect(inv).toMatchObject({ statusLabel: "Paid", status: "Paid", paidTotal: 1955262.58, balanceDue: 0 });
  });
});

describe("customer NTN / SECP", () => {
  // GET customer/{id} today: no ntn / secpRegistrationNo keys at all.
  const detail = {
    isSuccessful: true,
    message: "",
    data: {
      id: 75,
      idGUID: "2c24bde7",
      code: "WN00075",
      firstName: "TEST",
      lastName: "TEST",
      company: "TEST",
      fullName: "TEST TEST",
      email: "testss@gmail.com",
      cityId: 11,
      cityName: "Ormara",
      isActive: true,
    },
    errors: null,
  };
  const listRow = { id: 75, idGUID: "2c24bde7", firstName: "TEST", company: "TEST", email: "testss@gmail.com", ntn: "1234567-8", secpRegistrationNo: "S-9" };

  it("uses the new fields when GET customer/{id} has them (no extra request)", async () => {
    api.mockResolvedValueOnce({ ...detail, data: { ...detail.data, ntn: "7654321-0", secpRegistrationNo: null } });
    const c = await getCustomer(75, { listRow: normalizeCustomer(listRow), taxIds: true });
    expect(c).toMatchObject({ ntn: "7654321-0", secpRegistrationNo: null });
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("falls back to the row the screen came from", async () => {
    api.mockResolvedValueOnce(detail);
    const c = await getCustomer(75, { listRow: normalizeCustomer(listRow), taxIds: true });
    expect(c).toMatchObject({ customerType: "Company", ntn: "1234567-8", secpRegistrationNo: "S-9", cityName: "Ormara" });
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("a passed row is trusted as is (no lookup), even without an NTN", async () => {
    api.mockResolvedValueOnce(detail);
    const c = await getCustomer(75, { listRow: normalizeCustomer({ ...listRow, ntn: null, secpRegistrationNo: null }), taxIds: true });
    expect(c.ntn).toBeNull();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("without a row, a company's NTN comes from its customer list row", async () => {
    route({
      "/customer/75": detail,
      "/customer?": { isSuccessful: true, data: [{ ...listRow, id: 74, ntn: "0000000-0" }, listRow] },
    });
    const c = await getCustomer(75, { taxIds: true });
    expect(paths()).toEqual(["/customer/75", "/customer?page=1&limit=20&search=testss%40gmail.com"]);
    expect(c.ntn).toBe("1234567-8");
  });

  it("no lookup for an individual or without taxIds; a failed lookup still returns the customer", async () => {
    api.mockResolvedValueOnce({ ...detail, data: { ...detail.data, company: null } });
    expect((await getCustomer(75, { taxIds: true })).ntn).toBeNull();
    api.mockResolvedValueOnce(detail);
    expect((await getCustomer(75)).ntn).toBeNull();
    expect(api).toHaveBeenCalledTimes(2);

    api.mockReset();
    route({ "/customer/75": detail, "/customer?": new ApiError("Server error", 500) });
    expect(await getCustomer(75, { taxIds: true })).toMatchObject({ id: 75, ntn: null });
  });

  it("withTaxIds ignores another customer's row and never replaces a value", () => {
    const c = normalizeCustomer(detail.data);
    expect(withTaxIds(c, { id: 9, ntn: "1", secpRegistrationNo: "2" }).ntn).toBeNull();
    expect(withTaxIds({ ...c, ntn: "own" }, { id: 75, ntn: "row", secpRegistrationNo: "S" })).toMatchObject({ ntn: "own", secpRegistrationNo: "S" });
  });

  it("a blank NTN / SECP in the form keeps the existing one; typed values win", () => {
    const form: CustomerInput = { customerType: "Company", firstName: "A", email: "a@x.pk", company: "Acme", ntn: "  ", secpRegistrationNo: "" };
    expect(keepExistingTaxIds(form, { ntn: "1234567-8", secpRegistrationNo: "S-9" })).toMatchObject({ ntn: "1234567-8", secpRegistrationNo: "S-9" });
    expect(keepExistingTaxIds({ ...form, ntn: "7654321-0" }, { ntn: "1234567-8", secpRegistrationNo: null }).ntn).toBe("7654321-0");
    expect(keepExistingTaxIds(form, null)).toBe(form);
  });
});

describe("booking detail", () => {
  // Shapes as GET booking/{id} and GET booking/{id}/row answer today.
  const detail = {
    isSuccessful: true,
    data: {
      bookingId: 558,
      customerName: "SAC@WN",
      spaceCode: "341",
      spaceName: "Office 341",
      spaceTypeName: "Private Office",
      locationName: "I-8",
      companyName: "WorkNest Private Limited ",
      bookingStatusLabel: "Confirmed",
      contractStartDate: "2026-10-12T00:00:00.000",
      contractEndDate: "2027-10-12T00:00:00.000",
      balanceLeft: 2008560.0,
    },
  };
  const row = {
    isSuccessful: true,
    data: {
      bookingId: 558,
      customerCompany: "SAC@WN",
      companyName: "WorkNest Private Limited ",
      spaceId: 111,
      spaceTypeId: 1,
      spaceCode: "341",
      locationId: 1,
      challanNumber: "WN-20261012-2265",
      challanValidUntil: "2026-10-19T00:00:00.000",
      balanceLeft: 1,
    },
  };

  it("the company is the customer's, never the vendor's companyName", () => {
    expect(normalizeBooking(detail.data).companyName).toBeNull();
    expect(normalizeBooking(row.data).companyName).toBe("SAC@WN");
  });

  it("fills company, challan and space type from booking/{id}/row; the detail's values win", async () => {
    route({ "/booking/558/row": row, "/booking/558": detail });
    const b = await getBooking(558);
    expect(paths().sort()).toEqual(["/booking/558", "/booking/558/row"]);
    expect(b).toMatchObject({
      companyName: "SAC@WN",
      challanNumber: "WN-20261012-2265",
      challanValidUntil: "2026-10-19T00:00:00.000",
      spaceTypeId: 1,
      spaceId: 111,
      balanceLeft: 2008560,
    });
  });

  it("uses the detail's own challan fields when the API sends them; works without the row", async () => {
    route({
      "/booking/558/row": new ApiError("Not found", 404),
      "/booking/558": { ...detail, data: { ...detail.data, challanNumber: "WN-NEW", challanValidUntil: "2026-11-01" } },
    });
    const b = await getBooking(558);
    expect(b).toMatchObject({ challanNumber: "WN-NEW", challanValidUntil: "2026-11-01", companyName: null, spaceTypeId: null });
  });

  it("mergeBookingRow keeps detail values and ignores blanks", () => {
    expect(mergeBookingRow({ a: 1, b: null, c: "" }, { a: 2, b: 3, c: "x", d: 4 })).toEqual({ a: 1, b: 3, c: "x", d: 4 });
    expect(mergeBookingRow(null, null)).toEqual({});
  });

  it("reassign: the booking's space type, not a space with the same code", () => {
    const spaces = [
      { id: 5, code: "1", name: "Meeting Room 1", spaceTypeId: 3, locationId: 1, locationName: "I-8" },
      { id: 6, code: "1", name: "Shared Space 1", spaceTypeId: 2, locationId: 1, locationName: "I-8" },
    ];
    const base = { spaceTypeId: null, spaceId: null, spaceCode: "1", spaceName: "Shared Space 1", locationId: 1, locationName: "I-8" };
    expect(bookingSpaceTypeId({ ...base, spaceTypeId: 2 }, spaces)).toBe(2);
    expect(bookingSpaceTypeId({ ...base, spaceId: 6 }, spaces)).toBe(2);
    expect(bookingSpaceTypeId(base, spaces)).toBe(2);
    expect(bookingSpaceTypeId({ ...base, spaceName: "Meeting Room 1" }, spaces)).toBe(3);
    expect(bookingSpaceTypeId({ ...base, spaceName: "Gone", spaceCode: null })).toBeNull();
  });
});

describe("forecast location chips", () => {
  const forecast = normalizeDashboardForecast({
    totals: [{ month: "2026-10", expectedRent: 900 }],
    locations: [
      { locationId: 1, name: "I-8", months: [{ month: "2026-10", expectedRent: 500 }] },
      { locationId: 2, name: "F-7", months: [{ month: "2026-10", expectedRent: 400 }] },
    ],
  });

  it("shows the chosen location, or the totals for All", () => {
    expect(forecastRowsFor(forecast, 2)).toMatchObject({ locationId: 2, rows: [{ expectedRent: 400 }] });
    expect(forecastRowsFor(forecast, 0)).toMatchObject({ locationId: 0, rows: [{ expectedRent: 900 }] });
  });

  it("a location no longer in the forecast falls back to the totals", () => {
    const narrowed = normalizeDashboardForecast({ totals: [{ month: "2026-10", expectedRent: 500 }], locations: [] });
    expect(forecastRowsFor(narrowed, 2)).toMatchObject({ locationId: 0, rows: [{ expectedRent: 500 }] });
  });
});
