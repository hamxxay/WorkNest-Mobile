import { API_ENDPOINTS } from "../config/api";
import { ApiError, apiRequest, serverMessage } from "./apiClient";
import { formatDate } from "../utils/format";
import { pakistanToday, pakistanWallClockMs } from "../utils/pakistanDate";

// ─── Customer: free meeting-room hours (My Meeting Rooms) ─────────────────────
// Same page as the website (worknestpk.com/my-meeting-rooms): a confirmed private office booking gives the customer
// a monthly allowance of meeting-room hours, booked at that office's location in whole hours and cancelled before
// the start. API: api/booking/meeting-room/* (MeetingRoomController), always the signed-in user's own allowance and
// bookings. Every rule (1..max hours, remaining hours, overlaps, start in the future, location) is checked again by
// the API; the checks here only grey out what can't be booked. Times are Pakistan wall-clock times (UTC+5).
// Until the database script is run the API answers 503 with "Database update needed: ..." (shown as it is).

/** Customer endpoints (any signed-in user; own allowance and bookings only). */
export const MEETING_ROOM_ENDPOINTS = {
  /** GET: the allowance for the calendar month of `date` (yyyy-MM-dd). */
  entitlement: (date: string) => `/booking/meeting-room/entitlement?date=${encodeURIComponent(date)}`,
  /** GET: rooms the customer may book with free hours on `date`, with the times already taken. */
  rooms: (date: string) => `/booking/meeting-room/rooms?date=${encodeURIComponent(date)}`,
  /** POST { spaceId, startOn, durationHours, notes? } (201 = booked). */
  book: "/booking/meeting-room/book",
  /** POST { cancelReason? }: own free booking, before it starts. */
  cancel: (id: number | string) => `/booking/meeting-room/${encodeURIComponent(String(id))}/cancel`,
  /** GET: the customer's free meeting-room bookings, newest first. */
  my: "/booking/meeting-room/my",
};

/** Field limits of the API (MeetingRoomService.NotesMaxLength / CancelReasonMaxLength). */
export const NOTES_MAX_LENGTH = 500;
export const CANCEL_REASON_MAX_LENGTH = 400;

/** Opening hours when the meeting-room space settings have none (same default as the website and staff portal). */
export const DEFAULT_OPENING_HOUR = 8;
export const DEFAULT_CLOSING_HOUR = 20;

export const BOOKED_MESSAGE = "Meeting room booked with your free hours.";
export const CANCELLED_MESSAGE = "Booking cancelled. The hours are back in your monthly allowance.";
export const NO_FREE_HOURS_TEXT = "You have used all of this month's free hours. They start again on the 1st of next month.";

/** GET entitlement: the allowance for the calendar month of the chosen date. */
export type MeetingRoomEntitlement = {
  /** false: no confirmed private office covers the date (or its allowance is on hold); `message` says why. */
  hasEntitlement: boolean;
  /** The date asked about (Pakistan), yyyy-MM-dd. */
  date: string;
  status: string | null;
  monthStart: string | null;
  monthEnd: string | null;
  allocatedMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  /** Longest single free booking in hours. */
  maxBookingHours: number;
  privateSpaceName: string | null;
  locationId: number | null;
  locationName: string | null;
  /** Why there are no free hours (null when there are). */
  message: string | null;
};

/** A time the room is taken (Pakistan wall-clock text from the API). */
export type BusyTime = { startOn: string; endOn: string };

/** GET rooms: a room the customer may book on the date. */
export type MeetingRoom = {
  spaceId: number;
  spaceCode: string | null;
  spaceName: string;
  capacity: number | null;
  locationId: number | null;
  locationName: string | null;
  busy: BusyTime[];
};

