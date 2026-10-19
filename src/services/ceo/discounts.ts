import { formatDate } from "../../utils/format";
import { staffGet } from "../staff/http";
import { bool, num, optNum, optStr, pick, str, withQuery } from "../staff/normalize";
import { positiveId } from "./drill";
import { ceoErrorView, statusOf, toCeoError, withDatabaseUpdateMessage, type CeoErrorView } from "./errors";
import { serverMessage } from "../apiClient";
import { count, money, moneyFull, pct } from "./format";
import { drillPeriodParams, periodQuery, rangeOf } from "./period";
import { list, optId, payload, section, type Row } from "./readers";
import { normalizeRoomShift } from "./rooms";
import type { CeoPeriod, CeoRoomShift, CeoScope, DashRange } from "./types";

// The CEO dashboard's Discounts section (GET api/ceo/discounts and api/ceo/discounts/records/{kind}; database update
// DD_01). Discount a month of a booking = how far it was sold below its expected price (24/7: the room's list price x
// seats; Morning / Evening: that price less the location's shift discount; only what the Rooms section calls "under")
// plus its fixed PKR discount a month. Invoices: the discount on the invoices issued in the period, the same discounts
// as billed (shown on its own). Pure and unit-tested (__tests__/discounts.test.ts) apart from the two GETs: the
// normalisers never throw on a partial answer, and the texts the section shows are built here.

// ─── Types ────────────────────────────────────────────────────────────────────────────────────────────────

export type CeoDiscountSummary = {
  bookings: number;
  priced: number;
  unpriced: number;
  discounted: number;
  expectedMonthly: number;
  baseMonthly: number;
  soldMonthly: number;
  discountMonthly: number;
  discountPct: number;
  averageDiscountPct: number;
  belowPriceMonthly: number;
  belowPriceBookings: number;
  fixedMonthly: number;
  fixedBookings: number;
  newBookings: number;
  newDiscounted: number;
  newDiscountMonthly: number;
  invoiceDiscount: number;
  invoicesDiscounted: number;
  invoiceDiscountPaid: number;
};

/** A location, a seller or a shift; key null = no location / no salesperson recorded. */
export type CeoDiscountGroup = {
  key: string | null;
  name: string;
  /** Seller only: the role's name from the database. */
  role: string | null;
  bookings: number;
  discounted: number;
  baseMonthly: number;
  discountMonthly: number;
  discountPct: number;
  largestMonthly: number;
  invoiceDiscount: number;
  invoicesDiscounted: number;
};

export type CeoDiscountBooking = {
  bookingId: number | null;
  customer: string;
  room: string;
  locationId: number | null;
  location: string | null;
  shift: CeoRoomShift;
  seats: number;
  startOn: string | null;
  endOn: string | null;
  startedInPeriod: boolean;
  listSeatPrice: number | null;
  shiftDiscountCapPct: number;
  expectedMonthly: number | null;
  rentMonthly: number;
  soldMonthly: number;
  belowPriceMonthly: number;
  fixedMonthly: number;
  discountMonthly: number;
  discountPct: number;
  baseMonthly: number;
  sellerId: number | null;
  seller: string | null;
  sellerRole: string | null;
};

export type CeoDiscountInvoice = {
  invoiceId: number | null;
  invoiceNumber: string;
  customer: string;
  room: string | null;
  location: string | null;
  issuedOn: string | null;
  subTotal: number;
  discount: number;
  total: number;
  status: string;
  paid: boolean;
};

export type CeoDiscounts =
  | { available: false; message: string; period: CeoPeriod; periodLabel: string; range: DashRange | null }
  | {
      available: true;
      period: CeoPeriod;
      periodLabel: string;
      range: DashRange | null;
      summary: CeoDiscountSummary;
      byLocation: CeoDiscountGroup[];
      bySeller: CeoDiscountGroup[];
      byShift: CeoDiscountGroup[];
      biggest: CeoDiscountBooking[];
    };

export type CeoDiscountReport = Extract<CeoDiscounts, { available: true }>;

export type CeoDiscountRecordKind = "bookings" | "invoices";

/** What a drill-down list is narrowed to (besides the dashboard's period and location). */
export type CeoDiscountFilter = {
  /** A location id, or "none" (not tied to a location). */
  locationId?: number | "none" | null;
  /** A user id, or "none" (no salesperson recorded). */
  sellerId?: number | "none" | null;
  shift?: CeoRoomShift | null;
  newOnly?: boolean;
  /** Every booking, not only the discounted ones (e.g. "0 of 11 new deals discounted" still lists its 11). */
  all?: boolean;
};

export type CeoDiscountRecords = {
  kind: CeoDiscountRecordKind;
  title: string;
  total: number;
  discountTotal: number;
  baseTotal: number;
  discountPct: number;
  bookings: CeoDiscountBooking[];
  invoices: CeoDiscountInvoice[];
};

