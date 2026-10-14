import { INQUIRY_TYPE_LABELS, normalizeInquiryType } from "../../theme/inquiryTypes";
import { bool, num, optNum, optStr, pick, str, unwrapEnvelope } from "../staff/normalize";
import { AGING_LABELS, AGING_ORDER, FUNNEL_LABELS, FUNNEL_ORDER, isMonthKey, monthLabel } from "./format";
import type {
  CeoAgingBucket,
  CeoAgingBucketKey,
  CeoBookingRecord,
  CeoBreakdown,
  CeoBreakdownMetric,
  CeoBreakdownRow,
  CeoDashboard,
  CeoFunnelStage,
  CeoFunnelStageKey,
  CeoInquiryRecord,
  CeoInquiryTypeCount,
  CeoInvoiceRecord,
  CeoLocation,
  CeoMoney,
  CeoOccupancy,
  CeoPeriod,
  CeoQuotationRecord,
  CeoRecordKind,
  CeoRecords,
  CeoSales,
  CeoSpaceRecord,
  CeoTeam,
} from "./types";

// Normalisers for the CEO API (pure, unit-tested in __tests__/normalize.test.ts). They never throw on a partial
// answer: unknown shapes become empty sections / lists, so the screens show their empty states instead of failing.

type Row = Record<string, any>;

const isObject = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);

/** The payload inside the envelope as an object ({} for anything else). */
function payload(raw: unknown): Row {
  const inner = unwrapEnvelope<unknown>(raw);
  return isObject(inner) ? inner : {};
}

/** The object at `key`, or null when missing / not an object. */
function section(raw: Row, key: string): Row | null {
  const value = pick(raw, key);
  return isObject(value) ? value : null;
}

/** Rows of the list at `key` (objects only), mapped; [] when missing. */
function list<T>(raw: Row | null, key: string, map: (row: Row) => T): T[] {
  const value = raw ? pick(raw, key) : undefined;
  return Array.isArray(value) ? value.filter(isObject).map(map) : [];
}

/** A positive int id, or null. */
function optId(row: Row, ...keys: string[]): number | null {
  const n = optNum(row, ...keys);
  return n != null && Number.isInteger(n) && n > 0 ? n : null;
}

/** Sorted by the yyyy-MM `month` key, oldest first (rows without a month keep their place at the end). */
function byMonth<T extends { month: string }>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (!a.row.month || !b.row.month) return a.row.month ? -1 : b.row.month ? 1 : a.index - b.index;
      return a.row.month < b.row.month ? -1 : a.row.month > b.row.month ? 1 : a.index - b.index;
    })
    .map((x) => x.row);
}

export function normalizePeriod(value: unknown): CeoPeriod {
  return value === "quarter" || value === "year" ? value : "month";
}

// ─── Dashboard ────────────────────────────────────────────────────────────────────────────────────────────

/** Bucket key from the API's spelling ("1_30", "1-30", "90+", "notDue"...); null when unknown. */
export function agingKey(value: unknown): CeoAgingBucketKey | null {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/\+$/, "_plus")
    .replace(/days?$/, "")
    .replace(/_+$/, "");
  const aliases: Record<string, CeoAgingBucketKey> = {
    not_due: "not_due",
    notdue: "not_due",
    current: "not_due",
    "0": "not_due",
    "1_30": "1_30",
    "31_60": "31_60",
    "61_90": "61_90",
    "90_plus": "90_plus",
    "91_plus": "90_plus",
    over_90: "90_plus",
  };
  return aliases[key] ?? null;
}

/**
 * The five aging buckets in order (missing ones as zero) when the server sent any; unknown buckets are kept
 * after them. [] when there is no aging list at all.
 */
export function normalizeAging(value: unknown): CeoAgingBucket[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const known = new Map<CeoAgingBucketKey, CeoAgingBucket>();
  const extra: CeoAgingBucket[] = [];
  for (const row of value.filter(isObject)) {
    const key = agingKey(pick(row, "bucket"));
    const bucket: CeoAgingBucket = {
      bucket: key ?? str(row, "bucket"),
      label: optStr(row, "label") ?? (key ? AGING_LABELS[key] : str(row, "bucket") || "Other"),
      amount: num(row, "amount"),
      count: num(row, "count"),
    };
    if (!key) extra.push(bucket);
    else if (known.has(key)) {
      const prev = known.get(key)!;
      known.set(key, { ...prev, amount: prev.amount + bucket.amount, count: prev.count + bucket.count });
    } else known.set(key, bucket);
  }
  const ordered = AGING_ORDER.map(
    (key): CeoAgingBucket => known.get(key) ?? { bucket: key, label: AGING_LABELS[key], amount: 0, count: 0 },
  );
  return [...ordered, ...extra];
}

