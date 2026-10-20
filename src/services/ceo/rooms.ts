import type { Tone } from "../../theme/colors";
import { formatDate, formatNumber } from "../../utils/format";
import { bool, num, optNum, optStr, pick, str } from "../staff/normalize";
import { count, moneyFull, money, pct, periodWords, shareOf, clampPct } from "./format";
import { normalizePeriod, normalizeRanges } from "./normalize";
import { isObject, list, optId, payload, section, type Row } from "./readers";
import type {
  CeoPeriod,
  CeoRoom,
  CeoRoomCategory,
  CeoRoomPricing,
  CeoRoomSale,
  CeoRoomSalePricing,
  CeoRoomShift,
  CeoRoomShiftSummary,
  CeoRoomSummary,
  CeoRooms,
} from "./types";

// The CEO room report (GET api/ceo/rooms): rooms sold monthly, how full they are and the price each booking was sold
// at against the list price (the shift price for Morning / Evening bookings). Pure and unit-tested
// (__tests__/rooms.test.ts): the normaliser never throws on a partial answer, the list filters and the card texts
// are built here so the screen only lays them out.

// ─── Normalising ──────────────────────────────────────────────────────────────────────────────────────────

/** Shifts in display order. */
export const ROOM_SHIFTS: readonly CeoRoomShift[] = ["24/7", "Morning", "Evening"];

/** Within this percent of the expected price a sale counts as "at" the price (the API's rule). */
export const ROOM_PRICE_TOLERANCE_PCT = 0.5;

/** Shown when the server says the report is not available and sends no message of its own. */
export const ROOMS_UNAVAILABLE_MESSAGE = "Run CEO_02_room_report on the database to see the room report.";

/**
 * A booking's shift from the API's spelling: "Morning" for text starting morning / shift_morning, "Evening" for
 * evening / night / shift_evening, else "24/7" (24/7, 24_7, 24/7-I8, empty).
 */
export function normalizeRoomShift(value: unknown): CeoRoomShift {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^shift[\s_-]*/, "");
  if (text.startsWith("morning")) return "Morning";
  if (text.startsWith("evening") || text.startsWith("night")) return "Evening";
  return "24/7";
}

/** "under" / "at" / "over" from the API's spelling (any case, "below" / "above" too); null when unknown. */
export function normalizeRoomPricing(value: unknown): CeoRoomPricing | null {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "under" || text === "below" || text === "underpriced") return "under";
  if (text === "over" || text === "above" || text === "overpriced") return "over";
  if (text === "at" || text === "on" || text === "equal") return "at";
  return null;
}

/** Under / at / over from the variance percent (0.5% either way is at the price). */
export function pricingFor(variancePct: number | null): CeoRoomPricing {
  if (variancePct == null) return "at";
  if (variancePct < -ROOM_PRICE_TOLERANCE_PCT) return "under";
  if (variancePct > ROOM_PRICE_TOLERANCE_PCT) return "over";
  return "at";
}

/** A positive amount, or null (no price known). */
const price = (value: number | null): number | null => (value != null && value > 0 ? value : null);

