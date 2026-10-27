import type { QueryValue } from "../staff/normalize";
import { count, isMonthKey, money, monthLabel, pct, periodWords, shareOf } from "./format";
import { customRangeOf, drillPeriodParams } from "./period";
import type {
  CeoBreakdown,
  CeoBreakdownMetric,
  CeoBreakdownQuery,
  CeoBreakdownRow,
  CeoDrillList,
  CeoDrillStep,
  CeoDrillTarget,
  CeoMoney,
  CeoOccupancy,
  CeoPeriod,
  CeoRecordParams,
  CeoRecordsQuery,
  CeoScope,
  DashRange,
} from "./types";

// Drill-down routing of the CEO dashboard (pure, unit-tested in __tests__/drill.test.ts):
//   level 1 (dashboard) chart element / row -> level 2 breakdown (GET api/ceo/breakdown) -> level 3 records
//   (GET api/ceo/records/*); a few dashboard elements go straight to records (funnel stages, top customers, the
//   Overdue and New bookings cards). Mirrors the contract's table:
//
//   metric               key            breakdown rows   records for a row
//   revenue              month          locations        invoices  month + locationId = row
//   aging                bucket         locations        invoices  bucket + locationId = row
//   occupancy-type       spaceTypeId    locations        spaces    spaceTypeId + locationId = row
//   occupancy-location   locationId     space types      spaces    locationId + spaceTypeId = row
//   bookings-month       month          locations        bookings  month + locationId = row
//   inquiries-type       type           months (6)       inquiries type + month = row (+ the location filter)
//   staff                userId         months (6)       quotations userId + month = row
//
// The "No location" row of a location breakdown (key "none": invoices, spaces or bookings not tied to a location)
// opens its records with locationId=none. Tour inquiries follow the location filter by their branch (one location =
// only its inquiries); the full list of leases expiring is records/leases.
//
// A custom date range (period custom, ./period.ts) goes to every drill-down call as period=custom&periodFrom=&periodTo=
// (from / to narrow a list on their own there); Invoiced / Collected for a range open the invoices billed for it by
// location (breakdown revenue with from / to instead of a month), then a location's invoices (from / to). Month /
// quarter / year drill-downs are sent exactly as before.

/** A positive int, or null (location / space type / user ids, also when they arrive as text). */
export function positiveId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : /^\d+$/.test(String(value).trim()) ? Number(String(value).trim()) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** A space type id: positive, or 0 = "Other" (spaces without a type; the API accepts spaceTypeId=0); else null. */
export function spaceTypeKey(value: unknown): number | null {
  if (value === 0 || (typeof value === "string" && value.trim() === "0")) return 0;
  return positiveId(value);
}

/** A room category code (CP_02: "PrivateOffice", "SharedSpace"): a word, not an id or "none"; else null. */
export function categoryKey(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z][A-Za-z_]*$/.test(text) && text.toLowerCase() !== NO_LOCATION_KEY ? text : null;
}

/** The dashboard's location filter as a query value (null = all locations). */
const scopeLocation = (scope: { locationId?: number | null }) => positiveId(scope.locationId);

/** What a drill-down knows of the dashboard: its period (with a custom range) and its location filter. */
export type CeoDrillScope = Partial<CeoScope>;

/**
 * Records params with the dashboard's custom period added (period=custom, periodFrom, periodTo), so the list covers
 * the same range; unchanged for month / quarter / year (those requests stay as before).
 */
export function withDrillPeriod(params: CeoRecordParams, scope: CeoDrillScope): CeoRecordParams {
  const period = drillPeriodParams(scope);
  return period.period ? cleanParams({ ...params, ...period }) : params;
}

/** A breakdown query of the dashboard's scope: its period (a custom one with its range) and the given location. */
export function scopedBreakdown(
  base: Omit<CeoBreakdownQuery, "period" | "range" | "locationId">,
  scope: CeoDrillScope,
  locationId: number | null = scopeLocation(scope),
): CeoBreakdownQuery {
  const range = customRangeOf(scope);
  return { ...base, period: scope.period ?? "month", ...(range ? { range } : {}), locationId };
}

