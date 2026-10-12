import { normalizeApiBaseUrl } from "./api";
import { normalizeQuotation } from "../services/customerQuotationService";
import {
  ApiError,
  apiRequest,
  isAuthEndpoint,
  onSessionExpired,
  resetSessionExpiredState,
  setSessionRefresher,
} from "../services/apiClient";
import { getToken, getUser } from "../utils/authStorage";
import { normalizeQuotationPayload } from "../services/quotationService";

// Native modules the services import (no native side in unit tests).
jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(() => Promise.resolve()) },
}));

jest.mock("../utils/authStorage", () => ({
  getToken: jest.fn(),
  getUser: jest.fn(),
}));

// Failed requests are logged in development builds; keep the test output readable.
beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("normalizeApiBaseUrl", () => {
  it("appends /api when the configured base URL does not include one", () => {
    expect(normalizeApiBaseUrl("https://aeo.eaccounting360.com.pk/WorkNest")).toBe(
      "https://aeo.eaccounting360.com.pk/WorkNest/api"
    );
  });

  it("preserves an existing /api suffix", () => {
    expect(normalizeApiBaseUrl("https://aeo.eaccounting360.com.pk/WorkNest/api")).toBe(
      "https://aeo.eaccounting360.com.pk/WorkNest/api"
    );
  });
});

describe("normalizeQuotation", () => {
  it("handles the real quotation payload shape returned by the WorkNest API", () => {
    const payload = {
      customerName: "Usman Tariq",
      id: 1,
      items: [
        { id: 1, name: "Event Space (Full Day)", price: 45000, quantity: 1, total: 45000 },
        { id: 2, name: "Catering Package", price: 12000, quantity: 1, total: 12000 },
      ],
      quotationDate: "01 Aug 2026",
      status: "expired",
      subtotal: 57000,
      tax: 0,
      total: 57000,
      validUntil: "08 Aug 2026",
    };

    const normalized = normalizeQuotation(payload);

    expect(normalized.id).toBe("1");
    expect(normalized.customerName).toBe("Usman Tariq");
    expect(normalized.status).toBe("expired");
    expect(normalized.items).toHaveLength(2);
    expect(normalized.items[0]).toMatchObject({
      id: 1,
      name: "Event Space (Full Day)",
      price: 45000,
      quantity: 1,
      total: 45000,
    });
    expect(normalized.total).toBe(57000);
  });
});

describe("normalizeQuotationPayload", () => {
  it("sanitizes and normalizes the sales quotation body expected by /api/quotation", () => {
    const payload = normalizeQuotationPayload({
      customerId: "42",
      spaceId: "7",
      startDateTime: "2026-08-05T10:00:00Z",
      endDateTime: "2026-08-06T10:00:00Z",
      perSeatBasePrice: "2500",
      capacity: "12",
      monthlyBasePrice: "90000",
      maxDiscountPercent: "30",
      discountType: "percentage",
      discountPercentage: "10",
      discountValue: "5000",
      securityDepositOverride: "20000",
      billingPeriodMonths: "6",
      securityDepositMonths: "2",
      floorId: "3",
      remarks: "Needs air conditioning",
      validUntil: "2026-08-12T00:00:00Z",
    });

    expect(payload).toMatchObject({
      customerId: 42,
      spaceId: 7,
      perSeatBasePrice: 2500,
      capacity: 12,
      monthlyBasePrice: 90000,
      maxDiscountPercent: 30,
      discountType: "percentage",
      discountPercentage: 10,
      discountValue: 5000,
      securityDepositOverride: 20000,
      billingPeriodMonths: 6,
      securityDepositMonths: 2,
      floorId: 3,
      remarks: "Needs air conditioning",
      validUntil: "2026-08-12T00:00:00Z",
    });
  });
});

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

describe("apiRequest", () => {
  let expired: jest.Mock;
  let unsubscribe: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionExpiredState();
    setSessionRefresher(null);
    expired = jest.fn();
    unsubscribe = onSessionExpired(expired);
    (getToken as jest.Mock).mockResolvedValue("api-jwt");
    (getUser as jest.Mock).mockResolvedValue({ email: "customer@example.com" });
  });

  afterEach(() => unsubscribe());

  it("sends the API token and unwraps the { isSuccessful, data } envelope", async () => {
    const fetchMock = installFetch(jsonResponse(200, { isSuccessful: true, data: [{ bookingId: 7 }] }));

    const result = await apiRequest<Array<{ bookingId: number }>>("/booking/my", { requiresAuth: true });

    expect(result).toEqual([{ bookingId: 7 }]);
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer api-jwt");
  });

  it("turns { isSuccessful: false } into an error carrying the API message", async () => {
    installFetch(jsonResponse(201, { isSuccessful: false, message: "No available space for the requested period." }));

    await expect(apiRequest("/booking/smart", { method: "POST", requiresAuth: true, body: {} })).rejects.toMatchObject({
      message: "No available space for the requested period.",
    });
  });

  it("never shows a raw server error: technical text becomes a plain message", async () => {
    installFetch(jsonResponse(500, { message: "System.NullReferenceException: Object reference not set" }));

    await expect(apiRequest("/payment/my", { requiresAuth: true })).rejects.toMatchObject({
      status: 500,
      message: "Something went wrong on our side. Please try again in a moment.",
    });
  });

  it("does not end the session for a 401 from a sign-in endpoint", async () => {
    const fetchMock = installFetch(jsonResponse(401, { message: "Sign in required." }));

    await expect(apiRequest("/auth/me", { requiresAuth: true })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
  });

  it("does not end the session for a guest request that sent no token", async () => {
    (getToken as jest.Mock).mockResolvedValue(null);
    installFetch(jsonResponse(401, undefined));

    await expect(apiRequest("/booking/my", { requiresAuth: true })).rejects.toMatchObject({ status: 401 });
    expect(expired).not.toHaveBeenCalled();
  });

  it("renews the API token once on a 401 and re-sends the request", async () => {
    const refresher = jest.fn().mockResolvedValue("fresh-jwt");
    setSessionRefresher(refresher);
    const fetchMock = installFetch(
      jsonResponse(401, undefined),
      jsonResponse(200, { isSuccessful: true, data: { ok: true } }),
    );

    const result = await apiRequest<{ ok: boolean }>("/payment/my", { requiresAuth: true });

    expect(result).toEqual({ ok: true });
    expect(refresher).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[1][1].headers as Record<string, string>).Authorization).toBe("Bearer fresh-jwt");
    expect(expired).not.toHaveBeenCalled();
  });

  it("ends the session (once) when the token is refused and can't be renewed", async () => {
    setSessionRefresher(jest.fn().mockResolvedValue(null));
    installFetch(jsonResponse(401, undefined), jsonResponse(401, undefined));

    const results = await Promise.allSettled([
      apiRequest("/booking/my", { requiresAuth: true }),
      apiRequest("/payment/my", { requiresAuth: true }),
    ]);

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(expired).toHaveBeenCalledTimes(1);
  });
});

describe("isAuthEndpoint", () => {
  it("matches only the /auth endpoints", () => {
    expect(isAuthEndpoint("/auth/google-login")).toBe(true);
    expect(isAuthEndpoint("/auth/me")).toBe(true);
    expect(isAuthEndpoint("/Agreement/my")).toBe(false);
    expect(isAuthEndpoint("/booking/12/challan")).toBe(false);
  });
});
