import { ApiError, apiRequest, serverMessage } from "./apiClient";
import { bookingStatusKey, isPendingBooking, isVoidBooking } from "./bookingService";
import { cnicError, formatCnicInput } from "../utils/cnic";
import { phoneError } from "../utils/phone";
import { isValidEmail } from "../utils/validation";

// ─── Customer: the employees of one of their bookings ─────────────────────────
// Shared contract with the website and the CMS ("Attendants & Access"). Only the customer who booked manages them,
// while the booking is Confirmed and not ended (the API decides and says so in `canManage` / `reason`); at most the
// booked seats. Two kinds of rows:
//   pending  added by the customer, waiting for WorkNest to check their CNIC at the branch (not a booking attendant
//            yet, no door access)
//   active   a booking attendant (checked by sales, or added by sales directly: addedBy "staff"); WorkNest staff
//            enrol fingerprint, face or card at the branch, never the app
// Seats used = pending + active. The customer may remove either kind (an active person's door access is cancelled).
// Every rule is enforced by the API: the checks here only give quicker, clearer messages, and the API's own
// message is shown when it refuses.

/** Customer employee endpoints (role general, own bookings only). */
export const EMPLOYEE_ENDPOINTS = {
  /** GET (list) / POST (add): /api/booking/my/{bookingId}/employees */
  list: (bookingId: number | string) => `/booking/my/${encodeURIComponent(String(bookingId))}/employees`,
  /** DELETE: /api/booking/my/{bookingId}/employees/{personId} */
  remove: (bookingId: number | string, personId: number | string) =>
    `/booking/my/${encodeURIComponent(String(bookingId))}/employees/${encodeURIComponent(String(personId))}`,
};

export type EmployeeIdType = "CNIC" | "Passport";

/** What WorkNest staff have enrolled for the person so far (the customer can never enrol these). */
export type EmployeeAccess = { fingerprint: boolean; face: boolean; card: boolean };

/** pending: waiting for the CNIC check at the branch; active: on the booking (door access enrolled by staff). */
export type EmployeeStatus = "pending" | "active";
/** Who added the person: the customer (in the app / website) or WorkNest staff (sales, CMS). */
export type EmployeeAddedBy = "customer" | "staff";

export type BookingEmployee = {
  /** 0 when the API sent none (such a row can't be removed). */
  personId: number;
  status: EmployeeStatus;
  addedBy: EmployeeAddedBy;
  name: string;
  email: string | null;
  phone: string | null;
  idType: EmployeeIdType;
  /** As shown to the customer (a CNIC as 12345-1234567-1). */
  idNumber: string;
  addedOn: string | null;
  /** All false while pending. */
  access: EmployeeAccess;
};

/** Someone this customer added on another booking (offered under "Choose someone you added before"). */
export type SavedEmployee = {
  personId: number;
  name: string;
  idType: EmployeeIdType;
  idNumber: string;
};

export type BookingEmployees = {
  bookingId: number;
  space: string | null;
  location: string | null;
  /** Booked seats; null when the API did not say (no seat limit is shown then). */
  seats: number | null;
  /** Seats taken: pending + active (the API's count, never fewer than the rows listed). */
  used: number;
  /** Rows waiting for the CNIC check at the branch. */
  pendingCount: number;
  /** The customer may add and remove employees now. */
  canManage: boolean;
  /** Why they can't (shown above the read-only list); null when they can. */
  reason: string | null;
  /** Every seat is taken: Add is disabled. */
  seatsFull: boolean;
  /** canManage and a seat is free. */
  canAdd: boolean;
  employees: BookingEmployee[];
  /** People not on this booking yet; empty hides the "existing" mode. */
  savedEmployees: SavedEmployee[];
};

