import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import { sanitizeNotesInput } from "../utils/inputSanitizer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuotationCreatePayload = {
  customerId: number | string;
  spaceId: number | string;
  startDateTime: string;
  endDateTime: string;
  perSeatBasePrice: number | string;
  capacity: number | string;
  monthlyBasePrice: number | string;
  maxDiscountPercent: number | string;
  discountType: string;
  discountPercentage: number | string;
  discountValue: number | string;
  securityDepositOverride: number | string;
  billingPeriodMonths: number | string;
  securityDepositMonths: number | string;
  floorId: number | string;
  remarks?: string;
  validUntil: string;
};

export type QuotationRecord = {
  id?: number | string;
  customerId?: number | string;
  spaceId?: number | string;
  customerName?: string;
  spaceName?: string;
  locationName?: string;
  quotationNumber?: string;
  totalAmount?: number;
  total?: number;
  subtotalAmount?: number;
  taxAmount?: number;
  status?: string;
  validUntil?: string;
  quotationDate?: string;
  startDateTime?: string;
  endDateTime?: string;
  remarks?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type QuotationListResponse = {
  data: QuotationRecord[];
  total: number;
  page: number;
  limit: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(value: number | string | undefined | null, fieldName: string): number {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return 0;
  const next = Number(raw);
  if (!Number.isFinite(next)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return next;
}

/**
 * Normalizes a raw API record to a consistent QuotationRecord shape,
 * regardless of casing (Pascal vs camel).
 */
export function normalizeQuotationRecord(raw: any): QuotationRecord {
  return {
    id: raw?.id ?? raw?.Id ?? raw?.quotationId ?? raw?.QuotationId,
    quotationNumber: raw?.quotationNumber ?? raw?.QuotationNumber ?? raw?.quotationNo ?? String(raw?.id ?? ""),
    customerId: raw?.customerId ?? raw?.CustomerId,
    customerName: raw?.customerName ?? raw?.CustomerName ?? raw?.customer?.name ?? "",
    spaceId: raw?.spaceId ?? raw?.SpaceId,
    spaceName: raw?.spaceName ?? raw?.SpaceName ?? "",
    locationName: raw?.locationName ?? raw?.LocationName ?? "",
    status: (raw?.status ?? raw?.Status ?? "draft").toLowerCase(),
    totalAmount: Number(raw?.totalAmount ?? raw?.TotalAmount ?? raw?.total ?? raw?.Total ?? 0),
    total: Number(raw?.totalAmount ?? raw?.TotalAmount ?? raw?.total ?? raw?.Total ?? 0),
    subtotalAmount: Number(raw?.subtotalAmount ?? raw?.SubtotalAmount ?? raw?.subtotal ?? 0),
    taxAmount: Number(raw?.taxAmount ?? raw?.TaxAmount ?? raw?.tax ?? 0),
    validUntil: raw?.validUntil ?? raw?.ValidUntil ?? "",
    quotationDate: raw?.quotationDate ?? raw?.QuotationDate ?? raw?.createdAt ?? "",
    startDateTime: raw?.startDateTime ?? raw?.StartDateTime ?? "",
    endDateTime: raw?.endDateTime ?? raw?.EndDateTime ?? "",
    remarks: raw?.remarks ?? raw?.Remarks ?? "",
    version: Number(raw?.version ?? raw?.Version ?? 1),
    createdAt: raw?.createdAt ?? raw?.CreatedAt ?? "",
    updatedAt: raw?.updatedAt ?? raw?.UpdatedAt ?? "",
    ...raw,
  };
}

export function normalizeQuotationPayload(payload: QuotationCreatePayload): QuotationCreatePayload {
  return {
    customerId: toNumber(payload.customerId, "Customer Id"),
    spaceId: toNumber(payload.spaceId, "Space Id"),
    startDateTime: String(payload.startDateTime ?? "").trim(),
    endDateTime: String(payload.endDateTime ?? "").trim(),
    perSeatBasePrice: toNumber(payload.perSeatBasePrice, "Per seat base price"),
    capacity: toNumber(payload.capacity, "Capacity"),
    monthlyBasePrice: toNumber(payload.monthlyBasePrice, "Monthly base price"),
    maxDiscountPercent: toNumber(payload.maxDiscountPercent, "Max discount percent"),
    discountType: String(payload.discountType ?? "percentage").trim() || "percentage",
    discountPercentage: toNumber(payload.discountPercentage, "Discount percentage"),
    discountValue: toNumber(payload.discountValue, "Discount value"),
    securityDepositOverride: toNumber(payload.securityDepositOverride, "Security deposit override"),
    billingPeriodMonths: toNumber(payload.billingPeriodMonths, "Billing period months"),
    securityDepositMonths: toNumber(payload.securityDepositMonths, "Security deposit months"),
    floorId: toNumber(payload.floorId, "Floor Id"),
    remarks: sanitizeNotesInput(String(payload.remarks ?? "")),
    validUntil: String(payload.validUntil ?? "").trim(),
  };
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Create a new quotation. Used by Sales Executive / Admin.
 * POST /api/quotation
 */
export async function createQuotation(payload: QuotationCreatePayload): Promise<QuotationRecord> {
  const cleaned = normalizeQuotationPayload(payload);
  return apiRequest<QuotationRecord>(API_ENDPOINTS.quotation.create, {
    method: "POST",
    requiresAuth: true,
    body: cleaned,
  });
}

/**
 * Get MY quotations (General User).
 * GET /api/quotation/my  — uses x-user-email header (sent automatically by apiClient).
 * Falls back to /api/quotation/by-customer/{customerId} if needed.
 */
export async function getMyQuotations(): Promise<QuotationRecord[]> {
  try {
    const raw = await apiRequest<any>(API_ENDPOINTS.quotation.my, {
      method: "GET",
      requiresAuth: true,
    });
    const items: any[] = Array.isArray(raw) ? raw : raw?.data ?? raw?.items ?? [];
    return items.map(normalizeQuotationRecord);
  } catch (error) {
    console.warn("[quotationService] getMyQuotations failed:", error);
    throw error;
  }
}

/**
 * Get paginated quotation list. Used by Admin and Sales Executive.
 * GET /api/quotation?page=&limit=&search=&locationId=
 */
export async function getQuotations(
  page = 1,
  limit = 20,
  search?: string,
  locationId?: number
): Promise<{ data: QuotationRecord[]; total: number; page: number; limit: number }> {
  const path = API_ENDPOINTS.quotation.adminList(page, limit, search, locationId);
  const raw = await apiRequest<any>(path, {
    method: "GET",
    requiresAuth: true,
  });

  // Backend returns { data: [...], total, page, limit }
  const items: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
    ? raw.data
    : raw?.items ?? [];
  const total = Number(raw?.total ?? items.length);

  return {
    data: items.map(normalizeQuotationRecord),
    total,
    page: Number(raw?.page ?? page),
    limit: Number(raw?.limit ?? limit),
  };
}
