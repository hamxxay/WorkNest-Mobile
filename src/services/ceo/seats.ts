import type { Tone } from "../../theme/colors";
import { formatNumber } from "../../utils/format";
import { staffGet } from "../staff/http";
import { bool, num, optNum, optStr, pick, str, withQuery } from "../staff/normalize";
import { positiveId } from "./drill";
import { toCeoError } from "./errors";
import { clampPct, count, money, moneyFull, monthLabel, monthShort, pct, periodWords, shareOf } from "./format";
import { normalizePeriod, normalizeRanges } from "./normalize";
import { periodQuery } from "./period";
import { byMonth, isObject, list, optId, payload, section, type Row } from "./readers";
import { normalizeRoomShift, seatsText, signedPct } from "./rooms";
import type { CeoPeriod, CeoRoomShift, CeoScope, DashRange } from "./types";

// The CEO seat report (GET api/ceo/seats): seat occupancy against room occupancy (a 9-seat office sold for 5 seats is
// one occupied room but 4 empty seats), revenue per seat against the list price and the rent the empty seats could
// earn. Pure and unit-tested (__tests__/seats.test.ts): the normaliser never throws on a partial answer, and the
// tile / row / drill-down texts are built here so the screen (screens/App/Ceo/SeatsSection.tsx) only lays them out.
// Not in the services/ceo barrel: import it from "services/ceo/seats".

// ─── Types ────────────────────────────────────────────────────────────────────────────────────────────────

export type CeoSeatShiftName = CeoRoomShift;

/** Seat figures of a group of rooms: every room in scope (summary), one location or one space type. */
export type CeoSeatGroup = {
  /** byLocation rows only (null there = rooms with no location); null elsewhere. */
  locationId: number | null;
  /** bySpaceType rows only; null elsewhere. */
  spaceTypeId: number | null;
  /** Location / space type name from the database; "" for the summary. */
  name: string;
  rooms: number;
  roomsOccupied: number;
  roomOccupancyPct: number;
  seats: number;
  seatsSold: number;
  emptySeats: number;
  seatOccupancyPct: number;
  /** Room occupancy % less seat occupancy % (points): how much fuller the rooms look than the seats are. */
  gapPts: number;
  /** Rooms with a booking now that still have empty seats, and those empty seats. */
  partlyFilledRooms: number;
  partlyFilledEmptySeats: number;
  /** Seats sold for only one of Morning / Evening (sold, with one shift free to sell). */
  oneShiftSeats: number;
  /** Monthly rent of the bookings running now, after the booking discount (PKR). */
  soldMonthly: number;
  revenuePerSeat: number;
  /** Average list price a seat of the sold seats; null when no sold seat has a list price. */
  listSeatPriceSold: number | null;
  /** Average list price a seat over every seat with a list price; null when none has one. */
  listSeatPriceAll: number | null;
  /** Revenue per seat against the list price of the sold seats (%); null when none has a list price. */
  revenueVsListPct: number | null;
  /** Empty seats x their room's list price a seat, a month (rooms with a list price). */
  rentNotEarned: number;
  /** Empty seats of rooms without a list price (not priced in rentNotEarned). */
  emptySeatsUnpriced: number;
  /** In the period: seat-days sold / seat-days, room-days with a booking / room-days (so far). */
  periodSeatOccupancyPct: number;
  periodRoomOccupancyPct: number;
  periodDays: number;
};

/** Seats sold now on one shift. */
export type CeoSeatShift = { shift: CeoSeatShiftName; seats: number; bookings: number };

/** Seat and room occupancy at a month end (this month: now). */
export type CeoSeatMonth = {
  /** yyyy-MM. */
  month: string;
  rooms: number;
  roomsOccupied: number;
  roomOccupancyPct: number;
  seats: number;
  seatsSold: number;
  seatOccupancyPct: number;
};