function toSale(r: Row, roomSeats: number, roomSeatPrice: number | null): CeoRoomSale {
  const shift = normalizeRoomShift(pick(r, "shift", "shiftRaw", "shiftType"));
  const seatsSold = optNum(r, "seatsSold", "seats") || roomSeats;
  const soldMonthly = num(r, "soldMonthly");
  const soldSeatPrice = optNum(r, "soldSeatPrice") ?? (seatsSold > 0 ? soldMonthly / seatsSold : 0);
  const shiftDiscountCapPct = num(r, "shiftDiscountCapPct", "discountCapPct");
  const listSeatPriceAtSale = price(optNum(r, "listSeatPriceAtSale", "listSeatPrice")) ?? roomSeatPrice;
  // CP_02: the fixed PKR discount a month (already off soldMonthly); 0 / false from an older API.
  const fixedMonthly = Math.max(0, num(r, "fixedMonthly"));
  // 24/7 is compared with the full list price (a cap stored for it does not apply); a shift with the price less its cap.
  const expectedSeatPrice =
    price(optNum(r, "expectedSeatPrice")) ??
    (listSeatPriceAtSale != null ? (shift === "24/7" ? listSeatPriceAtSale : listSeatPriceAtSale * (1 - shiftDiscountCapPct / 100)) : null);
  const base = {
    bookingId: optId(r, "bookingId", "id"),
    customer: optStr(r, "customer", "customerName", "tenant") ?? "Customer",
    shift,
    seatsSold,
    startOn: optStr(r, "startOn", "startDate"),
    endOn: optStr(r, "endOn", "endDate"),
    listSeatPriceAtSale,
    shiftDiscountCapPct,
    soldMonthly,
    soldSeatPrice,
    fixedMonthly,
    fixedDiscount: bool(r, "fixedDiscount") || fixedMonthly > 0,
  };
  if (expectedSeatPrice == null) {
    // No list price known: shown as "No list price", not compared (as the server does).
    return { ...base, expectedSeatPrice: null, expectedMonthly: null, varianceMonthly: null, variancePct: null, pricing: "unpriced" };
  }
  const variancePct = optNum(r, "variancePct") ?? (soldSeatPrice / expectedSeatPrice - 1) * 100;
  return {
    ...base,
    expectedSeatPrice,
    expectedMonthly: optNum(r, "expectedMonthly") ?? expectedSeatPrice * seatsSold,
    varianceMonthly: optNum(r, "varianceMonthly") ?? (soldSeatPrice - expectedSeatPrice) * seatsSold,
    variancePct,
    // The server's verdict; else from the percent.
    pricing: normalizeRoomPricing(pick(r, "pricing")) ?? pricingFor(variancePct),
  };
}

function toRoom(r: Row): CeoRoom {
  const spaceId = optId(r, "spaceId", "id");
  const code = optStr(r, "code", "spaceCode");
  const seats = num(r, "seats", "capacity");
  const listSeatPrice = price(optNum(r, "listSeatPrice", "seatPrice"));
  const occupiedDays = optNum(r, "occupiedDays");
  const periodDays = optNum(r, "periodDays");
  return {
    spaceId,
    name: optStr(r, "name", "spaceName") ?? code ?? (spaceId ? `Room ${spaceId}` : "Room"),
    code,
    locationId: optId(r, "locationId"),
    location: optStr(r, "location", "locationName"),
    spaceType: optStr(r, "spaceType", "spaceTypeName"),
    categoryCode: optStr(r, "categoryCode", "category"),
    seats,
    listSeatPrice,
    listRoomPrice: price(optNum(r, "listRoomPrice")) ?? (listSeatPrice != null && seats > 0 ? listSeatPrice * seats : null),
    occupiedNow: bool(r, "occupiedNow", "occupied"),
    periodOccupancyPct: clampPct(
      optNum(r, "periodOccupancyPct", "occupancyPct") ?? (occupiedDays != null && periodDays ? (occupiedDays / periodDays) * 100 : 0),
    ),
    occupiedDays,
    periodDays,
    sales: list(r, "sales", (s) => toSale(s, seats, listSeatPrice)),
    upcomingStartOn: optStr(r, "upcomingStartOn"),
  };
}

// ─── Room categories (private offices, shared spaces) ─────────────────────────────────────────────────────

/** The categories of the report's rooms, in the order the tiles show them (always both, as the server). */
export const ROOM_CATEGORIES: readonly string[] = ["PrivateOffice", "SharedSpace"];

/**
 * A category's label only when the server sends none (a server from before byCategory): the words of its code
 * ("PrivateOffice" -> "Private Office"), "Other" for rooms without one. The server's label (the database's) always wins.
 */
export function roomCategoryLabel(code: string | null | undefined): string {
  const c = String(code ?? "").trim();
  if (!c) return "Other";
  return c
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (ch) => ch.toUpperCase());
}