/** GET my: one free meeting-room booking. */
export type FreeMeetingRoomBooking = {
  bookingId: number;
  spaceName: string | null;
  spaceCode: string | null;
  locationName: string | null;
  /** Pakistan wall-clock text ("2026-10-20T10:00:00.000"). */
  startOn: string;
  endOn: string;
  durationMinutes: number;
  bookingStatusCode: string | null;
  bookingStatusLabel: string | null;
  challanNumber: string | null;
  notes: string | null;
  cancelReason: string | null;
  /** Confirmed and not started yet (the API's rule). */
  canCancel: boolean;
  isPast: boolean;
};

export type SlotReason = "" | "After closing" | "Passed" | "Taken";

/** A whole-hour start time for the chosen room, date and duration. */
export type MeetingRoomSlot = {
  /** "10:00": what is sent as the start (with the date). */
  start: string;
  hour: number;
  /** "10:00 AM - 12:00 PM". */
  label: string;
  available: boolean;
  /** Why it can't be chosen (empty when it can). */
  reason: SlotReason;
};

/** Whole hours the meeting rooms open and close (24-hour clock). */
export type OpeningHours = { open: number; close: number };

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

function flag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const t = text(value).toLowerCase();
  return t === "true" || t === "1";
}

export function normalizeEntitlement(input: unknown, dateFallback = ""): MeetingRoomEntitlement {
  const raw = record(input);
  return {
    hasEntitlement: flag(field(raw, "hasEntitlement")),
    date: text(field(raw, "date")) || dateFallback,
    status: textOrNull(field(raw, "status")),
    monthStart: textOrNull(field(raw, "monthStart")),
    monthEnd: textOrNull(field(raw, "monthEnd")),
    allocatedMinutes: whole(field(raw, "allocatedMinutes")),
    usedMinutes: whole(field(raw, "usedMinutes")),
    remainingMinutes: whole(field(raw, "remainingMinutes")),
    maxBookingHours: whole(field(raw, "maxBookingHours")),
    privateSpaceName: textOrNull(field(raw, "privateSpaceName")),
    locationId: idOrNull(field(raw, "locationId")),
    locationName: textOrNull(field(raw, "locationName")),
    message: textOrNull(field(raw, "message")),
  };
}

export function normalizeMeetingRoom(input: unknown): MeetingRoom {
  const raw = record(input);
  const spaceCode = textOrNull(field(raw, "spaceCode"));
  return {
    spaceId: whole(field(raw, "spaceId")),
    spaceCode,
    spaceName: text(field(raw, "spaceName")) || spaceCode || "Meeting room",
    capacity: idOrNull(field(raw, "capacity")),
    locationId: idOrNull(field(raw, "locationId")),
    locationName: textOrNull(field(raw, "locationName")),
    busy: list(field(raw, "busy"))
      .map((b) => {
        const r = record(b);
        return { startOn: text(field(r, "startOn")), endOn: text(field(r, "endOn")) };
      })
      .filter((b) => b.startOn && b.endOn),
  };
}

/** GET rooms payload ({ date, rooms }) -> the rooms with an id. */
export function normalizeMeetingRooms(input: unknown): MeetingRoom[] {
  const raw = record(input);
  return list(field(raw, "rooms"))
    .map(normalizeMeetingRoom)
    .filter((r) => r.spaceId > 0);
}

export function normalizeFreeBooking(input: unknown): FreeMeetingRoomBooking {
  const raw = record(input);
  return {
    bookingId: whole(field(raw, "bookingId")),
    spaceName: textOrNull(field(raw, "spaceName")),
    spaceCode: textOrNull(field(raw, "spaceCode")),
    locationName: textOrNull(field(raw, "locationName")),
    startOn: text(field(raw, "startOn")),
    endOn: text(field(raw, "endOn")),
    durationMinutes: whole(field(raw, "durationMinutes")),
    bookingStatusCode: textOrNull(field(raw, "bookingStatusCode")),
    bookingStatusLabel: textOrNull(field(raw, "bookingStatusLabel")),
    challanNumber: textOrNull(field(raw, "challanNumber")),
    notes: textOrNull(field(raw, "notes")),
    cancelReason: textOrNull(field(raw, "cancelReason")),
    canCancel: flag(field(raw, "canCancel")),
    isPast: flag(field(raw, "isPast")),
  };
}

