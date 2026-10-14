import { cleanParams, periodRange, positiveId } from "../ceo/drill";
import { isMonthKey } from "../ceo/format";
import type { QueryValue } from "../staff/normalize";
import type { SmBreakdownMetric, SmBreakdownQuery, SmBreakdownRow, SmRecordsQuery, SmScope } from "./types";

// Drill-down routing of the Sales Manager dashboard (pure, unit-tested in __tests__/drill.test.ts), like the CEO's:
//   level 1 (dashboard) chart element / row -> level 2 breakdown (GET api/sales-manager/breakdown) -> level 3
//   records (GET api/sales-manager/records/*); some elements open their records directly. The contract's table:
//
//   metric           key      breakdown rows        records for a row
//   funnel-month     month    the manager's locs    bookings   month + locationId = row
//   staff            userId   last 6 months         quotations userId + month = row (+ the location filter)
//   inquiries-type   type     last 6 months         inquiries  type + month = row
//   renewals-month   month    the manager's locs    leases     month + locationId = row
//   revenue-month    month    the manager's locs    bookings   month + locationId = row
//
//   Direct: a funnel stage -> its records for the period; "Follow-ups due" -> inquiries?outcome=followup_due;
//   a not-interested reason -> inquiries?outcome=not_interested; a month of the inquiries chart -> that month's
//   inquiries. An expiring lease row is already a record (nothing opens).
//
// Tour inquiries have no location in the database: inquiry lists never carry a locationId.

/** The dashboard's location filter as a query value (null = all the manager's locations). */
const scopeLocation = (scope: { locationId?: number | null }) => positiveId(scope.locationId);

/** First word of each breadcrumb trail, per breakdown metric (also the screen title until the answer arrives). */
export const SM_BREAKDOWN_ROOTS: Record<SmBreakdownMetric, string> = {
  "funnel-month": "Sales funnel",
  staff: "Team",
  "inquiries-type": "Tour inquiries",
  "renewals-month": "Renewals",
  "revenue-month": "Revenue",
};

export type SmUnit = "money" | "count";

/** How a metric's two values read (value2 null = the metric has none). */
export function smMetricUnits(metric: SmBreakdownMetric): { value: SmUnit; value2: SmUnit | null } {
  switch (metric) {
    case "funnel-month":
    case "staff":
      return { value: "count", value2: "count" };
    case "renewals-month":
      // Expiring leases (count), their monthly value (PKR).
      return { value: "count", value2: "money" };
    case "revenue-month":
      return { value: "money", value2: null };
    case "inquiries-type":
    default:
      return { value: "count", value2: null };
  }
}

/** Query string parameters of GET api/sales-manager/breakdown: metric, its key, period and (when set) locationId. */
export function smBreakdownParams(query: SmBreakdownQuery): Record<string, QueryValue> {
  const params: Record<string, QueryValue> = { metric: query.metric };
  switch (query.metric) {
    case "funnel-month":
    case "renewals-month":
    case "revenue-month":
      params.month = query.month;
      break;
    case "staff":
      params.userId = positiveId(query.userId);
      break;
    case "inquiries-type":
      params.type = query.type;
      break;
  }
  params.period = query.period;
  // Inquiries cover every branch: no location filter.
  params.locationId = query.metric === "inquiries-type" ? null : positiveId(query.locationId);
  return params;
}

/** True when the query has the key its metric needs (otherwise the element is not tappable). */
export function isCompleteSmBreakdown(query: SmBreakdownQuery): boolean {
  switch (query.metric) {
    case "funnel-month":
    case "renewals-month":
    case "revenue-month":
      return isMonthKey(query.month);
    case "staff":
      return positiveId(query.userId) != null;
    case "inquiries-type":
      return !!query.type;
    default:
      return false;
  }
}

/** The records list a breakdown row opens (level 3), or null when the row has no usable key (e.g. "Other"). */
export function smRecordsForBreakdownRow(query: SmBreakdownQuery, row: SmBreakdownRow): SmRecordsQuery | null {
  const rowId = positiveId(row.key);
  const rowMonth = isMonthKey(row.key) ? row.key : null;
  const month = isMonthKey(query.month) ? query.month : null;
  switch (query.metric) {
    case "funnel-month":
    case "revenue-month":
      return rowId && month ? { kind: "bookings", params: cleanParams({ month, locationId: rowId }) } : null;
    case "renewals-month":
      return rowId && month ? { kind: "leases", params: cleanParams({ month, locationId: rowId }) } : null;
    case "staff": {
      const userId = positiveId(query.userId);
      return rowMonth && userId
        ? { kind: "quotations", params: cleanParams({ userId, month: rowMonth, locationId: scopeLocation(query) }) }
        : null;
    }
    case "inquiries-type":
      return rowMonth && query.type ? { kind: "inquiries", params: cleanParams({ type: query.type, month: rowMonth }) } : null;
    default:
      return null;
  }
}

/**
 * Funnel stage -> its records for the period (no breakdown level): inquiries -> tour inquiries (every branch),
 * quotations / accepted -> quotations?stage=, bookings -> bookings. null for an unknown stage.
 */
export function smRecordsForFunnelStage(stage: string, scope: SmScope, today: Date = new Date()): SmRecordsQuery | null {
  const { from, to } = periodRange(scope.period, today);
  const locationId = scopeLocation(scope);
  switch (stage) {
    case "inquiries":
      return { kind: "inquiries", params: cleanParams({ period: scope.period, from, to }) };
    case "quotations":
    case "accepted":
      return { kind: "quotations", params: cleanParams({ stage, period: scope.period, from, to, locationId }) };
    case "bookings":
      return { kind: "bookings", params: cleanParams({ period: scope.period, from, to, locationId }) };
    default:
      return null;
  }
}

/** Outcomes the inquiries list filters by. */
export type SmInquiryOutcome = "followup_due" | "not_interested" | "converted" | "open";

/** "Follow-ups due" -> open future prospects whose follow-up date has come (now, not the period). */
export function smFollowUpsDueRecords(): SmRecordsQuery {
  return { kind: "inquiries", params: { outcome: "followup_due" } };
}

/** Inquiries of the period with an outcome (not interested, converted, open); every branch. */
export function smInquiryOutcomeRecords(outcome: Exclude<SmInquiryOutcome, "followup_due">, scope: SmScope, today: Date = new Date()): SmRecordsQuery {
  const { from, to } = periodRange(scope.period, today);
  return { kind: "inquiries", params: cleanParams({ outcome, period: scope.period, from, to }) };
}

/** A not-interested reason -> the not-interested inquiries of the period (with that reason, when the API filters by it). */
export function smNotInterestedRecords(reason: string | null | undefined, scope: SmScope, today: Date = new Date()): SmRecordsQuery {
  const query = smInquiryOutcomeRecords("not_interested", scope, today);
  return { kind: "inquiries", params: cleanParams({ ...query.params, reason: reason?.trim() || null }) };
}

/** A month of the 12-month inquiries chart -> that month's inquiries (every branch); null without a month. */
export function smInquiryMonthRecords(month: string | null | undefined): SmRecordsQuery | null {
  return isMonthKey(month) ? { kind: "inquiries", params: { month } } : null;
}