const sameCode = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A room's category as the tiles and the list group it: a known code in the report's spelling, else as sent. */
export function roomCategoryOf(room: Pick<CeoRoom, "categoryCode">): string {
  const c = String(room.categoryCode ?? "").trim();
  return ROOM_CATEGORIES.find((k) => sameCode(k, c)) ?? c;
}

/**
 * Occupancy per category worked out from the rooms, by the server's rule: both report categories first (zeros when
 * there are none), then any other code; days occupied from the rooms' days (room-days), else their mean percent.
 */
export function summarizeRoomCategories(rooms: readonly CeoRoom[]): CeoRoomCategory[] {
  const codes = [...ROOM_CATEGORIES];
  for (const room of rooms) {
    const c = roomCategoryOf(room);
    if (!codes.some((k) => sameCode(k, c))) codes.push(c);
  }
  return codes.map((code) => {
    const group = rooms.filter((r) => sameCode(roomCategoryOf(r), code));
    const occupiedNow = group.filter((r) => r.occupiedNow).length;
    const withDays = group.length > 0 && group.every((r) => (r.periodDays ?? 0) > 0);
    const sum = (f: (r: CeoRoom) => number) => group.reduce((total, r) => total + f(r), 0);
    return {
      categoryCode: code,
      label: roomCategoryLabel(code),
      rooms: group.length,
      occupiedNow,
      vacantNow: group.length - occupiedNow,
      occupancyNowPct: shareOf(occupiedNow, group.length),
      periodOccupancyPct: withDays
        ? shareOf(sum((r) => r.occupiedDays ?? 0), sum((r) => r.periodDays ?? 0))
        : group.length
          ? clampPct(sum((r) => r.periodOccupancyPct) / group.length)
          : 0,
    };
  });
}

/** The server's byCategory (its labels and figures), a missing figure from the rooms; none sent = worked out from them. */
function normalizeByCategory(value: unknown, worked: CeoRoomCategory[]): CeoRoomCategory[] {
  const rows = Array.isArray(value) ? value.filter(isObject) : [];
  if (!rows.length) return worked;
  return rows.map((row) => {
    const code = String(pick(row, "categoryCode", "code") ?? "").trim();
    const w = worked.find((k) => sameCode(k.categoryCode, code));
    const n = (key: Exclude<keyof CeoRoomCategory, "categoryCode" | "label">) => optNum(row, key) ?? w?.[key] ?? 0;
    return {
      categoryCode: w?.categoryCode ?? code,
      label: optStr(row, "label") ?? w?.label ?? roomCategoryLabel(code),
      rooms: n("rooms"),
      occupiedNow: n("occupiedNow"),
      vacantNow: n("vacantNow"),
      occupancyNowPct: clampPct(n("occupancyNowPct")),
      periodOccupancyPct: clampPct(n("periodOccupancyPct")),
    };
  });
}

const emptyShift = (shift: CeoRoomShift): CeoRoomShiftSummary => ({
  shift,
  sales: 0,
  under: 0,
  at: 0,
  over: 0,
  unpriced: 0,
  expectedMonthly: 0,
  soldMonthly: 0,
  varianceMonthly: 0,
});

