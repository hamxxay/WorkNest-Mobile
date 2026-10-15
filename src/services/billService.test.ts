import { getToken, getUser } from "../utils/authStorage";
import { ApiError, resetSessionExpiredState, setSessionRefresher } from "./apiClient";
import { billFromPayment, getMyBills, isOpenBill, normalizeBill, normalizeBills, refundNote, summarizeBills } from "./billService";
import { normalizeChallan, normalizeMyBooking } from "./bookingService";
import { isDoorRefusal } from "./doorAccessService";
import { normalizePayment } from "./paymentService";

jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(() => Promise.resolve()) },
}));
jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

type FetchMock = jest.Mock<Promise<Partial<Response>>, [string, RequestInit]>;

function jsonResponse(status: number, body: unknown): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null } as unknown as Headers,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

function installFetch(...responses: Partial<Response>[]): FetchMock {
  const fetchMock: FetchMock = jest.fn();
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeEach(() => {
  jest.clearAllMocks();
  resetSessionExpiredState();
  setSessionRefresher(null);
  (getToken as jest.Mock).mockResolvedValue("api-jwt");
  (getUser as jest.Mock).mockResolvedValue({ email: "customer@example.com" });
});

// GET /invoice/my for customer 87 (two paid quotation bookings) and one overdue rent invoice.
const apiBills = {
  isSuccessful: true,
  data: {
    items: [
      {
        kind: "invoice", invoiceId: 501, number: "INV-REC-560-20270201", title: "Rent invoice", bookingId: 560,
        bookingStatus: "Confirmed", bookingClosed: false, spaceName: "Office 342", locationName: "I-8",
        issuedOn: "2027-01-18T00:00:00.000", dueOn: "2027-01-31T00:00:00.000", total: 635760, taxWithheld: 0, paid: 0,
        balance: 635760, status: "Overdue", isOverdue: true, daysOverdue: 3, accessSuspendsOn: "2027-02-08T00:00:00.000",
        accessSuspended: false, hasPdf: true,
      },
      {
        kind: "invoice", invoiceId: 430, invoicePublicId: "30674001-aa47-447a-8b6c-94e2405d47dd", number: "INV-2026-00430",
        title: "Invoice", bookingId: 561, bookingStatus: "Confirmed", bookingClosed: false, spaceName: "Office 329",
        issuedOn: "2026-10-15T00:00:00.000", dueOn: "2026-10-22T00:00:00.000", total: 1160760, taxWithheld: 0,
        paid: 1160760, balance: 0, status: "Paid", isOverdue: false, daysOverdue: 0, accessSuspended: false, hasPdf: true,
      },
      {
        kind: "invoice", invoiceId: 429, number: "INV-2026-00412", bookingId: 560, total: 1055760, paid: 1055760,
        balance: 0, status: "Paid", hasPdf: true,
      },
    ],
    summary: { paidTotal: 2216520, dueTotal: 635760, overdueTotal: 635760, overdueCount: 1, count: 3 },
  },
};

describe("bills (Payments tab, GET /invoice/my)", () => {
  it("shows the customer's invoices with the API's totals", async () => {
    const fetchMock = installFetch(jsonResponse(200, apiBills));
    const { items, summary } = await getMyBills();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/invoice\/my$/);
    expect(items.map((b) => b.number)).toEqual(["INV-REC-560-20270201", "INV-2026-00430", "INV-2026-00412"]);
    expect(summary).toEqual({ paidTotal: 2216520, dueTotal: 635760, overdueTotal: 635760, overdueCount: 1, count: 3 });
    const overdue = items[0];
    expect(overdue).toMatchObject({ invoiceId: 501, status: "Overdue", isOverdue: true, daysOverdue: 3, balance: 635760, hasPdf: true });
    expect(overdue.accessSuspendsOn).toBe("2027-02-08T00:00:00.000");
    expect(isOpenBill(overdue)).toBe(true);
    expect(isOpenBill(items[1])).toBe(false);
    expect(items[1].key).toBe("inv-430");
  });

  it("adds the totals itself when the API sent none", () => {
    const { summary } = normalizeBills([
      { kind: "invoice", invoiceId: 1, status: "Paid", paid: 100, balance: 0 },
      { kind: "challan", bookingId: 9, number: "WN-1", status: "Unpaid", total: 50, balance: 50 },
      { kind: "invoice", invoiceId: 2, status: "Overdue", isOverdue: true, balance: 20 },
      { kind: "challan", bookingId: 8, status: "Expired", balance: 70 },
    ]);
    expect(summary).toEqual({ paidTotal: 100, dueTotal: 70, overdueTotal: 20, overdueCount: 1, count: 4 });
  });

  it("opens a challan (no PDF of its own) for a booking challan", () => {
    const bill = normalizeBill({ kind: "challan", bookingId: 543, number: "WN-20261007-7592", status: "Unpaid", total: 315000, balance: 315000 });
    expect(bill).toMatchObject({ kind: "challan", invoiceId: null, hasPdf: false, title: "Booking challan", bookingId: 543 });
  });

  it("falls back to /payment/my on an API without /invoice/my", async () => {
    const fetchMock = installFetch(
      jsonResponse(404, { message: "Not found" }),
      jsonResponse(200, [{ id: 7, bookingId: 41, amount: 5000, paymentStatus: "Pending", challanNumber: "WN-7" }]),
    );
    const { items, summary } = await getMyBills();
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/payment\/my$/);
    expect(items[0]).toMatchObject({ kind: "payment", number: "WN-7", balance: 5000, status: "Unpaid" });
    expect(summary.dueTotal).toBe(5000);
  });

  it("reports other failures as an error, never as an empty list", async () => {
    installFetch(jsonResponse(500, { message: "Your bills could not be loaded. Please try again." }));
    await expect(getMyBills()).rejects.toMatchObject({ status: 500 });
  });

  it("maps a paid payment from the older API", () => {
    const bill = billFromPayment(normalizePayment({ id: 3, amount: 7000, paymentStatus: "Paid" }));
    expect(bill).toMatchObject({ paid: 7000, balance: 0, status: "Paid" });
    expect(summarizeBills([bill])).toEqual({ paidTotal: 7000, dueTotal: 0, overdueTotal: 0, overdueCount: 0, count: 1 });
  });
});

