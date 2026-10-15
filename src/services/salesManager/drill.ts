import { cleanParams, periodRange, positiveId } from "../ceo/drill";
import { count, isMonthKey } from "../ceo/format";
import type { QueryValue } from "../staff/normalize";
import { desks } from "./format";
import type { SmBreakdown, SmBreakdownMetric, SmBreakdownQuery, SmBreakdownRow, SmRecordsQuery, SmScope } from "./types";

// Drill-down routing of the Sales Manager dashboard (pure, unit-tested in __tests__/drill.test.ts), like the CEO's:
//   level 1 (dashboard) chart element / row -> level 2 breakdown (GET api/sales-manager/breakdown) -> level 3
//   records (GET api/sales-manager/records/*); some elements open their records directly. The contract's table:
//
//   metric           key      breakdown rows        records for a row
//   funnel-month     month    the manager's locs    bookings   month + locationId = row
//   staff            userId   last 6 months         quotations userId + month = row (+ the location filter)
//   inquiries-type   type     last 6 months         inquiries  type + month = row
//   renewals-month   month    the manager's locs    leases     month + locationId = row
//   desks-month      month    the manager's locs    bookings   month + locationId = row
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
  "desks-month": "Desks",
};

/** What a breakdown value counts: desks, or anything else (quotations, bookings, leases, inquiries). */
export type SmUnit = "desks" | "count";

/** How a metric's two values read (value2 null = the metric has none). No money: desks or plain counts. */
export function smMetricUnits(metric: SmBreakdownMetric): { value: SmUnit; value2: SmUnit | null } {
  switch (metric) {
    case "funnel-month":
      // Desks booked, bookings.
      return { value: "desks", value2: "count" };
    case "staff":
      // Quotations, desks sold.
      return { value: "count", value2: "desks" };
    case "renewals-month":
      // Leases ending, their desks.
      return { value: "count", value2: "desks" };
    case "desks-month":
      // Desks booked, desks ending.
      return { value: "desks", value2: "desks" };
    case "inquiries-type":
    default:
      return { value: "count", value2: null };
  }
}

/**
 * The figure on the right of a breakdown row: its desks with the unit word when the metric counts desks
 * ("91 desks"; staff and renewals: the second value, desks sold / the leases' desks), else the main count ("3").
 */
export function smBreakdownRowFigure(metric: SmBreakdownMetric, row: SmBreakdownRow): string | undefined {
  const units = smMetricUnits(metric);
  if (units.value === "desks") return desks(row.value);
  if (units.value2 === "desks") return row.value2 != null ? desks(row.value2) : undefined;
  return count(row.value);
}

/** The line under a breakdown row's name: "Desks booked 91 · Bookings 17" (the labels carry the words). */
export function smBreakdownRowDetail(breakdown: Pick<SmBreakdown, "valueLabel" | "value2Label">, row: SmBreakdownRow): string {
  const parts = [`${breakdown.valueLabel} ${count(row.value)}`];
  if (row.value2 != null && breakdown.value2Label) parts.push(`${breakdown.value2Label} ${count(row.value2)}`);
  if (row.count != null) parts.push(`${count(row.count)} in total`);
  return parts.join(" · ");
}

/** Query string parameters of GET api/sales-manager/breakdown: metric, its key, period and (when set) locationId. */
export function smBreakdownParams(query: SmBreakdownQuery): Record<string, QueryValue> {
  const params: Record<string, QueryValue> = { metric: query.metric };
  switch (query.metric) {
    case "funnel-month":
    case "renewals-month":
    case "desks-month":
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
    case "desks-month":
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
    case "desks-month":
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