export type CeoSeatRoom = {
  spaceId: number | null;
  name: string;
  code: string | null;
  locationId: number | null;
  location: string | null;
  spaceTypeId: number | null;
  spaceType: string | null;
  categoryCode: string | null;
  seats: number;
  seatsSold: number;
  emptySeats: number;
  seatOccupancyPct: number;
  seats247: number;
  seatsMorning: number;
  seatsEvening: number;
  oneShiftSeats: number;
  bookingsNow: number;
  /** Any confirmed booking now. */
  occupiedNow: boolean;
  /** null = no list price. */
  listSeatPrice: number | null;
  soldMonthly: number;
  revenuePerSeat: number;
  /** null when the room has no list price. */
  rentNotEarned: number | null;
  periodSeatOccupancyPct: number;
  periodRoomOccupancyPct: number;
};

/** The seat report (the server's database update SEAT_01 has run). */
export type CeoSeatReport = {
  available: true;
  period: CeoPeriod;
  /** e.g. "October 2026" ("" when not sent). */
  periodLabel: string;
  generatedAt: string | null;
  /** The Pakistan day of the "now" figures (yyyy-MM-dd), or null. */
  asOf: string | null;
  /** A custom period: the range the period figures cover (set only when sent). */
  range?: DashRange;
  summary: CeoSeatGroup;
  /** Always 24/7, Morning, Evening in this order. */
  byShift: CeoSeatShift[];
  /** By location name (locationId null = rooms with no location). */
  byLocation: CeoSeatGroup[];
  /** Most seats first. */
  bySpaceType: CeoSeatGroup[];
  /** At most 12, oldest first. */
  months: CeoSeatMonth[];
  /** Every room in scope, by location then room code (the server's order). */
  rooms: CeoSeatRoom[];
};

/** The server cannot build the report yet (SEAT_01 has not run): only its message is shown. */
export type CeoSeatsUnavailable = { available: false; message: string };

export type CeoSeats = CeoSeatReport | CeoSeatsUnavailable;

// ─── Normalising ──────────────────────────────────────────────────────────────────────────────────────────

/** Shifts in display order. */
export const SEAT_SHIFTS: readonly CeoSeatShiftName[] = ["24/7", "Morning", "Evening"];

/** Shown when the server says the report is not available and sends no message of its own (the contract's text). */
export const SEATS_UNAVAILABLE_MESSAGE =
  "Database update needed: run the script SEAT_01_ceo_seats_TEST (SEAT_01_ceo_seats_LIVE on the live database) to see the seat figures.";

/** The counting rule, shown under the section heading. */
export const SEAT_RULE_NOTE = "A seat is sold when any shift on it is sold (24/7 + the larger of Morning and Evening, up to the room's seats)";

/** Rooms shown in the drill-down before "Show more". */
export const SEATS_PAGE = 10;

/** Within this percent of the list price, revenue per seat counts as "at" the list price. */
const AT_LIST_TOLERANCE_PCT = 0.5;

const round1 = (value: number) => Math.round(value * 10) / 10;
/** A whole number of at least 0. */
const whole = (row: Row, ...keys: string[]) => Math.max(0, Math.round(num(row, ...keys)));
/** A positive amount, or null (no price known). */
const price = (value: number | null): number | null => (value != null && value > 0 ? value : null);
const isFalse = (value: unknown) => value === false || value === 0 || String(value).trim().toLowerCase() === "false";

