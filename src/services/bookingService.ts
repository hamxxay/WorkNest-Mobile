import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import { sanitizeNotesInput, sanitizeEmailInput, sanitizeNameInput, sanitizePhoneInput, sanitizeTextForState } from "../utils/inputSanitizer";

export type BookingCreatePayload = {
  userIdGuid?: string;
  userId?: number | string;
  spaceIdGuid?: string;
  spaceId?: number | string;
  startDateTime: string;
  endDateTime: string;
  startDate?: string;
  endDate?: string;
  startOn?: string;
  endOn?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  billingStartDate?: string;
  effectiveFrom?: string;
  notes?: string;
  customerEmail?: string;
  customerName?: string;
  phone?: string;
  discountType?: string;
  discountPercentage?: number | string;
  discountValue?: number | string;
  securityDepositOverride?: number | string;
  floorId?: number | string;
  billingPeriodMonths?: number | string;
  securityDepositMonths?: number | string;
  advanceRentMonths?: number | string;
  supportChargesId?: number | string;
  capacity?: number | string;
};

export type BookingRecord = {
  id?: number | string;
  bookingId?: number | string;
  userIdGuid?: string;
  spaceId?: number | string;
  startDateTime?: string;
  endDateTime?: string;
  status?: string;
  totalAmount?: number;
  notes?: string;
  customerName?: string;
  customerEmail?: string;
  phone?: string;
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

export function normalizeBookingPayload(payload: BookingCreatePayload): BookingCreatePayload {
  const base = {
    ...payload,
    userIdGuid: payload.userIdGuid ? String(payload.userIdGuid).trim() : undefined,
    userId: payload.userId == null ? undefined : toNumber(payload.userId, "User Id"),
    spaceIdGuid: payload.spaceIdGuid ? String(payload.spaceIdGuid).trim() : undefined,
    spaceId: payload.spaceId == null ? undefined : toNumber(payload.spaceId, "Space Id"),
    startDateTime: String(payload.startDateTime ?? "").trim(),
    endDateTime: String(payload.endDateTime ?? "").trim(),
    startDate: payload.startDate ? String(payload.startDate).trim() : undefined,
    endDate: payload.endDate ? String(payload.endDate).trim() : undefined,
    startOn: payload.startOn ? String(payload.startOn).trim() : undefined,
    endOn: payload.endOn ? String(payload.endOn).trim() : undefined,
    contractStartDate: payload.contractStartDate ? String(payload.contractStartDate).trim() : undefined,
    contractEndDate: payload.contractEndDate ? String(payload.contractEndDate).trim() : undefined,
    billingStartDate: payload.billingStartDate ? String(payload.billingStartDate).trim() : undefined,
    effectiveFrom: payload.effectiveFrom ? String(payload.effectiveFrom).trim() : undefined,
    notes: payload.notes ? sanitizeNotesInput(payload.notes) : undefined,
    customerEmail: payload.customerEmail ? sanitizeEmailInput(payload.customerEmail) : undefined,
    customerName: payload.customerName ? sanitizeNameInput(payload.customerName, "Customer name") : undefined,
    phone: payload.phone ? sanitizePhoneInput(payload.phone, "Phone") : undefined,
    discountType: payload.discountType ? sanitizeTextForState(payload.discountType, { maxLength: 40, collapse: true }).trim() : undefined,
    discountPercentage: payload.discountPercentage == null ? undefined : toNumber(payload.discountPercentage, "Discount percentage"),
    discountValue: payload.discountValue == null ? undefined : toNumber(payload.discountValue, "Discount value"),
    securityDepositOverride: payload.securityDepositOverride == null ? undefined : toNumber(payload.securityDepositOverride, "Security deposit override"),
    floorId: payload.floorId == null ? undefined : toNumber(payload.floorId, "Floor Id"),
    billingPeriodMonths: payload.billingPeriodMonths == null ? undefined : toNumber(payload.billingPeriodMonths, "Billing period months"),
    securityDepositMonths: payload.securityDepositMonths == null ? undefined : toNumber(payload.securityDepositMonths, "Security deposit months"),
    advanceRentMonths: payload.advanceRentMonths == null ? undefined : toNumber(payload.advanceRentMonths, "Advance rent months"),
    supportChargesId: payload.supportChargesId == null ? undefined : toNumber(payload.supportChargesId, "Support charges Id"),
    capacity: payload.capacity == null ? undefined : toNumber(payload.capacity, "Capacity"),
  };

  return Object.fromEntries(
    Object.entries(base).filter(([_, value]) => value !== undefined && value !== null && value !== "")
  ) as BookingCreatePayload;
}

export async function createAdminBooking(payload: BookingCreatePayload): Promise<BookingRecord> {
  const cleaned = normalizeBookingPayload(payload);

  return apiRequest<BookingRecord>(API_ENDPOINTS.booking.adminCreate, {
    method: "POST",
    requiresAuth: true,
    body: cleaned,
  });
}

export async function getBookings(): Promise<BookingRecord[]> {
  return apiRequest<BookingRecord[]>(API_ENDPOINTS.booking.list, {
    method: "GET",
    requiresAuth: true,
  });
}
