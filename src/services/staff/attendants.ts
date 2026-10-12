import type { StaffRole } from "../../context/roles";
import { cnicError } from "../../utils/cnic";
import { phoneError } from "../../utils/phone";
import { STAFF_ENDPOINTS } from "./endpoints";
import {
  actionResult,
  staffDelete,
  staffGet,
  staffPatch,
  staffPost,
  staffPut,
  type ActionResult,
} from "./http";
import { bool, isApiDate, num, optNum, optStr, pick, str, toList, unwrapEnvelope, utcIso, withQuery } from "./normalize";

// Attendants & Access (CMS admin.service.ts attendants / capacity requests / access suspension and
// pages/admin/attendant-management; API AttendantController). Roles: every staff role; admins / sales
// executives only reach bookings and customers at their locations (404 otherwise).
//
// Room capacity rule (the product rule, enforced by the API):
//   - Room has a free seat -> anyone assigns the person directly.
//   - Room is full:
//       sales executive -> asks an admin: POST bookings/{id}/capacity-requests (the API refuses a direct add with
//                          "... is full ... Only an admin can add more people to this room.")
//       admin / super admin -> private office: may overfill after confirming the surcharge (half a seat price per
//                          extra person, invoiced and emailed); meeting room / shared space: never.
//   - Admins approve / reject requests (GET capacity-requests, POST .../approve | reject); the requester or an
//     admin may withdraw one (POST .../cancel).
// Most responses here are plain objects / arrays, not ApiResponse envelopes.

// ─── People ───────────────────────────────────────────────────────────────────────────────────────────────

export type IdType = "CNIC" | "Passport";

export type CustomerAttendant = {
  customerAttendantId: number | null;
  personId: number;
  personGuid: string | null;
  name: string;
  email: string;
  phone: string;
  idType: IdType;
  idNumber: string;
  customerId: number;
  isActive: boolean;
  createdAt: string | null;
};

const toIdType = (value: unknown): IdType => (String(value ?? "").toLowerCase() === "passport" ? "Passport" : "CNIC");

export function normalizeCustomerAttendant(raw: any): CustomerAttendant {
  return {
    customerAttendantId: optNum(raw, "customerAttendantId"),
    personId: num(raw, "personId"),
    personGuid: optStr(raw, "personGuid"),
    name: str(raw, "name"),
    email: str(raw, "email"),
    phone: str(raw, "phone"),
    idType: toIdType(pick(raw, "idType")),
    idNumber: str(raw, "idNumber"),
    customerId: num(raw, "customerId"),
    isActive: raw?.isActive == null && raw?.IsActive == null ? true : bool(raw, "isActive"),
    createdAt: optStr(raw, "createdAt"),
  };
}

/** GET customers/{customerId}/attendants — the customer's people (active only, A-Z). */
export async function getCustomerAttendants(customerId: number): Promise<CustomerAttendant[]> {
  return toList(await staffGet(STAFF_ENDPOINTS.customers.attendants(customerId)), normalizeCustomerAttendant);
}

export type BookedSpace = {
  bookingDetailId: number;
  bookingGuid: string | null;
  spaceName: string;
  spaceCode: string | null;
  spaceCategory: string;
  startDateTime: string | null;
  endDateTime: string | null;
  capacity: number;
  activeAttendantsCount: number;
};

/**
 * GET customers/{customerId}/active-spaces — the customer's booked spaces (booking detail rows). Note: the API
 * returns every non-deleted booking detail, ended ones included; filter on endDateTime when needed.
 */
export async function getCustomerBookedSpaces(customerId: number): Promise<BookedSpace[]> {
  return toList(await staffGet(STAFF_ENDPOINTS.customers.activeSpaces(customerId)), (s) => ({
    bookingDetailId: num(s, "bookingDetailId"),
    bookingGuid: optStr(s, "bookingGuid"),
    spaceName: str(s, "spaceName") || "Dedicated Space",
    spaceCode: optStr(s, "spaceCode"),
    spaceCategory: str(s, "spaceCategory") || "Private Office",
    startDateTime: optStr(s, "startDateTime"),
    endDateTime: optStr(s, "endDateTime"),
    capacity: num(s, "capacity") || 1,
    activeAttendantsCount: num(s, "activeAttendantsCount"),
  }));
}