/** The custom range of a breakdown query (period custom with a real range), else null. */
const queryRange = (query: CeoBreakdownQuery): DashRange | null => customRangeOf(query);

/** Key of the breakdown row for the part not tied to a location ("No location"). */
export const NO_LOCATION_KEY = "none";

/**
 * The location a breakdown row stands for: its id, "none" for the "No location" row (records not tied to a
 * location, which the records endpoints take as locationId=none), or null for anything else.
 */
export function rowLocation(key: unknown): number | "none" | null {
  if (typeof key === "string" && key.trim().toLowerCase() === NO_LOCATION_KEY) return NO_LOCATION_KEY;
  return positiveId(key);
}

/** First word of each breadcrumb trail, per breakdown metric. */
export const BREAKDOWN_ROOTS: Record<CeoBreakdownMetric, string> = {
  revenue: "Revenue",
  aging: "Receivables",
  "occupancy-type": "Occupancy",
  "occupancy-location": "Occupancy",
  "occupancy-category": "Occupancy",
  "bookings-month": "New bookings",
  "inquiries-type": "Inquiries",
  staff: "Team",
};

/** How a metric's values read: money (PKR) or counts. */
export function metricUnit(metric: CeoBreakdownMetric): "money" | "count" {
  return metric === "revenue" || metric === "aging" ? "money" : "count";
}

/**
 * Query string parameters of GET api/ceo/breakdown: metric, its key, period and (when set) locationId. A custom
 * period adds periodFrom / periodTo; revenue for a range (no month) asks for the invoices billed for from / to (billing period start).
 */
export function breakdownParams(query: CeoBreakdownQuery): Record<string, QueryValue> {
  const params: Record<string, QueryValue> = { metric: query.metric };
  const range = queryRange(query);
  switch (query.metric) {
    case "revenue":
      if (!isMonthKey(query.month) && range) {
        params.from = range.from;
        params.to = range.to;
      } else {
        params.month = query.month;
      }
      break;
    case "bookings-month":
      params.month = query.month;
      break;
    case "aging":
      params.bucket = query.bucket;
      break;
    case "occupancy-type":
      params.spaceTypeId = spaceTypeKey(query.spaceTypeId);
      break;
    case "occupancy-category":
      params.category = query.category;
      break;
    case "inquiries-type":
      params.type = query.type;
      break;
    case "staff":
      params.userId = positiveId(query.userId);
      break;
    // occupancy-location: its key is locationId, sent below.
  }
  params.period = query.period;
  if (range) {
    params.periodFrom = range.from;
    params.periodTo = range.to;
  }
  params.locationId = positiveId(query.locationId);
  return params;
}

/** True when the query has the key its metric needs (otherwise the element is not tappable). */
export function isCompleteBreakdown(query: CeoBreakdownQuery): boolean {
  switch (query.metric) {
    case "revenue":
      // A month, or a custom range (the invoices billed for it).
      return isMonthKey(query.month) || queryRange(query) != null;
    case "bookings-month":
      return isMonthKey(query.month);
    case "aging":
      return !!query.bucket;
    case "occupancy-type":
      return spaceTypeKey(query.spaceTypeId) != null;
    case "occupancy-location":
      return positiveId(query.locationId) != null;
    case "occupancy-category":
      return !!query.category;
    case "inquiries-type":
      return !!query.type;
    case "staff":
      return positiveId(query.userId) != null;
    default:
      return false;
  }
}

/** Removes empty values (null / undefined / ""), so records requests only carry the filters that are set. */
export function cleanParams(params: CeoRecordParams): CeoRecordParams {
  const out: CeoRecordParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    out[key] = value;
  }
  return out;
}