export function normalizeFreeBookings(input: unknown): FreeMeetingRoomBooking[] {
  return list(input)
    .map(normalizeFreeBooking)
    .filter((b) => b.bookingId > 0 && b.startOn);
}

/** The API answered 503: the meeting-room database update is not installed on this server yet. */
export function isMeetingRoomsUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503;
}

// ─── Requests ─────────────────────────────────────────────────────────────────

/** GET entitlement for the calendar month of `date` (yyyy-MM-dd, Pakistan). */
export async function getMeetingRoomEntitlement(date: string): Promise<MeetingRoomEntitlement> {
  const payload = await apiRequest<unknown>(MEETING_ROOM_ENDPOINTS.entitlement(date), { requiresAuth: true });
  return normalizeEntitlement(payload, date);
}

/** GET rooms the customer may book with free hours on `date`, each with the times already taken. */
export async function getFreeMeetingRooms(date: string): Promise<MeetingRoom[]> {
  const payload = await apiRequest<unknown>(MEETING_ROOM_ENDPOINTS.rooms(date), { requiresAuth: true });
  return normalizeMeetingRooms(payload);
}

/** GET the customer's free meeting-room bookings, newest first. */
export async function getMyFreeMeetingRooms(): Promise<FreeMeetingRoomBooking[]> {
  const payload = await apiRequest<unknown>(MEETING_ROOM_ENDPOINTS.my, { requiresAuth: true });
  return normalizeFreeBookings(payload);
}

/** "2026-10-20T10:00:00": Pakistan wall-clock time without an offset, exactly as the website sends it. */
export function freeStartOn(date: string, start: string): string {
  return `${date}T${start}:00`;
}

export type FreeMeetingRoomBookInput = {
  spaceId: number;
  /** yyyy-MM-dd (Pakistan). */
  date: string;
  /** "10:00" (a slot's start). */
  start: string;
  durationHours: number;
  notes?: string;
};

/** The POST book body (notes left out when blank, like the website). */
export function buildFreeBookBody(input: FreeMeetingRoomBookInput): {
  spaceId: number;
  startOn: string;
  durationHours: number;
  notes?: string;
} {
  const notes = (input.notes ?? "").trim().slice(0, NOTES_MAX_LENGTH);
  return {
    spaceId: input.spaceId,
    startOn: freeStartOn(input.date, input.start),
    durationHours: input.durationHours,
    ...(notes ? { notes } : {}),
  };
}

/** POST book. Resolves the API's message ("Meeting room booked with your free hours."). */
export async function bookFreeMeetingRoom(input: FreeMeetingRoomBookInput): Promise<string> {
  const payload = await apiRequest<unknown>(MEETING_ROOM_ENDPOINTS.book, {
    method: "POST",
    requiresAuth: true,
    body: buildFreeBookBody(input),
    unwrapData: false,
  });
  return serverMessage(payload) ?? BOOKED_MESSAGE;
}

/** POST cancel (optional reason). Resolves the API's message. */
export async function cancelFreeMeetingRoom(bookingId: number, reason?: string): Promise<string> {
  const cancelReason = (reason ?? "").trim().slice(0, CANCEL_REASON_MAX_LENGTH);
  const payload = await apiRequest<unknown>(MEETING_ROOM_ENDPOINTS.cancel(bookingId), {
    method: "POST",
    requiresAuth: true,
    body: { cancelReason: cancelReason || null },
    unwrapData: false,
  });
  return serverMessage(payload) ?? CANCELLED_MESSAGE;
}

/**
 * GET space-config (public; the website reads it for the same reason): the rows behind the meeting-room opening
 * hours. Empty when it can't be read, so the default hours are used, like the website.
 */
export async function getMeetingRoomSpaceConfig(): Promise<unknown[]> {
  try {
    return list(await apiRequest<unknown>(API_ENDPOINTS.spaceConfig.list, { requiresAuth: true }));
  } catch {
    return [];
  }
}