function normalizeMoney(raw: Row | null): CeoMoney | null {
  if (!raw) return null;
  return {
    invoiced: num(raw, "invoiced"),
    invoicedPrev: optNum(raw, "invoicedPrev"),
    collected: num(raw, "collected"),
    collectedPrev: optNum(raw, "collectedPrev"),
    outstanding: num(raw, "outstanding"),
    outstandingCount: num(raw, "outstandingCount"),
    overdue: num(raw, "overdue"),
    overdueCount: num(raw, "overdueCount"),
    collectionRate: optNum(raw, "collectionRate"),
    months: byMonth(
      list(raw, "months", (m) => ({ month: str(m, "month"), invoiced: num(m, "invoiced"), collected: num(m, "collected", "paid") })),
    ),
    aging: normalizeAging(pick(raw, "aging")),
    topCustomers: list(raw, "topCustomers", (c) => ({
      customerId: optId(c, "customerId"),
      name: optStr(c, "name", "customer") ?? "Customer",
      amount: num(c, "amount"),
      invoices: num(c, "invoices", "count"),
    })),
  };
}

function normalizeOccupancy(raw: Row | null): CeoOccupancy | null {
  if (!raw) return null;
  return {
    totalSpaces: num(raw, "totalSpaces"),
    occupiedSpaces: num(raw, "occupiedSpaces"),
    occupancyPct: num(raw, "occupancyPct"),
    occupancyPctPrev: optNum(raw, "occupancyPctPrev"),
    activeBookings: num(raw, "activeBookings"),
    newBookings: num(raw, "newBookings"),
    newBookingsPrev: optNum(raw, "newBookingsPrev"),
    months: byMonth(
      list(raw, "months", (m) => ({ month: str(m, "month"), occupancyPct: num(m, "occupancyPct"), newBookings: num(m, "newBookings") })),
    ),
    byType: list(raw, "byType", (t) => ({
      spaceTypeId: optId(t, "spaceTypeId"),
      name: optStr(t, "name", "spaceType") ?? "Other",
      total: num(t, "total"),
      occupied: num(t, "occupied"),
    })),
    byLocation: list(raw, "byLocation", (l) => ({
      locationId: optId(l, "locationId"),
      name: optStr(l, "name", "location") ?? "Location",
      total: num(l, "total"),
      occupied: num(l, "occupied"),
    })),
    leasesExpiring: list(raw, "leasesExpiring", (b) => ({
      bookingId: optId(b, "bookingId"),
      customer: optStr(b, "customer") ?? "Customer",
      space: optStr(b, "space"),
      location: optStr(b, "location"),
      endOn: optStr(b, "endOn"),
      monthlyAmount: optNum(b, "monthlyAmount"),
    })),
  };
}

/** Funnel stages in order (missing ones as zero) when the server sent any; [] when there is no funnel. */
export function normalizeFunnel(value: unknown): CeoFunnelStage[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const found = new Map<string, CeoFunnelStage>();
  const extra: CeoFunnelStage[] = [];
  for (const row of value.filter(isObject)) {
    const stage = str(row, "stage").trim().toLowerCase();
    const known = (FUNNEL_ORDER as readonly string[]).includes(stage);
    const item: CeoFunnelStage = {
      stage,
      label: optStr(row, "label") ?? (known ? FUNNEL_LABELS[stage as CeoFunnelStageKey] : stage || "Other"),
      count: num(row, "count"),
    };
    if (known) found.set(stage, item);
    else extra.push(item);
  }
  return [...FUNNEL_ORDER.map((stage) => found.get(stage) ?? { stage, label: FUNNEL_LABELS[stage], count: 0 }), ...extra];
}

/**
 * Inquiries by Type: Website, WhatsApp, Walk-In, Reference, Not set, in that order (duplicates and spellings such
 * as "Walk-In" / "walk_in" merged); a type the app does not know is kept after them with its own label.
 */
export function normalizeInquiryTypes(value: unknown): CeoInquiryTypeCount[] {
  if (!Array.isArray(value)) return [];
  const known = new Map<string, CeoInquiryTypeCount>();
  const extra = new Map<string, CeoInquiryTypeCount>();
  for (const row of value.filter(isObject)) {
    const raw = pick(row, "type");
    const type = normalizeInquiryType(raw);
    const n = num(row, "count");
    if (type) {
      const prev = known.get(type);
      known.set(type, { type, key: type, label: INQUIRY_TYPE_LABELS[type], count: (prev?.count ?? 0) + n });
    } else {
      const key = String(raw).trim();
      const prev = extra.get(key.toLowerCase());
      extra.set(key.toLowerCase(), { type: null, key, label: optStr(row, "label") ?? key, count: (prev?.count ?? 0) + n });
    }
  }
  const order = ["Website", "WhatsApp", "WalkIn", "Reference", "NotSet"];
  const ordered = order.map((t) => known.get(t)).filter((x): x is CeoInquiryTypeCount => !!x);
  return [...ordered, ...extra.values()];
}

