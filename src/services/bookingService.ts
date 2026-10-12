import { API_ENDPOINTS } from "../config/api";
import { ApiError, apiRequest } from "./apiClient";
import { openApiPdf } from "./pdfService";
import { sanitizeNotesInput, sanitizeEmailInput, sanitizeNameInput, sanitizePhoneInput, sanitizeTextForState } from "../utils/inputSanitizer";
import { isValidCnic, CNIC_ERROR } from "../utils/cnic";
import { isValidPhone, PHONE_ERROR } from "../utils/phone";

// ─── Staff (admin / sales executive) ──────────────────────────────────────────

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

export async function getBookingById(bookingId: number | string): Promise<BookingRecord | null> {
  return apiRequest<BookingRecord>(API_ENDPOINTS.booking.byId(bookingId), {
    method: "GET",
    requiresAuth: true,
  });
}

// ─── Customer: my bookings, challans, self-booking ────────────────────────────
// Mirrors the website (worknestpk.com) My Bookings: GET /booking/my, the bank challan per booking
// (GET /booking/{id}/challan + /challan-pdf) and cancel for Pending bookings only.
// Every amount shown comes from the API; the app never calculates what a customer owes.

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const textOrNull = (value: unknown): string | null => text(value) || null;

/** A number the API sent, or null (never a made-up 0 for a missing amount). */
function amountOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function idOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** First defined value among camelCase / PascalCase variants of a field. */
function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function listFrom(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  const p = (payload ?? {}) as Record<string, unknown>;
  for (const key of ["items", "results", "bookings", "data"]) {
    if (Array.isArray(p[key])) return p[key] as any[];
  }
  return [];
}

export type MyBooking = {
  /** Booking id (number): used for the challan, its PDF and cancel. */
  id: number;
  publicId: string | null;
  spaceName: string;
  spaceCode: string | null;
  spaceTypeName: string | null;
  locationName: string | null;
  /** Status label from the API (e.g. Pending, Confirmed, Cancelled). */
  status: string;
  statusCode: string | null;
  startOn: string | null;
  endOn: string | null;
  bookedOn: string | null;
  billingPeriodLabel: string | null;
  /** Amounts exactly as the API sent them (null when it sent none). */
  totalAmount: number | null;
  subtotalAmount: number | null;
  discountAmount: number | null;
  securityDeposit: number | null;
  challanNumber: string | null;
  challanValidUntil: string | null;
};

export function normalizeMyBooking(input: unknown): MyBooking {
  const raw = (input ?? {}) as Record<string, unknown>;
  const id = idOrNull(pick(raw, "bookingId", "BookingId", "id", "Id")) ?? 0;
  return {
    id,
    publicId: textOrNull(pick(raw, "bookingPublicId", "BookingPublicId", "publicId", "PublicId", "idGuid")),
    spaceName: text(pick(raw, "spaceName", "SpaceName", "workspaceName")) || (id ? `Booking #${id}` : "Booking"),
    spaceCode: textOrNull(pick(raw, "spaceCode", "SpaceCode")),
    spaceTypeName: textOrNull(pick(raw, "spaceTypeName", "SpaceTypeName")),
    locationName: textOrNull(pick(raw, "locationName", "LocationName")),
    status: text(pick(raw, "bookingStatusLabel", "BookingStatusLabel", "bookingStatus", "status")) || "Pending",
    statusCode: textOrNull(pick(raw, "bookingStatusCode", "BookingStatusCode")),
    startOn: textOrNull(pick(raw, "startOn", "StartOn", "startDateTime", "startDate")),
    endOn: textOrNull(pick(raw, "endOn", "EndOn", "endDateTime", "endDate")),
    bookedOn: textOrNull(pick(raw, "bookedOn", "BookedOn", "createdAt", "createdOn")),
    billingPeriodLabel: textOrNull(pick(raw, "billingPeriodLabel", "BillingPeriodLabel")),
    totalAmount: amountOrNull(pick(raw, "totalPayable", "TotalPayable", "totalAmount", "TotalAmount")),
    subtotalAmount: amountOrNull(pick(raw, "subtotalAmount", "SubtotalAmount")),
    discountAmount: amountOrNull(pick(raw, "discountAmount", "DiscountAmount")),
    securityDeposit: amountOrNull(pick(raw, "securityDeposit", "SecurityDeposit")),
    challanNumber: textOrNull(pick(raw, "challanNumber", "ChallanNumber")),
    challanValidUntil: textOrNull(pick(raw, "challanValidUntil", "ChallanValidUntil")),
  };
}

