import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import { sanitizeNotesInput } from "../utils/inputSanitizer";

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
  totalAmount?: number;
  status?: string;
  validUntil?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

function toNumber(value: number | string | undefined | null, fieldName: string): number {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return 0;
  const next = Number(raw);
  if (!Number.isFinite(next)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return next;
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

export async function createQuotation(payload: QuotationCreatePayload): Promise<QuotationRecord> {
  const cleaned = normalizeQuotationPayload(payload);

  return apiRequest<QuotationRecord>(API_ENDPOINTS.quotation.create, {
    method: "POST",
    requiresAuth: true,
    body: cleaned,
  });
}

export async function getQuotations(): Promise<QuotationRecord[]> {
  return apiRequest<QuotationRecord[]>(API_ENDPOINTS.quotation.list, {
    method: "GET",
    requiresAuth: true,
  });
}