/**
 * The records list a breakdown row opens (level 3), or null when the row has no usable key (e.g. "Other").
 * Location-keyed rows replace the dashboard's location filter with the row's location. `extra` filters are added
 * (e.g. status=paid when the breakdown was opened from Collected). A custom period goes along (periodFrom / periodTo).
 */
export function recordsForBreakdownRow(query: CeoBreakdownQuery, row: CeoBreakdownRow, extra?: CeoRecordParams): CeoRecordsQuery | null {
  const records = recordsForRow(query, row);
  if (!records) return null;
  const params = extra ? cleanParams({ ...records.params, ...extra }) : records.params;
  return { kind: records.kind, params: withDrillPeriod(params, query) };
}

function recordsForRow(query: CeoBreakdownQuery, row: CeoBreakdownRow): CeoRecordsQuery | null {
  // Location rows: a location id or the "No location" row.
  const rowLoc = rowLocation(row.key);
  const rowMonth = isMonthKey(row.key) ? row.key : null;
  switch (query.metric) {
    case "revenue": {
      if (!rowLoc) return null;
      if (isMonthKey(query.month)) return { kind: "invoices", params: cleanParams({ month: query.month, locationId: rowLoc }) };
      // A custom range: the invoices billed for it (from / to).
      const range = queryRange(query);
      return range ? { kind: "invoices", params: cleanParams({ from: range.from, to: range.to, locationId: rowLoc }) } : null;
    }
    case "aging":
      return rowLoc && query.bucket ? { kind: "invoices", params: cleanParams({ bucket: query.bucket, locationId: rowLoc }) } : null;
    case "occupancy-type": {
      const typeId = spaceTypeKey(query.spaceTypeId);
      return rowLoc && typeId != null ? { kind: "spaces", params: cleanParams({ spaceTypeId: typeId, locationId: rowLoc }) } : null;
    }
    case "occupancy-location": {
      const locationId = positiveId(query.locationId);
      if (!locationId) return null;
      // CP_02: rows are room categories (key PrivateOffice / SharedSpace); before it, space types (numeric keys).
      const category = categoryKey(row.key);
      if (category) return { kind: "spaces", params: cleanParams({ locationId, category }) };
      const typeId = spaceTypeKey(row.key);
      return typeId != null ? { kind: "spaces", params: cleanParams({ locationId, spaceTypeId: typeId }) } : null;
    }
    case "occupancy-category":
      return rowLoc && query.category ? { kind: "spaces", params: cleanParams({ category: query.category, locationId: rowLoc }) } : null;
    case "bookings-month":
      return rowLoc && isMonthKey(query.month) ? { kind: "bookings", params: cleanParams({ month: query.month, locationId: rowLoc }) } : null;
    case "inquiries-type":
      return rowMonth && query.type
        ? { kind: "inquiries", params: cleanParams({ type: query.type, month: rowMonth, locationId: scopeLocation(query) }) }
        : null;
    case "staff": {
      const userId = positiveId(query.userId);
      return rowMonth && userId
        ? { kind: "quotations", params: cleanParams({ userId, month: rowMonth, locationId: scopeLocation(query) }) }
        : null;
    }
    default:
      return null;
  }
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * The calendar period to date, as the API counts it (DashboardService: this month / quarter / year from its
 * first day to today), as yyyy-MM-dd from / to.
 */
export function periodRange(period: CeoPeriod, today: Date = new Date()): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const start = period === "year" ? new Date(y, 0, 1) : period === "quarter" ? new Date(y, Math.floor(m / 3) * 3, 1) : new Date(y, m, 1);
  return { from: ymd(start), to: ymd(today) };
}

/**
 * Funnel stage -> records of the period (no breakdown level): inquiries -> tour inquiries, quotations / accepted /
 * converted -> quotations?stage=, bookings -> bookings; all with the location filter. null for an unknown stage.
 * A custom range is sent as periodFrom / periodTo (no from / to: the API turns the range into the times it counts).
 */
