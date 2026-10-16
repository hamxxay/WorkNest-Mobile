import type { Tone } from "../../theme/colors";
import { formatDate, formatNumber } from "../../utils/format";
import { bool, num, optNum, optStr, pick, str } from "../staff/normalize";
import { count, moneyFull, money, pct, periodWords, shareOf, clampPct } from "./format";
import { normalizePeriod } from "./normalize";
import { isObject, list, optId, payload, section, type Row } from "./readers";
import type {
  CeoPeriod,
  CeoRoom,
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
    periodOccupancyPct: clampPct(num(r, "periodOccupancyPct", "occupancyPct")),
    sales: list(r, "sales", (s) => toSale(s, seats, listSeatPrice)),
  };
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
    summary: normalizeSummary(section(d, "summary"), rooms),
    rooms,
  };
}

// ─── Filters ──────────────────────────────────────────────────────────────────────────────────────────────

export type RoomShiftFilter = "all" | CeoRoomShift;
export type RoomPricingFilter = "all" | CeoRoomSalePricing | "vacant";
export type RoomFilters = { shift: RoomShiftFilter; pricing: RoomPricingFilter };

export const ALL_ROOMS: RoomFilters = { shift: "all", pricing: "all" };

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
  vacant: "Vacant",
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
  return rooms.reduce((sum, r) => sum + (r.sales.length ? r.sales.filter((s) => saleMatches(s, filters)).length : vacantMatches(filters) ? 1 : 0), 0);
}

export type RoomFilterCounts = {
  /** Rows each shift option would show with the current pricing filter. */
  shift: Record<RoomShiftFilter, number>;
  /** Rows each pricing option would show with the current shift filter. */
  pricing: Record<RoomPricingFilter, number>;
};

/** How many rows each filter chip would show, keeping the other filter as it is. */
export function roomFilterCounts(rooms: readonly CeoRoom[], filters: RoomFilters): RoomFilterCounts {
  const shift = {} as Record<RoomShiftFilter, number>;
  for (const value of ROOM_SHIFT_FILTERS) shift[value] = countRows(rooms, { ...filters, shift: value });
  const pricing = {} as Record<RoomPricingFilter, number>;
  for (const value of ROOM_PRICING_FILTERS) pricing[value] = countRows(rooms, { ...filters, pricing: value });
  return { shift, pricing };
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
  /** "No booking this month" for a vacant room. */
  vacantText: string;
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
  const detail = joined(sale.shift, seatsText(sale.seatsSold), dateRange(sale.startOn, sale.endOn));
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
    sales: item.sales.map(roomSaleView),
    accessibilityLabel: [room.name, subtitle, now.label, facts].filter(Boolean).join(", "),
  };
}

/** "Showing 10 of 34 rooms" / "34 rooms" / "1 room". */
export function roomsShownText(shown: number, total: number): string {
  const noun = total === 1 ? "room" : "rooms";
  return shown < total ? `Showing ${formatNumber(shown, 0)} of ${formatNumber(total, 0)} ${noun}` : `${formatNumber(total, 0)} ${noun}`;
}