function normalizeSales(raw: Row | null): CeoSales | null {
  if (!raw) return null;
  return {
    funnel: normalizeFunnel(pick(raw, "funnel")),
    conversionRate: optNum(raw, "conversionRate"),
    inquiriesByType: normalizeInquiryTypes(pick(raw, "inquiriesByType")),
    quotationValue: num(raw, "quotationValue"),
    bookingValue: num(raw, "bookingValue"),
  };
}

function normalizeTeam(raw: Row | null): CeoTeam | null {
  if (!raw) return null;
  return {
    perLocation: list(raw, "perLocation", (l) => ({
      locationId: optId(l, "locationId"),
      name: optStr(l, "name") ?? "Location",
      admins: num(l, "admins"),
      salesExecutives: num(l, "salesExecutives"),
      quotations: num(l, "quotations"),
      converted: num(l, "converted"),
    })),
    people: list(raw, "people", (p) => ({
      userId: optId(p, "userId"),
      name: optStr(p, "name") ?? "Team member",
      role: str(p, "role").replace(/_/g, " "),
      locations: optStr(p, "locations"),
      quotations: num(p, "quotations"),
      converted: num(p, "converted"),
      convertedValue: num(p, "convertedValue"),
    })),
  };
}

export function normalizeLocations(value: unknown): CeoLocation[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const out: CeoLocation[] = [];
  for (const row of value.filter(isObject)) {
    const id = optId(row, "locationId", "id");
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push({ locationId: id, name: optStr(row, "name", "locationName") ?? `Location ${id}` });
  }
  return out;
}

/** GET api/ceo/dashboard answer (envelope or bare object). */
export function normalizeCeoDashboard(raw: unknown, requested: CeoPeriod = "month"): CeoDashboard {
  const d = payload(raw);
  const period = pick(d, "period") != null ? normalizePeriod(pick(d, "period")) : requested;
  return {
    period,
    periodLabel: str(d, "periodLabel"),
    generatedAt: optStr(d, "generatedAt"),
    locations: normalizeLocations(pick(d, "locations")),
    money: normalizeMoney(section(d, "money")),
    occupancy: normalizeOccupancy(section(d, "occupancy")),
    sales: normalizeSales(section(d, "sales")),
    team: normalizeTeam(section(d, "team")),
  };
}

// ─── Breakdown ────────────────────────────────────────────────────────────────────────────────────────────

/** Title and value labels when the server sent none. */
const BREAKDOWN_DEFAULTS: Record<CeoBreakdownMetric, { title: string; valueLabel: string; value2Label: string | null }> = {
  revenue: { title: "Revenue by location", valueLabel: "Invoiced", value2Label: "Collected" },
  aging: { title: "Receivables by location", valueLabel: "Amount", value2Label: null },
  "occupancy-type": { title: "Occupancy by location", valueLabel: "Occupied", value2Label: "Total" },
  "occupancy-location": { title: "Occupancy by space type", valueLabel: "Occupied", value2Label: "Total" },
  "bookings-month": { title: "New bookings by location", valueLabel: "New bookings", value2Label: null },
  "inquiries-type": { title: "Inquiries by month", valueLabel: "Inquiries", value2Label: null },
  staff: { title: "Quotations by month", valueLabel: "Quotations", value2Label: "Converted" },
};

/** Row keys of these metrics are months (labels default to "Oct 2026"). */
const MONTH_ROWS: ReadonlySet<CeoBreakdownMetric> = new Set<CeoBreakdownMetric>(["inquiries-type", "staff"]);

/** GET api/ceo/breakdown answer. */
export function normalizeCeoBreakdown(raw: unknown, metric: CeoBreakdownMetric): CeoBreakdown {
  const d = payload(raw);
  const defaults = BREAKDOWN_DEFAULTS[metric] ?? { title: "Breakdown", valueLabel: "Value", value2Label: null };
  // An explicit null means "no second value"; only a missing field falls back to the metric's default.
  const sentValue2Label = Object.prototype.hasOwnProperty.call(d, "value2Label") || Object.prototype.hasOwnProperty.call(d, "Value2Label");
  const value2Label = sentValue2Label ? optStr(d, "value2Label") : defaults.value2Label;
  const rows = list(d, "rows", (r): CeoBreakdownRow => {
    const key = str(r, "key").trim();
    return {
      key,
      label: optStr(r, "label") ?? (MONTH_ROWS.has(metric) ? monthLabel(key) : key || "Other"),
      value: num(r, "value"),
      value2: optNum(r, "value2"),
      count: optNum(r, "count"),
    };
  });
  return {
    title: optStr(d, "title") ?? defaults.title,
    subtitle: optStr(d, "subtitle"),
    valueLabel: optStr(d, "valueLabel") ?? defaults.valueLabel,
    value2Label,
    // Month rows oldest first (as the chart reads them); other rows keep the server's order.
    rows: MONTH_ROWS.has(metric) && rows.every((r) => isMonthKey(r.key)) ? [...rows].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)) : rows,
  };
}