/** A booked space is current until the end of its end date (the API also returns ended ones). */
export function isCurrentBookedSpace(space: Pick<BookedSpace, "endDateTime">, today: Date = new Date()): boolean {
  if (!space.endDateTime) return true;
  const end = new Date(space.endDateTime.length === 10 ? `${space.endDateTime}T00:00:00` : space.endDateTime);
  if (isNaN(end.getTime())) return true;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() >= startOfToday;
}

export type RoomAttendant = {
  id: number | null;
  bookingDetailId: number;
  personId: number;
  personGuid: string | null;
  customerId: number;
  name: string;
  email: string;
  phone: string;
  idType: IdType;
  idNumber: string;
  assignedFrom: string | null;
  assignedTo: string | null;
  /** Door access on / off for this person. */
  isEnabled: boolean;
  isOverCapacity: boolean;
  excessSeatCount: number;
  surchargeApplied: number | null;
  /** Machine operations still queued for this person. */
  hikPendingOps: number;
  /** Mobile app door unlock, when set up. */
  appAccess: { accountEmail: string | null; isActive: boolean; lastUnlockAt: string | null; unlockCount: number } | null;
};

/** GET bookings/{bookingDetailId}/attendants — people currently assigned to the booked space. */
export async function getRoomAttendants(bookingDetailId: number): Promise<RoomAttendant[]> {
  return toList(await staffGet(STAFF_ENDPOINTS.attendants.byBooking(bookingDetailId)), (a) => {
    const app = pick(a, "appAccess");
    return {
      id: optNum(a, "id"),
      bookingDetailId: num(a, "bookingDetailId") || bookingDetailId,
      personId: num(a, "personId"),
      personGuid: optStr(a, "personGuid"),
      customerId: num(a, "customerId"),
      name: str(a, "name"),
      email: str(a, "email"),
      phone: str(a, "phone"),
      idType: toIdType(pick(a, "idType")),
      idNumber: str(a, "idNumber"),
      assignedFrom: optStr(a, "assignedFrom"),
      assignedTo: optStr(a, "assignedTo"),
      isEnabled: a?.isEnabled == null && a?.IsEnabled == null ? true : bool(a, "isEnabled"),
      isOverCapacity: bool(a, "isOverCapacity"),
      excessSeatCount: num(a, "excessSeatCount"),
      surchargeApplied: optNum(a, "surchargeApplied"),
      hikPendingOps: num(a, "hikPendingOps"),
      appAccess: app
        ? {
            accountEmail: optStr(app, "accountEmail"),
            isActive: bool(app, "isActive"),
            lastUnlockAt: optStr(app, "lastUnlockAt"),
            unlockCount: num(app, "unlockCount"),
          }
        : null,
    };
  });
}

export type CapacityCheck = {
  bookingDetailId: number;
  spaceName: string;
  spaceCategory: string;
  roomCapacity: number;
  currentActiveAttendants: number;
  /** Adding one more person would go over the room's capacity. */
  wouldExceedCapacity: boolean;
  /** Overfilling is possible (private offices, admins only: always false for a sales executive). */
  allowsOverCapacity: boolean;
  excessSeatCount: number;
  seatPrice: number;
  estimatedSurcharge: number;
  subTotal: number;
  supportChargeAmount: number;
  taxAmount: number;
  grandTotal: number;
};

