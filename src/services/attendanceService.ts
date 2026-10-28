import { ApiError, apiRequest, errorMessage, serverMessage } from "./apiClient";
import { pakistanToday } from "../utils/pakistanDate";

// ─── Customer: attendance of the company's own employees ──────────────────────
// Same feature as the website's /my-attendance page. WorkNest staff turn attendance on per customer in the CMS; only
// the customer's main account (the booking owner) sees it. The API counts the fingerprint / card / face scans of the
// customer's employees on the room machines of their booked rooms and works the days out on request (first scan =
// in, last scan = out, machine time = Pakistan time). The customer defines shifts (one may be the default), assigns
// them to employees and declares holidays. API: api/attendance/my/* (role general). Not enabled: /status answers
// enabled:false and everything else 403; until the database script is run the API answers 503.

/** Customer endpoints (the signed-in customer's own company only). */
export const ATTENDANCE_ENDPOINTS = {
  /** GET: { enabled, customerId, customerName } (enabled:false instead of 403). */
  status: "/attendance/my/status",
  /** GET: the report for from..to (yyyy-MM-dd, at most 62 days), optionally one employee. */
  report: (from: string, to: string, personId?: number | null) =>
    `/attendance/my/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` +
    (personId ? `&personId=${encodeURIComponent(String(personId))}` : ""),
  /** GET: the customer's employees with their rooms and shift. */
  employees: "/attendance/my/employees",
  /** PUT { shiftId: int|null }: null = no own shift (the default shift then applies, if there is one). */
  employeeShift: (personId: number) => `/attendance/my/employees/${encodeURIComponent(String(personId))}/shift`,
  /** GET list, POST ShiftInput. */
  shifts: "/attendance/my/shifts",
  /** PUT ShiftInput, DELETE. */
  shift: (id: number) => `/attendance/my/shifts/${encodeURIComponent(String(id))}`,
  /** GET ?year=, POST { date, name }. */
  holidays: (year?: number) => `/attendance/my/holidays${year ? `?year=${encodeURIComponent(String(year))}` : ""}`,
  /** DELETE. */
  holiday: (id: number) => `/attendance/my/holidays/${encodeURIComponent(String(id))}`,
};

/** Longest report range the API accepts (days, both ends included). */
export const MAX_REPORT_DAYS = 62;
/** Field limits of the API (NVARCHAR(100)). */
export const SHIFT_NAME_MAX_LENGTH = 100;
export const HOLIDAY_NAME_MAX_LENGTH = 100;

export const NOT_ENABLED_MESSAGE = "Attendance isn't enabled for your account";
export const NOT_AVAILABLE_MESSAGE = "Attendance isn't available yet";

/** Work days as the API writes them, Monday first. */
export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export type AttendanceDayStatus =
  | "Present"
  | "Late"
  | "HalfDay"
  | "MissingOut"
  | "Absent"
  | "Holiday"
  | "OffDay"
  | "Pending";

export const ATTENDANCE_STATUSES: readonly AttendanceDayStatus[] = [
  "Present",
  "Late",
  "HalfDay",
  "MissingOut",
  "Absent",
  "Holiday",
  "OffDay",
  "Pending",
];

export type AttendanceStatus = { enabled: boolean; customerId: number | null; customerName: string | null };

export type AttendanceShift = {
  id: number;
  name: string;
  /** "09:00" (24-hour, Pakistan). */
  startTime: string;
  endTime: string;
  graceMinutes: number;
  halfDayMinutes: number | null;
  workDays: WeekDay[];
  isDefault: boolean;
  /** End at or before start: the shift ends the next day (the day counts as the date it starts). */
  crossesMidnight: boolean;
  employeeCount: number;
};

export type AttendanceShiftInput = {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  halfDayMinutes: number | null;
  workDays: WeekDay[];
  isDefault: boolean;
};

export type AttendanceHoliday = { id: number; date: string; name: string };

export type AttendanceEmployee = {
  personId: number;
  name: string;
  idNumberMasked: string | null;
  rooms: string[];
  shiftId: number | null;
  shiftName: string | null;
  /** No own shift: the customer's default shift applies. */
  usesDefaultShift: boolean;
  /** Still an employee (removed ones only appear in past reports). */
  active: boolean;
  /** Fingerprint enrolled on the room machines by WorkNest. */
  enrolled: boolean;
};