export function recordsForFunnelStage(stage: string, scope: CeoScope, today: Date = new Date()): CeoRecordsQuery | null {
  const locationId = scopeLocation(scope);
  if (customRangeOf(scope)) {
    const params = (extra: CeoRecordParams) => withDrillPeriod(cleanParams({ ...extra, locationId }), scope);
    switch (stage) {
      case "inquiries":
        return { kind: "inquiries", params: params({}) };
      case "quotations":
      case "accepted":
      case "converted":
        return { kind: "quotations", params: params({ stage }) };
      case "bookings":
        return { kind: "bookings", params: params({}) };
      default:
        return null;
    }
  }
  const { from, to } = periodRange(scope.period, today);
  switch (stage) {
    case "inquiries":
      return { kind: "inquiries", params: cleanParams({ period: scope.period, from, to, locationId }) };
    case "quotations":
    case "accepted":
    case "converted":
      return { kind: "quotations", params: cleanParams({ stage, period: scope.period, from, to, locationId }) };
    case "bookings":
      return { kind: "bookings", params: cleanParams({ period: scope.period, locationId }) };
    default:
      return null;
  }
}

/**
 * A sales executive's revenue (Team section) -> the quotations they created in the period that were converted
 * (records/quotations?stage=converted&userId=), with the location filter: the list behind the revenue figure.
 * null without a user id.
 */
export function recordsForPersonRevenue(userId: number | null | undefined, scope: CeoScope, today: Date = new Date()): CeoRecordsQuery | null {
  const id = positiveId(userId);
  const converted = id ? recordsForFunnelStage("converted", scope, today) : null;
  return converted && id ? { ...converted, params: { ...converted.params, userId: id } } : null;
}

/** A top customer -> that customer's invoices (null without a customer id). */
export function recordsForCustomer(customerId: number | null | undefined, scope: CeoScope): CeoRecordsQuery | null {
  const id = positiveId(customerId);
  return id ? { kind: "invoices", params: withDrillPeriod(cleanParams({ customerId: id, locationId: scopeLocation(scope) }), scope) } : null;
}

/** The Overdue card -> overdue invoices. */
export function overdueInvoicesRecords(scope: CeoScope): CeoRecordsQuery {
  return { kind: "invoices", params: withDrillPeriod(cleanParams({ status: "overdue", locationId: scopeLocation(scope) }), scope) };
}

/**
 * The Billed in advance card -> the unpaid invoices for a billing period that has not started yet
 * (records/invoices?status=advance). Not bound to the dashboard's period (their periods are still to come): only the
 * location goes along, and the list keeps the title "Billed in advance".
 */
export function billedInAdvanceTarget(scope: CeoDrillScope): CeoDrillStep {
  return {
    kind: "records",
    query: { kind: "invoices", params: cleanParams({ status: "advance", locationId: scopeLocation(scope) }) },
    title: "Billed in advance",
    keepTitle: true,
    timeless: true,
  };
}

/**
 * The Received card (CP_02) -> the fee receipts and payments received in the period to date (records/receipts, the
 * dashboard's period and location; a custom range: periodFrom / periodTo).
 */
export function receivedRecords(scope: CeoScope): CeoRecordsQuery {
  return { kind: "receipts", params: withDrillPeriod(cleanParams({ period: scope.period, locationId: scopeLocation(scope) }), scope) };
}

/** Last day of this month, yyyy-MM-dd. */
const monthEnd = (d: Date) => ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));

/**
 * The Security deposits card (CP_02) -> the invoices with a deposit whose billing period starts in the invoice window
 * the card counts: this month (whole month); a quarter / year from its first day to the end of this month; a custom
 * range: the range (as the CMS).
 */
export function depositRecords(scope: CeoScope, today: Date = new Date()): CeoRecordsQuery {
  const range = customRangeOf(scope);
  const from = range ? range.from : periodRange(scope.period, today).from;
  const to = range ? range.to : monthEnd(today);
  return { kind: "invoices", params: withDrillPeriod(cleanParams({ status: "deposit", from, to, locationId: scopeLocation(scope) }), scope) };
}