// ─── Normalising ──────────────────────────────────────────────────────────────────────────────────────────

/** Shown when the server says the section is not available and sends no message of its own. */
export const DISCOUNTS_UNAVAILABLE_MESSAGE = "Database update needed: run the script DD_01_ceo_discounts_TEST to see the discounts.";

export const DISCOUNT_SHIFTS: readonly CeoRoomShift[] = ["24/7", "Morning", "Evening"];

const SUMMARY_KEYS: readonly (keyof CeoDiscountSummary)[] = [
  "bookings", "priced", "unpriced", "discounted", "expectedMonthly", "baseMonthly", "soldMonthly", "discountMonthly", "discountPct",
  "averageDiscountPct", "belowPriceMonthly", "belowPriceBookings", "fixedMonthly", "fixedBookings", "newBookings", "newDiscounted",
  "newDiscountMonthly", "invoiceDiscount", "invoicesDiscounted", "invoiceDiscountPaid",
];

const share = (part: number, whole: number) => (whole > 0 ? Math.round((part * 1000) / whole) / 10 : 0);

export function emptyDiscountSummary(): CeoDiscountSummary {
  return Object.fromEntries(SUMMARY_KEYS.map((k) => [k, 0])) as CeoDiscountSummary;
}

function toGroup(r: Row): CeoDiscountGroup {
  const discountMonthly = Math.max(0, num(r, "discountMonthly"));
  const baseMonthly = Math.max(0, num(r, "baseMonthly"));
  return {
    key: optStr(r, "key"),
    name: optStr(r, "name") ?? "—",
    role: optStr(r, "role"),
    bookings: num(r, "bookings"),
    discounted: num(r, "discounted"),
    baseMonthly,
    discountMonthly,
    discountPct: optNum(r, "discountPct") ?? share(discountMonthly, baseMonthly),
    largestMonthly: num(r, "largestMonthly"),
    invoiceDiscount: num(r, "invoiceDiscount"),
    invoicesDiscounted: num(r, "invoicesDiscounted"),
  };
}

export function toDiscountBooking(r: Row): CeoDiscountBooking {
  const below = Math.max(0, num(r, "belowPriceMonthly"));
  const fixed = Math.max(0, num(r, "fixedMonthly"));
  const discountMonthly = optNum(r, "discountMonthly") ?? below + fixed;
  const baseMonthly = num(r, "baseMonthly");
  const sellerId = optId(r, "sellerId");
  return {
    bookingId: optId(r, "bookingId", "id"),
    customer: optStr(r, "customer") ?? "Customer",
    room: optStr(r, "room", "code") ?? "Room",
    locationId: optId(r, "locationId"),
    location: optStr(r, "location"),
    shift: normalizeRoomShift(pick(r, "shift")),
    seats: num(r, "seats"),
    startOn: optStr(r, "startOn"),
    endOn: optStr(r, "endOn"),
    startedInPeriod: bool(r, "startedInPeriod"),
    listSeatPrice: optNum(r, "listSeatPrice"),
    shiftDiscountCapPct: num(r, "shiftDiscountCapPct"),
    expectedMonthly: optNum(r, "expectedMonthly"),
    rentMonthly: num(r, "rentMonthly"),
    soldMonthly: num(r, "soldMonthly"),
    belowPriceMonthly: below,
    fixedMonthly: fixed,
    discountMonthly,
    discountPct: optNum(r, "discountPct") ?? share(discountMonthly, baseMonthly),
    baseMonthly,
    sellerId,
    seller: sellerId ? optStr(r, "seller") : null,
    sellerRole: sellerId ? optStr(r, "sellerRole") : null,
  };
}

export function toDiscountInvoice(r: Row): CeoDiscountInvoice {
  return {
    invoiceId: optId(r, "invoiceId", "id"),
    invoiceNumber: str(r, "invoiceNumber"),
    customer: optStr(r, "customer") ?? "Customer",
    room: optStr(r, "room"),
    location: optStr(r, "location"),
    issuedOn: optStr(r, "issuedOn"),
    subTotal: num(r, "subTotal"),
    discount: num(r, "discount"),
    total: num(r, "total"),
    status: str(r, "status"),
    paid: bool(r, "paid"),
  };
}

const PERIODS: readonly CeoPeriod[] = ["month", "quarter", "year", "custom"];

/**
 * GET api/ceo/discounts as the section uses it: every field defaulted, the shifts always 24/7, Morning, Evening, the
 * biggest discounts biggest first. available: false (DD_01 not run) keeps only the server's message.
 */
