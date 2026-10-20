import { INQUIRY_TYPE_LABELS, normalizeInquiryType } from "../../theme/inquiryTypes";
import { bool, num, optNum, optStr, pick, str, unwrapEnvelope } from "../staff/normalize";
import { byMonth, isObject, list, optId, payload, section, type Row } from "./readers";
import { AGING_LABELS, AGING_ORDER, FUNNEL_LABELS, FUNNEL_ORDER, isMonthKey, monthLabel } from "./format";
import { rangeOf } from "./period";
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
  CeoLeaseExpiring,
  CeoLeaseRecord,
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
  DashRange,
} from "./types";

// Normalisers for the CEO API (pure, unit-tested in __tests__/normalize.test.ts). They never throw on a partial
// answer: unknown shapes become empty sections / lists, so the screens show their empty states instead of failing.
//
// The generic pieces (the JSON readers in ./readers.ts, the funnel / inquiry-type / location / breakdown normalisers
// and the record row readers) are shared with the Sales Manager dashboard (services/salesManager), which follows
// the same contract style.

export function normalizePeriod(value: unknown): CeoPeriod {
  return value === "quarter" || value === "year" || value === "custom" ? value : "month";
}

/**
 * A custom period's ranges from an answer (from / to, and previousFrom / previousTo when `withPrevious`): set only
 * when sent, so a calendar period's answer keeps its shape.
 */