/** GET /booking/my — newest first. Throws a readable ApiError on failure (callers show an error state). */
export async function getMyBookings(): Promise<MyBooking[]> {
  const payload = await apiRequest<unknown>(API_ENDPOINTS.workspaces.myBookings, { requiresAuth: true });
  return listFrom(payload)
    .map(normalizeMyBooking)
    .sort((a, b) => b.id - a.id);
}

/** True for a booking still waiting for payment (status Pending). */
export function isPendingBooking(booking: Pick<MyBooking, "status" | "statusCode">): boolean {
  return [booking.status, booking.statusCode].some(v => text(v).toLowerCase() === "pending");
}

/** Customers may cancel a booking only while it is Pending (website rule); paid bookings go through the team. */
export function canCancelBooking(booking: Pick<MyBooking, "id" | "status" | "statusCode">): boolean {
  return booking.id > 0 && isPendingBooking(booking);
}

/**
 * PATCH /booking/{id}/cancel — cancels the customer's own Pending booking (its open challan is voided by the API).
 * Resolves with the API's message.
 */
export async function cancelMyBooking(
  booking: Pick<MyBooking, "id" | "status" | "statusCode">,
  reason?: string,
): Promise<string> {
  if (!canCancelBooking(booking)) {
    throw new ApiError("Only bookings that are still pending payment can be cancelled. Please contact us for help.", 400);
  }
  const payload = await apiRequest<{ message?: string }>(API_ENDPOINTS.workspaces.cancelBooking(booking.id), {
    method: "PATCH",
    requiresAuth: true,
    body: { cancelReason: reason ? sanitizeNotesInput(reason) : null },
    unwrapData: false,
  });
  return text(payload?.message) || "Booking cancelled.";
}

export type ChallanLine = {
  lineId: number | null;
  label: string;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  discountAmount: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  lineTotal: number | null;
};

/** A booking's bank challan (GET /booking/{id}/challan), amounts exactly as the API sent them. */
export type BookingChallan = {
  bookingId: number;
  bookingPublicId: string | null;
  challanNumber: string | null;
  issuedOn: string | null;
  validUntil: string | null;
  bookingStatus: string | null;
  bookingStatusCode: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerCompany: string | null;
  spaceName: string | null;
  spaceCode: string | null;
  spaceTypeName: string | null;
  locationName: string | null;
  branchName: string | null;
  startOn: string | null;
  endOn: string | null;
  billingPeriodLabel: string | null;
  billingPeriodMonths: number | null;
  monthlyRent: number | null;
  currentCycleAmount: number | null;
  securityDeposit: number | null;
  discountAmount: number | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalPayable: number | null;
  totalPaidAmount: number | null;
  balanceLeft: number | null;
  nextBillDueDate: string | null;
  lines: ChallanLine[];
};

