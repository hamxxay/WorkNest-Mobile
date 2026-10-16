import type { QueryValue } from "../staff/normalize";
import { count, isMonthKey, money, monthLabel, pct, periodWords, shareOf } from "./format";
import type {
  CeoBreakdownMetric,
  CeoBreakdownQuery,
  CeoBreakdownRow,
  CeoDrillList,
  CeoDrillTarget,
  CeoMoney,
  CeoOccupancy,
  CeoPeriod,
  CeoRecordParams,
  CeoRecordsQuery,
  CeoScope,
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

/** A positive int, or null (location / space type / user ids, also when they arrive as text). */
export function positiveId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : /^\d+$/.test(String(value).trim()) ? Number(String(value).trim()) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** The dashboard's location filter as a query value (null = all locations). */
const scopeLocation = (scope: { locationId?: number | null }) => positiveId(scope.locationId);

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
  "bookings-month": "New bookings",
  "inquiries-type": "Inquiries",
  staff: "Team",
};

/** How a metric's values read: money (PKR) or counts. */
export function metricUnit(metric: CeoBreakdownMetric): "money" | "count" {
  return metric === "revenue" || metric === "aging" ? "money" : "count";
}

/** Query string parameters of GET api/ceo/breakdown: metric, its key, period and (when set) locationId. */
export function breakdownParams(query: CeoBreakdownQuery): Record<string, QueryValue> {
  const params: Record<string, QueryValue> = { metric: query.metric };
  switch (query.metric) {
    case "revenue":
    case "bookings-month":
      params.month = query.month;
      break;
    case "aging":
      params.bucket = query.bucket;
      break;
    case "occupancy-type":
      params.spaceTypeId = positiveId(query.spaceTypeId);
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
  params.locationId = positiveId(query.locationId);
  return params;
}

/** True when the query has the key its metric needs (otherwise the element is not tappable). */
export function isCompleteBreakdown(query: CeoBreakdownQuery): boolean {
  switch (query.metric) {
    case "revenue":
    case "bookings-month":
      return isMonthKey(query.month);
    case "aging":
      return !!query.bucket;
    case "occupancy-type":
      return positiveId(query.spaceTypeId) != null;
    case "occupancy-location":
      return positiveId(query.locationId) != null;
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
 * (e.g. status=paid when the breakdown was opened from Collected).
 */
export function recordsForBreakdownRow(query: CeoBreakdownQuery, row: CeoBreakdownRow, extra?: CeoRecordParams): CeoRecordsQuery | null {
  const records = recordsForRow(query, row);
  return records && extra ? { kind: records.kind, params: cleanParams({ ...records.params, ...extra }) } : records;
}

function recordsForRow(query: CeoBreakdownQuery, row: CeoBreakdownRow): CeoRecordsQuery | null {
  const rowId = positiveId(row.key);
  // Location rows: a location id or the "No location" row.
  const rowLoc = rowLocation(row.key);
  const rowMonth = isMonthKey(row.key) ? row.key : null;
  switch (query.metric) {
    case "revenue":
      return rowLoc && isMonthKey(query.month) ? { kind: "invoices", params: cleanParams({ month: query.month, locationId: rowLoc }) } : null;
    case "aging":
      return rowLoc && query.bucket ? { kind: "invoices", params: cleanParams({ bucket: query.bucket, locationId: rowLoc }) } : null;
    case "occupancy-type": {
      const typeId = positiveId(query.spaceTypeId);
      return rowLoc && typeId ? { kind: "spaces", params: cleanParams({ spaceTypeId: typeId, locationId: rowLoc }) } : null;
    }
    case "occupancy-location": {
      const locationId = positiveId(query.locationId);
      return rowId && locationId ? { kind: "spaces", params: cleanParams({ locationId, spaceTypeId: rowId }) } : null;
    }
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
 */
export function recordsForFunnelStage(stage: string, scope: CeoScope, today: Date = new Date()): CeoRecordsQuery | null {
  const { from, to } = periodRange(scope.period, today);
  const locationId = scopeLocation(scope);
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

/** A top customer -> that customer's invoices (null without a customer id). */
export function recordsForCustomer(customerId: number | null | undefined, scope: CeoScope): CeoRecordsQuery | null {
  const id = positiveId(customerId);
  return id ? { kind: "invoices", params: cleanParams({ customerId: id, locationId: scopeLocation(scope) }) } : null;
}

/** The Overdue card -> overdue invoices. */
export function overdueInvoicesRecords(scope: CeoScope): CeoRecordsQuery {
  return { kind: "invoices", params: cleanParams({ status: "overdue", locationId: scopeLocation(scope) }) };
}

/** The New bookings card -> bookings created in the period. */
export function newBookingsRecords(scope: CeoScope): CeoRecordsQuery {
  return { kind: "bookings", params: cleanParams({ period: scope.period, locationId: scopeLocation(scope) }) };
}

/**
 * Bookings made since this day count as "made at any time": the bookings list filters by the day a booking was made,
 * so the Active bookings card asks from here to see every booking running today, whenever it was made.
 */
export const ALL_TIME_FROM = "2000-01-01";

/** The Active bookings card -> bookings running today (records/bookings?status=active), made at any time. */
export function activeBookingsRecords(scope: { locationId?: number | null }): CeoRecordsQuery {
  return { kind: "bookings", params: cleanParams({ status: "active", from: ALL_TIME_FROM, locationId: scopeLocation(scope) }) };
}

/** "Leases expiring" -> every confirmed lease ending in the next 90 days (records/leases, soonest first). */
export function leasesExpiringRecords(scope: { locationId?: number | null }): CeoRecordsQuery {
  return { kind: "leases", params: cleanParams({ locationId: scopeLocation(scope) }) };
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
//                              dashboard), then that month by location
//   Outstanding                aging buckets (from the dashboard), then that bucket   open invoices of that bucket
//                              by location (breakdown aging)                          and location
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
 * their invoiced and collected (from the dashboard's 12 months), each opening that month by location. Collected
 * leads to the paid invoices.
 */
export function revenueTarget(m: Pick<CeoMoney, "months">, measure: RevenueMeasure, scope: CeoScope, today: Date = new Date()): CeoDrillTarget {
  const locationId = scopeLocation(scope);
  const recordsParams = measure === "collected" ? { status: "paid" } : undefined;
  const months = periodMonths(scope.period, today);
  const monthQuery = (month: string): CeoBreakdownQuery => ({ metric: "revenue", month, period: scope.period, locationId });
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
    return { kind: "records", query: { kind: "invoices", params: cleanParams({ status: "open", locationId }) }, title: "Outstanding invoices" };
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
        open: b.bucket ? { kind: "breakdown", query: { metric: "aging", bucket: b.bucket, period: scope.period, locationId } } : null,
      })),
    },
  };
}

/**
 * Occupancy: by location (from the dashboard), each opening that location by space type. With one location
 * chosen on the dashboard, its breakdown straight away.
 */
export function occupancyTarget(occupancy: Pick<CeoOccupancy, "byLocation">, scope: CeoScope): CeoDrillTarget {
  const chosen = scopeLocation(scope);
  const rows = occupancy.byLocation.filter((l) => l.total > 0);
  const breakdown = (locationId: number): CeoDrillTarget => ({ kind: "breakdown", query: { metric: "occupancy-location", period: scope.period, locationId } });
  if (chosen && rows.some((l) => l.locationId === chosen)) return breakdown(chosen);
  return {
    kind: "list",
    list: {
      title: "Occupancy by location",
      subtitle: "Spaces in use today. Tap a location to see it by space type.",
      valueLabel: "Occupied",
      value2Label: "Total spaces",
      unit: "occupancy",
      rowHint: "Opens this location by space type",
      rows: rows.map((l) => ({
        key: String(l.locationId ?? l.name),
        label: l.name,
        value: l.occupied,
        value2: l.total,
        count: null,
        open: l.locationId ? { kind: "breakdown", query: { metric: "occupancy-location", period: scope.period, locationId: l.locationId } } : null,
      })),
    },
  };
}

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