/** GET bookings/{bookingDetailId}/capacity-check — what adding one more person would mean. */
export async function checkRoomCapacity(bookingDetailId: number): Promise<CapacityCheck> {
  const c = unwrapEnvelope<any>(await staffGet(STAFF_ENDPOINTS.attendants.capacityCheck(bookingDetailId))) ?? {};
  return {
    bookingDetailId: num(c, "bookingDetailId") || bookingDetailId,
    spaceName: str(c, "spaceName"),
    spaceCategory: str(c, "spaceCategory"),
    roomCapacity: num(c, "roomCapacity"),
    currentActiveAttendants: num(c, "currentActiveAttendants"),
    wouldExceedCapacity: bool(c, "wouldExceedCapacity"),
    allowsOverCapacity: bool(c, "allowsOverCapacity"),
    excessSeatCount: num(c, "excessSeatCount"),
    seatPrice: num(c, "seatPrice"),
    estimatedSurcharge: num(c, "estimatedSurcharge"),
    subTotal: num(c, "subTotal"),
    supportChargeAmount: num(c, "supportChargeAmount"),
    taxAmount: num(c, "taxAmount"),
    grandTotal: num(c, "grandTotal"),
  };
}

/**
 * What "add this person to the room" should do (CMS attendant-management processBookingAssignment):
 *   "assign"            room has a free seat: POST bookings/{id}/attendants
 *   "request-approval"  full, sales executive: POST bookings/{id}/capacity-requests
 *   "confirm-surcharge" full private office, admin: show check.estimatedSurcharge, then assign
 *   "not-allowed"       full meeting room / shared space, admin: overfilling is never allowed
 */
export type AddPersonAction = "assign" | "request-approval" | "confirm-surcharge" | "not-allowed";

export function addPersonAction(check: Pick<CapacityCheck, "wouldExceedCapacity" | "allowsOverCapacity">, role: StaffRole): AddPersonAction {
  if (!check.wouldExceedCapacity) return "assign";
  const canOverfill = role === "admin" || role === "super_admin";
  if (!canOverfill) return "request-approval";
  return check.allowsOverCapacity ? "confirm-surcharge" : "not-allowed";
}

