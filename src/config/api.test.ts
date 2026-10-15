import {
  isLocalNetworkHost,
  isReleaseSafeApiUrl,
  normalizeApiBaseUrl,
  PRODUCTION_API_BASE_URL,
  selectApiBaseUrl,
} from "./api";
import { normalizeQuotation } from "../services/customerQuotationService";
import {
  ApiError,
  apiRequest,
  isAuthEndpoint,
  onSessionExpired,
  requestTimeout,
  resetSessionExpiredState,
  setSessionRefresher,
} from "../services/apiClient";
import { getToken, getUser } from "../utils/authStorage";

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

describe("selectApiBaseUrl", () => {
  const release = { isDev: false, platformOS: "android" };
  const dev = { isDev: true, platformOS: "android" };

  it("uses the production API when nothing is configured", () => {
    expect(PRODUCTION_API_BASE_URL).toBe("https://aeo.eaccounting360.com.pk/WorkNest/api");
    expect(selectApiBaseUrl("", release)).toBe(PRODUCTION_API_BASE_URL);
    expect(selectApiBaseUrl(undefined, dev)).toBe(PRODUCTION_API_BASE_URL);
  });

  it("release: keeps a configured https API on a public host", () => {
    expect(selectApiBaseUrl("https://api.worknestpk.com/WorkNest", release)).toBe("https://api.worknestpk.com/WorkNest/api");
    expect(selectApiBaseUrl("https://aeo.eaccounting360.com.pk/WorkNest/", release)).toBe(PRODUCTION_API_BASE_URL);
  });

  it("release: never uses an http API", () => {
    expect(selectApiBaseUrl("http://aeo.eaccounting360.com.pk/WorkNest", release)).toBe(PRODUCTION_API_BASE_URL);
    expect(selectApiBaseUrl("HTTP://api.example.com", release)).toBe(PRODUCTION_API_BASE_URL);
  });

  it("release: never uses a local or private-network API, even over https", () => {
    for (const base of [
      "http://127.0.0.1:5200",
      "https://127.0.0.1:5200",
      "https://localhost:5001",
      "https://10.0.2.2:5001",
      "https://10.1.2.3",
      "https://192.168.1.20:5200/WorkNest",
      "https://172.20.0.5",
      "https://[::1]:5001",
      "https://dev-mac.local",
      "https://user@127.0.0.1/",
    ]) {
      expect(selectApiBaseUrl(base, release)).toBe(PRODUCTION_API_BASE_URL);
    }
  });

  it("release: a value that is not a URL falls back to production", () => {
    expect(selectApiBaseUrl("aeo.eaccounting360.com.pk/WorkNest", release)).toBe(PRODUCTION_API_BASE_URL);
    expect(selectApiBaseUrl("https://", release)).toBe(PRODUCTION_API_BASE_URL);
  });

  it("development: uses the configured local API (adb reverse) as is", () => {
    expect(selectApiBaseUrl("http://127.0.0.1:5200", dev)).toBe("http://127.0.0.1:5200/api");
    expect(selectApiBaseUrl("http://192.168.1.20:5200/api", dev)).toBe("http://192.168.1.20:5200/api");
  });

  it("development: remaps localhost to the emulator host on Android only", () => {
    expect(selectApiBaseUrl("http://localhost:5200", dev)).toBe("http://10.0.2.2:5200/api");
    expect(selectApiBaseUrl("http://localhost:5200", { isDev: true, platformOS: "ios" })).toBe("http://localhost:5200/api");
  });
});