function toGroup(r: Row): CeoSeatGroup {
  const rooms = whole(r, "rooms", "totalRooms");
  const roomsOccupied = whole(r, "roomsOccupied", "occupiedRooms");
  const seats = whole(r, "seats", "totalSeats");
  const seatsSold = whole(r, "seatsSold", "soldSeats");
  const roomOccupancyPct = clampPct(optNum(r, "roomOccupancyPct") ?? shareOf(roomsOccupied, rooms));
  const seatOccupancyPct = clampPct(optNum(r, "seatOccupancyPct") ?? shareOf(seatsSold, seats));
  const soldMonthly = num(r, "soldMonthly");
  return {
    locationId: optId(r, "locationId"),
    spaceTypeId: optId(r, "spaceTypeId"),
    name: str(r, "name").trim(),
    rooms,
    roomsOccupied,
    roomOccupancyPct,
    seats,
    seatsSold,
    emptySeats: optNum(r, "emptySeats") != null ? whole(r, "emptySeats") : Math.max(0, seats - seatsSold),
    seatOccupancyPct,
    gapPts: round1(optNum(r, "gapPts") ?? roomOccupancyPct - seatOccupancyPct),
    partlyFilledRooms: whole(r, "partlyFilledRooms"),
    partlyFilledEmptySeats: whole(r, "partlyFilledEmptySeats"),
    oneShiftSeats: whole(r, "oneShiftSeats"),
    soldMonthly,
    revenuePerSeat: optNum(r, "revenuePerSeat") ?? (seatsSold > 0 ? soldMonthly / seatsSold : 0),
    listSeatPriceSold: price(optNum(r, "listSeatPriceSold")),
    listSeatPriceAll: price(optNum(r, "listSeatPriceAll")),
    revenueVsListPct: optNum(r, "revenueVsListPct"),
    rentNotEarned: Math.max(0, num(r, "rentNotEarned")),
    emptySeatsUnpriced: whole(r, "emptySeatsUnpriced"),
    periodSeatOccupancyPct: clampPct(num(r, "periodSeatOccupancyPct")),
    periodRoomOccupancyPct: clampPct(num(r, "periodRoomOccupancyPct")),
    periodDays: whole(r, "periodDays"),
  };
}

function toRoom(r: Row): CeoSeatRoom {
  const spaceId = optId(r, "spaceId", "id");
  const code = optStr(r, "code", "spaceCode");
  const seats = whole(r, "seats", "capacity");
  const seatsSold = whole(r, "seatsSold");
  const emptySeats = optNum(r, "emptySeats") != null ? whole(r, "emptySeats") : Math.max(0, seats - seatsSold);
  const bookingsNow = whole(r, "bookingsNow");
  const listSeatPrice = price(optNum(r, "listSeatPrice", "seatPrice"));
  const soldMonthly = num(r, "soldMonthly");
  const rent = optNum(r, "rentNotEarned");
  return {
    spaceId,
    name: optStr(r, "name", "spaceName") ?? code ?? (spaceId ? `Room ${spaceId}` : "Room"),
    code,
    locationId: optId(r, "locationId"),
    location: optStr(r, "location", "locationName"),
    spaceTypeId: optId(r, "spaceTypeId"),
    spaceType: optStr(r, "spaceType", "spaceTypeName"),
    categoryCode: optStr(r, "categoryCode", "category"),
    seats,
    seatsSold,
    emptySeats,
    seatOccupancyPct: clampPct(optNum(r, "seatOccupancyPct") ?? shareOf(seatsSold, seats)),
    seats247: whole(r, "seats247"),
    seatsMorning: whole(r, "seatsMorning"),
    seatsEvening: whole(r, "seatsEvening"),
    oneShiftSeats: whole(r, "oneShiftSeats"),
    bookingsNow,
    occupiedNow: pick(r, "occupiedNow") != null ? bool(r, "occupiedNow") : bookingsNow > 0 || seatsSold > 0,
    listSeatPrice,
    soldMonthly,
    revenuePerSeat: optNum(r, "revenuePerSeat") ?? (seatsSold > 0 ? soldMonthly / seatsSold : 0),
    // The server's figure; else worked out from the list price (none without one).
    rentNotEarned: rent != null ? Math.max(0, rent) : listSeatPrice != null ? emptySeats * listSeatPrice : null,
    periodSeatOccupancyPct: clampPct(num(r, "periodSeatOccupancyPct")),
    periodRoomOccupancyPct: clampPct(num(r, "periodRoomOccupancyPct")),
  };
}

function toMonth(r: Row): CeoSeatMonth {
  const rooms = whole(r, "rooms");
  const roomsOccupied = whole(r, "roomsOccupied");
  const seats = whole(r, "seats");
  const seatsSold = whole(r, "seatsSold");
  return {
    month: str(r, "month").trim(),
    rooms,
    roomsOccupied,
    roomOccupancyPct: clampPct(optNum(r, "roomOccupancyPct") ?? shareOf(roomsOccupied, rooms)),
    seats,
    seatsSold,
    seatOccupancyPct: clampPct(optNum(r, "seatOccupancyPct") ?? shareOf(seatsSold, seats)),
  };
}

