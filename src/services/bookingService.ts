import { API_ENDPOINTS } from "../config/api";
import { ApiError, apiRequest } from "./apiClient";
import { openApiPdf } from "./pdfService";
import { sanitizeNotesInput, sanitizeEmailInput, sanitizeNameInput, sanitizePhoneInput, sanitizeTextForState } from "../utils/inputSanitizer";
import { isValidCnic, CNIC_ERROR } from "../utils/cnic";
import { isValidPhone, PHONE_ERROR } from "../utils/phone";
import { parseDate } from "../utils/format";
import { normalizeBreakdownFields, type BreakdownField } from "./amountBreakdown";
import { periodPrice } from "./workspaceService";

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
  // Amounts exactly as the API sent them (null when it sent none).
  /**
   * What the challan asks the customer to pay (`totalPayable`, the challan's TOTAL INITIAL AMOUNT PAYABLE).
   * Null when the API did not send it: show "See challan" then, never `totalAmount` (that is the booking's
   * rent value, not what is payable).
   */
  totalPayable: number | null;
  /** The booking's own amount (`totalAmount`). Not the amount payable: see totalPayable. */
  totalAmount: number | null;
  subtotalAmount: number | null;
  discountAmount: number | null;
  securityDeposit: number | null;
  /** Paid so far, when the API sends it (a booking with a payment can't be cancelled in the app). */
  totalPaidAmount: number | null;
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
    totalPayable: amountOrNull(pick(raw, "totalPayable", "TotalPayable")),
    totalAmount: amountOrNull(pick(raw, "totalAmount", "TotalAmount")),
    subtotalAmount: amountOrNull(pick(raw, "subtotalAmount", "SubtotalAmount")),
    discountAmount: amountOrNull(pick(raw, "discountAmount", "DiscountAmount")),
    securityDeposit: amountOrNull(pick(raw, "securityDeposit", "SecurityDeposit")),
    totalPaidAmount: paidAmountOf(raw),
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

/** Paid so far, from whichever paid-amount field the API sent (null when none). */
function paidAmountOf(raw: Record<string, unknown>): number | null {
  return amountOrNull(
    pick(raw, "totalPaidAmount", "TotalPaidAmount", "paidAmount", "PaidAmount", "amountPaid", "AmountPaid"),
  );
}

type StatusFields = { status?: string | null; statusCode?: string | null };

/** "No Show" / "no_show" / "NoShow" -> "noshow" (status labels and codes compared the same way). */
export function bookingStatusKey(value: unknown): string {
  return text(value).toLowerCase().replace(/[\s_-]+/g, "");
}

function statusKeys(booking: StatusFields): string[] {
  return [booking.status, booking.statusCode].map(bookingStatusKey).filter(Boolean);
}

/** True for a booking still waiting for payment (status Pending). */
export function isPendingBooking(booking: StatusFields): boolean {
  return statusKeys(booking).includes("pending");
}

/** Cancelled, rejected, no-show or expired: the booking will not go ahead (nothing to pay on it any more). */
export function isVoidBooking(booking: StatusFields): boolean {
  return statusKeys(booking).some(
    (k) =>
      k.includes("cancel") ||
      k.includes("reject") ||
      k.includes("noshow") ||
      k.includes("declin") ||
      k.includes("expire") ||
      k.includes("void"),
  );
}

/** Completed / ended by status (a booking whose end date has passed is also history, see isUpcomingBooking). */
export function isCompletedBooking(booking: StatusFields): boolean {
  return statusKeys(booking).some(
    (k) => k.includes("complet") || k.includes("terminat") || k === "ended" || k === "closed" || k === "checkedout",
  );
}

/**
 * My Bookings "Upcoming": not void (cancelled, rejected, no show), not completed, and not ended yet (a booking
 * without an end date, e.g. pending, counts as upcoming). Everything else is History.
 */