/** The summary worked out from the rooms (used for whatever the server did not send). */
export function summarizeRooms(rooms: readonly CeoRoom[]): CeoRoomSummary {
  const shifts = new Map(ROOM_SHIFTS.map((s) => [s, emptyShift(s)]));
  let underMonthly = 0;
  let overMonthly = 0;
  for (const sale of rooms.flatMap((r) => r.sales)) {
    const s = shifts.get(sale.shift)!;
    s.sales += 1;
    s[sale.pricing] += 1;
    s.expectedMonthly += sale.expectedMonthly ?? 0;
    s.soldMonthly += sale.soldMonthly;
    s.varianceMonthly += sale.varianceMonthly ?? 0;
    if (sale.pricing === "under") underMonthly += sale.varianceMonthly ?? 0;
    if (sale.pricing === "over") overMonthly += sale.varianceMonthly ?? 0;
  }
  const byShift = ROOM_SHIFTS.map((s) => shifts.get(s)!);
  const total = (key: Exclude<keyof CeoRoomShiftSummary, "shift">) =>
    byShift.reduce((sum, s) => sum + s[key], 0);
  const occupiedNow = rooms.filter((r) => r.occupiedNow).length;
  return {
    rooms: rooms.length,
    occupiedNow,
    vacantNow: rooms.length - occupiedNow,
    occupancyNowPct: shareOf(occupiedNow, rooms.length),
    // Every room has the same days in the period: the mean of the rooms is occupied days / all days.
    periodOccupancyPct: rooms.length ? clampPct(rooms.reduce((sum, r) => sum + r.periodOccupancyPct, 0) / rooms.length) : 0,
    sales: total("sales"),
    under: total("under"),
    at: total("at"),
    over: total("over"),
    unpriced: total("unpriced"),
    listMonthly: total("expectedMonthly"),
    soldMonthly: total("soldMonthly"),
    varianceMonthly: total("varianceMonthly"),
    underMonthly: Math.min(0, underMonthly),
    overMonthly: Math.max(0, overMonthly),
    byShift,
    byCategory: summarizeRoomCategories(rooms),
  };
}

/** The server's byShift list as the three shifts in order (a missing shift as zeros, a repeated one added up). */
function normalizeByShift(value: unknown): CeoRoomShiftSummary[] {
  const shifts = new Map(ROOM_SHIFTS.map((s) => [s, emptyShift(s)]));
  for (const row of (value as unknown[]).filter(isObject)) {
    const s = shifts.get(normalizeRoomShift(pick(row, "shift")))!;
    s.sales += num(row, "sales", "count");
    s.under += num(row, "under");
    s.at += num(row, "at");
    s.over += num(row, "over");
    s.unpriced += num(row, "unpriced");
    s.expectedMonthly += num(row, "expectedMonthly", "listMonthly");
    s.soldMonthly += num(row, "soldMonthly");
    s.varianceMonthly += num(row, "varianceMonthly");
  }
  return ROOM_SHIFTS.map((s) => shifts.get(s)!);
}

function normalizeSummary(raw: Row | null, rooms: readonly CeoRoom[]): CeoRoomSummary {
  const worked = summarizeRooms(rooms);
  if (!raw) return worked;
  const n = (key: keyof CeoRoomSummary, ...aliases: string[]) => optNum(raw, key, ...aliases) ?? (worked[key] as number);
  const byShift = pick(raw, "byShift");
  return {
    rooms: n("rooms", "totalRooms"),
    occupiedNow: n("occupiedNow"),
    vacantNow: n("vacantNow"),
    occupancyNowPct: n("occupancyNowPct"),
    periodOccupancyPct: n("periodOccupancyPct"),
    sales: n("sales"),
    under: n("under"),
    at: n("at"),
    over: n("over"),
    unpriced: n("unpriced"),
    listMonthly: n("listMonthly", "expectedMonthly"),
    soldMonthly: n("soldMonthly"),
    varianceMonthly: n("varianceMonthly"),
    underMonthly: Math.min(0, n("underMonthly")),
    overMonthly: Math.max(0, n("overMonthly")),
    byShift: Array.isArray(byShift) ? normalizeByShift(byShift) : worked.byShift,
    byCategory: normalizeByCategory(pick(raw, "byCategory"), worked.byCategory),
  };
}

const isFalse = (value: unknown) => value === false || value === 0 || String(value).trim().toLowerCase() === "false";

/**
 * GET api/ceo/rooms answer (envelope or bare object). `available: false` (the server's database update CEO_02 has
 * not run) keeps only its message; anything else is read as the report, missing parts as zeros / empty lists and a
 * missing summary worked out from the rooms.
 */