/** The server's byShift list as the three shifts in order (a missing shift as zeros, a repeated one added up). */
function toShifts(value: unknown): CeoSeatShift[] {
  const shifts = new Map(SEAT_SHIFTS.map((shift) => [shift, { shift, seats: 0, bookings: 0 }]));
  for (const row of Array.isArray(value) ? value.filter(isObject) : []) {
    const s = shifts.get(normalizeRoomShift(pick(row, "shift")))!;
    s.seats += whole(row, "seats", "seatsSold");
    s.bookings += whole(row, "bookings", "count");
  }
  return SEAT_SHIFTS.map((shift) => shifts.get(shift)!);
}

/**
 * The seat figures of a set of rooms, worked out from the rooms: the drill-down's totals line, and the summary when
 * the server sent none.
 */
export function summarizeSeatRooms(rooms: readonly CeoSeatRoom[]): CeoSeatGroup {
  const sum = (pickValue: (r: CeoSeatRoom) => number, of: readonly CeoSeatRoom[] = rooms) => of.reduce((total, r) => total + pickValue(r), 0);
  const seats = sum((r) => r.seats);
  const seatsSold = sum((r) => r.seatsSold);
  const roomsOccupied = rooms.filter((r) => r.occupiedNow).length;
  const partly = rooms.filter((r) => r.occupiedNow && r.emptySeats > 0);
  const priced = rooms.filter((r) => r.listSeatPrice != null);
  const pricedSold = priced.filter((r) => r.seatsSold > 0);
  const pricedSoldSeats = sum((r) => r.seatsSold, pricedSold);
  const pricedSeats = sum((r) => r.seats, priced);
  const listSeatPriceSold = pricedSoldSeats > 0 ? sum((r) => r.seatsSold * r.listSeatPrice!, pricedSold) / pricedSoldSeats : null;
  const roomOccupancyPct = shareOf(roomsOccupied, rooms.length);
  const seatOccupancyPct = shareOf(seatsSold, seats);
  const soldMonthly = sum((r) => r.soldMonthly);
  return {
    locationId: null,
    spaceTypeId: null,
    name: "",
    rooms: rooms.length,
    roomsOccupied,
    roomOccupancyPct,
    seats,
    seatsSold,
    emptySeats: sum((r) => r.emptySeats),
    seatOccupancyPct,
    gapPts: round1(roomOccupancyPct - seatOccupancyPct),
    partlyFilledRooms: partly.length,
    partlyFilledEmptySeats: sum((r) => r.emptySeats, partly),
    oneShiftSeats: sum((r) => r.oneShiftSeats),
    soldMonthly,
    revenuePerSeat: seatsSold > 0 ? soldMonthly / seatsSold : 0,
    listSeatPriceSold,
    listSeatPriceAll: pricedSeats > 0 ? sum((r) => r.seats * r.listSeatPrice!, priced) / pricedSeats : null,
    revenueVsListPct:
      listSeatPriceSold != null ? round1((sum((r) => r.soldMonthly, pricedSold) / pricedSoldSeats / listSeatPriceSold - 1) * 100) : null,
    rentNotEarned: sum((r) => r.rentNotEarned ?? 0),
    emptySeatsUnpriced: sum((r) => (r.listSeatPrice == null ? r.emptySeats : 0)),
    // Every room has the same days in the period: seat-days are weighted by seats, room-days count each room once.
    periodSeatOccupancyPct: seats > 0 ? clampPct(sum((r) => r.periodSeatOccupancyPct * r.seats) / seats) : 0,
    periodRoomOccupancyPct: rooms.length ? clampPct(sum((r) => r.periodRoomOccupancyPct) / rooms.length) : 0,
    periodDays: 0,
  };
}

/** The envelope's own message, unless it is a plain "Success" / "OK". */
function envelopeMessage(raw: unknown): string | null {
  const message = isObject(raw) ? optStr(raw, "message") : null;
  return message && !/^(success|ok)\.?$/i.test(message) ? message : null;
}