export type AttendantInput = {
  customerId: number;
  name: string;
  email: string;
  phone: string;
  idType: IdType;
  idNumber: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** First problem with a new person (the API answers missing fields with a 500, so check them here). */
export function validateAttendantInput(input: AttendantInput): string | null {
  if (!(input.customerId > 0)) return "Choose the customer.";
  if (!input.name?.trim()) return "Enter the person's name.";
  if (!input.email?.trim()) return "Enter the person's email.";
  if (!EMAIL_RE.test(input.email.trim())) return "Enter a valid email address.";
  if (!input.phone?.trim()) return "Enter the person's phone number.";
  const phone = phoneError(input.phone);
  if (phone) return phone;
  if (!input.idNumber?.trim()) return input.idType === "Passport" ? "Enter the passport number." : "Enter the CNIC number.";
  if (input.idType !== "Passport") {
    const cnic = cnicError(input.idNumber);
    if (cnic) return cnic;
  }
  return null;
}

/** POST attendants — creates the person (or links an existing one) to the customer. */
export async function createAttendant(input: AttendantInput): Promise<ActionResult<{ personId: number; personGuid: string | null }>> {
  const invalid = validateAttendantInput(input);
  if (invalid) throw new Error(invalid);
  const raw = await staffPost<any>(STAFF_ENDPOINTS.attendants.create, {
    customerId: input.customerId,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    idType: input.idType,
    idNumber: input.idNumber.trim(),
  });
  const result = actionResult<any>(raw, "Person added.");
  return { message: result.message, data: { personId: num(raw, "personId"), personGuid: optStr(raw, "personGuid") } };
}

/** PUT attendants/{personId} { name, email, phone } (the ID type / number can't be changed). */
export async function updateAttendant(
  personId: number,
  input: { name: string; email: string; phone: string },
): Promise<ActionResult> {
  if (!input.name?.trim() || !input.email?.trim() || !input.phone?.trim()) throw new Error("Enter the name, email and phone number.");
  const phone = phoneError(input.phone);
  if (phone) throw new Error(phone);
  const raw = await staffPut(STAFF_ENDPOINTS.attendants.update(personId), {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
  });
  return actionResult(raw, "Contact details updated.");
}

/**
 * POST bookings/{bookingDetailId}/attendants { personId, customerId } — assigns from today (the server's date;
 * no assignedFrom is sent, which avoids the UTC-midnight off-by-one day). A full room answers with the API's
 * message (sales executives: ask an admin instead).
 */
export async function assignAttendant(
  bookingDetailId: number,
  person: { personId: number; customerId: number },
): Promise<ActionResult<{ isOverCapacity: boolean; surchargeApplied: number | null; surchargeInvoiceError: string | null }>> {
  const raw = await staffPost<any>(STAFF_ENDPOINTS.attendants.assign(bookingDetailId), {
    personId: person.personId,
    customerId: person.customerId,
  });
  const result = actionResult<any>(raw, "Person added to the room.");
  const d = result.data ?? {};
  return {
    message: result.message,
    data: {
      isOverCapacity: bool(d, "isOverCapacity"),
      surchargeApplied: optNum(d, "surchargeApplied"),
      surchargeInvoiceError: optStr(d, "surchargeInvoiceError"),
    },
  };
}

/** DELETE bookings/{bookingDetailId}/attendants/{personId} — ends the assignment and turns door access off. */
export async function removeAttendant(bookingDetailId: number, personId: number): Promise<ActionResult> {
  const raw = await staffDelete(STAFF_ENDPOINTS.attendants.remove(bookingDetailId, personId));
  return actionResult(raw, "Person removed from the room.");
}

// ─── Capacity requests ────────────────────────────────────────────────────────────────────────────────────

export type CapacityRequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export type CapacityRequest = {
  id: number;
  bookingDetailId: number;
  personId: number;
  customerId: number;
  requestedByEmail: string;
  /** ISO in UTC (the API omits the "Z"; added here). */
  requestedAt: string | null;
  status: CapacityRequestStatus | string;
  decidedByEmail: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  personName: string;
  personEmail: string | null;
  personPhone: string | null;
  spaceName: string;
  spaceCategory: string | null;
  customerName: string;
  roomCapacity: number;
  currentAttendants: number;
  locationId: number | null;
};

export function normalizeCapacityRequest(raw: any): CapacityRequest {
  return {
    id: num(raw, "id"),
    bookingDetailId: num(raw, "bookingDetailId"),
    personId: num(raw, "personId"),
    customerId: num(raw, "customerId"),
    requestedByEmail: str(raw, "requestedByEmail"),
    requestedAt: utcIso(optStr(raw, "requestedAt")),
    status: str(raw, "status") || "Pending",
    decidedByEmail: optStr(raw, "decidedByEmail"),
    decidedAt: utcIso(optStr(raw, "decidedAt")),
    decisionNote: optStr(raw, "decisionNote"),
    personName: str(raw, "personName"),
    personEmail: optStr(raw, "personEmail"),
    personPhone: optStr(raw, "personPhone"),
    spaceName: str(raw, "spaceName"),
    spaceCategory: optStr(raw, "spaceCategory"),
    customerName: str(raw, "customerName"),
    roomCapacity: num(raw, "roomCapacity"),
    currentAttendants: num(raw, "currentAttendants"),
    locationId: optNum(raw, "locationId"),
  };
}

/**
 * GET capacity-requests?status=&bookingDetailId= — newest first. status: Pending (default), Approved, Rejected,
 * Cancelled or "all". Admins / sales executives only see rooms at their locations.
 */
export async function listCapacityRequests(
  query: { status?: CapacityRequestStatus | "all"; bookingDetailId?: number | null } = {},
): Promise<CapacityRequest[]> {
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.capacityRequests.list, {
      status: query.status ?? "Pending",
      bookingDetailId: query.bookingDetailId && query.bookingDetailId > 0 ? query.bookingDetailId : undefined,
    }),
  );
  return toList(raw, normalizeCapacityRequest);
}

