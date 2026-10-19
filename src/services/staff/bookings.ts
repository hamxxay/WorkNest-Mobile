import { STAFF_ENDPOINTS } from "./endpoints";
import {
  actionResult,
  downloadStaffFile,
  staffGet,
  staffPatch,
  staffPost,
  staffPut,
  type ActionResult,
  type DownloadedFile,
} from "./http";
import { listFilterQuery, type ListFilters } from "./listFilters";
import { num, optNum, optStr, pick, str, toList, toPage, unwrapEnvelope, withQuery, type Page } from "./normalize";

// Bookings (CMS admin.service.ts getBookings / updateBookingStatus / reassignBooking / createAdminBooking,
// booking.service.ts; API BookingController). Roles: list, status, reassign, edit: admin, super admin, sales
// executive (StaffRoles; the CMS gives sales executives the same Bookings page with the status menu).
// Admins / sales executives only get bookings at their locations ([RecordScope]: 404 for others).
//
// API facts the screens rely on:
//   - The list is { data, total }; search, locationId and the list filters (status = a WN_BookingStatuses id from
//     GET booking/statuses, from / to = start date; ./listFilters) are applied on the server.
//   - Status arrives as bookingStatusCode / bookingStatusLabel strings (no numeric id in the row).
//   - Staff change status with PATCH booking/{id}/status { statusId }; any status can go to any other.
//     Staff cancel = status 86. PATCH booking/{id}/cancel is the customer's own cancel (the API checks the
//     caller's email against the booking owner), so staff never call it.
//   - There is no booking/{id}/details route: details = GET booking/{id}. It lacks fields the list row has
//     (customerCompany, spaceTypeId, and on older APIs challanNumber / challanValidUntil): getBooking fills them
//     from GET booking/{id}/row.
//   - companyName is the vendor company (WorkNest's own branch company), never the customer's: the customer's
//     company is customerCompany.

/** Booking status ids the CMS status menu sends (manage.ts bookings config). */
export const BOOKING_STATUS = {
  pending: 5,
  confirmed: 33,
  noShow: 6,
  rejected: 3,
  cancelled: 86,
} as const;

export type BookingStatusId = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

/** The CMS status menu, in its order. */
export const BOOKING_STATUS_OPTIONS: { id: BookingStatusId; label: string }[] = [
  { id: BOOKING_STATUS.pending, label: "Pending" },
  { id: BOOKING_STATUS.confirmed, label: "Confirmed" },
  { id: BOOKING_STATUS.noShow, label: "No Show" },
  { id: BOOKING_STATUS.rejected, label: "Rejected" },
  { id: BOOKING_STATUS.cancelled, label: "Cancelled" },
];

