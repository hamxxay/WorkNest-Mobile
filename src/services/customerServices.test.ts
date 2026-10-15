import { getToken, getUser } from "../utils/authStorage";
import { ApiError, resetSessionExpiredState, setSessionRefresher } from "./apiClient";
import {
  cancelMyBooking,
  canCancelBooking,
  categoryCodeForMode,
  challanStage,
  createSmartBooking,
  CustomerProfileRequiredError,
  getBookingDetails,
  getMyBookings,
  getSmartAvailability,
  isChallanExpired,
  isChallanToPay,
  isUpcomingBooking,
  isVoidBooking,
  normalizeChallan,
  normalizeMyBooking,
  summarizeBookings,
} from "./bookingService";
import { getMyPayments, isPaid, normalizePayment, parseApiDate, summarizePayments } from "./paymentService";
import { getAnnouncements, normalizeAnnouncement, notificationLink } from "./notificationService";
import {
  agreementStage,
  isAgreementSignable,
  isAgreementSuperseded,
  normalizeAgreement,
  signedUploadError,
} from "./agreementService";
import { buildTourMessage, submitContactMessage, submitTourRequest } from "./tourService";
import {
  canRespondToQuotation,
  getMyQuotations,
  normalizeQuotation,
  normalizeQuotationApiId,
} from "./customerQuotationService";

jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(() => Promise.resolve()) },
}));
jest.mock("../utils/authStorage", () => ({
  getToken: jest.fn(),
  getUser: jest.fn(),
}));

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