// ─── Rules (pure, unit tested) ────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

/** The hour of "08:00" / "08:00:00"; the fallback when it has none. */
function hourOf(value: unknown, fallback: number): number {
  const raw = text(value);
  if (!raw) return fallback;
  const h = Number(raw.split(":")[0]);
  return Number.isFinite(h) ? h : fallback;
}

/**
 * Meeting-room opening hours from the space settings: the "meeting" rows, the room's location first (active rows
 * only), then any active meeting row, then the first one; the defaults when there is none (website rules).
 */
export function meetingRoomOpeningHours(config: unknown[], locationId: number | null | undefined): OpeningHours {
  const meeting = list(config)
    .map(record)
    .filter((c) => text(field(c, "spaceCategory")).toLowerCase() === "meeting");
  const active = (c: Record<string, unknown>) => {
    const status = field(c, "status");
    return Number(status === undefined || status === null ? 1 : status) === 1;
  };
  const cfg =
    meeting.find((c) => locationId != null && Number(field(c, "locationId")) === locationId && active(c)) ??
    meeting.find(active) ??
    meeting[0];
  return {
    open: hourOf(cfg ? field(cfg, "openingTime") : null, DEFAULT_OPENING_HOUR),
    close: hourOf(cfg ? field(cfg, "closingTime") : null, DEFAULT_CLOSING_HOUR),
  };
}

/** "10:00 AM" for an hour of the day (24 and later wrap to the next day's clock). */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Whole-hour start times from opening to closing for the chosen date and duration, Pakistan time. Greyed out:
 * a booking that would end after closing, a start that has passed (Pakistan "now", not the phone's clock) and a
 * start whose booking would overlap a taken time.
 */
export function buildMeetingRoomSlots(args: {
  date: string;
  hours: OpeningHours;
  durationHours: number;
  busy: BusyTime[];
  now?: number;
}): MeetingRoomSlot[] {
  const { date, hours, durationHours, busy } = args;
  const now = args.now ?? Date.now();
  if (!date) return [];
  const taken = busy
    .map((b) => ({ start: pakistanWallClockMs(b.startOn), end: pakistanWallClockMs(b.endOn) }))
    .filter((b) => !Number.isNaN(b.start) && !Number.isNaN(b.end));

  const slots: MeetingRoomSlot[] = [];
  for (let h = hours.open; h < hours.close; h++) {
    const start = pakistanWallClockMs(`${date}T${pad(h)}:00:00`);
    if (Number.isNaN(start)) continue;
    const end = start + durationHours * 3_600_000;
    let reason: SlotReason = "";
    if (h + durationHours > hours.close) reason = "After closing";
    else if (start <= now) reason = "Passed";
    else if (taken.some((b) => b.start < end && b.end > start)) reason = "Taken";
    slots.push({
      start: `${pad(h)}:00`,
      hour: h,
      label: `${hourLabel(h)} - ${hourLabel(h + durationHours)}`,
      available: !reason,
      reason,
    });
  }
  return slots;
}

/** 1 .. the longest free booking the API allows. */
export function durationOptions(maxBookingHours: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(maxBookingHours || 0)) }, (_, i) => i + 1);
}

/** A duration fits in the hours left this month. */
export function isDurationAllowed(hours: number, remainingMinutes: number): boolean {
  return hours * 60 <= (remainingMinutes || 0);
}

/** Keeps the duration within the longest booking and the hours left (the shortest allowed one otherwise, or 1). */
export function clampDuration(current: number, maxBookingHours: number, remainingMinutes: number): number {
  const allowed = durationOptions(maxBookingHours).filter((h) => isDurationAllowed(h, remainingMinutes));
  return allowed.includes(current) ? current : allowed.length ? allowed[0] : 1;
}