export function normalizeCeoDiscounts(raw: unknown, period: CeoPeriod): CeoDiscounts {
  const d = payload(raw);
  const sent = optStr(d, "period");
  const head = {
    period: sent && (PERIODS as readonly string[]).includes(sent) ? (sent as CeoPeriod) : period,
    periodLabel: str(d, "periodLabel"),
    range: rangeOf(pick(d, "from"), pick(d, "to")),
  };
  const flag = pick(d, "available");
  if (!Object.keys(d).length || flag === false || flag === 0 || String(flag).toLowerCase() === "false") {
    return { available: false, message: optStr(d, "message") ?? DISCOUNTS_UNAVAILABLE_MESSAGE, ...head };
  }
  const s = section(d, "summary") ?? {};
  const summary = Object.fromEntries(SUMMARY_KEYS.map((k) => [k, num(s, k)])) as CeoDiscountSummary;
  const shifts = new Map(list(d, "byShift", toGroup).map((g) => [normalizeRoomShift(g.key ?? g.name), g]));
  return {
    available: true,
    ...head,
    summary,
    byLocation: list(d, "byLocation", toGroup),
    bySeller: list(d, "bySeller", toGroup),
    byShift: DISCOUNT_SHIFTS.map((shift) => shifts.get(shift) ?? toGroup({ key: shift, name: shift })),
    biggest: list(d, "biggest", toDiscountBooking).sort((a, b) => b.discountMonthly - a.discountMonthly),
  };
}

