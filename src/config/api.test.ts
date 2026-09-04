import { normalizeApiBaseUrl } from "./api";
import { normalizeQuotation } from "../services/mockQuotationService";

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
