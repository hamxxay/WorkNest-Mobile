import type { QueryValue } from "../staff/normalize";
import { isMonthKey } from "./format";
import type {
  CeoBreakdownMetric,
  CeoBreakdownQuery,
  CeoBreakdownRow,
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
//   inquiries-type       type           months (6)       inquiries type + month = row
//   staff                userId         months (6)       quotations userId + month = row

/** A positive int, or null (location / space type / user ids, also when they arrive as text). */
export function positiveId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : /^\d+$/.test(String(value).trim()) ? Number(String(value).trim()) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** The dashboard's location filter as a query value (null = all locations). */
const scopeLocation = (scope: { locationId?: number | null }) => positiveId(scope.locationId);

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
function clean(params: CeoRecordParams): CeoRecordParams {
  const out: CeoRecordParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    out[key] = value;
  }
  return out;
}

/**
 * The records list a breakdown row opens (level 3), or null when the row has no usable key (e.g. "Other").
 * Location-keyed rows replace the dashboard's location filter with the row's location.
 */
export function recordsForBreakdownRow(query: CeoBreakdownQuery, row: CeoBreakdownRow): CeoRecordsQuery | null {
  const rowId = positiveId(row.key);
  const rowMonth = isMonthKey(row.key) ? row.key : null;
  switch (query.metric) {
    case "revenue":
      return rowId && isMonthKey(query.month) ? { kind: "invoices", params: clean({ month: query.month, locationId: rowId }) } : null;
    case "aging":
      return rowId && query.bucket ? { kind: "invoices", params: clean({ bucket: query.bucket, locationId: rowId }) } : null;
    case "occupancy-type": {
      const typeId = positiveId(query.spaceTypeId);
      return rowId && typeId ? { kind: "spaces", params: clean({ spaceTypeId: typeId, locationId: rowId }) } : null;
    }
    case "occupancy-location": {
      const locationId = positiveId(query.locationId);
      return rowId && locationId ? { kind: "spaces", params: clean({ locationId, spaceTypeId: rowId }) } : null;
    }
    case "bookings-month":
      return rowId && isMonthKey(query.month) ? { kind: "bookings", params: clean({ month: query.month, locationId: rowId }) } : null;
    case "inquiries-type":
      return rowMonth && query.type ? { kind: "inquiries", params: clean({ type: query.type, month: rowMonth }) } : null;
    case "staff": {
      const userId = positiveId(query.userId);
      return rowMonth && userId
        ? { kind: "quotations", params: clean({ userId, month: rowMonth, locationId: scopeLocation(query) }) }
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
 * Funnel stage -> records of the period (no breakdown level): inquiries -> tour inquiries, quotations / accepted
 * -> quotations?stage=, bookings -> bookings. null for an unknown stage.
 */
export function recordsForFunnelStage(stage: string, scope: CeoScope, today: Date = new Date()): CeoRecordsQuery | null {
  const { from, to } = periodRange(scope.period, today);
  const locationId = scopeLocation(scope);
  switch (stage) {
    case "inquiries":
      return { kind: "inquiries", params: clean({ period: scope.period, from, to }) };
    case "quotations":
    case "accepted":
      return { kind: "quotations", params: clean({ stage, period: scope.period, from, to, locationId }) };
    case "bookings":
      return { kind: "bookings", params: clean({ period: scope.period, locationId }) };
    default:
      return null;
  }
}

/** A top customer -> that customer's invoices (null without a customer id). */
export function recordsForCustomer(customerId: number | null | undefined, scope: CeoScope): CeoRecordsQuery | null {
  const id = positiveId(customerId);
  return id ? { kind: "invoices", params: clean({ customerId: id, locationId: scopeLocation(scope) }) } : null;
}

/** The Overdue card -> overdue invoices. */
export function overdueInvoicesRecords(scope: CeoScope): CeoRecordsQuery {
  return { kind: "invoices", params: clean({ status: "overdue", locationId: scopeLocation(scope) }) };
}

/** The New bookings card -> bookings created in the period. */
export function newBookingsRecords(scope: CeoScope): CeoRecordsQuery {
  return { kind: "bookings", params: clean({ period: scope.period, locationId: scopeLocation(scope) }) };
}

/** "Revenue > Oct 2026 > I-8" as pieces; empty pieces dropped. */
export function trailOf(...parts: (string | null | undefined)[]): string[] {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean);
}

/** Breadcrumb for screen readers: "Revenue, then Oct 2026, then I-8". */
export function trailForSpeech(trail: readonly string[]): string {
  return trail.join(", then ");
}