/** Status id for a status label / code ("Confirmed", "no show", "cancelled", ...); null when unknown. */
export function bookingStatusIdFromLabel(label: string | null | undefined): BookingStatusId | null {
  const key = (label ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  switch (key) {
    case "pending":
    case "pendingconfirmation":
      return BOOKING_STATUS.pending;
    case "confirmed":
    case "active":
      return BOOKING_STATUS.confirmed;
    case "noshow":
      return BOOKING_STATUS.noShow;
    case "rejected":
      return BOOKING_STATUS.rejected;
    case "cancelled":
    case "canceled":
      return BOOKING_STATUS.cancelled;
    default:
      return null;
  }
}

export type StaffBooking = {
  bookingId: number;
  bookingPublicId: string | null;
  customerName: string;
  customerEmail: string | null;
  userName: string | null;
  userEmail: string | null;
  /** The customer's company (customerCompany; the row's companyName is WorkNest's own). */
  companyName: string | null;
  spaceId: number | null;
  spaceName: string;
  spaceCode: string | null;
  /** Space type id (list row and booking/{id}/row); space codes are not unique across types. */
  spaceTypeId: number | null;
  spaceTypeName: string | null;
  spaceCapacity: number | null;
  locationId: number | null;
  locationName: string | null;
  startOn: string | null;
  endOn: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  statusCode: string | null;
  statusLabel: string;
  /** From the label (the row carries no numeric status). */
  statusId: BookingStatusId | null;
  challanNumber: string | null;
  challanValidUntil: string | null;
  billingPeriodLabel: string | null;
  numberOfMonths: number | null;
  monthlyRent: number;
  securityDeposit: number;
  totalAmount: number;
  totalPaidAmount: number;
  balanceLeft: number;
  nextBillDueDate: string | null;
  bookedOn: string | null;
};

export function normalizeBooking(raw: any): StaffBooking {
  const statusLabel = str(raw, "bookingStatusLabel", "bookingStatus", "statusLabel", "status", "bookingStatusCode");
  return {
    bookingId: num(raw, "bookingId", "id"),
    bookingPublicId: optStr(raw, "bookingPublicId", "publicId", "idGuid"),
    customerName: str(raw, "customerName", "userName", "customerEmail", "userEmail"),
    customerEmail: optStr(raw, "customerEmail", "userEmail"),
    userName: optStr(raw, "userName"),
    userEmail: optStr(raw, "userEmail"),
    companyName: optStr(raw, "customerCompany"),
    spaceId: optNum(raw, "spaceId"),
    spaceName: str(raw, "spaceName"),
    spaceCode: optStr(raw, "spaceCode"),
    spaceTypeId: optNum(raw, "spaceTypeId"),
    spaceTypeName: optStr(raw, "spaceTypeName"),
    spaceCapacity: optNum(raw, "spaceCapacity"),
    locationId: optNum(raw, "locationId"),
    locationName: optStr(raw, "locationName"),
    startOn: optStr(raw, "startOn", "startDateTime"),
    endOn: optStr(raw, "endOn", "endDateTime"),
    contractStartDate: optStr(raw, "contractStartDate"),
    contractEndDate: optStr(raw, "contractEndDate"),
    statusCode: optStr(raw, "bookingStatusCode"),
    statusLabel,
    statusId: bookingStatusIdFromLabel(statusLabel) ?? bookingStatusIdFromLabel(optStr(raw, "bookingStatusCode")),
    challanNumber: optStr(raw, "challanNumber"),
    challanValidUntil: optStr(raw, "challanValidUntil"),
    billingPeriodLabel: optStr(raw, "billingPeriodLabel"),
    numberOfMonths: optNum(raw, "numberOfMonths"),
    monthlyRent: num(raw, "monthlyRent"),
    securityDeposit: num(raw, "securityDeposit"),
    totalAmount: num(raw, "totalAmount", "totalPayable"),
    totalPaidAmount: num(raw, "totalPaidAmount"),
    balanceLeft: num(raw, "balanceLeft"),
    nextBillDueDate: optStr(raw, "nextBillDueDate"),
    bookedOn: optStr(raw, "bookedOn"),
  };
}

/** GET booking?page=&limit=&search=&locationId= — search: customer / user name or email, space, challan number. */
export async function listBookings(
  query: { page?: number; limit?: number; search?: string } & Partial<ListFilters> = {},
): Promise<Page<StaffBooking>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.bookings.list, {
      page,
      limit,
      search: query.search?.trim(),
      ...listFilterQuery(query),
    }),
  );
  return toPage(raw, normalizeBooking, { page, limit });
}

export type BookingDetailLine = Record<string, any>;

export type StaffBookingDetail = StaffBooking & {
  customerAddress: string | null;
  spaceNumber: string | null;
  locationAddress: string | null;
  cityName: string | null;
  branchName: string | null;
  billingPeriod: string | null;
  billingPeriodMonths: number | null;
  currentCycleAmount: number;
  firstCycleRent: number;
  totalContractAmount: number;
  totalPayable: number;
  nextBillingDate: string | null;
  offeringType: string | null;
  details: BookingDetailLine[];
};

/** `detail` with the fields it lacks (null / missing) taken from `row`; the detail's own values win. */
export function mergeBookingRow(detail: Record<string, any> | null | undefined, row: Record<string, any> | null | undefined): Record<string, any> {
  const d = detail ?? {};
  if (!row) return d;
  const merged: Record<string, any> = { ...row };
  for (const [key, value] of Object.entries(d)) {
    if (value != null && value !== "") merged[key] = value;
  }
  return merged;
}

/**
 * GET booking/{id} — booking details (ApiResponse), completed with GET booking/{id}/row (customer company, space
 * type id, challan number and validity) when that answers; the row is optional.
 */
export async function getBooking(id: number | string): Promise<StaffBookingDetail> {
  const [detail, row] = await Promise.all([
    staffGet(STAFF_ENDPOINTS.bookings.byId(id)),
    staffGet(STAFF_ENDPOINTS.bookings.row(id)).catch(() => null),
  ]);
  const d = mergeBookingRow(unwrapEnvelope<any>(detail), row ? unwrapEnvelope<any>(row) : null);
  return {
    ...normalizeBooking(d),
    customerAddress: optStr(d, "customerAddress"),
    spaceNumber: optStr(d, "spaceNumber"),
    locationAddress: optStr(d, "locationAddress"),
    cityName: optStr(d, "cityName"),
    branchName: optStr(d, "branchName"),
    billingPeriod: optStr(d, "billingPeriod"),
    billingPeriodMonths: optNum(d, "billingPeriodMonths"),
    currentCycleAmount: num(d, "currentCycleAmount"),
    firstCycleRent: num(d, "firstCycleRent"),
    totalContractAmount: num(d, "totalContractAmount"),
    totalPayable: num(d, "totalPayable"),
    nextBillingDate: optStr(d, "nextBillingDate"),
    offeringType: optStr(d, "offeringType"),
    details: Array.isArray(pick(d, "details")) ? pick(d, "details") : [],
  };
}