/**
 * POST bookings/{bookingDetailId}/capacity-requests { personId, customerId } — the room is full: ask an admin.
 * `alreadyPending` when a request for this person and room is already waiting (no new id).
 */
export async function requestCapacityApproval(
  bookingDetailId: number,
  person: { personId: number; customerId: number },
): Promise<ActionResult<{ id: number | null; alreadyPending: boolean }>> {
  if (!(person.personId > 0) || !(person.customerId > 0)) throw new Error("Choose the person to add.");
  const raw = await staffPost<any>(STAFF_ENDPOINTS.capacityRequests.create(bookingDetailId), {
    personId: person.personId,
    customerId: person.customerId,
  });
  const id = optNum(raw, "id");
  const result = actionResult(raw, "An admin has been asked to approve adding this person.");
  return { message: result.message, data: { id: id && id > 0 ? id : null, alreadyPending: !(id && id > 0) } };
}

/** POST capacity-requests/{id}/approve — admin / super admin: adds the person (surcharge rules apply). */
export async function approveCapacityRequest(id: number): Promise<ActionResult> {
  const raw = await staffPost(STAFF_ENDPOINTS.capacityRequests.approve(id));
  return actionResult(raw, "Approved. The person has been added to the room.");
}

/** POST capacity-requests/{id}/reject { note } — admin / super admin; the note is optional (max 500). */
export async function rejectCapacityRequest(id: number, note?: string): Promise<ActionResult> {
  const trimmed = note?.trim() ?? "";
  if (trimmed.length > 500) throw new Error("Keep the note under 500 characters.");
  const raw = await staffPost(STAFF_ENDPOINTS.capacityRequests.reject(id), { note: trimmed || null });
  return actionResult(raw, "Request rejected.");
}

/** POST capacity-requests/{id}/cancel — the person who asked, or an admin, withdraws a pending request. */
export async function cancelCapacityRequest(id: number): Promise<ActionResult> {
  const raw = await staffPost(STAFF_ENDPOINTS.capacityRequests.cancel(id));
  return actionResult(raw, "Request withdrawn.");
}

/** Approve / reject buttons: admins and super admins, pending requests only. */
export function canDecideCapacityRequest(request: Pick<CapacityRequest, "status">, role: StaffRole): boolean {
  return (role === "admin" || role === "super_admin") && request.status.toLowerCase() === "pending";
}

/** Withdraw button: a pending request, for the person who asked (same email) or an admin. */
export function canWithdrawCapacityRequest(
  request: Pick<CapacityRequest, "status" | "requestedByEmail">,
  role: StaffRole,
  userEmail: string | null | undefined,
): boolean {
  if (request.status.toLowerCase() !== "pending") return false;
  if (role === "admin" || role === "super_admin") return true;
  const mine = (userEmail ?? "").trim().toLowerCase();
  return !!mine && request.requestedByEmail.trim().toLowerCase() === mine;
}

// ─── Door access ──────────────────────────────────────────────────────────────────────────────────────────

/** PATCH access-status — door access on / off for one person (personId) or the whole booked space (null). */
export async function setDoorAccess(input: {
  bookingDetailId: number;
  customerId: number;
  personId: number | null;
  isEnabled: boolean;
}): Promise<ActionResult<{ rowsUpdated: number; machines: Record<string, any> | null }>> {
  const raw = await staffPatch<any>(STAFF_ENDPOINTS.attendants.accessStatus, input);
  const result = actionResult(raw, input.isEnabled ? "Access turned on." : "Access turned off.");
  const machines = pick(raw, "machines");
  return {
    message: result.message,
    data: { rowsUpdated: num(raw, "rowsUpdated"), machines: machines && typeof machines === "object" ? machines : null },
  };
}