/** Minutes as hours: 360 -> "6", 90 -> "1.5". */
export function hoursText(minutes: number | null | undefined): string {
  const h = (minutes ?? 0) / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

/** "hour" for exactly one hour (60 minutes), else "hours". */
export function hoursUnit(minutes: number | null | undefined): string {
  return (minutes ?? 0) === 60 ? "hour" : "hours";
}

/** "1 hour" / "3 hours" for whole hours. */
export function hoursLabel(hours: number): string {
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/** Share of the month's hours used, 0..100. */
export function usedPercent(e: Pick<MeetingRoomEntitlement, "allocatedMinutes" | "usedMinutes"> | null | undefined): number {
  if (!e || e.allocatedMinutes <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((e.usedMinutes / e.allocatedMinutes) * 100)));
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "October 2026": the allowance month (its first day, or the chosen date). */
export function monthLabel(monthStart: string | null | undefined, date: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(text(monthStart) || text(date));
  if (!m) return "";
  const month = MONTH_NAMES[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : "";
}

/** Today in Pakistan, yyyy-MM-dd (the earliest date that can be chosen). */
export function meetingRoomToday(now: Date = new Date()): string {
  return pakistanToday(now);
}

/** A chosen date never before today (Pakistan). */
export function clampMeetingRoomDate(value: string, today: string): string {
  return value < today ? today : value;
}

/** yyyy-MM-dd of an API date-time (Pakistan wall-clock text). */
export function dayOf(iso: string | null | undefined): string {
  return text(iso).slice(0, 10);
}

/** "10:00 AM" of an API date-time (Pakistan wall-clock text); empty when it has no time. */
export function timeOf(iso: string | null | undefined): string {
  const m = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/.exec(text(iso));
  if (!m) return "";
  const h = Number(m[1]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** "Tue, 20 Oct 2026, 10:00 AM - 12:00 PM" for a booking. */
export function bookingWhenText(b: Pick<FreeMeetingRoomBooking, "startOn" | "endOn">): string {
  const day = formatDate(dayOf(b.startOn), { weekday: true, fallback: "" });
  const start = timeOf(b.startOn);
  const end = timeOf(b.endOn);
  const time = start && end ? `${start} - ${end}` : start;
  return [day, time].filter(Boolean).join(", ");
}

/** The booking's room name (its code, or "Meeting room"). */
export function bookingRoomName(b: Pick<FreeMeetingRoomBooking, "spaceName" | "spaceCode">): string {
  return b.spaceName || b.spaceCode || "Meeting room";
}

/** "6 seats" (empty when the API sent no capacity). */
export function seatsText(room: Pick<MeetingRoom, "capacity">): string {
  return room.capacity ? `${room.capacity} ${room.capacity === 1 ? "seat" : "seats"}` : "";
}

/** "Room A, Tue, 20 Oct 2026, 10:00 AM - 12:00 PM. Uses 2 of your 6 remaining hours." */
export function bookingSummary(args: {
  roomName: string;
  date: string;
  slotLabel: string;
  durationHours: number;
  remainingMinutes: number;
}): string {
  const day = formatDate(args.date, { weekday: true, fallback: args.date });
  return (
    `${args.roomName}, ${day}, ${args.slotLabel}. ` +
    `Uses ${args.durationHours} of your ${hoursText(args.remainingMinutes)} remaining ${hoursUnit(args.remainingMinutes)}.`
  );
}

/** Book is possible: free hours, a room, an available start and a duration within the hours left. */
export function canBookFreeMeetingRoom(args: {
  entitlement: Pick<MeetingRoomEntitlement, "hasEntitlement" | "remainingMinutes"> | null;
  spaceId: number | null;
  startSlot: string | null;
  durationHours: number;
  slots: MeetingRoomSlot[];
}): boolean {
  const { entitlement, spaceId, startSlot, durationHours, slots } = args;
  return (
    !!entitlement?.hasEntitlement &&
    !!spaceId &&
    !!startSlot &&
    isDurationAllowed(durationHours, entitlement.remainingMinutes) &&
    slots.some((s) => s.start === startSlot && s.available)
  );
}