export function normalizeChallan(input: unknown, bookingIdFallback?: number): BookingChallan {
  const raw = (input ?? {}) as Record<string, unknown>;
  const contract = (raw.contract ?? raw.Contract ?? {}) as Record<string, unknown>;
  const rawLines = Array.isArray(raw.details) ? raw.details : Array.isArray(raw.Details) ? raw.Details : [];
  return {
    bookingId: idOrNull(pick(raw, "bookingId", "BookingId")) ?? bookingIdFallback ?? 0,
    bookingPublicId: textOrNull(pick(raw, "bookingPublicId", "BookingPublicId")),
    challanNumber: textOrNull(pick(raw, "challanNumber", "ChallanNumber")),
    issuedOn: textOrNull(pick(raw, "issuedOn", "IssuedOn")),
    validUntil: textOrNull(pick(raw, "validUntil", "ValidUntil")),
    bookingStatus: textOrNull(pick(raw, "bookingStatusLabel", "BookingStatusLabel")),
    bookingStatusCode: textOrNull(pick(raw, "bookingStatusCode", "BookingStatusCode")),
    customerName: textOrNull(pick(raw, "customerName", "CustomerName")),
    customerEmail: textOrNull(pick(raw, "customerEmail", "CustomerEmail")),
    customerCompany: textOrNull(pick(raw, "customerCompany", "CustomerCompany")),
    spaceName: textOrNull(pick(raw, "spaceName", "SpaceName")),
    spaceCode: textOrNull(pick(raw, "spaceCode", "SpaceCode")),
    spaceTypeName: textOrNull(pick(raw, "spaceTypeName", "SpaceTypeName")),
    locationName: textOrNull(pick(raw, "locationName", "LocationName")),
    branchName: textOrNull(pick(raw, "branchName", "BranchName")),
    startOn: textOrNull(pick(raw, "startOn", "StartOn")),
    endOn: textOrNull(pick(raw, "endOn", "EndOn")),
    billingPeriodLabel: textOrNull(pick(raw, "billingPeriodLabel", "BillingPeriodLabel")),
    billingPeriodMonths: amountOrNull(pick(raw, "billingPeriodMonths", "BillingPeriodMonths")),
    monthlyRent: amountOrNull(pick(raw, "monthlyRent", "MonthlyRent")),
    currentCycleAmount: amountOrNull(pick(raw, "currentCycleAmount", "CurrentCycleAmount")),
    securityDeposit: amountOrNull(pick(raw, "securityDeposit", "SecurityDeposit")),
    discountAmount: amountOrNull(pick(raw, "discountAmount", "DiscountAmount")),
    subtotalAmount: amountOrNull(pick(raw, "subtotalAmount", "SubtotalAmount")),
    taxAmount: amountOrNull(pick(raw, "taxAmount", "TaxAmount") ?? pick(contract, "taxAmount", "TaxAmount")),
    totalPayable: amountOrNull(pick(raw, "totalPayable", "TotalPayable")),
    totalPaidAmount: amountOrNull(pick(raw, "totalPaidAmount", "TotalPaidAmount")),
    balanceLeft: amountOrNull(pick(raw, "balanceLeft", "BalanceLeft") ?? pick(contract, "balanceLeft", "BalanceLeft")),
    nextBillDueDate: textOrNull(
      pick(raw, "nextBillDueDate", "NextBillDueDate", "nextBillingDate", "NextBillingDate") ??
        pick(contract, "nextBillDueDate", "NextBillDueDate", "nextBillingDate", "NextBillingDate"),
    ),
    lines: rawLines.map((line: any) => {
      const l = (line ?? {}) as Record<string, unknown>;
      return {
        lineId: idOrNull(pick(l, "lineId", "LineId")),
        label: text(pick(l, "chargeTypeLabel", "ChargeTypeLabel", "description", "Description")) || "Charge",
        description: textOrNull(pick(l, "description", "Description")),
        quantity: amountOrNull(pick(l, "quantity", "Quantity")),
        unitPrice: amountOrNull(pick(l, "unitPrice", "UnitPrice")),
        discountAmount: amountOrNull(pick(l, "discountAmount", "DiscountAmount")),
        taxRate: amountOrNull(pick(l, "taxRate", "TaxRate")),
        taxAmount: amountOrNull(pick(l, "taxAmount", "TaxAmount")),
        lineTotal: amountOrNull(pick(l, "lineTotal", "LineTotal")),
      };
    }),
  };
}