/**
 * GET api/ceo/seats answer (envelope or bare object). `available: false` (the server's database update SEAT_01 has
 * not run) keeps only its message (the contract's text when none is sent); anything else is read as the report:
 * missing numbers as 0 (prices as null), missing lists as [], a missing summary worked out from the rooms. Never
 * throws.
 */
export function normalizeCeoSeats(raw: unknown, requested: CeoPeriod = "month"): CeoSeats {
  const d = payload(raw);
  if (isFalse(pick(d, "available"))) {
    return { available: false, message: optStr(d, "message") ?? envelopeMessage(raw) ?? SEATS_UNAVAILABLE_MESSAGE };
  }
  const rooms = list(d, "rooms", toRoom);
  const summary = section(d, "summary");
  return {
    available: true,
    period: pick(d, "period") != null ? normalizePeriod(pick(d, "period")) : requested,
    periodLabel: str(d, "periodLabel"),
    generatedAt: optStr(d, "generatedAt"),
    asOf: optStr(d, "asOf"),
    ...normalizeRanges(d),
    summary: summary ? toGroup(summary) : summarizeSeatRooms(rooms),
    byShift: toShifts(pick(d, "byShift")),
    byLocation: list(d, "byLocation", toGroup),
    bySpaceType: list(d, "bySpaceType", toGroup),
    months: byMonth(list(d, "months", toMonth)).slice(-12),
    rooms,
  };
}

// ─── Loading ──────────────────────────────────────────────────────────────────────────────────────────────

/** API path (relative to API_BASE_URL, which already ends in /api). */
export const CEO_SEATS_ENDPOINT = "/ceo/seats";

async function ceoGet(path: string): Promise<unknown> {
  try {
    return await staffGet(path);
  } catch (error) {
    throw toCeoError(error);
  }
}

/**
 * GET api/ceo/seats?period=&locationId= (custom: &from=&to=) — seat occupancy against room occupancy, revenue per
 * seat and rent not earned. CEO / super admin. Before the server's database update SEAT_01 it answers
 * `available: false` with a message (shown instead of the figures).
 */
export async function getCeoSeats(scope: CeoScope): Promise<CeoSeats> {
  const raw = await ceoGet(withQuery(CEO_SEATS_ENDPOINT, { ...periodQuery(scope.period, scope.range), locationId: positiveId(scope.locationId) }));
  return normalizeCeoSeats(raw, scope.period);
}

// ─── Texts ────────────────────────────────────────────────────────────────────────────────────────────────

const joined = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");
const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;
export const roomsCountText = (n: number): string => plural(n, "room", "rooms");

/** 8.2 -> "8.2 points", 1 -> "1 point". */
export function pointsText(value: number): string {
  const v = Math.abs(round1(value));
  return `${formatNumber(v, Number.isInteger(v) ? 0 : 1)} ${v === 1 ? "point" : "points"}`;
}

/** How much fuller the rooms look than the seats are: "8.2 points above seats" / "4.1 points below seats". */
export function gapText(gapPts: number): string {
  const gap = round1(gapPts);
  if (gap > 0) return `${pointsText(gap)} above seats`;
  if (gap < 0) return `${pointsText(gap)} below seats`;
  return "same as seats";
}

/** "12 seats have one shift free to sell" / "No seat has only one shift sold". */
export function oneShiftText(n: number): string {
  if (n <= 0) return "No seat has only one shift sold";
  return `${plural(n, "seat has", "seats have")} one shift free to sell`;
}

/** "4 empty seats have no list price". */
export function unpricedText(n: number): string {
  return `${count(n)} empty ${n === 1 ? "seat has" : "seats have"} no list price`;
}

/** Tile tone for an occupancy: as the dashboard's other occupancy tiles. */
const occupancyTone = (value: number): Tone => (value >= 70 ? "success" : value >= 40 ? "primary" : "warning");

export type SeatTileKey = "seats" | "rooms" | "empty" | "revenue" | "rent" | "period";

/** A KPI tile's texts (the screen adds what pressing it does). */
export type SeatTile = { key: SeatTileKey; label: string; value: string; sub: string; tone: Tone; icon: string };