export function normalizeCeoRooms(raw: unknown, requested: CeoPeriod = "month"): CeoRooms {
  const d = payload(raw);
  if (isFalse(pick(d, "available"))) {
    const envelopeMessage = isObject(raw) ? optStr(raw, "message") : null;
    return { available: false, message: optStr(d, "message") ?? envelopeMessage ?? ROOMS_UNAVAILABLE_MESSAGE };
  }
  const rooms = list(d, "rooms", toRoom);
  return {
    available: true,
    period: pick(d, "period") != null ? normalizePeriod(pick(d, "period")) : requested,
    periodLabel: str(d, "periodLabel"),
    generatedAt: optStr(d, "generatedAt"),
    ...normalizeRanges(d),
    summary: normalizeSummary(section(d, "summary"), rooms),
    rooms,
  };
}

// ─── Filters ──────────────────────────────────────────────────────────────────────────────────────────────

export type RoomShiftFilter = "all" | CeoRoomShift;
/** "vacant": rooms without a booking in the period (labelled "Not let", so it is not read as "Vacant now"). */
export type RoomPricingFilter = "all" | CeoRoomSalePricing | "vacant";
/** Whether a booking covers this moment (a category tile shows the rooms in use now). */
export type RoomNowFilter = "all" | "occupied" | "vacant";
/** "all", or a room category code (roomCategoryOf). */
export type RoomCategoryFilter = string;
export type RoomFilters = { shift: RoomShiftFilter; pricing: RoomPricingFilter; now: RoomNowFilter; category: RoomCategoryFilter };

export const ALL_ROOMS: RoomFilters = { shift: "all", pricing: "all", now: "all", category: "all" };

export const ROOM_NOW_FILTERS: readonly RoomNowFilter[] = ["all", "occupied", "vacant"];

const NOW_LABELS: Record<RoomNowFilter, string> = { all: "All", occupied: "Occupied now", vacant: "Vacant now" };

export const roomNowLabel = (value: RoomNowFilter): string => NOW_LABELS[value];

/** A room passes the "right now" and the category filters. */
export function roomNowMatches(room: CeoRoom, filters: RoomFilters): boolean {
  const category = filters.category ?? "all";
  return (
    (filters.now === "all" || room.occupiedNow === (filters.now === "occupied")) &&
    (category === "all" || roomCategoryOf(room) === category)
  );
}

export const ROOM_SHIFT_FILTERS: readonly RoomShiftFilter[] = ["all", ...ROOM_SHIFTS];
/** "No list price" is offered only when the report has such sales (roomPricingFilters). */
export const ROOM_PRICING_FILTERS: readonly RoomPricingFilter[] = ["all", "under", "at", "over", "unpriced", "vacant"];

export const ROOM_PRICING_LABELS: Record<CeoRoomSalePricing, string> = { under: "Under", at: "At", over: "Over", unpriced: "No list price" };

const FILTER_LABELS: Record<RoomShiftFilter | RoomPricingFilter, string> = {
  all: "All",
  "24/7": "24/7",
  Morning: "Morning",
  Evening: "Evening",
  under: "Under",
  at: "At",
  over: "Over",
  unpriced: "No list price",
  // Not let in the period (the CMS word): "Vacant" sat next to "Vacant now" and read the same.
  vacant: "Not let",
};

export const roomFilterLabel = (value: RoomShiftFilter | RoomPricingFilter): string => FILTER_LABELS[value];

/** A room in the list: the room and its sales that pass the filters. */
export type RoomListItem = {
  room: CeoRoom;
  /** In the server's order; [] for a vacant room. */
  sales: CeoRoomSale[];
  /** No booking in the period: one row that says so. */
  vacant: boolean;
};

/** A sale passes when its shift and its pricing match (a "Vacant" filter passes no sale). */
export function saleMatches(sale: CeoRoomSale, filters: RoomFilters): boolean {
  return (filters.shift === "all" || sale.shift === filters.shift) && (filters.pricing === "all" || sale.pricing === filters.pricing);
}