/** GET /booking/{id}/challan — the customer's own booking only (the API checks it). */
export async function getBookingChallan(bookingId: number): Promise<BookingChallan> {
  if (!(bookingId > 0)) throw new ApiError("This booking has no challan yet.", 404);
  const payload = await apiRequest<unknown>(API_ENDPOINTS.booking.challan(bookingId), { requiresAuth: true });
  return normalizeChallan(payload, bookingId);
}

/** GET /booking/{id}/challan-pdf with the sign-in token, opened in the share / viewer sheet. */
export async function openBookingChallanPdf(bookingId: number, challanNumber?: string | null): Promise<void> {
  if (!(bookingId > 0)) throw new ApiError("This booking has no challan yet.", 404);
  await openApiPdf(API_ENDPOINTS.booking.challanPdf(bookingId), {
    fileName: `Challan-${challanNumber || bookingId}`,
    title: `WorkNest Challan ${challanNumber || `#${bookingId}`}`,
  });
}

/** Space categories the API's smart booking understands (WN_Bookings_InsertSmart). */
export type SmartBookingCategory = "SharedSpace" | "PrivateOffice" | "MeetingRoom";

/** The booking flow's mode → the API category code (same map as the staff portal checkout). */
export function categoryCodeForMode(mode: "shared" | "meeting" | "office"): SmartBookingCategory {
  if (mode === "office") return "PrivateOffice";
  if (mode === "shared") return "SharedSpace";
  return "MeetingRoom";
}

/** Customer details the API asks for the first time someone books (CustomerProfileRequired). */
export type BookingCustomerProfile = {
  firstName: string;
  lastName?: string;
  phoneNumber: string;
  cnicOrPassport?: string;
  address?: string;
  cityId?: number;
};

export type SmartBookingInput = {
  categoryCode: SmartBookingCategory;
  /** Local date-time, e.g. 2026-10-14T09:00:00. */
  startDateTime: string;
  endDateTime: string;
  capacity?: number;
  notes?: string;
  shiftType?: string;
  profile?: BookingCustomerProfile;
};

/** What the API returned for a new booking (WN_Bookings_Insert): ids, the challan and the amounts. */
export type CreatedBooking = {
  bookingId: number | null;
  bookingPublicId: string | null;
  challanNumber: string | null;
  challanValidUntil: string | null;
  subtotalAmount: number | null;
  discountAmount: number | null;
  taxAmount: number | null;
  securityDeposit: number | null;
  totalAmount: number | null;
  monthlyRent: number | null;
  billingPeriodMonths: number | null;
  assignedSpaceName: string | null;
};

/** The API needs the customer's details (first booking): ask for them and send the booking again with `profile`. */
export class CustomerProfileRequiredError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
    this.name = "CustomerProfileRequiredError";
  }
}

export function normalizeCreatedBooking(input: unknown): CreatedBooking {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    bookingId: idOrNull(pick(raw, "bookingId", "BookingId", "id", "Id")),
    bookingPublicId: textOrNull(pick(raw, "bookingPublicId", "BookingPublicId")),
    challanNumber: textOrNull(pick(raw, "challanNumber", "ChallanNumber")),
    challanValidUntil: textOrNull(pick(raw, "challanValidUntil", "ChallanValidUntil")),
    subtotalAmount: amountOrNull(pick(raw, "subtotalAmount", "SubtotalAmount")),
    discountAmount: amountOrNull(pick(raw, "discountAmount", "DiscountAmount")),
    taxAmount: amountOrNull(pick(raw, "taxAmount", "TaxAmount")),
    securityDeposit: amountOrNull(pick(raw, "securityDeposit", "SecurityDeposit")),
    totalAmount: amountOrNull(pick(raw, "totalAmount", "TotalAmount")),
    monthlyRent: amountOrNull(pick(raw, "monthlyRent", "MonthlyRent")),
    billingPeriodMonths: amountOrNull(pick(raw, "billingPeriodMonths", "BillingPeriodMonths")),
    assignedSpaceName: textOrNull(pick(raw, "assignedSpaceName", "AssignedSpaceName", "spaceName", "SpaceName")),
  };
}