/** Revenue per seat: its sub line and tone (under the list price is a warning, over it good). */
function revenueTile(s: CeoSeatGroup): Pick<SeatTile, "sub" | "tone"> {
  if (s.seatsSold <= 0) return { sub: "no seat sold now", tone: "neutral" };
  if (s.listSeatPriceSold == null) return { sub: "no list price to compare", tone: "neutral" };
  const list = `list ${money(s.listSeatPriceSold)} a seat`;
  const v = s.revenueVsListPct;
  if (v == null) return { sub: list, tone: "primary" };
  const tone: Tone = v < -AT_LIST_TOLERANCE_PCT ? "warning" : v > AT_LIST_TOLERANCE_PCT ? "success" : "primary";
  return { sub: `${list}, ${signedPct(v)}`, tone };
}

/** The rent not earned tile's sub line (short: a tile shows two lines). */
function rentSub(s: CeoSeatGroup): string {
  const n = s.emptySeatsUnpriced;
  if (s.rentNotEarned > 0) {
    return n > 0 ? `plus ${count(n)} empty ${n === 1 ? "seat" : "seats"} with no list price` : "empty seats at the list price";
  }
  if (n > 0) return unpricedText(n);
  return s.emptySeats > 0 ? "no empty seat has a list price" : "every seat is sold";
}

/** The six KPI tiles of the section, in order. */
export function seatTiles(s: CeoSeatGroup, period: CeoPeriod): SeatTile[] {
  const revenue = revenueTile(s);
  return [
    {
      key: "seats",
      label: "Seat occupancy now",
      value: pct(s.seatOccupancyPct),
      sub: `${count(s.seatsSold)} of ${seatsText(s.seats)}`,
      tone: occupancyTone(s.seatOccupancyPct),
      icon: "people-outline",
    },
    {
      key: "rooms",
      label: "Rooms occupied now",
      value: pct(s.roomOccupancyPct),
      sub: `${count(s.roomsOccupied)} of ${roomsCountText(s.rooms)}, ${gapText(s.gapPts)}`,
      tone: "info",
      icon: "business-outline",
    },
    {
      key: "empty",
      label: "Empty seats",
      value: count(s.emptySeats),
      sub:
        s.partlyFilledEmptySeats > 0
          ? `${count(s.partlyFilledEmptySeats)} in ${roomsCountText(s.partlyFilledRooms)} already let`
          : s.emptySeats > 0
            ? "none in rooms already let"
            : "every seat is sold",
      tone: s.emptySeats > 0 ? "warning" : "success",
      icon: "grid-outline",
    },
    { key: "revenue", label: "Revenue per seat a month", value: money(s.revenuePerSeat), ...revenue, icon: "cash-outline" },
    {
      key: "rent",
      label: "Rent not earned a month",
      value: money(s.rentNotEarned),
      sub: rentSub(s),
      tone: s.rentNotEarned > 0 ? "warning" : "success",
      icon: "trending-down-outline",
    },
    {
      key: "period",
      label: `Seats ${periodWords(period)}`,
      value: pct(s.periodSeatOccupancyPct),
      sub: `of seat-days sold, rooms ${pct(s.periodRoomOccupancyPct)}`,
      tone: "info",
      icon: "calendar-outline",
    },
  ];
}

/** The seats sold now by shift as table rows: shift, seats, bookings. */
export function seatShiftRows(byShift: readonly CeoSeatShift[]): { key: string; cells: string[] }[] {
  return byShift.map((s) => ({ key: s.shift, cells: [s.shift, count(s.seats), count(s.bookings)] }));
}

/** The 12-month chart's columns: seat occupancy % and room occupancy % at each month end. */
export function seatTrendData(months: readonly CeoSeatMonth[]): { label: string; title: string; values: number[] }[] {
  return months.map((m) => ({ label: monthShort(m.month), title: monthLabel(m.month), values: [m.seatOccupancyPct, m.roomOccupancyPct] }));
}

/** The chart's figures as text: the latest month, and the first one when there are more. */
export function seatTrendText(months: readonly CeoSeatMonth[]): string | null {
  if (!months.length) return null;
  const line = (m: CeoSeatMonth) => `${monthLabel(m.month)}: seats ${pct(m.seatOccupancyPct)}, rooms ${pct(m.roomOccupancyPct)}`;
  const last = months[months.length - 1];
  return months.length > 1 ? `${line(last)}. ${line(months[0])}.` : `${line(last)}.`;
}

