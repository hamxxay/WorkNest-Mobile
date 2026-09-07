import { normalizeApiBaseUrl } from "./api";
import { normalizeQuotation } from "../services/mockQuotationService";
import { apiRequest } from "../services/apiClient";
import { getToken, getUser } from "../utils/authStorage";

jest.mock("../utils/authStorage", () => ({
  getToken: jest.fn(),
  getUser: jest.fn(),
}));

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

describe("apiRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retries the auth/me request with the user email when the bearer token is rejected", async () => {
    (getToken as jest.Mock).mockResolvedValue("expired-firebase-token");
    (getUser as jest.Mock).mockResolvedValue({ email: "salahuddina999@gmail.com" });

    const fetchMock = jest.fn();
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as typeof fetch;

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: "Unauthorized" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { id: 1, email: "salahuddina999@gmail.com", name: "Salahuddin" } }),
      });

    const result = await apiRequest<{ id: number; email: string; name: string }>("/auth/me", {
      requiresAuth: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer expired-firebase-token");
    expect(fetchMock.mock.calls[0][1].headers["X-User-Email"]).toBe("salahuddina999@gmail.com");
    expect(fetchMock.mock.calls[1][1].headers["X-User-Email"]).toBe("salahuddina999@gmail.com");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
    expect(result).toMatchObject({ id: 1, email: "salahuddina999@gmail.com", name: "Salahuddin" });
  });
});
