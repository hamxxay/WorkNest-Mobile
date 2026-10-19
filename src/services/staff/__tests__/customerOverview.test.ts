// Customer detail overview (GET customer/{id}/overview, procedure WN_Customers_GetOverview of CD_01): the response
// mapping (camelCase rows as the API sends them), the section errors (404 not found / other location, 503 until the
// database script has run), the summary figures and money helpers, the timeline helpers and the agreement lookup.
// The real apiClient is used except for apiRequest; config / authStorage are mocked so React Native is never loaded.

jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api", API_ENDPOINTS: { auth: { logout: "/auth/logout" } } }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token") }));
jest.mock("../../apiClient", () => ({ ...jest.requireActual("../../apiClient"), apiRequest: jest.fn() }));

import { ApiError, apiRequest } from "../../apiClient";
import {
  CUSTOMER_DETAIL_DB_MESSAGE,
  countLabel,
  describeSectionError,
  findAgreement,
  getCustomerOverview,
  humanize,
  loadSection,
  normalizeCustomerOverview,
  normalizeCustomerReceipt,
  normalizeTimelineEvent,
  outstandingNote,
  outstandingTone,
  paidPercent,
  paymentsCount,
  summaryFigures,
  timelineKindLabel,
  timelineTarget,
  timelineTone,
  type CustomerSummary,
} from "../customerOverview";
import { STAFF_ENDPOINTS } from "../endpoints";

const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());

/** One overview answer, as the API serialises the procedure's result sets (camelCase keys, UTC instants with "Z"). */
const PAYLOAD = {
  isSuccessful: true,
  message: "Success",
  data: {
    summary: {
      customerId: 42,
      customerCode: "CUS-0042",
      totalBookings: 3,
      activeBookings: 1,
      invoiceCount: 4,
      totalInvoiced: 1250000,
      totalPaid: 500000,
      outstanding: 650000,
      outstandingCount: 2,
      overdue: 150000,
      overdueCount: 1,
      depositHeld: 200000,
      depositCount: 1,
      quotationCount: 2,
      locations: "Blue Area, I-8",
    },
    bookings: [
      {
        bookingId: 560,
        bookingStatusId: 2,
        bookingStatusLabel: "Confirmed",
        spaceId: 7,
        spaceName: null,
        spaceCode: "PR-07",
        spaceTypeName: "Private Room",
        spaceCapacity: 4,
        locationId: 1,
        locationName: "Blue Area",
        startOn: "2026-10-01T09:00:00",
        endOn: "2027-09-30T18:00:00",
        createdOn: "2026-09-20T07:00:00Z",
        monthlyRent: 100000,
        billingPeriodLabel: "Monthly",
        totalContractAmount: 1200000,
        totalPaidAmount: 500000,
        balanceLeft: 700000,
        nextBillingDate: "2026-11-01",
        securityDeposit: 200000,
        challanNumber: "CH-1",
        isActive: true,
        createdByName: "Sara Khan",
      },
    ],
    receipts: [
      {
        id: 9,
        idGUID: "a1",
        code: "FR-9",
        receiptDate: "2026-10-02",
        totalAmount: 500000,
        whtAmount: 0,
        securityDepositAmount: 0,
        paymentType: "Bank Transfer",
        status: 1,
        statusLabel: "Active",
        voidReason: null,
        remarks: null,
        createdOn: "2026-10-02T06:00:00Z",
        createdByName: "Ali Raza",
        invoiceId: 411,
        invoiceNumber: "INV-411",
        cashInHandAccountName: "Meezan Bank",
        locationName: "Blue Area",
      },
    ],
    payments: [
      {
        id: 3,
        idGUID: "p3",
        amount: 25000,
        currencyCode: "PKR",
        paymentMethodId: null,
        paymentMethodLabel: "Bank Transfer / Challan",
        statusId: 1,
        paymentStatus: "Pending",
        paidOn: null,
        createdOn: "2026-10-03T06:00:00Z",
        transactionRef: "TX-1",
        invoiceId: 0,
        invoiceNumber: null,
        bookingId: 560,
      },
    ],
    agreements: [
      {
        id: 12,
        status: "SignedUploaded",
        sentAt: "2026-09-25",
        signedDate: null,
        createdOn: "2026-09-25T05:00:00Z",
        feeAmount: 100000,
        securityDeposit: 200000,
        quotationId: 77,
        quotationNumber: "QT-77",
        quotationVersion: 2,
        bookingId: null,
        spaceName: "PR-07",
        locationName: "Blue Area",
        hasSignedPdf: true,
        createdByName: "Sara Khan",
      },
    ],
    deposits: [
      {
        id: 5,
        bookingId: 560,
        refNo: "SD-5",
        amount: 200000,
        state: "Held",
        createdOn: "2026-10-01T05:00:00Z",
        releasedOn: null,
        forfeitedOn: null,
        forfeitReason: null,
      },
    ],
    timeline: [
      {
        kind: "quotation",
        action: "AgreementSent",
        title: null,
        reference: "QT-77 v2",
        detail: "Agreement sent to the customer",
        note: null,
        amount: null,
        actorName: "Sara Khan",
        refId: 77,
        createdOn: "2026-09-25T05:00:00Z",
        eventDate: null,
      },
      {
        kind: "agreement",
        action: "Signed",
        title: "Agreement signed",
        reference: "QT-77",
        detail: "PR-07",
        note: null,
        amount: 100000,
        actorName: null,
        refId: 12,
        createdOn: null,
        eventDate: "2026-09-28",
      },
    ],
  },
};

