import { getToken, getUser } from "../utils/authStorage";
import { ApiError, resetSessionExpiredState, setSessionRefresher } from "./apiClient";
import {
  canCancelBooking,
  categoryCodeForMode,
  createSmartBooking,
  CustomerProfileRequiredError,
  getMyBookings,
  normalizeChallan,
  normalizeMyBooking,
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
import { buildTourMessage, submitTourRequest } from "./tourService";
import { canRespondToQuotation, normalizeQuotationApiId } from "./customerQuotationService";

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

  it("allows cancel only for Pending bookings", () => {
    expect(canCancelBooking({ id: 1, status: "Pending", statusCode: null })).toBe(true);
    expect(canCancelBooking({ id: 1, status: "Confirmed", statusCode: "confirmed" })).toBe(false);
    expect(canCancelBooking({ id: 1, status: "Cancelled", statusCode: null })).toBe(false);
    expect(canCancelBooking({ id: 0, status: "Pending", statusCode: null })).toBe(false);
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
    expect(notificationLink(undefined)).toBe("myapp://notifications");
    expect(notificationLink({ screen: "bookings" })).toBe("myapp://bookings");
    expect(notificationLink({ type: "challan" })).toBe("myapp://payments");
    expect(notificationLink({ quotationId: "12" })).toBe("myapp://quotation/12");
    expect(notificationLink({ link: "https://worknestpk.com/my-agreements" })).toBe("https://worknestpk.com/my-agreements");
    expect(notificationLink({ link: "https://evil.example.com" })).toBe("myapp://notifications");
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
    expect(message).toBe("Thank you.");
  });
});

describe("quotations (customer actions)", () => {
  it("normalizes ids and only lets open quotations be answered", () => {
    expect(normalizeQuotationApiId("QUO-0012")).toBe("12");
    expect(canRespondToQuotation({ status: "sent", isActive: true })).toBe(true);
    expect(canRespondToQuotation({ status: "accepted", isActive: true })).toBe(false);
    expect(canRespondToQuotation({ status: "active", isActive: false })).toBe(false);
  });
});