export function isUpcomingBooking(
  booking: StatusFields & { endOn?: string | null },
  now: number = Date.now(),
): boolean {
  if (isVoidBooking(booking) || isCompletedBooking(booking)) return false;
  const end = parseDate(booking.endOn ?? null);
  return !end || end.getTime() > now;
}

export type BookingSummary = { upcoming: number; completed: number; cancelled: number };

/** Profile counts, with the same rules as the My Bookings tabs (cancelled = cancelled, rejected or no show). */
export function summarizeBookings(
  bookings: Array<StatusFields & { endOn?: string | null }>,
  now: number = Date.now(),
): BookingSummary {
  return bookings.reduce<BookingSummary>(
    (acc, b) => {
      if (isUpcomingBooking(b, now)) acc.upcoming += 1;
      else if (isVoidBooking(b)) acc.cancelled += 1;
      else acc.completed += 1;
      return acc;
    },
    { upcoming: 0, completed: 0, cancelled: 0 },
  );
}

/** True when the API reports a payment on the booking (any paid amount above zero). */
export function hasPayment(booking: { totalPaidAmount?: number | null }): boolean {
  return (booking.totalPaidAmount ?? 0) > 0;
}

/**
 * A challan's last day to pay has passed. A date without a time ("2026-09-14" or "2026-09-14T00:00:00") is valid
 * until the end of that day; a date with a time until that moment. Unknown dates never count as expired.
 */
export function isChallanExpired(validUntil: string | null | undefined, now: Date = new Date()): boolean {
  const d = parseDate(validUntil ?? null);
  if (!d) return false;
  const midnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
  const expiresAt = midnight ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() : d.getTime();
  return now.getTime() >= expiresAt;
}

type ChallanFacts = StatusFields & {
  challanValidUntil?: string | null;
  totalPaidAmount?: number | null;
  totalPayable?: number | null;
};

/**
 * Where a booking's challan stands, from the API's booking status, its last day to pay and the payments it reports:
 *   "toPay"    Pending, not paid and still valid: show the last day to pay and how to pay
 *   "expired"  Pending and not paid, but the last day has passed: ask for a new challan, no payment instructions
 *   "void"     cancelled, rejected or no show: nothing to pay any more
 *   "settled"  paid (the API reports a payment covering it) or the booking is past Pending (confirmed...)
 */
export type ChallanStage = "toPay" | "expired" | "void" | "settled";

export function challanStage(booking: ChallanFacts, now: Date = new Date()): ChallanStage {
  if (isVoidBooking(booking)) return "void";
  if (!isPendingBooking(booking)) return "settled";
  if (hasPayment(booking)) {
    const payable = booking.totalPayable ?? null;
    if (payable === null || (booking.totalPaidAmount ?? 0) >= payable) return "settled";
  }
  return isChallanExpired(booking.challanValidUntil, now) ? "expired" : "toPay";
}

/** The customer still has this challan to pay (see challanStage). */
export function isChallanToPay(booking: ChallanFacts, now: Date = new Date()): boolean {
  return challanStage(booking, now) === "toPay";
}

/**
 * Customers may cancel a booking only while it is Pending and nothing has been paid on it (website rule); paid
 * bookings go through the team. The API enforces the same rule and its refusal message is shown as is.
 */
export function canCancelBooking(
  booking: Pick<MyBooking, "id" | "status" | "statusCode"> & { totalPaidAmount?: number | null },
): boolean {
  return booking.id > 0 && isPendingBooking(booking) && !hasPayment(booking);
}

/**
 * PATCH /booking/{id}/cancel — cancels the customer's own Pending booking (its open challan is voided by the API).
 * Resolves with the API's message. A refusal (e.g. a payment was received meanwhile) throws an ApiError carrying
 * the API's own message.
 */