/**
 * The new bookings behind the Bookings stage / Booked value with their seller and contract value (CP_02:
 * records/bookings?sales=true): the bookings stage's records plus sales=true.
 */
export function salesBookingsRecords(scope: CeoScope, today: Date = new Date()): CeoRecordsQuery | null {
  const q = recordsForFunnelStage("bookings", scope, today);
  return q ? { ...q, params: { ...q.params, sales: true } } : null;
}

/**
 * A sales executive's revenue when it counts bookings (CP_02) -> the new bookings they sold in the period
 * (records/bookings?sellerId=), with the location filter. null without a user id.
 */
export function recordsForPersonBookings(userId: number | null | undefined, scope: CeoScope, today: Date = new Date()): CeoRecordsQuery | null {
  const id = positiveId(userId);
  const q = id ? recordsForFunnelStage("bookings", scope, today) : null;
  return q && id ? { ...q, params: { ...q.params, sellerId: id } } : null;
}

/** The New bookings card -> bookings created in the period (a custom range: periodFrom / periodTo). */
export function newBookingsRecords(scope: CeoScope): CeoRecordsQuery {
  return { kind: "bookings", params: withDrillPeriod(cleanParams({ period: scope.period, locationId: scopeLocation(scope) }), scope) };
}

/**
 * Bookings made since this day count as "made at any time": the bookings list filters by the day a booking was made,
 * so the Active bookings card asks from here to see every booking running today, whenever it was made.
 */
export const ALL_TIME_FROM = "2000-01-01";

/** The Active bookings card -> bookings running today (records/bookings?status=active), made at any time. */
export function activeBookingsRecords(scope: CeoDrillScope): CeoRecordsQuery {
  return { kind: "bookings", params: withDrillPeriod(cleanParams({ status: "active", from: ALL_TIME_FROM, locationId: scopeLocation(scope) }), scope) };
}

/** "Leases expiring" -> every confirmed lease ending in the next 90 days (records/leases, soonest first). */
export function leasesExpiringRecords(scope: CeoDrillScope): CeoRecordsQuery {
  return { kind: "leases", params: withDrillPeriod(cleanParams({ locationId: scopeLocation(scope) }), scope) };
}

/** "Revenue > Oct 2026 > I-8" as pieces; empty pieces dropped. */
export function trailOf(...parts: (string | null | undefined)[]): string[] {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean);
}

/** Breadcrumb for screen readers: "Revenue, then Oct 2026, then I-8". */
export function trailForSpeech(trail: readonly string[]): string {
  return trail.join(", then ");
}

// ─── KPI cards -> drill-down ──────────────────────────────────────────────────────────────────────────────
//
//   card                       level 2                                               level 3
//   Invoiced / Collected       month: this month by location (breakdown revenue);    invoices of that month and
//                              quarter / year: the period's months (from the          location (Collected: paid)
//                              dashboard), then that month by location; a custom      (a range: billed for it)
//                              range: its invoices by location (from / to)
//   Outstanding                aging buckets (from the dashboard), then that bucket   open invoices of that bucket
//                              by location (breakdown aging)                          and location
//   Billed in advance          -                                                      unpaid invoices for periods
//                                                                                     not started yet (any period)
//   Occupancy                  by location (from the dashboard), then that location   spaces of that location and
//                              by space type (breakdown occupancy-location)           type
//   Active bookings            -                                                      bookings running today

/** The yyyy-MM months of the period to date, oldest first (this month only for "month"). */
export function periodMonths(period: CeoPeriod, today: Date = new Date()): string[] {
  const y = today.getFullYear();
  const m = today.getMonth();
  const first = period === "year" ? 0 : period === "quarter" ? Math.floor(m / 3) * 3 : m;
  const out: string[] = [];
  for (let i = first; i <= m; i++) out.push(`${y}-${pad2(i + 1)}`);
  return out;
}