/** GET booking/{id}/row — the booking in list-row shape (e.g. after an agreement created it). */
export async function getBookingRow(id: number | string): Promise<StaffBooking> {
  return normalizeBooking(unwrapEnvelope(await staffGet(STAFF_ENDPOINTS.bookings.row(id))));
}

/**
 * GET booking/{id}/billing-summary — the booking's challan view (ChallanResponseDto: challan number, validity,
 * charge lines, totals). Passed through; stage 2 types the fields its screen shows.
 */
export async function getBookingBillingSummary(id: number | string): Promise<Record<string, any>> {
  return unwrapEnvelope<Record<string, any>>(await staffGet(STAFF_ENDPOINTS.bookings.billingSummary(id))) ?? {};
}

/** PATCH booking/{id}/status { statusId } */
export async function updateBookingStatus(id: number | string, statusId: BookingStatusId): Promise<ActionResult> {
  const raw = await staffPatch(STAFF_ENDPOINTS.bookings.status(id), { statusId });
  return actionResult(raw, "Booking status updated.");
}

/** Staff cancel: status Cancelled (86), as the CMS does. */
export function cancelBooking(id: number | string): Promise<ActionResult> {
  return updateBookingStatus(id, BOOKING_STATUS.cancelled);
}

/** PUT booking/{id} { startDateTime?, endDateTime?, notes? } */
export async function updateBooking(
  id: number | string,
  changes: { startDateTime?: string; endDateTime?: string; notes?: string },
): Promise<ActionResult> {
  const raw = await staffPut(STAFF_ENDPOINTS.bookings.update(id), changes);
  return actionResult(raw, "Booking updated.");
}

export type ReassignmentSpace = {
  id: number;
  publicId: string | null;
  code: string | null;
  name: string;
  locationId: number | null;
  locationName: string | null;
  capacity: number;
  seatPrice: number;
  roomPrice: number;
};

/** GET booking/available-spaces-reassignment — free spaces of the type for the dates (excluding this booking). */
export async function getReassignmentSpaces(query: {
  spaceTypeId: number;
  startOn: string;
  endOn: string;
  excludeBookingId?: number;
}): Promise<ReassignmentSpace[]> {
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.bookings.reassignmentSpaces, {
      spaceTypeId: query.spaceTypeId,
      startOn: query.startOn,
      endOn: query.endOn,
      excludeBookingId: query.excludeBookingId,
    }),
  );
  return toList(raw, (s) => ({
    id: num(s, "id"),
    publicId: optStr(s, "publicId"),
    code: optStr(s, "code"),
    name: str(s, "name"),
    locationId: optNum(s, "locationId"),
    locationName: optStr(s, "locationName"),
    capacity: num(s, "capacity"),
    seatPrice: num(s, "seatPrice"),
    roomPrice: num(s, "roomPrice"),
  }));
}

/**
 * The space type to reassign a booking within: the booking's own spaceTypeId; without it, the type of its
 * space in `spaces` (by space id, else by code at the same location — codes repeat across space types).
 */
export function bookingSpaceTypeId(
  booking: Pick<StaffBooking, "spaceTypeId" | "spaceId" | "spaceCode" | "spaceName" | "locationId" | "locationName">,
  spaces: { id: number; code: string | null; name: string; spaceTypeId: number | null; locationId: number | null; locationName: string | null }[] = [],
): number | null {
  if (booking.spaceTypeId && booking.spaceTypeId > 0) return booking.spaceTypeId;
  const sameLocation = (s: (typeof spaces)[number]) =>
    booking.locationId != null && s.locationId != null
      ? s.locationId === booking.locationId
      : !!booking.locationName && s.locationName === booking.locationName;
  const match =
    (booking.spaceId ? spaces.find((s) => s.id === booking.spaceId) : undefined) ??
    spaces.find((s) => sameLocation(s) && !!booking.spaceCode && s.code === booking.spaceCode && s.name === booking.spaceName) ??
    spaces.find((s) => sameLocation(s) && s.name === booking.spaceName);
  return match?.spaceTypeId && match.spaceTypeId > 0 ? match.spaceTypeId : null;
}

