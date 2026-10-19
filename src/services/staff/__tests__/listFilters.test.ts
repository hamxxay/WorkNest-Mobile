// List filters of the staff lists (Bookings, Quotations, Invoices, Payments, Customers; API LST_01): the query each
// list sends (only the filters that are set), the filter helpers the screens use and the Status choices.
// apiClient / config / authStorage are mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api" }));
jest.mock("../../../utils/authStorage", () => ({
  getToken: jest.fn(async () => "token"),
  getUser: jest.fn(async () => ({ email: "staff@worknest.test" })),
}));
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
    friendlyApiMessage: (_status: number, payload: any) => payload?.message ?? "Something went wrong. Please try again.",
    serverMessage: (payload: any) => (typeof payload?.message === "string" && payload.message ? payload.message : null),
  };
});

import { apiRequest, ApiError } from "../../apiClient";
import { listBookings } from "../bookings";
import { listCustomers } from "../customers";
import { listInvoices } from "../invoices";
import {
  LIST_DATE_LABEL,
  NO_LIST_FILTERS,
  activeFilterChips,
  activeFilterCount,
  effectiveListFilters,
  getListStatusOptions,
  hasActiveFilters,
  listFilterQuery,
  normalizeStatusOptions,
  statusDisplay,
  withFromDate,
  withToDate,
  withoutFilter,
  type ListFilters,
} from "../listFilters";
import { listQuotations } from "../quotations";

const api = apiRequest as jest.Mock;

beforeEach(() => api.mockReset());

const lastPath = () => api.mock.calls[api.mock.calls.length - 1][0] as string;

const filters = (f: Partial<ListFilters>): ListFilters => ({ ...NO_LIST_FILTERS, ...f });