export type RevenueMeasure = "invoiced" | "collected";

const MEASURE_LABELS: Record<RevenueMeasure, string> = { invoiced: "Invoiced", collected: "Collected" };

/**
 * Invoiced or Collected for the period: this month by location (one month), else the months of the period with
 * their invoiced and collected (from the dashboard's 12 months), each opening that month by location. A custom range:
 * the invoices billed for it by location (as the CMS). Collected leads to the paid invoices.
 */
export function revenueTarget(
  m: Pick<CeoMoney, "months"> & Partial<Pick<CeoMoney, "securityDeposits">>,
  measure: RevenueMeasure,
  scope: CeoScope,
  today: Date = new Date(),
): CeoDrillTarget {
  // CP_02 (deposits sent): Collected = paid so far, so its invoices are the ones with a payment (status collected);
  // an older API: the paid invoices.
  const recordsParams = measure === "collected" ? { status: m.securityDeposits != null ? "collected" : "paid" } : undefined;
  if (customRangeOf(scope)) return { kind: "breakdown", query: scopedBreakdown({ metric: "revenue" }, scope), recordsParams };
  const months = periodMonths(scope.period, today);
  const monthQuery = (month: string): CeoBreakdownQuery => scopedBreakdown({ metric: "revenue", month }, scope);
  if (months.length === 1) return { kind: "breakdown", query: monthQuery(months[0]), recordsParams };
  const label = MEASURE_LABELS[measure];
  const other = MEASURE_LABELS[measure === "invoiced" ? "collected" : "invoiced"];
  const list: CeoDrillList = {
    title: `${label} by month`,
    subtitle: `${label} and ${other.toLowerCase()} ${periodWords(scope.period)}. Tap a month to see it by location.`,
    valueLabel: label,
    value2Label: other,
    unit: "money",
    rowHint: "Opens this month by location",
    rows: months.map((month) => {
      const sent = m.months.find((x) => x.month === month);
      const invoiced = sent?.invoiced ?? 0;
      const collected = sent?.collected ?? 0;
      return {
        key: month,
        label: monthLabel(month),
        value: measure === "invoiced" ? invoiced : collected,
        value2: measure === "invoiced" ? collected : invoiced,
        count: null,
        open: { kind: "breakdown", query: monthQuery(month), recordsParams },
      };
    }),
  };
  return { kind: "list", list };
}

/**
 * Outstanding: the aging buckets (from the dashboard), each opening that bucket by location; without buckets, the
 * unpaid invoices.
 */
export function agingTarget(m: Pick<CeoMoney, "aging">, scope: CeoScope): CeoDrillTarget {
  const locationId = scopeLocation(scope);
  if (!m.aging.length) {
    return { kind: "records", query: { kind: "invoices", params: withDrillPeriod(cleanParams({ status: "open", locationId }), scope) }, title: "Outstanding invoices" };
  }
  return {
    kind: "list",
    list: {
      title: "Outstanding by age",
      subtitle: "Unpaid invoices by how long they are past due. Tap a bucket to see it by location.",
      valueLabel: "Amount",
      value2Label: null,
      unit: "money",
      rowHint: "Opens this bucket by location",
      rows: m.aging.map((b) => ({
        key: b.bucket,
        label: b.label,
        value: b.amount,
        value2: null,
        count: b.count,
        open: b.bucket ? { kind: "breakdown", query: scopedBreakdown({ metric: "aging", bucket: b.bucket }, scope, locationId) } : null,
      })),
    },
  };
}

/** What the Occupancy tile's drill adds to its records: only the occupied rooms (records/spaces?occupied=true). */
export const OCCUPIED_ONLY: CeoRecordParams = { occupied: true };