describe("isReleaseSafeApiUrl / isLocalNetworkHost", () => {
  it("accepts https on public hosts only", () => {
    expect(isReleaseSafeApiUrl("https://aeo.eaccounting360.com.pk/WorkNest/api")).toBe(true);
    expect(isReleaseSafeApiUrl("https://172.32.0.1/api")).toBe(true);
    expect(isReleaseSafeApiUrl("http://aeo.eaccounting360.com.pk/WorkNest/api")).toBe(false);
    expect(isReleaseSafeApiUrl("ftp://aeo.eaccounting360.com.pk")).toBe(false);
  });

  it("recognises loopback, private and link-local hosts", () => {
    for (const host of ["localhost", "LOCALHOST", "127.0.0.1", "127.1.2.3", "10.0.2.2", "192.168.0.10", "172.16.0.1", "172.31.255.255", "169.254.1.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "box.local"]) {
      expect(isLocalNetworkHost(host)).toBe(true);
    }
    for (const host of ["aeo.eaccounting360.com.pk", "8.8.8.8", "172.15.0.1", "172.32.0.1", "192.169.0.1", "localhost.example.com"]) {
      expect(isLocalNetworkHost(host)).toBe(false);
    }
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
    const fetchMock = installFetch(jsonResponse(401, { message: "Invalid email or password." }));

    await expect(
      apiRequest("/auth/login", { method: "POST", requiresAuth: true, body: {} }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
  });

  it("renews the token on a 401 from /auth/me (the profile is an ordinary signed-in request)", async () => {
    const refresher = jest.fn().mockResolvedValue("fresh-jwt");
    setSessionRefresher(refresher);
    const fetchMock = installFetch(
      jsonResponse(401, { message: "Sign in required." }),
      jsonResponse(200, { isSuccessful: true, data: { email: "customer@example.com" } }),
    );

    await expect(apiRequest("/auth/me", { requiresAuth: true })).resolves.toEqual({ email: "customer@example.com" });
    expect(refresher).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[1][1].headers as Record<string, string>).Authorization).toBe("Bearer fresh-jwt");
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

describe("apiRequest session refresh", () => {
  let expired: jest.Mock;
  let unsubscribe: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionExpiredState();
    expired = jest.fn();
    unsubscribe = onSessionExpired(expired);
    (getToken as jest.Mock).mockResolvedValue("api-jwt");
    (getUser as jest.Mock).mockResolvedValue({ email: "customer@example.com" });
  });

  afterEach(() => {
    unsubscribe();
    setSessionRefresher(null);
  });

  it("keeps the session when the token could not be renewed because the network failed", async () => {
    setSessionRefresher(jest.fn().mockRejectedValue(new ApiError("offline", 0)));
    const fetchMock = installFetch(jsonResponse(401, undefined));

    await expect(apiRequest("/booking/my", { requiresAuth: true })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
  });

  it("parallel 401s share one renewal", async () => {
    const refresher = jest.fn().mockResolvedValue("fresh-jwt");
    setSessionRefresher(refresher);
    installFetch(
      jsonResponse(401, undefined),
      jsonResponse(401, undefined),
      jsonResponse(200, { data: [] }),
      jsonResponse(200, { data: [] }),
    );

    await Promise.all([
      apiRequest("/booking/my", { requiresAuth: true }),
      apiRequest("/payment/my", { requiresAuth: true }),
    ]);

    expect(refresher).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
  });
});

describe("isAuthEndpoint", () => {
  it("matches only the sign-in endpoints", () => {
    expect(isAuthEndpoint("/auth/google-login")).toBe(true);
    expect(isAuthEndpoint("/auth/login")).toBe(true);
    expect(isAuthEndpoint("/auth/logout")).toBe(true);
    expect(isAuthEndpoint("auth/register")).toBe(true);
    expect(isAuthEndpoint("/Agreement/my")).toBe(false);
    expect(isAuthEndpoint("/booking/12/challan")).toBe(false);
  });

  it("treats /auth/me as an ordinary signed-in request (a 401 there renews the session)", () => {
    expect(isAuthEndpoint("/auth/me")).toBe(false);
    expect(isAuthEndpoint("auth/me")).toBe(false);
    expect(isAuthEndpoint("/auth/me?x=1")).toBe(false);
    expect(isAuthEndpoint("/auth/media")).toBe(true);
  });
});

describe("requestTimeout", () => {
  it("is 20 s unless a call asks for longer (e.g. a door machine capture)", () => {
    expect(requestTimeout()).toBe(20000);
    expect(requestTimeout(120000)).toBe(120000);
    expect(requestTimeout(0)).toBe(20000);
    expect(requestTimeout(-5)).toBe(20000);
    expect(requestTimeout(NaN)).toBe(20000);
  });
});