// ─── By location / space type and the drill-down ─────────────────────────────────────────────────────────

export type SeatGroupKind = "location" | "spaceType";

/** What the drill-down sheet lists: one location's rooms, one space type's, or every room in scope. */
export type SeatDrill =
  | { kind: "location"; locationId: number | null; name: string }
  | { kind: "spaceType"; spaceTypeId: number | null; name: string }
  | { kind: "all"; name: string };

/** Shown for the rooms with no location (locationId null). */
export const NO_LOCATION_NAME = "No location";
/** Shown for the rooms with no space type. */
export const NO_SPACE_TYPE_NAME = "No space type";

/** The group's name from the server; for rooms with no location / type the contract's wording. */
export function seatGroupName(group: CeoSeatGroup, kind: SeatGroupKind): string {
  if (group.name) return group.name;
  if (kind === "location") return group.locationId == null ? NO_LOCATION_NAME : `Location ${group.locationId}`;
  return group.spaceTypeId == null ? NO_SPACE_TYPE_NAME : `Space type ${group.spaceTypeId}`;
}

/** The drill-down a location / space type row opens. */
export function seatDrillOf(group: CeoSeatGroup, kind: SeatGroupKind): SeatDrill {
  const name = seatGroupName(group, kind);
  return kind === "location" ? { kind, locationId: group.locationId, name } : { kind, spaceTypeId: group.spaceTypeId, name };
}

/** A room belongs to the drill-down (an id of null matches the rooms without one: "No location"). */
export function seatDrillMatches(room: CeoSeatRoom, drill: SeatDrill): boolean {
  if (drill.kind === "location") return room.locationId === (drill.locationId ?? null);
  if (drill.kind === "spaceType") return room.spaceTypeId === (drill.spaceTypeId ?? null);
  return true;
}

/**
 * The drill-down's rooms, most rent not earned first (a room without a list price counts as 0 there), then most
 * empty seats, then the server's order.
 */
export function seatDrillRooms(rooms: readonly CeoSeatRoom[], drill: SeatDrill): CeoSeatRoom[] {
  return rooms
    .map((room, index) => ({ room, index }))
    .filter(({ room }) => seatDrillMatches(room, drill))
    .sort(
      (a, b) =>
        (b.room.rentNotEarned ?? 0) - (a.room.rentNotEarned ?? 0) || b.room.emptySeats - a.room.emptySeats || a.index - b.index,
    )
    .map(({ room }) => room);
}

/** A location / space type row (HBarList item): seat occupancy as the bar, sold of seats, rooms and rent not earned. */
export type SeatGroupItem = { key: string; label: string; value: number; valueLabel: string; detail: string };

export function seatGroupItem(group: CeoSeatGroup, kind: SeatGroupKind, index = 0): SeatGroupItem {
  const id = kind === "location" ? group.locationId : group.spaceTypeId;
  const rent =
    group.rentNotEarned > 0
      ? `${money(group.rentNotEarned)} a month not earned`
      : group.emptySeatsUnpriced > 0
        ? unpricedText(group.emptySeatsUnpriced)
        : group.emptySeats > 0
          ? null
          : "every seat sold";
  return {
    key: `${kind}-${id ?? "none"}-${index}`,
    label: seatGroupName(group, kind),
    value: group.seatOccupancyPct,
    valueLabel: `${pct(group.seatOccupancyPct)} · ${count(group.seatsSold)}/${count(group.seats)} seats`,
    detail: joined(`rooms ${pct(group.roomOccupancyPct)}`, rent),
  };
}

/** The rows of a by location / by space type list (groups without seats are left out). */
export function seatGroupItems(groups: readonly CeoSeatGroup[], kind: SeatGroupKind): { group: CeoSeatGroup; item: SeatGroupItem }[] {
  return groups.filter((g) => g.seats > 0 || g.rooms > 0).map((group, i) => ({ group, item: seatGroupItem(group, kind, i) }));
}