const SUMMARY: CustomerSummary = normalizeCustomerOverview(PAYLOAD).summary;

describe("normalizeCustomerOverview", () => {
  it("maps every result set of the procedure", () => {
    const o = normalizeCustomerOverview(PAYLOAD);
    expect(o.summary).toEqual({
      totalBookings: 3,
      activeBookings: 1,
      invoiceCount: 4,
      totalInvoiced: 1250000,
      totalPaid: 500000,
      outstanding: 650000,
      outstandingCount: 2,
      overdue: 150000,
      overdueCount: 1,
      depositHeld: 200000,
      depositCount: 1,
      quotationCount: 2,
      locations: "Blue Area, I-8",
    });
    expect(o.bookings[0]).toMatchObject({
      bookingId: 560,
      status: "Confirmed",
      spaceName: "PR-07", // no space name: the space code
      spaceType: "Private Room",
      locationName: "Blue Area",
      monthlyRent: 100000,
      billingPeriod: "Monthly",
      balance: 700000,
      isActive: true,
      createdByName: "Sara Khan",
    });
    expect(o.receipts[0]).toMatchObject({ id: 9, code: "FR-9", amount: 500000, status: "Active", isVoid: false, invoiceId: 411, account: "Meezan Bank" });
    expect(o.payments[0]).toMatchObject({ id: 3, amount: 25000, currency: "PKR", status: "Pending", invoiceId: null, bookingId: 560, reference: "TX-1" });
    expect(o.agreements[0]).toMatchObject({ id: 12, status: "SignedUploaded", sentAt: "2026-09-25", quotationNumber: "QT-77", quotationVersion: 2, bookingId: null, hasSignedPdf: true });
    expect(o.deposits[0]).toMatchObject({ id: 5, bookingId: 560, refNo: "SD-5", amount: 200000, state: "Held" });
    expect(o.timeline).toHaveLength(2);
  });

  it("reads a bare payload too, and missing lists or summary as empty (never an error)", () => {
    const o = normalizeCustomerOverview({ summary: null });
    expect(o.summary.totalInvoiced).toBe(0);
    expect(o.summary.locations).toBe("");
    expect(o.bookings).toEqual([]);
    expect(o.receipts).toEqual([]);
    expect(o.payments).toEqual([]);
    expect(o.agreements).toEqual([]);
    expect(o.deposits).toEqual([]);
    expect(o.timeline).toEqual([]);
    expect(normalizeCustomerOverview(null).bookings).toEqual([]);
  });

  it("marks a receipt void only for status 0", () => {
    expect(normalizeCustomerReceipt({ id: 1, status: 0, statusLabel: "Void", voidReason: "Duplicate" })).toMatchObject({ isVoid: true, voidReason: "Duplicate" });
    expect(normalizeCustomerReceipt({ id: 1, status: 1 }).isVoid).toBe(false);
    expect(normalizeCustomerReceipt({ id: 1 }).isVoid).toBe(false);
  });

  it("words timeline events and keeps date-only events apart", () => {
    const [sent, signed] = normalizeCustomerOverview(PAYLOAD).timeline;
    expect(sent).toMatchObject({ kind: "quotation", title: "Agreement sent", at: "2026-09-25T05:00:00Z", dateOnly: false, refId: 77 });
    expect(signed).toMatchObject({ kind: "agreement", title: "Agreement signed", at: "2026-09-28", dateOnly: true, amount: 100000 });
    expect(normalizeTimelineEvent({ kind: "Mystery", action: "" })).toMatchObject({ kind: "other", title: "Update", at: null, refId: null });
    expect(normalizeTimelineEvent({ kind: "RECEIPT", action: "Voided", title: "Receipt voided", refId: 0 })).toMatchObject({ kind: "receipt", refId: null });
  });
});