describe("list filter query", () => {
  it("sends only the filters that are set", () => {
    expect(listFilterQuery(NO_LIST_FILTERS)).toEqual({ locationId: undefined, status: undefined, from: undefined, to: undefined });
    expect(listFilterQuery(filters({ locationId: 3, status: " 33 ", from: "2026-10-01", to: "2026-10-31" }))).toEqual({
      locationId: 3,
      status: "33",
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("leaves out a location that is not an id, a blank status and dates that are not whole yyyy-MM-dd", () => {
    expect(listFilterQuery(filters({ locationId: 0, status: "  ", from: "2026-10", to: "2026-02-30" }))).toEqual({
      locationId: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
    });
    expect(listFilterQuery(null)).toEqual({ locationId: undefined, status: undefined, from: undefined, to: undefined });
  });

  it("keeps a customer status of 0 (inactive): it is a value, not 'nothing chosen'", () => {
    expect(listFilterQuery(filters({ status: "0" })).status).toBe("0");
  });
});

describe("filter helpers", () => {
  it("counts location, status and the date range (once)", () => {
    expect(activeFilterCount(NO_LIST_FILTERS)).toBe(0);
    expect(hasActiveFilters(NO_LIST_FILTERS)).toBe(false);
    expect(activeFilterCount(filters({ from: "2026-10-01", to: "2026-10-05" }))).toBe(1);
    expect(activeFilterCount(filters({ locationId: 2, status: "Paid", to: "2026-10-05" }))).toBe(3);
    expect(hasActiveFilters(filters({ status: "Paid" }))).toBe(true);
  });

  it("moves the other date instead of leaving From after To (CMS rule)", () => {
    expect(withFromDate(filters({ to: "2026-10-05" }), "2026-10-09")).toMatchObject({ from: "2026-10-09", to: "2026-10-09" });
    expect(withToDate(filters({ from: "2026-10-09" }), "2026-10-01")).toMatchObject({ from: "2026-10-01", to: "2026-10-01" });
    expect(withFromDate(filters({ to: "2026-10-05" }), "2026-10-01")).toMatchObject({ from: "2026-10-01", to: "2026-10-05" });
    expect(withFromDate(filters({ from: "2026-10-01", to: "2026-10-05" }), null)).toMatchObject({ from: null, to: "2026-10-05" });
    expect(withToDate(filters({ from: "2026-10-01", to: "2026-10-05" }), "bad")).toMatchObject({ from: "2026-10-01", to: null });
  });

  it("drops a location that is not offered and a status that is not a loaded choice", () => {
    const f = filters({ locationId: 4, status: "33" });
    expect(effectiveListFilters(f, [4, 5], [{ value: "33", label: "Confirmed" }])).toEqual(f);
    expect(effectiveListFilters(f, [5], [{ value: "33", label: "Confirmed" }]).locationId).toBeNull();
    expect(effectiveListFilters(f, [4], [{ value: "5", label: "Pending" }]).status).toBeNull();
    // Choices not known (yet): the status is kept.
    expect(effectiveListFilters(f, [4], null).status).toBe("33");
  });

  it("removes one filter (the date range as a whole)", () => {
    const f = filters({ locationId: 4, status: "2", from: "2026-10-01", to: "2026-10-05" });
    expect(withoutFilter(f, "location")).toEqual({ ...f, locationId: null });
    expect(withoutFilter(f, "status")).toEqual({ ...f, status: null });
    expect(withoutFilter(f, "dates")).toEqual({ ...f, from: null, to: null });
  });

  it("names the filters that are on, with the list's own date label", () => {
    const context = {
      locations: [{ id: 4, name: "Gulberg" }],
      statusOptions: [{ value: "InProgress", label: "InProgress" }],
      dateLabel: LIST_DATE_LABEL.invoices,
    };
    expect(activeFilterChips(filters({ locationId: 4, status: "InProgress", from: "2026-10-01", to: "2026-10-05" }), context)).toEqual([
      { key: "location", label: "Gulberg" },
      { key: "status", label: "In Progress" },
      { key: "dates", label: "Issued 1 – 5 Oct 2026" },
    ]);
    expect(activeFilterChips(filters({ locationId: 9, from: "2026-10-01" }), context)).toEqual([
      { key: "location", label: "Location 9" },
      { key: "dates", label: "Issued from 1 Oct 2026" },
    ]);
    expect(activeFilterChips(filters({ to: "2026-10-05" }), { ...context, dateLabel: LIST_DATE_LABEL.bookings })).toEqual([
      { key: "dates", label: "Start date until 5 Oct 2026" },
    ]);
    expect(activeFilterChips(NO_LIST_FILTERS, context)).toEqual([]);
  });

  it("filters each list on the date the CMS names", () => {
    expect(LIST_DATE_LABEL).toEqual({
      bookings: "Start date",
      quotations: "Created",
      invoices: "Issued",
      payments: "Payment date",
      customers: "Created",
    });
    expect(statusDisplay("NoShow")).toBe("No Show");
    expect(statusDisplay(" Paid ")).toBe("Paid");
  });
});

describe("status choices", () => {
  it("GET {list}/statuses, read from the envelope; blanks and repeated values dropped", async () => {
    api.mockResolvedValueOnce({
      isSuccessful: true,
      data: [
        { value: "5", label: "Pending" },
        { Value: "33", Label: "Confirmed" },
        { value: "33", label: "Confirmed again" },
        { value: "", label: "Empty" },
        { value: "6", label: " " },
        null,
      ],
    });
    expect(await getListStatusOptions("bookings")).toEqual([
      { value: "5", label: "Pending" },
      { value: "33", label: "Confirmed" },
    ]);
    expect(lastPath()).toBe("/booking/statuses");
    expect(normalizeStatusOptions({ isSuccessful: true, data: null })).toEqual([]);
  });

  it("each list asks its own controller", async () => {
    api.mockResolvedValue({ isSuccessful: true, data: [] });
    const paths: string[] = [];
    for (const list of ["quotations", "invoices", "payments", "customers"] as const) {
      await getListStatusOptions(list);
      paths.push(lastPath());
    }
    expect(paths).toEqual(["/quotation/statuses", "/invoice/statuses", "/payment/statuses", "/customer/statuses"]);
  });
});

describe("filtered lists", () => {
  const set = filters({ locationId: 2, status: "33", from: "2026-10-01", to: "2026-10-31" });

  it("an unfiltered list is requested exactly as before", async () => {
    api.mockResolvedValue({ data: [], total: 0 });
    await listBookings({ page: 1, limit: 15, search: "", ...NO_LIST_FILTERS });
    expect(lastPath()).toBe("/booking?page=1&limit=15");
    await listCustomers({ page: 2, limit: 20, ...NO_LIST_FILTERS });
    expect(lastPath()).toBe("/customer?page=2&limit=20");
  });

  it("bookings, quotations, invoices and customers send location, status and dates with the search", async () => {
    api.mockResolvedValue({ data: [], total: 0 });
    await listBookings({ page: 1, limit: 15, search: "acme", ...set });
    expect(lastPath()).toBe("/booking?page=1&limit=15&search=acme&locationId=2&status=33&from=2026-10-01&to=2026-10-31");
    await listQuotations({ page: 1, limit: 15, ...set, status: "Sent" });
    expect(lastPath()).toBe("/quotation?page=1&limit=15&locationId=2&status=Sent&from=2026-10-01&to=2026-10-31");
    await listInvoices({ page: 1, limit: 20, typeId: 3, ...set, status: "Overdue" });
    expect(lastPath()).toBe("/invoice?page=1&limit=20&typeId=3&locationId=2&status=Overdue&from=2026-10-01&to=2026-10-31");
    await listCustomers({ page: 1, limit: 20, search: "ali", locationId: 2, status: "0" });
    expect(lastPath()).toBe("/customer?page=1&limit=20&search=ali&locationId=2&status=0");
  });

  it("a filtered customer list carries a total", async () => {
    api.mockResolvedValueOnce({ isSuccessful: true, message: "Success", data: [{ id: 1, firstName: "Ali", email: "a@x.pk" }], total: 41 });
    const page = await listCustomers({ page: 1, limit: 20, status: "1" });
    expect(page).toMatchObject({ total: 41, hasMore: true });
  });

  it("the database update missing (503) reaches the screen with the API's message", async () => {
    const message = "Database update needed: run the script LST_01_list_filters_TEST (LST_01_list_filters_LIVE on the live database).";
    api.mockRejectedValueOnce(new ApiError(message, 503, { isSuccessful: false, message }));
    await expect(listBookings({ status: "33" })).rejects.toMatchObject({ status: 503, message });
  });
});