/** A room without a sale in the period (one "vacant" row) has no shift: it shows under All shifts only. */
export function vacantMatches(filters: RoomFilters): boolean {
  return filters.shift === "all" && (filters.pricing === "all" || filters.pricing === "vacant");
}

/** The rooms with something to show for these filters, in the server's order. */
export function filterRooms(rooms: readonly CeoRoom[], filters: RoomFilters): RoomListItem[] {
  const out: RoomListItem[] = [];
  for (const room of rooms) {
    if (!roomNowMatches(room, filters)) continue;
    if (!room.sales.length) {
      if (vacantMatches(filters)) out.push({ room, sales: [], vacant: true });
      continue;
    }
    const sales = room.sales.filter((s) => saleMatches(s, filters));
    if (sales.length) out.push({ room, sales, vacant: false });
  }
  return out;
}

/** Rows (sales, and one per vacant room) that pass these filters. */
export function countRows(rooms: readonly CeoRoom[], filters: RoomFilters): number {
  return rooms.reduce((sum, r) => {
    if (!roomNowMatches(r, filters)) return sum;
    return sum + (r.sales.length ? r.sales.filter((s) => saleMatches(s, filters)).length : vacantMatches(filters) ? 1 : 0);
  }, 0);
}

export type RoomFilterCounts = {
  /** Rows each shift option would show with the current pricing filter. */
  shift: Record<RoomShiftFilter, number>;
  /** Rows each pricing option would show with the current shift filter. */
  pricing: Record<RoomPricingFilter, number>;
  /** Rows each "right now" option would show with the other filters. */
  now: Record<RoomNowFilter, number>;
  /** Rows "all" and each category of the rooms would show with the other filters. */
  category: Record<RoomCategoryFilter, number>;
};

/** How many rows each filter chip would show, keeping the other filters as they are. */
export function roomFilterCounts(rooms: readonly CeoRoom[], filters: RoomFilters): RoomFilterCounts {
  const shift = {} as Record<RoomShiftFilter, number>;
  for (const value of ROOM_SHIFT_FILTERS) shift[value] = countRows(rooms, { ...filters, shift: value });
  const pricing = {} as Record<RoomPricingFilter, number>;
  for (const value of ROOM_PRICING_FILTERS) pricing[value] = countRows(rooms, { ...filters, pricing: value });
  const now = {} as Record<RoomNowFilter, number>;
  for (const value of ROOM_NOW_FILTERS) now[value] = countRows(rooms, { ...filters, now: value });
  const category: Record<RoomCategoryFilter, number> = { all: countRows(rooms, { ...filters, category: "all" }) };
  for (const value of new Set(rooms.map(roomCategoryOf))) category[value] = countRows(rooms, { ...filters, category: value });
  return { shift, pricing, now, category };
}

/** The category chips to offer: All, then the categories that have rooms (the server's labels); none when only one has. */
export function roomCategoryFilters(categories: readonly CeoRoomCategory[]): { value: RoomCategoryFilter; label: string }[] {
  const withRooms = categories.filter((c) => c.rooms > 0);
  return withRooms.length > 1 ? [{ value: "all", label: "All" }, ...withRooms.map((c) => ({ value: c.categoryCode, label: c.label }))] : [];
}

// ─── Display ──────────────────────────────────────────────────────────────────────────────────────────────

/** Pill, chart and figure tones: under the price is a loss, over it a premium, no list price needs a look. */
export const ROOM_PRICING_TONES: Record<CeoRoomSalePricing, Tone> = { under: "danger", at: "neutral", over: "success", unpriced: "warning" };

/** The pricing chips to offer: "No list price" only when the report has such sales (or it is the one chosen). */
export function roomPricingFilters(rooms: readonly CeoRoom[], chosen: RoomPricingFilter = "all"): RoomPricingFilter[] {
  const unpriced = chosen === "unpriced" || rooms.some((r) => r.sales.some((s) => s.pricing === "unpriced"));
  return ROOM_PRICING_FILTERS.filter((f) => f !== "unpriced" || unpriced);
}