function sentBody(fetchMock: FetchMock, call = 0): Record<string, unknown> {
  return JSON.parse(String(fetchMock.mock.calls[call][1].body));
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

describe("bookings (website My Bookings rules)", () => {
  it("normalizes /booking/my rows and keeps the API's amounts (no local math)", () => {
    const b = normalizeMyBooking({
      bookingId: 41,
      bookingPublicId: "3f1c",
      spaceName: "Office 12",
      bookingStatusLabel: "Pending",
      bookingStatusCode: "pending",
      startOn: "2026-11-01T09:00:00",
      endOn: "2027-01-31T17:00:00",
      totalAmount: 174000,
      securityDeposit: 50000,
      challanNumber: "1001234567",
      challanValidUntil: "2026-10-20",
    });
    expect(b).toMatchObject({
      id: 41,
      publicId: "3f1c",
      status: "Pending",
      totalAmount: 174000,
      securityDeposit: 50000,
      challanNumber: "1001234567",
    });
    expect(normalizeMyBooking({ BookingId: 7 }).totalAmount).toBeNull();
  });

  it("keeps the challan's totalPayable apart from the booking's totalAmount (never used as the payable)", () => {
    const withPayable = normalizeMyBooking({ bookingId: 557, totalAmount: 283500, totalPayable: 470480, totalPaidAmount: 459630 });
    expect(withPayable).toMatchObject({ totalAmount: 283500, totalPayable: 470480, totalPaidAmount: 459630 });
    // Older API without totalPayable: the screens show "See challan", not 283,500.
    const without = normalizeMyBooking({ bookingId: 551, totalAmount: 630000 });
    expect(without.totalPayable).toBeNull();
    expect(without.totalAmount).toBe(630000);
    expect(normalizeMyBooking({ bookingId: 3, paidAmount: 1000 }).totalPaidAmount).toBe(1000);
  });

  it("allows cancel only for Pending bookings with no payment", () => {
    expect(canCancelBooking({ id: 1, status: "Pending", statusCode: null })).toBe(true);
    expect(canCancelBooking({ id: 1, status: "Pending", statusCode: "Pending", totalPaidAmount: 0 })).toBe(true);
    expect(canCancelBooking({ id: 1, status: "Pending", statusCode: "Pending", totalPaidAmount: 1001566.45 })).toBe(false);
    expect(canCancelBooking({ id: 1, status: "Confirmed", statusCode: "confirmed" })).toBe(false);
    expect(canCancelBooking({ id: 1, status: "Cancelled", statusCode: null })).toBe(false);
    expect(canCancelBooking({ id: 1, status: "Rejected", statusCode: "Rejected" })).toBe(false);
    expect(canCancelBooking({ id: 0, status: "Pending", statusCode: null })).toBe(false);
  });

  it("refuses to send a cancel for a paid booking, and shows the API's message when it refuses", async () => {
    await expect(
      cancelMyBooking({ id: 9, status: "Pending", statusCode: "Pending", totalPaidAmount: 500 }),
    ).rejects.toBeInstanceOf(ApiError);

    installFetch(
      jsonResponse(400, { isSuccessful: false, message: "This booking has a payment and can't be cancelled.", data: null }),
    );
    await expect(cancelMyBooking({ id: 9, status: "Pending", statusCode: "Pending" })).rejects.toThrow(
      "This booking has a payment and can't be cancelled.",
    );
  });

  it("lists rejected, no-show, cancelled, completed and ended bookings under History", () => {
    const now = new Date(2026, 9, 13, 12, 0, 0).getTime();
    const future = "2027-11-05T00:00:00.000";
    const upcoming = (status: string, statusCode: string | null = null, endOn: string | null = future) =>
      isUpcomingBooking({ status, statusCode, endOn }, now);
    expect(upcoming("Pending", "Pending")).toBe(true);
    expect(upcoming("Confirmed", "Confirmed")).toBe(true);
    expect(upcoming("Pending", "Pending", null)).toBe(true);
    expect(upcoming("Rejected", "Rejected")).toBe(false);
    expect(upcoming("No Show", "NoShow")).toBe(false);
    expect(upcoming("Cancelled", "Cancelled")).toBe(false);
    expect(upcoming("Completed")).toBe(false);
    expect(upcoming("Confirmed", "Confirmed", "2026-10-01T00:00:00")).toBe(false);

    expect(isVoidBooking({ status: "No Show", statusCode: "NoShow" })).toBe(true);
    expect(isVoidBooking({ status: "Pending", statusCode: "Pending" })).toBe(false);

    expect(
      summarizeBookings(
        [
          { status: "Pending", statusCode: "Pending", endOn: future },
          { status: "Rejected", statusCode: "Rejected", endOn: future },
          { status: "No Show", statusCode: "NoShow", endOn: future },
          { status: "Confirmed", statusCode: "Confirmed", endOn: "2026-01-01" },
        ],
        now,
      ),
    ).toEqual({ upcoming: 1, completed: 1, cancelled: 2 });
  });

  it("treats a challan as expired after its last day (date only) or its time", () => {
    const now = new Date(2026, 9, 13, 12, 0, 0);
    expect(isChallanExpired("2026-09-14T00:00:00.000", now)).toBe(true);
    expect(isChallanExpired("2026-10-13T00:00:00.000", now)).toBe(false); // valid all of today
    expect(isChallanExpired("2026-10-13", now)).toBe(false);
    expect(isChallanExpired("2026-10-13T09:30:00", now)).toBe(true);
    expect(isChallanExpired("2026-10-18T03:56:13.000", now)).toBe(false);
    expect(isChallanExpired(null, now)).toBe(false);
    expect(isChallanExpired("not a date", now)).toBe(false);
  });

  it("only asks to pay a Pending, unexpired challan that has not been paid", () => {
    const now = new Date(2026, 9, 13, 12, 0, 0);
    const base = { status: "Pending", statusCode: "Pending", challanValidUntil: "2026-10-18T03:56:13.000" };
    expect(isChallanToPay(base, now)).toBe(true);
    expect(isChallanToPay({ ...base, challanValidUntil: "2026-09-14T00:00:00.000" }, now)).toBe(false);
    expect(isChallanToPay({ ...base, status: "Rejected", statusCode: "Rejected" }, now)).toBe(false);
    expect(isChallanToPay({ ...base, status: "No Show", statusCode: "NoShow" }, now)).toBe(false);
    expect(isChallanToPay({ ...base, totalPaidAmount: 999760, totalPayable: 999760 }, now)).toBe(false);
    expect(isChallanToPay({ ...base, totalPaidAmount: 100, totalPayable: 999760 }, now)).toBe(true);
    expect(isChallanToPay({ ...base, totalPaidAmount: 100 }, now)).toBe(false);
  });

  it("tells where a challan stands (to pay, expired, void, settled)", () => {
    const now = new Date(2026, 9, 13, 12, 0, 0);
    const expiredDate = "2026-09-14T00:00:00.000";
    // User 48, booking 370: Pending, valid until 14 Sep 2026, nothing paid.
    expect(challanStage({ status: "Pending", statusCode: "Pending", challanValidUntil: expiredDate, totalPaidAmount: 0 }, now)).toBe(
      "expired",
    );
    expect(
      challanStage({ status: "Pending", challanValidUntil: expiredDate, totalPaidAmount: 100, totalPayable: 376100 }, now),
    ).toBe("expired");
    expect(
      challanStage({ status: "Pending", challanValidUntil: expiredDate, totalPaidAmount: 376100, totalPayable: 376100 }, now),
    ).toBe("settled");
    expect(challanStage({ status: "No Show", statusCode: "NoShow", totalPaidAmount: 459630 }, now)).toBe("void");
    expect(challanStage({ status: "Confirmed", statusCode: "Confirmed" }, now)).toBe("settled");
    expect(challanStage({ status: "Pending", challanValidUntil: "2026-10-18T03:56:13.000" }, now)).toBe("toPay");
  });

  it("reports a failed /booking/my as an error instead of an empty list", async () => {
    installFetch(jsonResponse(500, undefined));
    await expect(getMyBookings()).rejects.toBeInstanceOf(ApiError);
  });

  it("reads the challan DTO including its lines", () => {
    const c = normalizeChallan(
      {
        challanNumber: "1001234567",
        validUntil: "2026-10-20",
        bookingStatusLabel: "Pending",
        totalPayable: 201840,
        details: [{ lineId: 1, chargeTypeLabel: "Advance rent", lineTotal: 151840 }],
        contract: { balanceLeft: 300000 },
      },
      41,
    );
    expect(c).toMatchObject({ bookingId: 41, challanNumber: "1001234567", totalPayable: 201840, balanceLeft: 300000 });
    expect(c.lines).toEqual([expect.objectContaining({ label: "Advance rent", lineTotal: 151840 })]);
    expect(c.fields).toEqual([]);
  });

  it("reads the challan's fields breakdown (what the screen shows)", () => {
    const c = normalizeChallan({
      bookingId: 557,
      totalPayable: 470480,
      totalPaidAmount: 459630,
      fields: [
        { label: "Space No.", value: "309", key: "spaceNo", isHeader: true },
        { label: "Advance Rent (3 Months)", value: "PKR 297,500", key: "advanceRent", isHeader: false },
        { label: "TOTAL INITIAL AMOUNT PAYABLE", value: "PKR 470,480", key: "totalAmount", isHeader: false },
      ],
    });
    expect(c.fields).toHaveLength(3);
    expect(c.fields[1]).toEqual({ key: "advanceRent", label: "Advance Rent (3 Months)", value: "PKR 297,500", isHeader: false });
    expect(c.totalPaidAmount).toBe(459630);
  });

  it("maps the booking mode to the API category code", () => {
    expect(categoryCodeForMode("office")).toBe("PrivateOffice");
    expect(categoryCodeForMode("shared")).toBe("SharedSpace");
    expect(categoryCodeForMode("meeting")).toBe("MeetingRoom");
  });

  it("creates a smart booking with the API's field names and returns its challan", async () => {
    const fetchMock = installFetch(
      jsonResponse(201, {
        isSuccessful: true,
        data: { bookingId: 55, challanNumber: "1009", totalAmount: 1200, securityDeposit: 0 },
      }),
    );

    const created = await createSmartBooking({
      categoryCode: "MeetingRoom",
      startDateTime: "2026-10-14T09:00:00",
      endDateTime: "2026-10-14T11:00:00",
    });

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/booking\/smart$/);
    expect(sentBody(fetchMock)).toMatchObject({ categoryCode: "MeetingRoom", startDateTime: "2026-10-14T09:00:00" });
    expect(created).toMatchObject({ bookingId: 55, challanNumber: "1009", totalAmount: 1200 });
  });

  it("turns CustomerProfileRequired into a typed error with the API's explanation", async () => {
    installFetch(
      jsonResponse(400, {
        isSuccessful: false,
        message: "CustomerProfileRequired",
        errors: ["Please complete your customer profile details to book a space."],
      }),
    );

    const error = await createSmartBooking({
      categoryCode: "SharedSpace",
      startDateTime: "2026-11-01T09:00:00",
      endDateTime: "2026-11-30T17:00:00",
    }).catch((e) => e);

    expect(error).toBeInstanceOf(CustomerProfileRequiredError);
    expect(error.message).toBe("Please complete your customer profile details to book a space.");
  });

  it("rejects an invalid phone before sending the customer profile", async () => {
    const fetchMock = installFetch();
    await expect(
      createSmartBooking({
        categoryCode: "SharedSpace",
        startDateTime: "2026-11-01T09:00:00",
        endDateTime: "2026-11-30T17:00:00",
        profile: { firstName: "Ali", phoneNumber: "123" },
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("availability and booking details", () => {
  it("asks /booking/smart/available for the period and reports count and lowest listed price", async () => {
    const fetchMock = installFetch(
      jsonResponse(200, {
        isSuccessful: true,
        data: [
          { id: 1, seatPrice: 30000, billingPeriodCode: "Monthly", securityDeposit: 50000 },
          { id: 2, seatPrice: 25000, billingPeriodCode: "Monthly" },
        ],
      }),
    );
    const result = await getSmartAvailability({
      categoryCode: "PrivateOffice",
      startOn: "2026-11-01T00:00:00",
      endOn: "2027-02-01T00:00:00",
      capacity: 4,
    });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/booking/smart/available?");
    expect(url).toContain("categoryCode=PrivateOffice");
    expect(url).toContain("capacity=4");
    expect(result).toEqual({ count: 2, fromPrice: 25000, billingPeriodCode: "Monthly", securityDeposit: 50000 });
  });

  it("reports no space as count 0", async () => {
    installFetch(jsonResponse(200, { isSuccessful: true, data: [] }));
    const result = await getSmartAvailability({ categoryCode: "MeetingRoom", startOn: "a", endOn: "b" });
    expect(result.count).toBe(0);
    expect(result.fromPrice).toBeNull();
  });

  it("loads booking details from GET /booking/{id} in the challan shape", async () => {
    const fetchMock = installFetch(
      jsonResponse(200, { isSuccessful: true, data: { bookingStatusLabel: "Confirmed", spaceName: "Office 3", totalPayable: 1000 } }),
    );
    const details = await getBookingDetails(12);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/booking\/12$/);
    expect(details).toMatchObject({ bookingId: 12, bookingStatus: "Confirmed", spaceName: "Office 3", totalPayable: 1000 });
  });
});

describe("payments (challan only, status from the API)", () => {
  it("keeps the API's status and never infers Paid", () => {
    const pending = normalizePayment({ id: 3, bookingId: 41, amount: 5000, paymentStatus: "Pending", paymentMethodLabel: "Bank Transfer / Challan" });
    const paid = normalizePayment({ Id: 4, Amount: 7000, PaymentStatus: "Paid", PaidOn: "05/10/2026 10:00:00 am" });
    expect(isPaid(pending)).toBe(false);
    expect(isPaid(paid)).toBe(true);
    expect(paid.paidOn).toBe("2026-10-05 10:00:00 am");
    expect(normalizePayment({ id: 9 }).status).toBe("Pending");
    expect(summarizePayments([pending, paid])).toEqual({ paid: 7000, pending: 5000 });
  });

  it("reads DD/MM/YYYY dates like the website", () => {
    expect(parseApiDate("5/1/2026")).toBe("2026-01-05");
    expect(parseApiDate("2026-01-05T10:00:00")).toBe("2026-01-05T10:00:00");
    expect(parseApiDate(null)).toBeNull();
  });

  it("reports a failed /payment/my as an error instead of an empty list", async () => {
    installFetch(jsonResponse(503, undefined));
    await expect(getMyPayments()).rejects.toMatchObject({ status: 503 });
  });
});

describe("notifications", () => {
  it("reads GET /mobile/announcements", async () => {
    installFetch(
      jsonResponse(200, {
        isSuccessful: true,
        data: { items: [{ id: "a1", title: "Hello", body: "Lift maintenance", isRead: false }], total: 1, page: 1, limit: 20 },
      }),
    );
    const page = await getAnnouncements();
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({ id: "a1", title: "Hello", isRead: false });
    expect(normalizeAnnouncement({ Id: "b", IsRead: true }).isRead).toBe(true);
  });

  it("turns a tapped notification into an app link", () => {
    expect(notificationLink(undefined)).toBe("worknest://notifications");
    expect(notificationLink({ screen: "bookings" })).toBe("worknest://bookings");
    expect(notificationLink({ type: "challan" })).toBe("worknest://payments");
    expect(notificationLink({ quotationId: "12" })).toBe("worknest://quotation/12");
    expect(notificationLink({ link: "https://worknestpk.com/my-agreements" })).toBe("https://worknestpk.com/my-agreements");
    expect(notificationLink({ link: "https://evil.example.com" })).toBe("worknest://notifications");
    // Links sent with the old scheme still open the app.
    expect(notificationLink({ link: "myapp://bookings" })).toBe("myapp://bookings");
    expect(notificationLink({ link: "worknest://payments" })).toBe("worknest://payments");
  });
});

describe("agreements (website My Agreements rules)", () => {
  const sent = normalizeAgreement({ id: 5, quotationId: 9, status: "AgreementSent", sentDate: "2026-10-01T00:00:00" });
  const newer = normalizeAgreement({ id: 6, quotationId: 9, status: "AgreementSent" });

  it("only the latest agreement of a quotation can be signed", () => {
    expect(isAgreementSuperseded(sent, [sent, newer])).toBe(true);
    expect(isAgreementSignable(sent, [sent, newer])).toBe(false);
    expect(isAgreementSignable(newer, [sent, newer])).toBe(true);
  });

  it("knows the stage", () => {
    expect(agreementStage(sent)).toBe("sign");
    expect(agreementStage(normalizeAgreement({ id: 7, status: "SignedUploaded" }))).toBe("review");
    expect(agreementStage(normalizeAgreement({ id: 8, status: "Signed", bookingId: 77 }))).toBe("booked");
  });

  it("checks a signed upload like the API does", () => {
    const pdf = { uri: "content://x", name: "signed.pdf", type: "application/pdf", size: 1024 };
    expect(signedUploadError(null, "2026-10-02")).toMatch(/Choose/);
    expect(signedUploadError({ ...pdf, name: "scan.jpg", type: "image/jpeg" }, "2026-10-02")).toMatch(/PDF/);
    expect(signedUploadError({ ...pdf, size: 11 * 1024 * 1024 }, "2026-10-02")).toMatch(/10 MB/);
    expect(signedUploadError(pdf, "2999-01-01")).toMatch(/future/);
    expect(signedUploadError(pdf, "2026-09-01", sent.sentAt as string)).toMatch(/before the agreement was sent/);
    expect(signedUploadError(pdf, "2026-10-02", sent.sentAt as string)).toBeNull();
  });
});

describe("book a tour", () => {
  it("formats the message like the website", () => {
    expect(
      buildTourMessage({
        fullName: "Ali",
        email: "ali@example.com",
        phone: "03001234567",
        location: "Blue Area",
        preferredDate: "2026-10-20",
        timeSlot: "10:00 AM - 11:00 AM",
        notes: "Two people",
      }),
    ).toBe("Tour Request\nLocation: Blue Area\nDate: 2026-10-20\nTime: 10:00 AM - 11:00 AM\n\nTwo people");
  });

  it("posts to /book-tour", async () => {
    const fetchMock = installFetch(jsonResponse(201, { isSuccessful: true, message: "Thank you." }));
    const message = await submitTourRequest({ fullName: "Ali Khan", email: "ali@example.com", phone: "03001234567" });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/book-tour$/);
    expect(sentBody(fetchMock)).toMatchObject({ fullName: "Ali Khan", email: "ali@example.com", message: "Tour Request" });
    expect(sentBody(fetchMock)).not.toHaveProperty("locationId");
    expect(message).toBe("Thank you.");
  });

  it("sends the chosen location's id so the branch's staff get the request", async () => {
    const fetchMock = installFetch(jsonResponse(201, { isSuccessful: true, message: "Thank you." }));
    await submitTourRequest({ fullName: "Ali Khan", email: "ali@example.com", phone: "03001234567", location: "I-8", locationId: 2 });
    expect(sentBody(fetchMock)).toMatchObject({ message: "Tour Request\nLocation: I-8", locationId: 2 });
  });
});

describe("contact us", () => {
  it("posts the message to /contact", async () => {
    const fetchMock = installFetch(jsonResponse(201, { isSuccessful: true, message: "Thanks." }));
    const message = await submitContactMessage({
      fullName: "Ali Khan",
      email: "ali@example.com",
      phone: "",
      message: "Do you have parking?",
    });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/contact$/);
    expect(sentBody(fetchMock)).toMatchObject({ fullName: "Ali Khan", message: "Do you have parking?" });
    expect(message).toBe("Thanks.");
  });

  it("refuses an empty message before calling the API", async () => {
    const fetchMock = installFetch();
    await expect(
      submitContactMessage({ fullName: "Ali", email: "ali@example.com", phone: "", message: " " }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("quotations (customer actions)", () => {
  it("normalizes ids and, without canRespond from the API, only lets a Sent quotation be answered", () => {
    expect(normalizeQuotationApiId("QUO-0012")).toBe("12");
    expect(canRespondToQuotation({ status: "sent", isActive: true })).toBe(true);
    expect(canRespondToQuotation({ status: "sent", isActive: false })).toBe(false);
    expect(canRespondToQuotation({ status: "accepted", isActive: true })).toBe(false);
    expect(canRespondToQuotation({ status: "active", isActive: true })).toBe(false);
    expect(canRespondToQuotation({ status: "pending", isActive: true })).toBe(false);
    expect(canRespondToQuotation({ status: "draft", isActive: true })).toBe(false);
  });

  it("follows the API's canRespond when it is sent", () => {
    const active = normalizeQuotation({ id: 238, status: "Active", isActive: true, canRespond: false });
    expect(active.canRespond).toBe(false);
    expect(canRespondToQuotation(active)).toBe(false);
    const sent = normalizeQuotation({ id: 240, status: "Sent", isActive: true, canRespond: true });
    expect(canRespondToQuotation(sent)).toBe(true);
    expect(normalizeQuotation({ id: 1, status: "Sent" }).canRespond).toBeUndefined();
  });

  it("reads the quotation's fields breakdown and its total payable", () => {
    const q = normalizeQuotation({
      id: 238,
      status: "Active",
      subtotalAmount: 2100000,
      totalAmount: 879800,
      totalPayable: 879800,
      details: [{ feeType: "RoomRent", description: "Private Office facility", quantity: 12, unitPrice: 175000, amount: 2100000 }],
      fields: [{ label: "Advance Rent (3 Months)", value: "PKR 525,000", key: "advanceRent", isHeader: false }],
    });
    expect(q.total).toBe(879800);
    expect(q.subtotal).toBe(2100000);
    expect(q.fields).toEqual([{ key: "advanceRent", label: "Advance Rent (3 Months)", value: "PKR 525,000", isHeader: false }]);
  });

  it("never lists draft quotations", async () => {
    installFetch(
      jsonResponse(200, {
        isSuccessful: true,
        data: [
          { id: 59, status: "Draft" },
          { id: 218, status: "Signed" },
        ],
      }),
    );
    const list = await getMyQuotations();
    expect(list.map((q) => q.id)).toEqual(["218"]);
  });
});

describe("request headers", () => {
  it("identifies the customer by the JWT only (no email header)", async () => {
    const fetchMock = installFetch(jsonResponse(200, { isSuccessful: true, data: [] }));
    await getMyBookings();
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer api-jwt");
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("x-user-email");
  });
});