describe("getCustomerOverview", () => {
  it("GETs customer/{id}/overview with the login token and keeps the envelope", async () => {
    api.mockResolvedValueOnce(PAYLOAD);
    const o = await getCustomerOverview(42);
    expect(STAFF_ENDPOINTS.customers.overview(42)).toBe("/customer/42/overview");
    expect(api).toHaveBeenCalledWith("/customer/42/overview", expect.objectContaining({ method: "GET", requiresAuth: true, unwrapData: false }));
    expect(o.summary.activeBookings).toBe(1);
  });
});

describe("describeSectionError / loadSection", () => {
  it("503 asking for the database script: needsDbUpdate with the API's message", () => {
    const body = { isSuccessful: false, message: "Database update needed: run the script CD_01_customer_detail_TEST" };
    const e = describeSectionError(new ApiError(body.message, 503, body));
    expect(e).toEqual({ status: 503, needsDbUpdate: true, notFound: false, message: body.message });
  });

  it("503 without a readable message still names the script when the error says so; other 503s are a passing outage", () => {
    expect(describeSectionError(new ApiError("Database update needed", 503, null))).toMatchObject({ needsDbUpdate: true, message: CUSTOMER_DETAIL_DB_MESSAGE });
    const outage = describeSectionError(new ApiError("The service is temporarily unavailable. Please try again in a few minutes.", 503, "<html>"));
    expect(outage).toMatchObject({ needsDbUpdate: false, notFound: false, message: "The service is temporarily unavailable. Please try again in a few minutes." });
  });

  it("404 with the API's message is not found (also a customer of another location); without one the endpoint is missing", () => {
    expect(describeSectionError(new ApiError("Customer not found.", 404, { isSuccessful: false, message: "Customer not found." }))).toMatchObject({
      notFound: true,
      message: "Customer not found.",
    });
    expect(describeSectionError(new ApiError("This isn't available right now. Please try again later.", 404, null))).toMatchObject({
      notFound: false,
      message: "Not available on this server yet. It will work once the API update is live.",
    });
  });

  it("a 200 refusal saying not found (GET customer/{id}) is not found; other errors keep their readable message", () => {
    expect(describeSectionError(new ApiError("Customer not found.", 200, { isSuccessful: false, message: "Customer not found." }))).toMatchObject({ notFound: true });
    expect(describeSectionError(new ApiError("Your access is turned off.", 200, {}))).toMatchObject({ notFound: false, message: "Your access is turned off." });
    expect(describeSectionError(new ApiError("Can't reach the server. Check your internet connection and try again.", 0))).toMatchObject({ status: 0, needsDbUpdate: false });
    expect(describeSectionError("boom")).toMatchObject({ message: "Something went wrong. Please try again." });
  });

  it("loadSection never throws: one section's failure stays in that section", async () => {
    await expect(loadSection(async () => 5)).resolves.toEqual({ ok: true, data: 5 });
    const failed = await loadSection(async () => {
      throw new ApiError("Database update needed: run the script CD_01_customer_detail_TEST", 503, null);
    });
    expect(failed).toMatchObject({ ok: false, error: { needsDbUpdate: true } });
  });
});