export async function cancelMyBooking(
  booking: Pick<MyBooking, "id" | "status" | "statusCode"> & { totalPaidAmount?: number | null },
  reason?: string,
): Promise<string> {
  if (!canCancelBooking(booking)) {
    throw new ApiError("Only unpaid bookings that are still pending can be cancelled. Please contact us for help.", 400);
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
  customerAddress: string | null;
  spaceName: string | null;
  spaceNumber: string | null;
  spaceCapacity: number | null;
  spaceCode: string | null;
  spaceTypeName: string | null;
  locationName: string | null;
  branchName: string | null;
  startOn: string | null;
  endOn: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  numberOfMonths: number | null;
  bookedOn: string | null;
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
  /**
   * The API's amount breakdown (same as the challan PDF): its amount rows add up to totalPayable. Empty when the
   * API sent none (GET /booking/{id} has no breakdown).
   */
  fields: BreakdownField[];
  /** Ledger lines (accounting entries). They do not add up to the total payable: show `fields` instead. */
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
    customerCompany: textOrNull(pick(raw, "customerCompany", "CustomerCompany", "companyName", "CompanyName")),
    customerAddress: textOrNull(pick(raw, "customerAddress", "CustomerAddress")),
    spaceName: textOrNull(pick(raw, "spaceName", "SpaceName")),
    spaceNumber: textOrNull(pick(raw, "spaceNumber", "SpaceNumber") ?? pick(contract, "spaceNumber", "SpaceNumber")),
    spaceCapacity: amountOrNull(pick(raw, "spaceCapacity", "SpaceCapacity")),
    spaceCode: textOrNull(pick(raw, "spaceCode", "SpaceCode")),
    spaceTypeName: textOrNull(pick(raw, "spaceTypeName", "SpaceTypeName")),
    locationName: textOrNull(pick(raw, "locationName", "LocationName")),
    branchName: textOrNull(pick(raw, "branchName", "BranchName")),
    startOn: textOrNull(pick(raw, "startOn", "StartOn")),
    endOn: textOrNull(pick(raw, "endOn", "EndOn")),
    contractStartDate: textOrNull(pick(raw, "contractStartDate", "ContractStartDate") ?? pick(contract, "contractStartDate")),
    contractEndDate: textOrNull(pick(raw, "contractEndDate", "ContractEndDate") ?? pick(contract, "contractEndDate")),
    numberOfMonths: amountOrNull(pick(raw, "numberOfMonths", "NumberOfMonths") ?? pick(contract, "numberOfMonths")),
    bookedOn: textOrNull(pick(raw, "bookedOn", "BookedOn")),
    billingPeriodLabel: textOrNull(pick(raw, "billingPeriodLabel", "BillingPeriodLabel", "billingPeriod", "BillingPeriod")),
    billingPeriodMonths: amountOrNull(pick(raw, "billingPeriodMonths", "BillingPeriodMonths")),
    monthlyRent: amountOrNull(pick(raw, "monthlyRent", "MonthlyRent")),
    currentCycleAmount: amountOrNull(pick(raw, "currentCycleAmount", "CurrentCycleAmount")),
    securityDeposit: amountOrNull(pick(raw, "securityDeposit", "SecurityDeposit")),
    discountAmount: amountOrNull(pick(raw, "discountAmount", "DiscountAmount")),
    subtotalAmount: amountOrNull(pick(raw, "subtotalAmount", "SubtotalAmount")),
    taxAmount: amountOrNull(pick(raw, "taxAmount", "TaxAmount") ?? pick(contract, "taxAmount", "TaxAmount")),
    totalPayable: amountOrNull(pick(raw, "totalPayable", "TotalPayable")),
    totalPaidAmount: paidAmountOf(raw),
    balanceLeft: amountOrNull(pick(raw, "balanceLeft", "BalanceLeft") ?? pick(contract, "balanceLeft", "BalanceLeft")),
    nextBillDueDate: textOrNull(
      pick(raw, "nextBillDueDate", "NextBillDueDate", "nextBillingDate", "NextBillingDate") ??
        pick(contract, "nextBillDueDate", "NextBillDueDate", "nextBillingDate", "NextBillingDate"),
    ),
    fields: normalizeBreakdownFields(raw),
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

/**
 * GET /booking/{id} — full booking details (customer: own booking only), same shape as the challan.
 * Accepts the numeric id or the public id (GUID).
 */
export async function getBookingDetails(bookingId: number | string): Promise<BookingChallan> {
  const payload = await apiRequest<unknown>(API_ENDPOINTS.booking.byId(bookingId), { requiresAuth: true });
  const numeric = Number(bookingId);
  return normalizeChallan(payload, Number.isFinite(numeric) && numeric > 0 ? numeric : undefined);
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

/** Spaces still free for a period (GET /booking/smart/available), with the API's listed prices. */
export type SmartAvailability = {
  /** How many spaces of the category (at the location) are free for the whole period and can be booked (priced). */
  count: number;
  /** Free spaces without a listed price for the period: they can't be booked in the app. */
  unpricedCount: number;
  /**
   * Listed price per billing period of the space a booking for this period gets (the first bookable one, smallest
   * first, as the API assigns it): a private office's whole-office price, otherwise the seat price. Null when none.
   */
  price: number | null;
  /** Seats of that space (private offices are priced per office). */
  seats: number | null;
  /** Lowest listed price per billing period among the bookable spaces (same rule as `price`). */
  fromPrice: number | null;
  billingPeriodCode: string | null;
  securityDeposit: number | null;
};

/** The booking period a category is charged by: offices and shared desks monthly, meeting rooms hourly. */
function bookingPeriodOf(categoryCode: string): string {
  return /^(privateoffice|sharedspace)$/i.test(categoryCode) ? "monthly" : "hourly";
}

/**
 * GET /booking/smart/available — is a space of this category free for the period at this location? Public endpoint
 * (works for guests). Only spaces with a price for the booking period count (the API's Bookable flag; older APIs:
 * a price of the category's period). Throws a readable ApiError on failure.
 */
export async function getSmartAvailability(input: {
  categoryCode: string;
  startOn: string;
  endOn: string;
  capacity?: number;
  shiftType?: string;
  /** The card's location (WN_Locations.Id): only its spaces are counted. */
  locationId?: number;
}): Promise<SmartAvailability> {
  const params = new URLSearchParams();
  params.set("categoryCode", input.categoryCode);
  params.set("startOn", input.startOn);
  params.set("endOn", input.endOn);
  if (input.capacity && input.capacity > 0) params.set("capacity", String(input.capacity));
  if (input.shiftType) params.set("shiftType", input.shiftType);
  if (input.locationId && input.locationId > 0) params.set("locationId", String(input.locationId));
  const payload = await apiRequest<unknown>(`${API_ENDPOINTS.workspaces.smartAvailable}?${params.toString()}`, {
    requiresAuth: true,
  });
  let rows = listFrom(payload) as Array<Record<string, unknown>>;
  // An API without the location filter answers for every location: keep the card's location only.
  if (input.locationId && input.locationId > 0) {
    rows = rows.filter((r) => {
      const loc = idOrNull(pick(r, "locationId", "LocationId"));
      return loc === null || loc === input.locationId;
    });
  }
  const period = bookingPeriodOf(input.categoryCode);
  const priceOf = (r: Record<string, unknown>) =>
    periodPrice({
      categoryCode: textOrNull(pick(r, "categoryCode", "CategoryCode")) ?? input.categoryCode,
      seatPrice: amountOrNull(pick(r, "seatPrice", "SeatPrice")),
      roomPrice: amountOrNull(pick(r, "roomPrice", "RoomPrice")),
      capacity: amountOrNull(pick(r, "capacity", "Capacity")),
    });
  const bookable = rows.filter((r) => {
    const flag = pick(r, "bookable", "Bookable");
    const ok =
      typeof flag === "boolean"
        ? flag
        : text(pick(r, "billingPeriodCode", "BillingPeriodCode")).toLowerCase() === period;
    return ok && priceOf(r) > 0;
  });
  const prices = bookable.map(priceOf);
  const first = bookable[0] ?? {};
  return {
    count: bookable.length,
    unpricedCount: rows.length - bookable.length,
    price: bookable.length ? priceOf(first) : null,
    seats: bookable.length ? amountOrNull(pick(first, "capacity", "Capacity")) : null,
    fromPrice: prices.length ? Math.min(...prices) : null,
    billingPeriodCode: textOrNull(pick(first, "billingPeriodCode", "BillingPeriodCode")),
    securityDeposit: amountOrNull(pick(first, "securityDeposit", "SecurityDeposit")),
  };
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
  /** The space category code from GET /space/available (preferred), or categoryCodeForMode(...). */
  categoryCode: SmartBookingCategory | (string & {});
  /** The card's location (WN_Locations.Id): the API books a space of this location only. */
  locationId?: number;
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
  /** The API returned the same booking made a moment ago (sent again, e.g. after a time-out): nothing new was booked. */
  duplicate: boolean;
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
    duplicate: (() => {
      const flag = pick(raw, "isDuplicate", "IsDuplicate");
      return flag === true || flag === 1 || flag === "true";
    })(),
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
 * How long the app waits for POST /booking/smart (it creates the booking, its invoice and challan; 20 s was not
 * always enough, and a time-out tempted customers to book twice).
 */
export const SMART_BOOKING_TIMEOUT_MS = 60000;

/**
 * True when a booking request failed in a way that does not tell whether the booking was made: no answer (time-out,
 * connection lost) or a gateway error. The customer must check My Bookings before trying again.
 */
export function bookingOutcomeUnknown(error: unknown): boolean {
  if (!(error instanceof ApiError) || error instanceof CustomerProfileRequiredError) return false;
  return error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504;
}

export const BOOKING_OUTCOME_UNKNOWN_MESSAGE =
  "We could not confirm whether your booking was made. Check My Bookings before trying again.";

/** "2026-10-14T09:00:00", "2026-10-14 09:00" ... -> "2026-10-14T09:00" (for comparing booking periods). */
function minuteKey(value: string | null | undefined): string {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(String(value ?? "").trim());
  if (m) return `${m[1]}T${m[2]}:${m[3]}`;
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(String(value ?? "").trim());
  return dateOnly ? `${dateOnly[1]}T00:00` : "";
}

/**
 * After a booking request with no answer: the customer's own booking for exactly this period, if the API made it
 * (newest first; never a cancelled or rejected one). Null when there is none. Throws when My Bookings can't be read.
 */
export async function findBookingForPeriod(input: {
  startDateTime: string;
  endDateTime: string;
  locationName?: string | null;
}): Promise<MyBooking | null> {
  const start = minuteKey(input.startDateTime);
  const end = minuteKey(input.endDateTime);
  if (!start || !end) return null;
  const location = (input.locationName ?? "").trim().toLowerCase();
  const bookings = await getMyBookings();
  return (
    bookings.find((b) => {
      const status = `${b.status} ${b.statusCode ?? ""}`.toLowerCase();
      if (/cancel|reject|no.?show/.test(status)) return false;
      if (minuteKey(b.startOn) !== start || minuteKey(b.endOn) !== end) return false;
      return !location || !b.locationName || b.locationName.trim().toLowerCase() === location;
    }) ?? null
  );
}

/**
 * POST /booking/smart — books a space of the chosen category at the chosen location; the API picks the space,
 * prices it and issues the bank challan. Resolves with the API's booking (show its challan next; `duplicate` when
 * the API returned the same booking made a moment ago). Throws CustomerProfileRequiredError when the API first needs
 * the customer's details, or a readable ApiError otherwise (see bookingOutcomeUnknown for a time-out).
 */
export async function createSmartBooking(input: SmartBookingInput): Promise<CreatedBooking> {
  const body = {
    categoryCode: input.categoryCode,
    locationId: input.locationId && input.locationId > 0 ? input.locationId : undefined,
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
      timeoutMs: SMART_BOOKING_TIMEOUT_MS,
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