export function normalizeDiscountRecords(kind: CeoDiscountRecordKind, raw: unknown): CeoDiscountRecords {
  const d = payload(raw);
  const bookings = kind === "bookings" ? list(d, "rows", toDiscountBooking) : [];
  const invoices = kind === "invoices" ? list(d, "rows", toDiscountInvoice) : [];
  return {
    kind,
    title: str(d, "title"),
    total: optNum(d, "total") ?? bookings.length + invoices.length,
    discountTotal: num(d, "discountTotal"),
    baseTotal: num(d, "baseTotal"),
    discountPct: num(d, "discountPct"),
    bookings,
    invoices,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────────────────────────────────

export const DISCOUNT_ENDPOINTS = {
  discounts: "/ceo/discounts",
  records: (kind: CeoDiscountRecordKind) => `/ceo/discounts/records/${kind}`,
} as const;

/** The section's own database update (DD_01_ceo_discounts_TEST / _LIVE): no word boundary after its number. */
const DISCOUNTS_UPDATE = /\bDD_\d{2}(?!\d)/i;

/**
 * The server's own message for a 503 that names the section's database update ("Database update needed: run the script
 * DD_01_ceo_discounts_TEST ... to see the discounts."), shown as it is; null for anything else.
 */
export function discountsUpdateMessage(error: unknown): string | null {
  if (statusOf(error) !== 503 || !error || typeof error !== "object") return null;
  const e = error as { message?: unknown; details?: unknown };
  for (const text of [serverMessage(e.details), e.message]) {
    if (typeof text === "string" && DISCOUNTS_UPDATE.test(text) && text.trim().length <= 300) return text.trim();
  }
  return null;
}

/** Title, message and icon for an error in the section or its sheet: its own database update by name, else as the CEO screens. */
export function discountsErrorView(error: unknown): CeoErrorView {
  const own = discountsUpdateMessage(error);
  return own ? { title: "Database update needed", message: own, icon: "construct-outline", databaseUpdate: true } : ceoErrorView(error);
}

async function get(path: string): Promise<unknown> {
  try {
    return await staffGet(path);
  } catch (error) {
    const own = discountsUpdateMessage(error);
    throw own ? withDatabaseUpdateMessage(error, own) : toCeoError(error);
  }
}

/** GET api/ceo/discounts?period=&locationId= (custom: &from=&to=). CEO / super admin. */
export async function getCeoDiscounts(scope: CeoScope): Promise<CeoDiscounts> {
  const raw = await get(withQuery(DISCOUNT_ENDPOINTS.discounts, { ...periodQuery(scope.period, scope.range), locationId: positiveId(scope.locationId) }));
  return normalizeCeoDiscounts(raw, scope.period);
}

/** The query of a records list: the dashboard's period (custom: periodFrom / periodTo) and location, then the filter. */
export function discountRecordsParams(scope: CeoScope, filter: CeoDiscountFilter = {}): Record<string, string | number | boolean | null> {
  const loc = filter.locationId === "none" ? "none" : positiveId(filter.locationId) ?? positiveId(scope.locationId);
  const seller = filter.sellerId === "none" ? "none" : positiveId(filter.sellerId);
  return {
    period: scope.period,
    ...drillPeriodParams(scope),
    locationId: loc,
    sellerId: seller,
    shift: filter.shift ?? null,
    newOnly: filter.newOnly ? true : null,
    all: filter.all ? true : null,
  };
}

/** GET api/ceo/discounts/records/{kind}: the discounted bookings (biggest first) or the invoices with a discount. */
export async function getCeoDiscountRecords(kind: CeoDiscountRecordKind, scope: CeoScope, filter: CeoDiscountFilter = {}): Promise<CeoDiscountRecords> {
  const raw = await get(withQuery(DISCOUNT_ENDPOINTS.records(kind), discountRecordsParams(scope, filter)));
  return normalizeDiscountRecords(kind, raw);
}

// ─── Texts ────────────────────────────────────────────────────────────────────────────────────────────────

/** Full PKR in whole rupees for sentences ("PKR 252,429"). */
const rupees = (value: number) => moneyFull(Math.round(value));

/** "2 of 9 discounted · 4.5%" under a location / salesperson / shift. */
export function groupDetail(g: CeoDiscountGroup): string {
  if (!g.bookings) return g.invoicesDiscounted ? "Invoices only" : "No bookings";
  const parts = [`${count(g.discounted)} of ${count(g.bookings)} discounted`];
  if (g.discountMonthly > 0) parts.push(pct(g.discountPct));
  return parts.join(" · ");
}

/** The filter a breakdown row opens (key null: no location / no salesperson recorded). */
export function groupFilter(by: "location" | "seller" | "shift", g: CeoDiscountGroup): CeoDiscountFilter {
  if (by === "location") return { locationId: positiveId(g.key) ?? "none" };
  if (by === "seller") return { sellerId: positiveId(g.key) ?? "none" };
  return { shift: normalizeRoomShift(g.key ?? g.name) };
}

/** "Office 309 · 24/7 · 3 seats · I-8" under a booking. */
export function bookingDetail(b: CeoDiscountBooking, withLocation = true): string {
  return [b.room, b.shift, `${count(b.seats)} seat${b.seats === 1 ? "" : "s"}`, withLocation ? b.location : null].filter(Boolean).join(" · ");
}

/** "Sold by Luqman Ahmad (Super Admin)" / "No salesperson recorded". */
export function sellerText(b: Pick<CeoDiscountBooking, "seller" | "sellerRole">): string {
  if (!b.seller) return "No salesperson recorded";
  return b.sellerRole ? `Sold by ${b.seller} (${b.sellerRole})` : `Sold by ${b.seller}`;
}

/** "Expected PKR 105K, sold PKR 94.5K" (the expected price for 24/7, the shift price for Morning / Evening). */
export function priceLine(b: CeoDiscountBooking): string {
  const sold = `sold ${money(b.soldMonthly)}`;
  if (b.expectedMonthly == null) return `No list price, ${sold}`;
  return `Expected ${money(b.expectedMonthly)}, ${sold}`;
}

/** How the discount is made up: "PKR 10,500 below the price + PKR 1,000 fixed". */
export function discountMakeUp(b: CeoDiscountBooking): string {
  const parts: string[] = [];
  if (b.belowPriceMonthly > 0) parts.push(`${rupees(b.belowPriceMonthly)} below the ${b.shift === "24/7" ? "price" : "shift price"}`);
  if (b.fixedMonthly > 0) parts.push(`${rupees(b.fixedMonthly)} fixed discount`);
  return parts.join(" + ") || "No discount";
}

/** What a screen reader says for a discounted booking. */
export function bookingSpeech(b: CeoDiscountBooking): string {
  return [
    `${b.customer}, ${bookingDetail(b)}`,
    `${rupees(b.discountMonthly)} a month off, ${pct(b.discountPct)}`,
    priceLine(b),
    discountMakeUp(b),
    sellerText(b),
  ].join(". ");
}

/** "Issued 7 Oct 2026 · Office 351 · I-8" under an invoice. */
export function invoiceDetail(i: CeoDiscountInvoice): string {
  return [i.issuedOn ? `Issued ${formatDate(i.issuedOn)}` : null, i.room, i.location].filter(Boolean).join(" · ");
}

/** The line under a records list's title: "4 bookings · PKR 49,000 a month off PKR 650,000 (7.5%)". */
export function recordsSummary(r: CeoDiscountRecords): string {
  const what = r.kind === "invoices" ? "invoice" : "booking";
  const shown = r.kind === "invoices" ? r.invoices.length : r.bookings.length;
  const head = r.total > shown ? `Showing the biggest ${count(shown)} of ${count(r.total)}` : `${count(r.total)} ${what}${r.total === 1 ? "" : "s"}`;
  if (r.discountTotal <= 0) return head;
  return r.kind === "invoices"
    ? `${head} · ${rupees(r.discountTotal)} off ${rupees(r.baseTotal)} (${pct(r.discountPct)})`
    : `${head} · ${rupees(r.discountTotal)} a month off ${rupees(r.baseTotal)} expected (${pct(r.discountPct)})`;
}