describe("refund note (paid, then rejected / cancelled)", () => {
  it("says what was paid and to contact WorkNest", () => {
    expect(refundNote(879800, "Rejected")).toBe(
      "This booking was rejected after you paid PKR 879,800. Please contact WorkNest about a refund.",
    );
    expect(refundNote(100, "No Show")).toMatch(/marked as a no show/);
    expect(refundNote(0, "Rejected")).toBeNull();
    expect(refundNote(null, "Cancelled")).toBeNull();
  });
});

describe("door access notice and billing figures on bookings", () => {
  it("reads the suspension notice of a booking", () => {
    const b = normalizeMyBooking({
      bookingId: 532, bookingStatusLabel: "Confirmed", accessSuspended: true,
      accessSuspendedReason: "Door access to this space is suspended because invoice INV-2026-00386 is unpaid.",
      accessSuspendedInvoiceId: 386, accessSuspendedInvoiceNumber: "INV-2026-00386",
    });
    expect(b).toMatchObject({ accessSuspended: true, accessSuspendedInvoiceId: 386, accessSuspendedInvoiceNumber: "INV-2026-00386" });
    expect(normalizeMyBooking({ bookingId: 1 })).toMatchObject({ accessSuspended: false, accessSuspendedInvoiceId: null, accessSuspendedReason: null });
  });

  it("hides next bill / balance left when the API marks them unreliable", () => {
    expect(normalizeChallan({ bookingId: 560, billingFiguresReliable: false }).billingFiguresReliable).toBe(false);
    expect(normalizeChallan({ bookingId: 560, billingFiguresReliable: true, firstCycleRent: 735000 })).toMatchObject({
      billingFiguresReliable: true,
      firstCycleRent: 735000,
    });
    // The challan endpoint sends no flag: nothing to hide there.
    expect(normalizeChallan({ bookingId: 560 }).billingFiguresReliable).toBe(true);
  });

  it("treats the server's refusal as final, not a network failure", () => {
    expect(isDoorRefusal(new ApiError("Door access is suspended because an invoice is unpaid.", 200))).toBe(true);
    expect(isDoorRefusal(new ApiError("Not yours", 403))).toBe(true);
    expect(isDoorRefusal(new ApiError("Can't reach the server.", 0))).toBe(false);
    expect(isDoorRefusal(new ApiError("Server error", 500))).toBe(false);
    expect(isDoorRefusal(new Error("x"))).toBe(false);
  });
});