/** Shown when the API says the list is read-only but gives no reason. */
export const READ_ONLY_REASON = "Employees can be added or removed only while the booking is confirmed and has not ended.";
export const SEATS_FULL_TEXT = "All seats are taken";
export const ADDED_MESSAGE = "Employee added. WorkNest will check their CNIC at the branch and add their fingerprint or face.";
export const REMOVED_MESSAGE = "Employee removed and their door access cancelled.";
export const BRANCH_ACCESS_NOTE = "Fingerprint, face or card access is added by WorkNest staff at the branch.";
export const PENDING_TEXT = "Waiting for check at the branch";
export const PENDING_NOTE = "New employees wait for a CNIC check at the branch. WorkNest staff then add their fingerprint, face or card.";
/** Shown instead of the server's text when the API answers 503 (the employees database update is not installed yet). */
export const EMPLOYEES_UNAVAILABLE = "Employees can't be managed in the app just yet. Please try again later or contact WorkNest.";

const text = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim());
const textOrNull = (value: unknown): string | null => text(value) || null;

/** First value among camelCase / PascalCase variants of a field (empty strings and nulls skipped). */
function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function field(raw: Record<string, unknown>, name: string): unknown {
  return pick(raw, name, name.charAt(0).toUpperCase() + name.slice(1));
}

function wholeOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function idOf(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** true / "true" / 1 / "1" / "yes" are true; anything else (missing included) is false. */
function flag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const t = text(value).toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export function toEmployeeIdType(value: unknown): EmployeeIdType {
  return text(value).toLowerCase() === "passport" ? "Passport" : "CNIC";
}

/** A CNIC as 12345-1234567-1 (when it has 13 digits); a passport number as sent, upper case. */
export function displayIdNumber(idType: EmployeeIdType, idNumber: unknown): string {
  const value = text(idNumber);
  if (idType === "CNIC" && /^\d{13}$/.test(value.replace(/[\s-]/g, ""))) return formatCnicInput(value);
  return idType === "Passport" ? value.toUpperCase() : value;
}

function normalizeAccess(input: unknown): EmployeeAccess {
  const raw = record(input);
  return {
    fingerprint: flag(field(raw, "fingerprint")),
    face: flag(field(raw, "face")),
    card: flag(field(raw, "card")),
  };
}

/**
 * "pending" (also "Pending", "waiting", "requested") or "active" (also "verified", "assigned"). A row without a
 * status is a booking attendant, so active (the first contract had no pending rows).
 */
export function toEmployeeStatus(value: unknown): EmployeeStatus {
  const t = text(value).toLowerCase();
  return t === "pending" || t === "waiting" || t === "requested" ? "pending" : "active";
}

/** "staff" (also "sales", "admin", "worknest", "cms"); anything else, missing included, is the customer. */
export function toEmployeeAddedBy(value: unknown): EmployeeAddedBy {
  const t = text(value).toLowerCase().replace(/[\s_-]+/g, "");
  return ["staff", "sales", "salesexecutive", "admin", "superadmin", "worknest", "cms"].includes(t) ? "staff" : "customer";
}

export function normalizeEmployee(input: unknown): BookingEmployee {
  const raw = record(input);
  const idType = toEmployeeIdType(field(raw, "idType"));
  const status = toEmployeeStatus(field(raw, "status"));
  const access = normalizeAccess(field(raw, "access"));
  return {
    personId: idOf(field(raw, "personId")),
    status,
    addedBy: toEmployeeAddedBy(field(raw, "addedBy")),
    name: text(pick(raw, "name", "Name", "fullName", "FullName")) || "Employee",
    email: textOrNull(field(raw, "email")),
    phone: textOrNull(field(raw, "phone")),
    idType,
    idNumber: displayIdNumber(idType, field(raw, "idNumber")),
    addedOn: textOrNull(field(raw, "addedOn")),
    // Nobody has door access before the branch check, whatever the row says.
    access: status === "pending" ? { fingerprint: false, face: false, card: false } : access,
  };
}

function normalizeSavedEmployee(input: unknown): SavedEmployee {
  const raw = record(input);
  const idType = toEmployeeIdType(field(raw, "idType"));
  return {
    personId: idOf(field(raw, "personId")),
    name: text(pick(raw, "name", "Name", "fullName", "FullName")) || "Employee",
    idType,
    idNumber: displayIdNumber(idType, field(raw, "idNumber")),
  };
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * GET employees payload -> what the screen shows. Tolerates missing fields: no `canManage` means read-only, no
 * `seats` means no seat limit is shown, no `used` counts the employees, and people already on the booking are
 * never offered again as "added before".
 */
export function normalizeBookingEmployees(input: unknown, bookingIdFallback = 0): BookingEmployees {
  const raw = record(input);
  const employees = list(field(raw, "employees")).map(normalizeEmployee);
  const onBooking = new Set(employees.map((e) => e.personId).filter((id) => id > 0));
  const seen = new Set<number>();
  const savedEmployees = list(field(raw, "savedEmployees"))
    .map(normalizeSavedEmployee)
    .filter((p) => {
      if (!(p.personId > 0) || onBooking.has(p.personId) || seen.has(p.personId)) return false;
      seen.add(p.personId);
      return true;
    });

  const seatsRaw = wholeOrNull(field(raw, "seats"));
  const seats = seatsRaw && seatsRaw > 0 ? seatsRaw : null;
  const used = Math.max(wholeOrNull(field(raw, "used")) ?? 0, employees.length);
  const canManage = flag(field(raw, "canManage"));
  const seatsFull = seats !== null && used >= seats;

  return {
    bookingId: idOf(field(raw, "bookingId")) || bookingIdFallback,
    space: textOrNull(pick(raw, "space", "Space", "spaceName", "SpaceName")),
    location: textOrNull(pick(raw, "location", "Location", "locationName", "LocationName")),
    seats,
    used,
    pendingCount: employees.filter((e) => e.status === "pending").length,
    canManage,
    reason: canManage ? null : textOrNull(field(raw, "reason")) ?? READ_ONLY_REASON,
    seatsFull,
    canAdd: canManage && !seatsFull,
    employees,
    savedEmployees,
  };
}

/** "2 of 4 seats used" (or "2 employees" when the seat count is unknown). */
export function seatsUsedLabel(data: Pick<BookingEmployees, "seats" | "used">): string {
  if (data.seats === null) return `${data.used} employee${data.used === 1 ? "" : "s"}`;
  return `${data.used} of ${data.seats} seat${data.seats === 1 ? "" : "s"} used`;
}

/** "Employees 2/4" for the booking card / detail entry ("Employees" while the count is unknown). */
export function employeesButtonLabel(summary: Pick<BookingEmployees, "seats" | "used"> | null | undefined): string {
  if (!summary) return "Employees";
  return summary.seats === null ? `Employees ${summary.used}` : `Employees ${summary.used}/${summary.seats}`;
}

/** Enrolled access as chip labels, in a fixed order (empty: access is still pending at the branch). */
export function accessLabels(access: EmployeeAccess): string[] {
  const labels: string[] = [];
  if (access.fingerprint) labels.push("Fingerprint");
  if (access.face) labels.push("Face");
  if (access.card) labels.push("Card");
  return labels;
}

/**
 * The Employees entry belongs on Confirmed bookings (also checked-in / active ones). The API still decides whether
 * the list can be changed; a confirmed booking that has ended shows it read-only.
 */
export function showsEmployees(booking: { status?: string | null; statusCode?: string | null }): boolean {
  if (isVoidBooking(booking) || isPendingBooking(booking)) return false;
  return [booking.status, booking.statusCode]
    .map(bookingStatusKey)
    .some((k) => k.includes("confirm") || k === "active" || k === "checkedin" || k === "ongoing" || k === "inuse");
}

/** The API answered 503: the employees feature is not installed on this server yet (database update missing). */
export function isEmployeesUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503;
}

/** Runs an employees request; a 503 becomes EMPLOYEES_UNAVAILABLE (the server's text names database scripts). */
async function employeesRequest<T>(send: () => Promise<T>): Promise<T> {
  try {
    return await send();
  } catch (error) {
    if (isEmployeesUnavailable(error)) throw new ApiError(EMPLOYEES_UNAVAILABLE, 503, (error as ApiError).details);
    throw error;
  }
}

/** GET /booking/my/{bookingId}/employees. Throws a readable ApiError (e.g. 404: not this customer's booking). */
export async function getBookingEmployees(bookingId: number): Promise<BookingEmployees> {
  if (!(bookingId > 0)) throw new ApiError("This booking could not be found.", 404);
  const payload = await employeesRequest(() =>
    apiRequest<unknown>(EMPLOYEE_ENDPOINTS.list(bookingId), { requiresAuth: true }),
  );
  return normalizeBookingEmployees(payload, bookingId);
}

/** Seats used / booked for the "Employees 2/4" entry. */
export type EmployeeSummary = Pick<BookingEmployees, "seats" | "used" | "canManage">;

/**
 * The count behind the "Employees" entry. Resolves null when the API answers 404 / 405 (not the customer's own
 * booking, or no such endpoint on this server) or 503 (the feature's database update is not installed yet): the
 * entry is hidden then. Other failures throw.
 */
export async function getEmployeeSummary(bookingId: number): Promise<EmployeeSummary | null> {
  try {
    const data = await getBookingEmployees(bookingId);
    return { seats: data.seats, used: data.used, canManage: data.canManage };
  } catch (error) {
    if (error instanceof ApiError && [404, 405, 503].includes(error.status)) return null;
    throw error;
  }
}

// ─── Add employee form ────────────────────────────────────────────────────────

export type EmployeeFormMode = "new" | "existing";

export type EmployeeForm = {
  mode: EmployeeFormMode;
  /** mode "existing": one of savedEmployees. */
  personId?: number | null;
  fullName?: string;
  email?: string;
  phone?: string;
  idType?: EmployeeIdType;
  idNumber?: string;
};

export type EmployeeFormField = "personId" | "fullName" | "email" | "phone" | "idNumber";
export type EmployeeFormErrors = Partial<Record<EmployeeFormField, string>>;

export const NAME_MIN = 2;
/** Same limits as the API (BookingEmployeeService: WN_Persons.Name / Email are 150 characters). */
export const NAME_MAX = 150;
export const EMAIL_MAX = 150;
export const PASSPORT_MIN = 6;
export const PASSPORT_MAX = 20;
export const PASSPORT_ERROR = `Passport number must be ${PASSPORT_MIN} to ${PASSPORT_MAX} letters and numbers.`;

/** Passport input while typing: letters and numbers only, upper case, at most 20. */
export function formatPassportInput(value: string): string {
  return (value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, PASSPORT_MAX);
}

/** Same rules as the API: name 2-150, email (up to 150) and phone optional but valid, CNIC 13 digits, passport 6-20 letters / numbers. */
export function validateEmployeeForm(form: EmployeeForm): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {};
  if (form.mode === "existing") {
    if (!(Number(form.personId) > 0)) errors.personId = "Choose the person to add.";
    return errors;
  }

  const name = text(form.fullName).replace(/\s+/g, " ");
  if (!name) errors.fullName = "Enter the employee's full name.";
  else if (name.length < NAME_MIN) errors.fullName = `Full name must be at least ${NAME_MIN} characters.`;
  else if (name.length > NAME_MAX) errors.fullName = `Full name must be ${NAME_MAX} characters or fewer.`;

  const email = text(form.email);
  if (email.length > EMAIL_MAX) errors.email = `Email must be ${EMAIL_MAX} characters or fewer.`;
  else if (email && !isValidEmail(email)) errors.email = "Enter a valid email address, or leave it empty.";

  const phone = phoneError(text(form.phone));
  if (phone) errors.phone = phone;

  const idNumber = text(form.idNumber);
  if (form.idType === "Passport") {
    if (!idNumber) errors.idNumber = "Enter the passport number.";
    else if (!new RegExp(`^[A-Za-z0-9]{${PASSPORT_MIN},${PASSPORT_MAX}}$`).test(idNumber)) errors.idNumber = PASSPORT_ERROR;
  } else if (!idNumber) {
    errors.idNumber = "Enter the CNIC number.";
  } else {
    const cnic = cnicError(idNumber);
    if (cnic) errors.idNumber = cnic;
  }
  return errors;
}