describe("summary figures and money helpers", () => {
  it("builds the five CMS cards from the API's figures", () => {
    const cards = summaryFigures(SUMMARY);
    expect(cards.map((c) => c.label)).toEqual(["Active bookings", "Total invoiced", "Paid", "Outstanding", "Security deposit held"]);
    expect(cards.map((c) => c.value)).toEqual(["1", "PKR 1.25M", "PKR 500K", "PKR 650K", "PKR 200K"]);
    expect(cards.map((c) => c.sub)).toEqual(["3 bookings in all", "4 invoices", "40% of invoiced", "PKR 150K overdue (1)", "1 deposit held"]);
    expect(cards.map((c) => c.tone)).toEqual(["success", "primary", "success", "danger", "info"]);
  });

  it("paid share: whole percent, none when nothing was invoiced", () => {
    expect(paidPercent({ totalInvoiced: 300, totalPaid: 100 })).toBe(33);
    expect(paidPercent({ totalInvoiced: 0, totalPaid: 0 })).toBeNull();
    expect(summaryFigures({ ...SUMMARY, totalInvoiced: 0, totalPaid: 0 })[2].sub).toBe("Nothing invoiced yet");
  });

  it("outstanding: the overdue part first, else the open invoices, else nothing to pay", () => {
    expect(outstandingNote({ overdue: 150000, overdueCount: 1, outstandingCount: 2 })).toBe("PKR 150K overdue (1)");
    expect(outstandingNote({ overdue: 0, overdueCount: 0, outstandingCount: 1 })).toBe("1 open invoice");
    expect(outstandingNote({ overdue: 0, overdueCount: 0, outstandingCount: 3 })).toBe("3 open invoices");
    expect(outstandingNote({ overdue: 0, overdueCount: 0, outstandingCount: 0 })).toBe("Nothing to pay");
    expect(outstandingTone({ outstanding: 10, overdue: 5 })).toBe("danger");
    expect(outstandingTone({ outstanding: 10, overdue: 0 })).toBe("warning");
    expect(outstandingTone({ outstanding: 0, overdue: 0 })).toBe("success");
  });

  it("counts and plurals", () => {
    expect(countLabel(1, "booking")).toBe("1 booking");
    expect(countLabel(1200, "booking")).toBe("1,200 bookings");
    expect(paymentsCount(normalizeCustomerOverview(PAYLOAD))).toBe(3);
  });
});

describe("timeline helpers", () => {
  it("humanize words activity codes", () => {
    expect(humanize("AgreementSent")).toBe("Agreement sent");
    expect(humanize("version_created")).toBe("Version created");
    expect(humanize("")).toBe("");
    expect(humanize(null)).toBe("");
  });

  it("names kinds as the CMS timeline does", () => {
    expect(timelineKindLabel("deposit")).toBe("Security deposit");
    expect(timelineKindLabel("other")).toBe("Update");
    expect(timelineKindLabel("invoice")).toBe("Invoice");
  });

  it("colours events from what happened", () => {
    expect(timelineTone({ kind: "receipt", action: "Voided" })).toBe("danger");
    expect(timelineTone({ kind: "payment", action: "Paid" })).toBe("success");
    expect(timelineTone({ kind: "deposit", action: "Held" })).toBe("info");
    expect(timelineTone({ kind: "booking", action: "Created" })).toBe("primary");
  });

  it("opens quotation, booking, invoice and agreement events; nothing for the others", () => {
    expect(timelineTarget({ kind: "quotation", refId: 77 })).toEqual({ kind: "quotation", quotationId: 77 });
    expect(timelineTarget({ kind: "booking", refId: 560 })).toEqual({ kind: "booking", bookingId: 560 });
    expect(timelineTarget({ kind: "invoice", refId: 411 })).toEqual({ kind: "invoice", invoiceId: 411 });
    expect(timelineTarget({ kind: "agreement", refId: 12 })).toEqual({ kind: "agreement", agreementId: 12 });
    expect(timelineTarget({ kind: "receipt", refId: 9 })).toBeNull();
    expect(timelineTarget({ kind: "payment", refId: 3 })).toBeNull();
    expect(timelineTarget({ kind: "booking", refId: null })).toBeNull();
  });
});

describe("findAgreement", () => {
  const page = (rows: unknown[]) => ({ isSuccessful: true, data: rows, totalCount: rows.length, page: 1, limit: 50 });

  it("searches the agreements list by quotation number and matches the id", async () => {
    api.mockResolvedValueOnce(page([{ id: 11, quotationNumber: "QT-77" }, { id: 12, quotationNumber: "QT-77", status: "Signed" }]));
    const a = await findAgreement(12, ["QT-77", "Ayesha Malik"]);
    expect(a).toMatchObject({ id: 12, status: "Signed" });
    expect(api).toHaveBeenCalledTimes(1);
    expect(api.mock.calls[0][0]).toBe("/agreement?page=1&limit=50&search=QT-77");
  });

  it("falls back to the next hint, skips blanks and repeats, and returns null when the list does not have it", async () => {
    api.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([{ id: 12 }]));
    expect(await findAgreement(12, [" ", "QT-77", "qt-77", "Ayesha Malik"])).toMatchObject({ id: 12 });
    expect(api.mock.calls.map((c) => c[0])).toEqual(["/agreement?page=1&limit=50&search=QT-77", "/agreement?page=1&limit=50&search=Ayesha%20Malik"]);

    api.mockReset();
    api.mockResolvedValue(page([{ id: 99 }]));
    expect(await findAgreement(12, ["QT-77", null, undefined])).toBeNull();
  });
});