export type SeatFigure = { label: string; value: string; tone?: Tone };

/** A room in the drill-down. */
export type SeatRoomView = {
  key: string;
  title: string;
  /** "PO-12 · Private Office" (a location's room) / "PO-12 · I-8" (a space type's) / both (every room). */
  subtitle: string;
  /** "Full" / "Partly filled" / "Vacant now". */
  status: { label: string; tone: Tone };
  /** Seats, sold, empty, list a seat, rent not earned. */
  figures: SeatFigure[];
  /** "24/7 2 · Morning 3 · Evening 1 · 1 seat has one shift free to sell", only when any shift seats are sold. */
  shifts: string | null;
  accessibilityLabel: string;
};

/** A drill-down room's texts. */
export function seatRoomView(room: CeoSeatRoom, kind: SeatDrill["kind"], index = 0): SeatRoomView {
  const subtitle = joined(
    room.code && room.code !== room.name ? room.code : null,
    kind !== "location" ? room.location ?? NO_LOCATION_NAME : null,
    kind !== "spaceType" ? room.spaceType : null,
  );
  const status = !room.occupiedNow
    ? { label: "Vacant now", tone: "neutral" as Tone }
    : room.emptySeats > 0
      ? { label: "Partly filled", tone: "warning" as Tone }
      : { label: "Full", tone: "success" as Tone };
  const figures: SeatFigure[] = [
    { label: "Seats", value: count(room.seats) },
    { label: "Sold", value: count(room.seatsSold) },
    { label: "Empty", value: count(room.emptySeats) },
    { label: "List a seat", value: room.listSeatPrice != null ? moneyFull(room.listSeatPrice) : "No list price" },
    {
      label: "Rent not earned",
      value: room.rentNotEarned != null ? moneyFull(room.rentNotEarned) : "Not priced",
      tone: room.rentNotEarned != null && room.rentNotEarned > 0 ? "warning" : undefined,
    },
  ];
  const shifts =
    room.seatsMorning + room.seatsEvening > 0
      ? joined(
          `24/7 ${count(room.seats247)}`,
          `Morning ${count(room.seatsMorning)}`,
          `Evening ${count(room.seatsEvening)}`,
          room.oneShiftSeats > 0 ? oneShiftText(room.oneShiftSeats) : null,
        )
      : null;
  return {
    key: room.spaceId ? `seat-room-${room.spaceId}` : `seat-room-${room.name}-${index}`,
    title: room.name,
    subtitle,
    status,
    figures,
    shifts,
    accessibilityLabel: [
      room.name,
      subtitle,
      status.label,
      ...figures.map((f) => `${f.label} ${f.value}`),
      shifts ? `Seats by shift: ${shifts}` : null,
    ]
      .filter(Boolean)
      .join(", "),
  };
}

/** The drill-down's totals line: "Total: 3 rooms, 21 seats, 12 sold, 9 empty, PKR 270,000 a month not earned". */
export function seatTotalsText(rooms: readonly CeoSeatRoom[]): string {
  const t = summarizeSeatRooms(rooms);
  const parts = [
    roomsCountText(t.rooms),
    seatsText(t.seats),
    `${count(t.seatsSold)} sold`,
    `${count(t.emptySeats)} empty`,
    `${moneyFull(t.rentNotEarned)} a month not earned`,
    t.emptySeatsUnpriced > 0 ? unpricedText(t.emptySeatsUnpriced) : null,
  ];
  return `Total: ${parts.filter(Boolean).join(", ")}`;
}

/** The drill-down's subtitle: how full its seats are now and the sort order. */
export function seatDrillSubtitle(rooms: readonly CeoSeatRoom[]): string {
  const t = summarizeSeatRooms(rooms);
  return `${pct(t.seatOccupancyPct)} of seats sold now (rooms ${pct(t.roomOccupancyPct)}). Most rent not earned first.`;
}

/** Small label above the drill-down's title. */
export function seatDrillOverline(drill: SeatDrill): string {
  return drill.kind === "location" ? "Seats by location" : drill.kind === "spaceType" ? "Seats by space type" : "Seats in every room";
}