/** The first problem with the form, or null when it can be sent. */
export function firstEmployeeFormError(form: EmployeeForm): string | null {
  const errors = validateEmployeeForm(form);
  const order: EmployeeFormField[] = ["personId", "fullName", "email", "phone", "idNumber"];
  for (const key of order) if (errors[key]) return errors[key] ?? null;
  return null;
}

export type AddEmployeeBody =
  | { mode: "existing"; personId: number }
  | {
      mode: "new";
      fullName: string;
      email: string | null;
      phone: string | null;
      idType: EmployeeIdType;
      idNumber: string;
    };

/** The POST body (call after validateEmployeeForm): a CNIC is sent as 12345-1234567-1, a passport upper case. */
export function buildAddEmployeeBody(form: EmployeeForm): AddEmployeeBody {
  if (form.mode === "existing") return { mode: "existing", personId: Number(form.personId) };
  const idType: EmployeeIdType = form.idType === "Passport" ? "Passport" : "CNIC";
  const email = text(form.email).toLowerCase();
  const phone = text(form.phone).replace(/\s+/g, " ");
  return {
    mode: "new",
    fullName: text(form.fullName).replace(/\s+/g, " "),
    email: email || null,
    phone: phone || null,
    idType,
    idNumber: idType === "CNIC" ? formatCnicInput(text(form.idNumber)) : formatPassportInput(text(form.idNumber)),
  };
}