/** "+PKR 5,000" / "-PKR 12,000" / "PKR 0" (full). */
export function signedMoney(value: number): string {
  const v = Math.round(value * 100) / 100;
  return v > 0 ? `+${moneyFull(v)}` : moneyFull(v === 0 ? 0 : v);
}

/** "+PKR 5K" / "-PKR 120K" (compact). */
export function signedMoneyCompact(value: number): string {
  const v = Math.round(value);
  return v > 0 ? `+${money(v)}` : money(v === 0 ? 0 : v);
}

/** "+4.2%" / "-14.3%" / "0%"; "—" when unknown. */
export function signedPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0%";
  return rounded > 0 ? `+${pct(rounded)}` : pct(rounded);
}

export const seatsText = (n: number): string => `${count(n)} ${n === 1 ? "seat" : "seats"}`;

/** A category tile's texts: "11 of 56" in use now, then the share, the vacant rooms and its days occupied in the period. */
export function roomCategoryTile(c: CeoRoomCategory): { label: string; value: string; sub: string; tone: Tone; hint: string | null } {
  if (!c.rooms) return { label: c.label, value: "0 of 0", sub: "No rooms", tone: "neutral", hint: null };
  return {
    label: c.label,
    value: `${count(c.occupiedNow)} of ${count(c.rooms)}`,
    sub: `${pct(c.occupancyNowPct)} now · ${count(c.vacantNow)} vacant · ${pct(c.periodOccupancyPct)} days occupied`,
    tone: c.occupancyNowPct >= 70 ? "success" : c.occupancyNowPct >= 40 ? "primary" : "warning",
    hint: `Shows the ${c.label} rooms in use now in the list below`,
  };
}

const dateRange = (start: string | null, end: string | null): string | null => {
  if (start && end) return `${formatDate(start)} to ${formatDate(end)}`;
  if (start) return `from ${formatDate(start)}`;
  if (end) return `until ${formatDate(end)}`;
  return null;
};

const joined = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

export type RoomFigure = { label: string; value: string; tone?: Tone };

export type RoomSaleView = {
  key: string;
  tenant: string;
  /** "Morning · 4 seats · 1 Oct 2026 to 31 Dec 2026". */
  detail: string;
  pricing: CeoRoomSalePricing;
  /** The pill: "Under price" / "At price" / "Over price" / "No list price". */
  pricingLabel: string;
  tone: Tone;
  /**
   * List, expected and sold per seat, and the difference a month (with its percent); without a list price: sold per
   * seat and sold a month.
   */
  figures: RoomFigure[];
  /** How the expected price of a shift booking was worked out, why an unpriced one is not compared, or null. */
  note: string | null;
  accessibilityLabel: string;
};

export type RoomCardView = {
  key: string;
  title: string;
  /** "PO-12 · I-8 · Private Office · 4 seats". */
  subtitle: string;
  now: { label: string; tone: Tone };
  /** "List PKR 35,000 a seat · PKR 140,000 a room · 72% occupied this month". */
  facts: string;
  vacant: boolean;
  /** "No booking this month" for a room not let in the period. */
  vacantText: string;
  /** "Starts 5 Nov 2026": the next confirmed booking, starting after the period (CP_02); null when none / not sent. */
  upcomingText: string | null;
  sales: RoomSaleView[];
  /** The room's own part (title to facts) for screen readers. */
  accessibilityLabel: string;
};