export function normalizeRanges(d: Row, withPrevious = false): { range?: DashRange; previousRange?: DashRange } {
  const range = rangeOf(pick(d, "from"), pick(d, "to"));
  const previous = withPrevious ? rangeOf(pick(d, "previousFrom"), pick(d, "previousTo")) : null;
  return { ...(range ? { range } : {}), ...(previous ? { previousRange: previous } : {}) };
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

/** Billed in advance: both null when the amount is not sent (an older API), else the count defaults to 0. */
function normalizeBilledInAdvance(raw: Row): Pick<CeoMoney, "billedInAdvance" | "billedInAdvanceCount"> {
  const amount = optNum(raw, "billedInAdvance");
  return amount == null ? { billedInAdvance: null, billedInAdvanceCount: null } : { billedInAdvance: amount, billedInAdvanceCount: num(raw, "billedInAdvanceCount") };
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
    ...normalizeBilledInAdvance(raw),
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

const toLeaseExpiring = (b: Row): CeoLeaseExpiring => ({
  bookingId: optId(b, "bookingId", "id"),
  customer: optStr(b, "customer", "customerName") ?? "Customer",
  space: optStr(b, "space", "spaceName"),
  location: optStr(b, "location", "locationName"),
  endOn: optStr(b, "endOn", "endDate"),
  monthlyAmount: optNum(b, "monthlyAmount"),
});

const toLeaseRecord = (b: Row): CeoLeaseRecord => ({ ...toLeaseExpiring(b), daysLeft: optNum(b, "daysLeft") });

function normalizeOccupancy(raw: Row | null): CeoOccupancy | null {
  if (!raw) return null;
  const leasesExpiring = list(raw, "leasesExpiring", toLeaseExpiring);
  const count = optNum(raw, "leasesExpiringCount");
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
      // 0 = "Other" (spaces without a type): kept, so the row opens like any other (as on the CMS).
      spaceTypeId: optNum(t, "spaceTypeId") === 0 ? 0 : optId(t, "spaceTypeId"),
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
    leasesExpiring,
    // The full count when sent (never below the list it came with); null = unknown (only the list).
    leasesExpiringCount: count == null ? null : Math.max(leasesExpiring.length, Math.floor(count)),
    leasesExpiringMonthly: optNum(raw, "leasesExpiringMonthly"),
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

/** Count of one funnel stage ("quotations", "bookings"...), 0 when it is not there. */
export function stageCount(stages: CeoFunnelStage[], stage: CeoFunnelStageKey): number {
  return stages.find((s) => s.stage === stage)?.count ?? 0;
}

/**
 * Quotations created in the period that were booked (the API's quotationsBooked), never more than the quotations.
 * An older API does not send it: the period's bookings stand in, at most one per quotation.
 */
export function quotationsBookedOf(sent: number | null, bookings: number, quotations: number): number {
  return Math.max(0, Math.min(sent ?? bookings, quotations));
}

/**
 * A conversion rate as sent, kept within 0-100 (an older API sent all bookings / quotations, which could pass
 * 100%); null when not sent. Conversion = quotations created in the period that were booked / quotations created
 * in the period (owner's rule, 16 Oct 2026).
 */
export function conversionRateOf(sent: number | null): number | null {
  return sent == null ? null : Math.max(0, Math.min(100, sent));
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
  const funnel = normalizeFunnel(pick(raw, "funnel"));
  return {
    funnel,
    conversionRate: conversionRateOf(optNum(raw, "conversionRate")),
    quotationsBooked: quotationsBookedOf(optNum(raw, "quotationsBooked"), stageCount(funnel, "bookings"), stageCount(funnel, "quotations")),
    inquiriesByType: normalizeInquiryTypes(pick(raw, "inquiriesByType")),
    quotationValue: num(raw, "quotationValue"),
    bookingValue: num(raw, "bookingValue"),
    // Not sent (an older API): its inquiry figures never followed the location.
    inquiriesAllLocations: typeof pick(raw, "inquiriesAllLocations") === "boolean" ? pick(raw, "inquiriesAllLocations") : true,
  };
}

/**
 * Team section: the sales executives only (the API leaves every other role out), highest revenue first (then
 * converted, quotations; ties keep the server's order). Revenue = their converted value (an older API: convertedValue).
 */
function normalizeTeam(raw: Row | null): CeoTeam | null {
  if (!raw) return null;
  const people = list(raw, "people", (p) => ({
    userId: optId(p, "userId"),
    name: optStr(p, "name") ?? "Team member",
    role: str(p, "role").replace(/_/g, " "),
    locations: optStr(p, "locations"),
    quotations: num(p, "quotations"),
    converted: num(p, "converted"),
    revenue: optNum(p, "revenue") ?? num(p, "convertedValue"),
  }))
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.revenue - a.p.revenue || b.p.converted - a.p.converted || b.p.quotations - a.p.quotations || a.i - b.i)
    .map(({ p }) => p);
  return {
    perLocation: list(raw, "perLocation", (l) => ({
      locationId: optId(l, "locationId"),
      name: optStr(l, "name") ?? "Location",
      salesExecutives: num(l, "salesExecutives"),
      quotations: num(l, "quotations"),
      converted: num(l, "converted"),
    })),
    people,
    salesExecutives: optNum(raw, "salesExecutives") ?? people.length,
    revenue: optNum(raw, "revenue") ?? people.reduce((sum, p) => sum + p.revenue, 0),
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
    ...normalizeRanges(d, true),
    locations: normalizeLocations(pick(d, "locations")),
    money: normalizeMoney(section(d, "money")),
    occupancy: normalizeOccupancy(section(d, "occupancy")),
    sales: normalizeSales(section(d, "sales")),
    team: normalizeTeam(section(d, "team")),
  };
}

// ─── Breakdown ────────────────────────────────────────────────────────────────────────────────────────────

/** Title and value labels of a breakdown, used when the server sent none. */
export type BreakdownDefaults = { title: string; valueLabel: string; value2Label: string | null };

/** Title and value labels when the server sent none. */
const BREAKDOWN_DEFAULTS: Record<CeoBreakdownMetric, BreakdownDefaults> = {
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

/**
 * A breakdown answer ({ title, subtitle, valueLabel, value2Label, rows }) with these defaults. With `monthRows`
 * the row keys are yyyy-MM months: labels default to "Oct 2026" and rows are sorted oldest first.
 */
export function normalizeBreakdownWith(raw: unknown, defaults: BreakdownDefaults, monthRows: boolean): CeoBreakdown {
  const d = payload(raw);
  // An explicit null means "no second value"; only a missing field falls back to the metric's default.
  const sentValue2Label = Object.prototype.hasOwnProperty.call(d, "value2Label") || Object.prototype.hasOwnProperty.call(d, "Value2Label");
  const value2Label = sentValue2Label ? optStr(d, "value2Label") : defaults.value2Label;
  const rows = list(d, "rows", (r): CeoBreakdownRow => {
    const key = str(r, "key").trim();
    return {
      key,
      label: optStr(r, "label") ?? (monthRows ? monthLabel(key) : key || "Other"),
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
    rows: monthRows && rows.every((r) => isMonthKey(r.key)) ? [...rows].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)) : rows,
  };
}

/** GET api/ceo/breakdown answer. */
export function normalizeCeoBreakdown(raw: unknown, metric: CeoBreakdownMetric): CeoBreakdown {
  const defaults = BREAKDOWN_DEFAULTS[metric] ?? { title: "Breakdown", valueLabel: "Value", value2Label: null };
  return normalizeBreakdownWith(raw, defaults, MONTH_ROWS.has(metric));
}

// ─── Records ──────────────────────────────────────────────────────────────────────────────────────────────

const RECORD_TITLES: Record<CeoRecordKind, string> = {
  invoices: "Invoices",
  spaces: "Spaces",
  bookings: "Bookings",
  inquiries: "Tour inquiries",
  quotations: "Quotations",
  leases: "Leases expiring",
};

const toInvoice = (r: Row): CeoInvoiceRecord => ({
  invoiceId: optId(r, "invoiceId", "id"),
  invoiceNumber: optStr(r, "invoiceNumber", "invoiceNo"),
  customer: optStr(r, "customer", "customerName"),
  location: optStr(r, "location", "locationName"),
  issuedOn: optStr(r, "issuedOn", "invoiceDate"),
  periodStart: optStr(r, "periodStart", "billingPeriodStart"),
  periodEnd: optStr(r, "periodEnd", "billingPeriodEnd"),
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

export const toBookingRecord = (r: Row): CeoBookingRecord => ({
  bookingId: optId(r, "bookingId", "id"),
  customer: optStr(r, "customer", "customerName"),
  space: optStr(r, "space", "spaceName"),
  location: optStr(r, "location", "locationName"),
  startOn: optStr(r, "startOn", "startDate"),
  endOn: optStr(r, "endOn", "endDate"),
  status: optStr(r, "status"),
  totalAmount: optNum(r, "totalAmount", "total"),
});

export const toInquiryRecord = (r: Row): CeoInquiryRecord => {
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

export const toQuotationRecord = (r: Row): CeoQuotationRecord => ({
  quotationId: optId(r, "quotationId", "id"),
  quotationNumber: optStr(r, "quotationNumber", "quotationNo"),
  customer: optStr(r, "customer", "customerName"),
  location: optStr(r, "location", "locationName"),
  createdBy: optStr(r, "createdBy"),
  status: optStr(r, "status"),
  total: optNum(r, "total", "totalAmount"),
  createdOn: optStr(r, "createdOn", "createdAt"),
});

/** A records answer ({ title, total, rows }) as an object; a bare array is accepted too (rows only). */
export function recordsPayload(raw: unknown): Row {
  const inner = unwrapEnvelope<unknown>(raw);
  return Array.isArray(inner) ? { rows: inner } : isObject(inner) ? inner : {};
}

/** The full count of a records answer, never below the number of rows it carries. */
export function recordsTotal(d: Row, rows: number): number {
  return Math.max(rows, Math.floor(num(d, "total")));
}

/** GET api/ceo/records/{kind} answer. `total` is never below the number of rows. */
export function normalizeCeoRecords(kind: CeoRecordKind, raw: unknown): CeoRecords {
  const d = recordsPayload(raw);
  const title = optStr(d, "title") ?? RECORD_TITLES[kind] ?? "Records";
  const totalOf = (n: number) => recordsTotal(d, n);
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
      const rows = list(d, "rows", toBookingRecord);
      return { kind, title, total: totalOf(rows.length), rows };
    }
    case "inquiries": {
      const rows = list(d, "rows", toInquiryRecord);
      return { kind, title, total: totalOf(rows.length), rows };
    }
    case "leases": {
      const rows = list(d, "rows", toLeaseRecord);
      return { kind, title, total: totalOf(rows.length), rows };
    }
    case "quotations":
    default: {
      const rows = list(d, "rows", toQuotationRecord);
      return { kind: "quotations", title, total: totalOf(rows.length), rows };
    }
  }
}