export type AccessSuspension = {
  /** True while access is suspended for unpaid challans (or extended past it). */
  open: boolean;
  suspended: boolean;
  extended: boolean;
  bookingId: number | null;
  reason: string | null;
  suspendedAt: string | null;
  invoiceNumber: string | null;
  dueOn: string | null;
  grandTotal: number | null;
  balanceDue: number | null;
  overrideUntil: string | null;
  overrideByEmail: string | null;
  overrideReason: string | null;
};

/** GET bookings/{bookingDetailId}/access-suspension — null when access is not suspended. */
export async function getAccessSuspension(bookingDetailId: number): Promise<AccessSuspension | null> {
  const s = unwrapEnvelope<any>(await staffGet(STAFF_ENDPOINTS.attendants.accessSuspension(bookingDetailId)));
  if (!s || !bool(s, "open")) return null;
  return {
    open: true,
    suspended: bool(s, "suspended"),
    extended: bool(s, "extended"),
    bookingId: optNum(s, "bookingId"),
    reason: optStr(s, "reason"),
    suspendedAt: optStr(s, "suspendedAt"),
    invoiceNumber: optStr(s, "invoiceNumber"),
    dueOn: optStr(s, "dueOn"),
    grandTotal: optNum(s, "grandTotal"),
    balanceDue: optNum(s, "balanceDue"),
    overrideUntil: optStr(s, "overrideUntil"),
    overrideByEmail: optStr(s, "overrideByEmail"),
    overrideReason: optStr(s, "overrideReason"),
  };
}

/**
 * POST bookings/{bookingDetailId}/access-suspension/extend { overrideUntil, reason } — temporary access while
 * suspended (admin, super admin, sales executive). overrideUntil yyyy-MM-dd, not in the past; reason 3-500 chars.
 */
export async function extendDoorAccess(
  bookingDetailId: number,
  input: { overrideUntil: string; reason: string },
): Promise<ActionResult> {
  if (!isApiDate(input.overrideUntil)) throw new Error("Choose the date access is extended until.");
  const reason = input.reason?.trim() ?? "";
  if (reason.length < 3 || reason.length > 500) throw new Error("Enter a reason for the extension (3-500 characters).");
  const raw = await staffPost<any>(STAFF_ENDPOINTS.attendants.extendAccess(bookingDetailId), {
    overrideUntil: input.overrideUntil,
    reason,
  });
  return actionResult(raw, "Temporary access given.");
}

export type BookingChallan = {
  id: number;
  invoiceNumber: string;
  type: string;
  issuedOn: string | null;
  dueOn: string | null;
  grandTotal: number;
  paidTotal: number;
  balanceDue: number;
  status: string;
  isOverdue: boolean;
};

/** GET bookings/{bookingDetailId}/challans — the booking's challan and invoices with what is still due. */
export async function getRoomChallans(bookingDetailId: number): Promise<{
  bookingId: number | null;
  challanNumber: string | null;
  challanValidUntil: string | null;
  totalBalanceDue: number;
  overdueCount: number;
  challans: BookingChallan[];
}> {
  const d = unwrapEnvelope<any>(await staffGet(STAFF_ENDPOINTS.attendants.challans(bookingDetailId))) ?? {};
  const list = pick(d, "challans");
  return {
    bookingId: optNum(d, "bookingId"),
    challanNumber: optStr(d, "challanNumber"),
    challanValidUntil: optStr(d, "challanValidUntil"),
    totalBalanceDue: num(d, "totalBalanceDue"),
    overdueCount: num(d, "overdueCount"),
    challans: Array.isArray(list)
      ? list.map((c: any) => ({
          id: num(c, "id"),
          invoiceNumber: str(c, "invoiceNumber"),
          type: str(c, "type"),
          issuedOn: optStr(c, "issuedOn"),
          dueOn: optStr(c, "dueOn"),
          grandTotal: num(c, "grandTotal"),
          paidTotal: num(c, "paidTotal"),
          balanceDue: num(c, "balanceDue"),
          status: str(c, "status"),
          isOverdue: bool(c, "isOverdue"),
        }))
      : [],
  };
}