type Envelope = { data?: unknown; Data?: unknown };

/** The API's own (readable) message, or the fallback. */
const messageOf = (payload: unknown, fallback: string): string => serverMessage(record(payload).message ?? record(payload).Message) ?? fallback;

/**
 * POST /booking/my/{bookingId}/employees. Resolves with the new person's id (0 when the API sent none) and the
 * API's message. A refusal (seats full, the same ID already on the booking, booking not confirmed) throws an
 * ApiError carrying the API's message, shown to the customer as is.
 */
export async function addBookingEmployee(
  bookingId: number,
  form: EmployeeForm,
): Promise<{ personId: number; message: string }> {
  if (!(bookingId > 0)) throw new ApiError("This booking could not be found.", 404);
  const invalid = firstEmployeeFormError(form);
  if (invalid) throw new ApiError(invalid, 400);
  const payload = await employeesRequest(() =>
    apiRequest<unknown>(EMPLOYEE_ENDPOINTS.list(bookingId), {
      method: "POST",
      requiresAuth: true,
      body: buildAddEmployeeBody(form),
      unwrapData: false,
    }),
  );
  const p = record(payload) as Envelope;
  const data = record(p.data ?? p.Data);
  return {
    personId: idOf(field(data, "personId")) || (form.mode === "existing" ? Number(form.personId) || 0 : 0),
    message: messageOf(payload, ADDED_MESSAGE),
  };
}

/**
 * DELETE /booking/my/{bookingId}/employees/{personId}: a pending person's request is withdrawn; an active person
 * (also one sales added) is removed from the booking and their door access cancelled (queued by the API when a
 * door machine is offline). Resolves with the API's message.
 */
export async function removeBookingEmployee(bookingId: number, personId: number): Promise<string> {
  if (!(bookingId > 0) || !(personId > 0)) throw new ApiError("This employee could not be found.", 404);
  const payload = await employeesRequest(() =>
    apiRequest<unknown>(EMPLOYEE_ENDPOINTS.remove(bookingId, personId), {
      method: "DELETE",
      requiresAuth: true,
      unwrapData: false,
    }),
  );
  return messageOf(payload, REMOVED_MESSAGE);
}