function profileBody(profile?: BookingCustomerProfile): Record<string, unknown> {
  if (!profile) return {};
  const phone = text(profile.phoneNumber);
  if (!isValidPhone(phone)) throw new ApiError(PHONE_ERROR, 400);
  const cnic = text(profile.cnicOrPassport);
  if (cnic && !isValidCnic(cnic)) throw new ApiError(CNIC_ERROR, 400);
  return {
    firstName: sanitizeNameInput(profile.firstName, "First name"),
    lastName: profile.lastName ? sanitizeNameInput(profile.lastName, "Last name") : undefined,
    phoneNumber: sanitizePhoneInput(phone),
    cnicOrPassport: cnic ? cnic.replace(/[\s-]/g, "") : undefined,
    address: profile.address ? sanitizeNotesInput(profile.address) : undefined,
    cityId: profile.cityId,
  };
}

/** Turns the API's "CustomerProfileRequired" refusal into a typed error the booking screen can act on. */
function asProfileRequired(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const details = (error.details ?? {}) as Record<string, unknown>;
  const code = text(details.message ?? details.Message);
  if (code !== "CustomerProfileRequired" && error.message !== "CustomerProfileRequired") return error;
  const errors = (details.errors ?? details.Errors) as unknown;
  const first = Array.isArray(errors) ? text(errors[0]) : "";
  return new CustomerProfileRequiredError(
    first || "Please complete your customer profile details to book a space.",
    error.details,
  );
}

/**
 * POST /booking/smart — books a space of the chosen category; the API picks the space, prices it and issues
 * the bank challan. Resolves with the API's booking (show its challan next). Throws CustomerProfileRequiredError
 * when the API first needs the customer's details, or a readable ApiError otherwise.
 */
export async function createSmartBooking(input: SmartBookingInput): Promise<CreatedBooking> {
  const body = {
    categoryCode: input.categoryCode,
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
    capacity: input.capacity && input.capacity > 0 ? input.capacity : undefined,
    notes: input.notes ? sanitizeNotesInput(input.notes) : undefined,
    shiftType: input.shiftType || undefined,
    ...profileBody(input.profile),
  };
  try {
    const payload = await apiRequest<unknown>(API_ENDPOINTS.smartBooking.create, {
      method: "POST",
      requiresAuth: true,
      body,
    });
    const created = normalizeCreatedBooking(payload);
    if (!created.bookingId) {
      throw new ApiError("Your booking could not be confirmed. Please check My Bookings or try again.", 500, payload);
    }
    return created;
  } catch (error) {
    throw asProfileRequired(error);
  }
}

/**
 * POST /booking — books one specific space. Same result and errors as createSmartBooking.
 */
export async function createSpaceBooking(input: {
  spaceId: number;
  startDateTime: string;
  endDateTime: string;
  notes?: string;
  profile?: BookingCustomerProfile;
}): Promise<CreatedBooking> {
  const body = {
    spaceId: input.spaceId,
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
    notes: input.notes ? sanitizeNotesInput(input.notes) : undefined,
    ...profileBody(input.profile),
  };
  try {
    const payload = await apiRequest<unknown>(API_ENDPOINTS.workspaces.book, {
      method: "POST",
      requiresAuth: true,
      body,
    });
    const created = normalizeCreatedBooking(payload);
    if (!created.bookingId) {
      throw new ApiError("Your booking could not be confirmed. Please check My Bookings or try again.", 500, payload);
    }
    return created;
  } catch (error) {
    throw asProfileRequired(error);
  }
}