/**
 * Occupancy: the occupied rooms. By location (from the dashboard; locations without an occupied room left out), each
 * opening that location by space type, then its occupied rooms. With one location chosen on the dashboard, its
 * breakdown straight away. The chart drills (occupancy-type / occupancy-location) keep showing occupied and vacant.
 */
export function occupancyTarget(occupancy: Pick<CeoOccupancy, "byLocation">, scope: CeoScope): CeoDrillTarget {
  const chosen = scopeLocation(scope);
  const breakdown = (locationId: number): CeoDrillStep => ({
    kind: "breakdown",
    query: scopedBreakdown({ metric: "occupancy-location" }, scope, locationId),
    recordsParams: OCCUPIED_ONLY,
  });
  if (chosen && occupancy.byLocation.some((l) => l.locationId === chosen && l.total > 0)) return breakdown(chosen);
  const rows = occupancy.byLocation.filter((l) => l.total > 0 && l.occupied > 0);
  return {
    kind: "list",
    list: {
      title: "Occupied rooms by location",
      subtitle: "Rooms in use today. Tap a location to see them by space type.",
      valueLabel: "Occupied",
      value2Label: "Total spaces",
      unit: "occupancy",
      rowHint: "Opens the occupied rooms of this location by space type",
      rows: rows.map((l) => ({
        key: String(l.locationId ?? l.name),
        label: l.name,
        value: l.occupied,
        value2: l.total,
        count: null,
        open: l.locationId ? breakdown(l.locationId) : null,
      })),
    },
  };
}

/**
 * A room category's occupancy card (CP_02) -> that category by location (breakdown occupancy-category; the occupied
 * rooms only), then a location's occupied rooms of the category.
 */
export function occupancyCategoryTarget(categoryCode: string, scope: CeoScope): CeoDrillStep {
  return { kind: "breakdown", query: scopedBreakdown({ metric: "occupancy-category", category: categoryCode }, scope), recordsParams: OCCUPIED_ONLY };
}

/** A location's rooms of one category (CP_02 By location rows): records/spaces; location 0 = the "No location" row. */
export function categorySpacesRecords(locationId: number | null, categoryCode: string): CeoRecordsQuery | null {
  const loc = locationId === 0 ? NO_LOCATION_KEY : positiveId(locationId);
  return loc && categoryCode ? { kind: "spaces", params: cleanParams({ locationId: loc, category: categoryCode }) } : null;
}

/** A breakdown opened for the occupied rooms only: the rows (space types) without an occupied room left out. */
export function occupiedRowsOnly(breakdown: CeoBreakdown): CeoBreakdown {
  return { ...breakdown, rows: breakdown.rows.filter((r) => r.value > 0) };
}

/** True when the records a breakdown opens are the occupied rooms only (the Occupancy tile). */
export const isOccupiedOnly = (recordsParams?: CeoRecordParams) => recordsParams?.occupied === true;

/** How a list's values read: PKR, or counts (occupancy: spaces). */
export const drillListFormat = (list: Pick<CeoDrillList, "unit">) => (list.unit === "money" ? money : (v: number) => count(v));

/** A list row's second line: "Invoiced PKR 1.2M · Collected PKR 900K", "PKR 50K · 3 invoices", "72% · 18 of 25 spaces in use". */
export function drillListRowDetail(list: CeoDrillList, row: CeoBreakdownRow): string {
  if (list.unit === "occupancy") {
    const total = row.value2 ?? 0;
    return `${pct(shareOf(row.value, total))} · ${count(row.value)} of ${count(total)} spaces in use`;
  }
  const format = drillListFormat(list);
  const parts = [list.value2Label || row.count != null ? `${list.valueLabel} ${format(row.value)}` : format(row.value)];
  if (row.value2 != null && list.value2Label) parts.push(`${list.value2Label} ${format(row.value2)}`);
  if (row.count != null) parts.push(`${count(row.count)} ${row.count === 1 ? "invoice" : "invoices"}`);
  return parts.join(" · ");
}