export type AttendanceDay = {
  personId: number;
  name: string;
  /** yyyy-MM-dd: the work day (a night shift's start date). */
  date: string;
  /** Pakistan wall-clock text ("2026-10-28T09:04:11"). */
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number | null;
  scans: number;
  status: AttendanceDayStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  onHoliday: boolean;
  onOffDay: boolean;
  shiftName: string | null;
  room: string | null;
};

export type AttendanceSummary = {
  personId: number;
  name: string;
  present: number;
  late: number;
  halfDay: number;
  missingOut: number;
  absent: number;
  holidays: number;
  offDays: number;
  workedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
};

export type AttendanceReport = {
  customerId: number | null;
  customerName: string | null;
  from: string;
  to: string;
  days: AttendanceDay[];
  summary: AttendanceSummary[];
};

// ─── Reading the API ──────────────────────────────────────────────────────────

const text = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim());
const textOrNull = (value: unknown): string | null => text(value) || null;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** camelCase first, then PascalCase. */
function field(raw: Record<string, unknown>, name: string): unknown {
  const value = raw[name];
  if (value !== undefined && value !== null) return value;
  return raw[name.charAt(0).toUpperCase() + name.slice(1)];
}

function whole(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function idOrNull(value: unknown): number | null {
  const n = whole(value);
  return n > 0 ? n : null;
}

/** A whole number, or null when the API sent none (0 is kept). */
function wholeOrNull(value: unknown): number | null {
  if (value === null || value === undefined || text(value) === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function flag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const t = text(value).toLowerCase();
  return t === "true" || t === "1";
}

/** "09:00:00" / "9:00" / "09:00" -> "09:00"; empty when it is not a time. */
export function normalizeTime(value: unknown): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(text(value));
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "";
  return `${pad(h)}:${m[2]}`;
}

/** ["Mon","Tue"] or "Mon,Tue" (any case, full names too) -> known days, Monday first, no repeats. */
export function normalizeWorkDays(value: unknown): WeekDay[] {
  const raw = Array.isArray(value) ? value : text(value).split(",");
  const picked = new Set(
    raw.map((d) => text(d).slice(0, 3).toLowerCase()).filter(Boolean),
  );
  return WEEK_DAYS.filter((d) => picked.has(d.toLowerCase()));
}

export function normalizeAttendanceStatus(input: unknown): AttendanceStatus {
  const raw = record(input);
  return {
    enabled: flag(field(raw, "enabled")),
    customerId: idOrNull(field(raw, "customerId")),
    customerName: textOrNull(field(raw, "customerName")),
  };
}

/** End at or before start = a night shift that ends the next day. */
export function crossesMidnight(startTime: string, endTime: string): boolean {
  const s = normalizeTime(startTime);
  const e = normalizeTime(endTime);
  return !!s && !!e && e <= s;
}

export function normalizeShift(input: unknown): AttendanceShift {
  const raw = record(input);
  const startTime = normalizeTime(field(raw, "startTime"));
  const endTime = normalizeTime(field(raw, "endTime"));
  const crosses = field(raw, "crossesMidnight");
  return {
    id: whole(field(raw, "id")),
    name: text(field(raw, "name")) || "Shift",
    startTime,
    endTime,
    graceMinutes: whole(field(raw, "graceMinutes")),
    halfDayMinutes: idOrNull(field(raw, "halfDayMinutes")),
    workDays: normalizeWorkDays(field(raw, "workDays")),
    isDefault: flag(field(raw, "isDefault")),
    crossesMidnight: crosses === undefined || crosses === null ? crossesMidnight(startTime, endTime) : flag(crosses),
    employeeCount: whole(field(raw, "employeeCount")),
  };
}

export function normalizeShifts(input: unknown): AttendanceShift[] {
  return list(input)
    .map(normalizeShift)
    .filter((s) => s.id > 0);
}

export function normalizeHoliday(input: unknown): AttendanceHoliday {
  const raw = record(input);
  return {
    id: whole(field(raw, "id")),
    date: text(field(raw, "date")).slice(0, 10),
    name: text(field(raw, "name")) || "Holiday",
  };
}

/** Holidays with an id and a date, earliest first. */
export function normalizeHolidays(input: unknown): AttendanceHoliday[] {
  return list(input)
    .map(normalizeHoliday)
    .filter((h) => h.id > 0 && /^\d{4}-\d{2}-\d{2}$/.test(h.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeEmployee(input: unknown): AttendanceEmployee {
  const raw = record(input);
  const active = field(raw, "active");
  return {
    personId: whole(field(raw, "personId")),
    name: text(field(raw, "name")) || "Employee",
    idNumberMasked: textOrNull(field(raw, "idNumberMasked")),
    rooms: list(field(raw, "rooms")).map(text).filter(Boolean),
    shiftId: idOrNull(field(raw, "shiftId")),
    shiftName: textOrNull(field(raw, "shiftName")),
    usesDefaultShift: flag(field(raw, "usesDefaultShift")),
    // Missing = active (older answers may leave it out).
    active: active === undefined || active === null ? true : flag(active),
    enrolled: flag(field(raw, "enrolled")),
  };
}

/** Employees with an id: current ones first, then by name. */
export function normalizeEmployees(input: unknown): AttendanceEmployee[] {
  return list(input)
    .map(normalizeEmployee)
    .filter((e) => e.personId > 0)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

/** A known status (any case, "Half day" / "half_day" too); unknown -> "Present" when there was a scan, else "Pending". */
export function normalizeDayStatus(value: unknown, hasScan = false): AttendanceDayStatus {
  const key = text(value).replace(/[\s_-]/g, "").toLowerCase();
  const found = ATTENDANCE_STATUSES.find((s) => s.toLowerCase() === key);
  return found ?? (hasScan ? "Present" : "Pending");
}

export function normalizeDay(input: unknown): AttendanceDay {
  const raw = record(input);
  const checkIn = textOrNull(field(raw, "checkIn"));
  return {
    personId: whole(field(raw, "personId")),
    name: text(field(raw, "name")) || "Employee",
    date: text(field(raw, "date")).slice(0, 10),
    checkIn,
    checkOut: textOrNull(field(raw, "checkOut")),
    workedMinutes: wholeOrNull(field(raw, "workedMinutes")),
    scans: whole(field(raw, "scans")),
    status: normalizeDayStatus(field(raw, "status"), !!checkIn),
    lateMinutes: whole(field(raw, "lateMinutes")),
    earlyLeaveMinutes: whole(field(raw, "earlyLeaveMinutes")),
    overtimeMinutes: whole(field(raw, "overtimeMinutes")),
    onHoliday: flag(field(raw, "onHoliday")),
    onOffDay: flag(field(raw, "onOffDay")),
    shiftName: textOrNull(field(raw, "shiftName")),
    room: textOrNull(field(raw, "room")),
  };
}

export function normalizeSummary(input: unknown): AttendanceSummary {
  const raw = record(input);
  return {
    personId: whole(field(raw, "personId")),
    name: text(field(raw, "name")) || "Employee",
    present: whole(field(raw, "present")),
    late: whole(field(raw, "late")),
    halfDay: whole(field(raw, "halfDay")),
    missingOut: whole(field(raw, "missingOut")),
    absent: whole(field(raw, "absent")),
    holidays: whole(field(raw, "holidays")),
    offDays: whole(field(raw, "offDays")),
    workedMinutes: whole(field(raw, "workedMinutes")),
    overtimeMinutes: whole(field(raw, "overtimeMinutes")),
    lateMinutes: whole(field(raw, "lateMinutes")),
  };
}

/** The report: days newest first (then by name), summaries by name. */
export function normalizeReport(input: unknown, fallback: { from: string; to: string } = { from: "", to: "" }): AttendanceReport {
  const raw = record(input);
  return {
    customerId: idOrNull(field(raw, "customerId")),
    customerName: textOrNull(field(raw, "customerName")),
    from: text(field(raw, "from")).slice(0, 10) || fallback.from,
    to: text(field(raw, "to")).slice(0, 10) || fallback.to,
    days: list(field(raw, "days"))
      .map(normalizeDay)
      .filter((d) => d.personId > 0 && d.date)
      .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)),
    summary: list(field(raw, "summary"))
      .map(normalizeSummary)
      .filter((s) => s.personId > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Totals of all employees' summaries (the "All employees" view). */
export function totalSummary(rows: AttendanceSummary[]): AttendanceSummary {
  const total: AttendanceSummary = {
    personId: 0,
    name: "All employees",
    present: 0,
    late: 0,
    halfDay: 0,
    missingOut: 0,
    absent: 0,
    holidays: 0,
    offDays: 0,
    workedMinutes: 0,
    overtimeMinutes: 0,
    lateMinutes: 0,
  };
  for (const r of rows) {
    total.present += r.present;
    total.late += r.late;
    total.halfDay += r.halfDay;
    total.missingOut += r.missingOut;
    total.absent += r.absent;
    total.holidays += r.holidays;
    total.offDays += r.offDays;
    total.workedMinutes += r.workedMinutes;
    total.overtimeMinutes += r.overtimeMinutes;
    total.lateMinutes += r.lateMinutes;
  }
  return total;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** 403: attendance is not turned on for this account (or it is not the customer's main account). */
export function isAttendanceNotEnabled(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** 503: the attendance database update is not installed on this server yet. */
export function isAttendanceUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503;
}

/** Readable text for a failed attendance request (403 / 503 get a friendly line instead of the API's). */
export function attendanceErrorMessage(error: unknown, fallback?: string): string {
  if (isAttendanceNotEnabled(error)) return NOT_ENABLED_MESSAGE;
  if (isAttendanceUnavailable(error)) return NOT_AVAILABLE_MESSAGE;
  return errorMessage(error, fallback);
}

// ─── Requests ─────────────────────────────────────────────────────────────────

/** GET status: enabled:false for customers without attendance (and for employees, who have no customer). */
export async function getAttendanceStatus(): Promise<AttendanceStatus> {
  const payload = await apiRequest<unknown>(ATTENDANCE_ENDPOINTS.status, { requiresAuth: true });
  return normalizeAttendanceStatus(payload);
}

/** GET the report for from..to (yyyy-MM-dd), optionally one employee. */
export async function getAttendanceReport(from: string, to: string, personId?: number | null): Promise<AttendanceReport> {
  const payload = await apiRequest<unknown>(ATTENDANCE_ENDPOINTS.report(from, to, personId), { requiresAuth: true });
  return normalizeReport(payload, { from, to });
}

export async function getAttendanceEmployees(): Promise<AttendanceEmployee[]> {
  const payload = await apiRequest<unknown>(ATTENDANCE_ENDPOINTS.employees, { requiresAuth: true });
  return normalizeEmployees(payload);
}

/** PUT the employee's own shift (null = none of their own: the default shift applies, if any). */
export async function setEmployeeShift(personId: number, shiftId: number | null): Promise<string | null> {
  const payload = await apiRequest<unknown>(ATTENDANCE_ENDPOINTS.employeeShift(personId), {
    method: "PUT",
    requiresAuth: true,
    body: { shiftId },
    unwrapData: false,
  });
  return serverMessage(payload);
}

export async function getAttendanceShifts(): Promise<AttendanceShift[]> {
  const payload = await apiRequest<unknown>(ATTENDANCE_ENDPOINTS.shifts, { requiresAuth: true });
  return normalizeShifts(payload);
}

/** POST a new shift (id null) or PUT an existing one. */
export async function saveAttendanceShift(id: number | null, input: AttendanceShiftInput): Promise<string | null> {
  const payload = await apiRequest<unknown>(id ? ATTENDANCE_ENDPOINTS.shift(id) : ATTENDANCE_ENDPOINTS.shifts, {
    method: id ? "PUT" : "POST",
    requiresAuth: true,
    body: buildShiftBody(input),
    unwrapData: false,
  });
  return serverMessage(payload);
}

export async function deleteAttendanceShift(id: number): Promise<string | null> {
  const payload = await apiRequest<unknown>(ATTENDANCE_ENDPOINTS.shift(id), {
    method: "DELETE",
    requiresAuth: true,
    unwrapData: false,
  });
  return serverMessage(payload);
}

/** GET the holidays of a year, earliest first. */
export async function getAttendanceHolidays(year: number): Promise<AttendanceHoliday[]> {
  const payload = await apiRequest<unknown>(ATTENDANCE_ENDPOINTS.holidays(year), { requiresAuth: true });
  return normalizeHolidays(payload);
}

export async function addAttendanceHoliday(date: string, name: string): Promise<string | null> {
  const payload = await apiRequest<unknown>(ATTENDANCE_ENDPOINTS.holidays(), {
    method: "POST",
    requiresAuth: true,
    body: { date, name: name.trim().slice(0, HOLIDAY_NAME_MAX_LENGTH) },
    unwrapData: false,
  });
  return serverMessage(payload);
}

export async function deleteAttendanceHoliday(id: number): Promise<string | null> {
  const payload = await apiRequest<unknown>(ATTENDANCE_ENDPOINTS.holiday(id), {
    method: "DELETE",
    requiresAuth: true,
    unwrapData: false,
  });
  return serverMessage(payload);
}

// ─── Rules and formatting (pure, unit tested) ─────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The ShiftInput body: trimmed name, "HH:mm" times, work days Monday first, half-day null when not set. */
export function buildShiftBody(input: AttendanceShiftInput): AttendanceShiftInput {
  return {
    name: input.name.trim().slice(0, SHIFT_NAME_MAX_LENGTH),
    startTime: normalizeTime(input.startTime),
    endTime: normalizeTime(input.endTime),
    graceMinutes: whole(input.graceMinutes),
    halfDayMinutes: input.halfDayMinutes && input.halfDayMinutes > 0 ? Math.floor(input.halfDayMinutes) : null,
    workDays: normalizeWorkDays(input.workDays),
    isDefault: !!input.isDefault,
  };
}

/** Why the shift can't be saved, or null. */
export function validateShift(input: AttendanceShiftInput): string | null {
  if (!input.name.trim()) return "Enter a name for the shift.";
  if (!normalizeTime(input.startTime) || !normalizeTime(input.endTime)) return "Choose the start and end time.";
  if (normalizeTime(input.startTime) === normalizeTime(input.endTime)) return "The start and end time can't be the same.";
  if (!normalizeWorkDays(input.workDays).length) return "Choose at least one work day.";
  if (!Number.isFinite(input.graceMinutes) || input.graceMinutes < 0) return "Grace minutes can't be negative.";
  if (input.halfDayMinutes !== null && (!Number.isFinite(input.halfDayMinutes) || input.halfDayMinutes <= 0)) {
    return "Half-day minutes must be more than 0, or left empty.";
  }
  return null;
}

/** A number typed into a minutes field: "15" -> 15, "" -> null, anything else -> NaN. */
export function parseMinutes(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

/** Shift length in minutes (a night shift runs into the next day). */
export function shiftLengthMinutes(startTime: string, endTime: string): number {
  const s = normalizeTime(startTime);
  const e = normalizeTime(endTime);
  if (!s || !e) return 0;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const diff = toMin(e) - toMin(s);
  return diff > 0 ? diff : diff + 24 * 60;
}

/** Minutes as "8h 05m" ("0h 00m" for 0); a dash when there is no value. */
export function durationText(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}

/** "09:00" (24-hour) -> "09:00 AM"; empty when it is not a time. */
export function clockText(time: string | null | undefined): string {
  const t = normalizeTime(time);
  if (!t) return "";
  const h = Number(t.slice(0, 2));
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)}:${t.slice(3, 5)} ${h < 12 ? "AM" : "PM"}`;
}

/** "09:04 AM" of an API date-time (Pakistan wall-clock text); empty when it has no time. */
export function scanTimeText(iso: string | null | undefined): string {
  const m = /^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/.exec(text(iso));
  return m ? clockText(m[1]) : "";
}

/** "09:04 AM → 06:10 PM" (the out part "—" while there is none; empty with no in either). */
export function inOutText(day: Pick<AttendanceDay, "checkIn" | "checkOut">): string {
  const inText = scanTimeText(day.checkIn);
  if (!inText) return "";
  return `${inText} → ${scanTimeText(day.checkOut) || "—"}`;
}

/** "09:00 AM – 06:00 PM" for a shift (", next day" for a night shift). */
export function shiftTimesText(s: Pick<AttendanceShift, "startTime" | "endTime">): string {
  const night = crossesMidnight(s.startTime, s.endTime);
  return `${clockText(s.startTime)} – ${clockText(s.endTime)}${night ? " (next day)" : ""}`;
}

/** "Mon–Fri", "Mon, Wed, Sat", "Every day". */
export function workDaysText(days: readonly WeekDay[]): string {
  const sorted = normalizeWorkDays(days as unknown as string[]);
  if (!sorted.length) return "No work days";
  if (sorted.length === 7) return "Every day";
  const idx = sorted.map((d) => WEEK_DAYS.indexOf(d));
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  return consecutive && sorted.length >= 3 ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join(", ");
}

const STATUS_LABELS: Record<AttendanceDayStatus, string> = {
  Present: "Present",
  Late: "Late",
  HalfDay: "Half day",
  MissingOut: "Missing out",
  Absent: "Absent",
  Holiday: "Holiday",
  OffDay: "Off day",
  Pending: "Pending",
};

export function dayStatusLabel(status: AttendanceDayStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** Colour family of a day status (HalfDay has its own orange; the rest are theme tones). */
export type AttendanceStatusColor = "success" | "warning" | "orange" | "danger" | "neutral" | "info";

export function dayStatusColor(status: AttendanceDayStatus): AttendanceStatusColor {
  switch (status) {
    case "Present":
      return "success";
    case "Late":
      return "warning";
    case "HalfDay":
      return "orange";
    case "MissingOut":
    case "Absent":
      return "danger";
    case "Pending":
      return "info";
    default:
      return "neutral";
  }
}

/** Extra facts of a day: "Late 12m", "Left 20m early", "Overtime 1h 00m", "On a holiday". */
export function dayNotes(day: AttendanceDay): string[] {
  const notes: string[] = [];
  if (day.onHoliday) notes.push("On a holiday");
  if (day.onOffDay) notes.push("On an off day");
  if (day.lateMinutes > 0) notes.push(`Late ${durationText(day.lateMinutes)}`);
  if (day.earlyLeaveMinutes > 0) notes.push(`Left ${durationText(day.earlyLeaveMinutes)} early`);
  if (day.overtimeMinutes > 0) notes.push(`Overtime ${durationText(day.overtimeMinutes)}`);
  return notes;
}

/** Today in Pakistan, yyyy-MM-dd. */
export function attendanceToday(now: Date = new Date()): string {
  return pakistanToday(now);
}

/** The default report range: the 1st of this month (Pakistan) to today. */
export function thisMonthRange(today: string = attendanceToday()): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/** Days from..to, both included (0 when either is not a date or to is before from). */
export function rangeDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Why the range can't be asked for, or null. */
export function validateRange(from: string, to: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return "Choose the from and to dates.";
  if (to < from) return "The to date can't be before the from date.";
  if (rangeDays(from, to) > MAX_REPORT_DAYS) return `Choose at most ${MAX_REPORT_DAYS} days.`;
  return null;
}

/** yyyy-MM-dd plus `days` (negative goes back). */
export function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) return date;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/** "09:00" -> a Date today at 09:00 (phone time; only the clock part is used by the time picker). */
export function timeToDate(time: string, base: Date = new Date()): Date | null {
  const t = normalizeTime(time);
  if (!t) return null;
  const d = new Date(base);
  d.setHours(Number(t.slice(0, 2)), Number(t.slice(3, 5)), 0, 0);
  return d;
}

/** The picked clock time as "HH:mm". */
export function dateToTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** What an employee's shift is shown as: their own shift, "Default (Day)", or "No shift". */
export function employeeShiftText(e: AttendanceEmployee, shifts: AttendanceShift[]): string {
  if (e.shiftId && !e.usesDefaultShift) return e.shiftName || shifts.find((s) => s.id === e.shiftId)?.name || "Shift";
  const def = shifts.find((s) => s.isDefault);
  if (e.usesDefaultShift || def) {
    const name = e.shiftName || def?.name;
    return name ? `Default (${name})` : "Default shift";
  }
  return "No shift";
}