// ─── Records ──────────────────────────────────────────────────────────────────────────────────────────────

const RECORD_TITLES: Record<CeoRecordKind, string> = {
  invoices: "Invoices",
  spaces: "Spaces",
  bookings: "Bookings",
  inquiries: "Tour inquiries",
  quotations: "Quotations",
};

const toInvoice = (r: Row): CeoInvoiceRecord => ({
  invoiceId: optId(r, "invoiceId", "id"),
  invoiceNumber: optStr(r, "invoiceNumber", "invoiceNo"),
  customer: optStr(r, "customer", "customerName"),
  location: optStr(r, "location", "locationName"),
  issuedOn: optStr(r, "issuedOn", "invoiceDate"),
  dueOn: optStr(r, "dueOn", "dueDate"),
  total: num(r, "total", "totalAmount"),
  paid: num(r, "paid", "paidAmount"),
  balance: num(r, "balance"),
  status: optStr(r, "status"),
});

const toSpace = (r: Row): CeoSpaceRecord => ({
  spaceId: optId(r, "spaceId", "id"),
  name: optStr(r, "name", "spaceName"),
  spaceType: optStr(r, "spaceType"),
  location: optStr(r, "location", "locationName"),
  capacity: optNum(r, "capacity"),
  occupied: bool(r, "occupied"),
  customer: optStr(r, "customer"),
  bookingEndOn: optStr(r, "bookingEndOn"),
});

const toBooking = (r: Row): CeoBookingRecord => ({
  bookingId: optId(r, "bookingId", "id"),
  customer: optStr(r, "customer", "customerName"),
  space: optStr(r, "space", "spaceName"),
  location: optStr(r, "location", "locationName"),
  startOn: optStr(r, "startOn", "startDate"),
  endOn: optStr(r, "endOn", "endDate"),
  status: optStr(r, "status"),
  totalAmount: optNum(r, "totalAmount", "total"),
});

const toInquiry = (r: Row): CeoInquiryRecord => {
  const typeText = optStr(r, "type");
  return {
    inquiryId: optId(r, "inquiryId", "id"),
    name: optStr(r, "name"),
    phone: optStr(r, "phone"),
    type: normalizeInquiryType(typeText),
    typeText,
    referenceName: optStr(r, "referenceName"),
    status: optStr(r, "status"),
    createdOn: optStr(r, "createdOn", "createdAt"),
    feedback: optStr(r, "feedback"),
  };
};

const toQuotation = (r: Row): CeoQuotationRecord => ({
  quotationId: optId(r, "quotationId", "id"),
  quotationNumber: optStr(r, "quotationNumber", "quotationNo"),
  customer: optStr(r, "customer", "customerName"),
  location: optStr(r, "location", "locationName"),
  createdBy: optStr(r, "createdBy"),
  status: optStr(r, "status"),
  total: optNum(r, "total", "totalAmount"),
  createdOn: optStr(r, "createdOn", "createdAt"),
});

/** GET api/ceo/records/{kind} answer. `total` is never below the number of rows. */
export function normalizeCeoRecords(kind: CeoRecordKind, raw: unknown): CeoRecords {
  const inner = unwrapEnvelope<unknown>(raw);
  // A bare array is accepted too (rows only).
  const d: Row = Array.isArray(inner) ? { rows: inner } : isObject(inner) ? inner : {};
  const title = optStr(d, "title") ?? RECORD_TITLES[kind] ?? "Records";
  const totalOf = (n: number) => Math.max(n, Math.floor(num(d, "total")));
  switch (kind) {
    case "invoices": {
      const rows = list(d, "rows", toInvoice);
      return { kind, title, total: totalOf(rows.length), rows };
    }
    case "spaces": {
      const rows = list(d, "rows", toSpace);
      return { kind, title, total: totalOf(rows.length), rows };
    }
    case "bookings": {
      const rows = list(d, "rows", toBooking);
      return { kind, title, total: totalOf(rows.length), rows };
    }
    case "inquiries": {
      const rows = list(d, "rows", toInquiry);
      return { kind, title, total: totalOf(rows.length), rows };
    }
    case "quotations":
    default: {
      const rows = list(d, "rows", toQuotation);
      return { kind: "quotations", title, total: totalOf(rows.length), rows };
    }
  }
}