/** One sale's texts. */
export function roomSaleView(sale: CeoRoomSale, index: number): RoomSaleView {
  const unpriced = sale.pricing === "unpriced";
  const pricingLabel = unpriced ? ROOM_PRICING_LABELS.unpriced : `${ROOM_PRICING_LABELS[sale.pricing]} price`;
  const tone = ROOM_PRICING_TONES[sale.pricing];
  const figures: RoomFigure[] = unpriced
    ? [
        { label: "Sold per seat", value: moneyFull(sale.soldSeatPrice) },
        { label: "Sold a month", value: moneyFull(sale.soldMonthly) },
      ]
    : [
        { label: "List per seat", value: moneyFull(sale.listSeatPriceAtSale) },
        { label: "Expected per seat", value: moneyFull(sale.expectedSeatPrice) },
        { label: "Sold per seat", value: moneyFull(sale.soldSeatPrice) },
        {
          label: "Difference a month",
          value: `${signedMoney(sale.varianceMonthly ?? 0)} (${signedPct(sale.variancePct)})`,
          tone: sale.pricing === "at" ? undefined : tone,
        },
      ];
  // The cap is only applied to Morning / Evening bookings (a 24/7 one may carry a cap that does not apply).
  const note = unpriced
    ? "No list price was set for this room, so this booking is not compared"
    : sale.shift !== "24/7" && sale.shiftDiscountCapPct > 0
      ? `${sale.shift} price: list less the ${pct(sale.shiftDiscountCapPct)} shift discount`
      : null;
  const detail = joined(
    sale.shift,
    seatsText(sale.seatsSold),
    dateRange(sale.startOn, sale.endOn),
    // CP_02: a fixed PKR discount (already off the sold price), as the CMS sale line.
    (sale.fixedMonthly ?? 0) > 0 && `fixed discount ${moneyFull(sale.fixedMonthly ?? 0)} a month`,
  );
  return {
    key: `sale-${sale.bookingId ?? "x"}-${index}`,
    tenant: sale.customer,
    detail,
    pricing: sale.pricing,
    pricingLabel,
    tone,
    figures,
    note,
    accessibilityLabel: [
      sale.customer,
      detail,
      unpriced ? pricingLabel : `${ROOM_PRICING_LABELS[sale.pricing]} the expected price`,
      ...figures.map((f) => `${f.label} ${f.value}`),
      note,
    ]
      .filter(Boolean)
      .join(", "),
  };
}

/** A room card's texts (the room, whether it is in use now, and its sales that pass the filters). */
export function roomCardView(item: RoomListItem, period: CeoPeriod, index = 0): RoomCardView {
  const { room } = item;
  const words = periodWords(period);
  const subtitle = joined(room.code && room.code !== room.name ? room.code : null, room.location, room.spaceType, room.seats > 0 && seatsText(room.seats));
  const now = room.occupiedNow ? { label: "Occupied now", tone: "success" as Tone } : { label: "Vacant now", tone: "neutral" as Tone };
  const facts = joined(
    room.listSeatPrice != null ? `List ${moneyFull(room.listSeatPrice)} a seat` : "No list price",
    room.listSeatPrice != null && room.listRoomPrice != null && room.seats > 1 ? `${moneyFull(room.listRoomPrice)} a room` : null,
    `${pct(room.periodOccupancyPct)} occupied ${words}`,
  );
  return {
    key: room.spaceId ? `room-${room.spaceId}` : `room-${room.name}-${index}`,
    title: room.name,
    subtitle,
    now,
    facts,
    vacant: item.vacant,
    vacantText: `No booking ${words}`,
    upcomingText: room.upcomingStartOn ? `Starts ${formatDate(room.upcomingStartOn)}` : null,
    sales: item.sales.map(roomSaleView),
    accessibilityLabel: [room.name, subtitle, now.label, facts].filter(Boolean).join(", "),
  };
}

/** "Showing 10 of 34 rooms" / "34 rooms" / "1 room". */
export function roomsShownText(shown: number, total: number): string {
  const noun = total === 1 ? "room" : "rooms";
  return shown < total ? `Showing ${formatNumber(shown, 0)} of ${formatNumber(total, 0)} ${noun}` : `${formatNumber(total, 0)} ${noun}`;
}