/** PATCH booking/{id}/reassign { newSpaceId } (the server picks the pricing). */
export async function reassignBooking(id: number | string, newSpaceId: number): Promise<ActionResult> {
  const raw = await staffPatch(STAFF_ENDPOINTS.bookings.reassign(id), { newSpaceId });
  return actionResult(raw, "Booking reassigned.");
}

/** GET booking/calendar?spaceId=&year=&month= — booked dates (yyyy-MM-dd) of a space in a month. */
export async function getBookedDates(spaceId: number | string, year: number, month: number): Promise<string[]> {
  const data = unwrapEnvelope<any>(await staffGet(withQuery(STAFF_ENDPOINTS.bookings.calendar, { spaceId, year, month })));
  const dates = pick(data, "bookedDates");
  return Array.isArray(dates) ? dates.map(String) : [];
}

/** POST booking/{id}/send-challan-email (the server builds the challan PDF). */
export async function emailBookingChallan(id: number | string): Promise<ActionResult> {
  const raw = await staffPost(STAFF_ENDPOINTS.bookings.sendChallanEmail(id), { pdfBase64: "" });
  return actionResult(raw, "Challan emailed.");
}

/** GET booking/{id}/challan-pdf, downloaded with the login token. */
export function downloadBookingChallanPdf(id: number | string, challanNumber?: string | null): Promise<DownloadedFile> {
  return downloadStaffFile(STAFF_ENDPOINTS.bookings.challanPdf(id), {
    fileName: `Challan-${challanNumber || id}.pdf`,
    mimeType: "application/pdf",
  });
}

// ─── Staff booking (create-admin) ─────────────────────────────────────────────────────────────────────────

export type StaffBookingInput = {
  /** The customer's user: id, or an email (the API creates / links the user). */
  userId?: number | null;
  customerEmail?: string | null;
  customerName?: string | null;
  phone?: string | null;
  spaceId: number;
  floorId?: number | null;
  offeringTypeId?: number | null;
  offeringType?: string | null;
  /** "yyyy-MM-ddTHH:mm:ss" */
  startDateTime: string;
  endDateTime: string;
  capacity?: number | null;
  discountType?: "Percentage" | "Amount";
  discountValue?: number;
  perSeatBasePrice?: number | null;
  securityDepositOverride?: number | null;
  billingPeriodMonths?: number | null;
  securityDepositMonths?: number | null;
  notes?: string;
};

export type CreatedBooking = {
  bookingId: number;
  bookingPublicId: string | null;
  challanNumber: string | null;
  challanValidUntil: string | null;
  totalAmount: number;
  monthlyRent: number;
};

/**
 * POST booking/create-admin (admin, super admin, sales executive). Needs the space and the customer (userId or
 * customerEmail). The phone goes in `phone` (the CMS sends customerPhone, which the API ignores).
 */
export async function createStaffBooking(input: StaffBookingInput): Promise<ActionResult<CreatedBooking>> {
  if (!(input.spaceId > 0)) throw new Error("Choose the space.");
  if (!(input.userId && input.userId > 0) && !input.customerEmail?.trim()) throw new Error("Choose the customer.");
  const discount = Number(input.discountValue) || 0;
  const raw = await staffPost(STAFF_ENDPOINTS.bookings.createAdmin, {
    userId: input.userId && input.userId > 0 ? input.userId : null,
    customerEmail: input.customerEmail?.trim() || null,
    customerName: input.customerName?.trim() || null,
    phone: input.phone?.trim() || null,
    spaceId: input.spaceId,
    floorId: input.floorId && input.floorId > 0 ? input.floorId : null,
    offeringTypeId: input.offeringTypeId ?? null,
    offeringType: input.offeringType ?? "24/7",
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
    capacity: input.capacity ?? null,
    discountType: input.discountType ?? "Percentage",
    discountPercentage: (input.discountType ?? "Percentage") === "Percentage" ? discount : 0,
    discountValue: discount,
    perSeatBasePrice: input.perSeatBasePrice ?? null,
    securityDepositOverride: input.securityDepositOverride ?? null,
    billingPeriodMonths: input.billingPeriodMonths ?? null,
    securityDepositMonths: input.securityDepositMonths ?? null,
    notes: input.notes?.trim() || null,
  });
  const result = actionResult<any>(raw, "Booking created.");
  const d = result.data ?? {};
  const failure = optStr(d, "errorMessage");
  if (failure) throw new Error(failure);
  return {
    message: result.message,
    data: {
      bookingId: num(d, "bookingId"),
      bookingPublicId: optStr(d, "bookingPublicId"),
      challanNumber: optStr(d, "challanNumber"),
      challanValidUntil: optStr(d, "challanValidUntil"),
      totalAmount: num(d, "totalAmount"),
      monthlyRent: num(d, "monthlyRent"),
    },
  };
}
