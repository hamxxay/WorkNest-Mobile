import { cleanParams, periodRange, positiveId } from "../ceo/drill";
import { count, isMonthKey } from "../ceo/format";
import type { QueryValue } from "../staff/normalize";
import { desks } from "./format";
import type {
  SmBreakdown,
  SmBreakdownMetric,
  SmBreakdownQuery,
  SmBreakdownRow,
  SmComplaintFilterStatus,
  SmRecordsQuery,
  SmScope,
} from "./types";

// Drill-down routing of the Sales Manager dashboard (pure, unit-tested in __tests__/drill.test.ts), like the CEO's:
//   level 1 (dashboard) chart element / row -> level 2 breakdown (GET api/sales-manager/breakdown) -> level 3
//   records (GET api/sales-manager/records/*); some elements open their records directly. The contract's table:
//
//   metric           key      breakdown rows        records for a row
//   funnel-month     month    the manager's locs    bookings   month + locationId = row
//   staff            userId   last 6 months         quotations userId + month = row (+ the location filter)
//   inquiries-type   type     last 6 months         inquiries  type + month = row (+ the location filter)
//   renewals-month   month    the manager's locs    leases     month + locationId = row
//   desks-month      month    the manager's locs    bookings   month + locationId = row
//
//   Direct: a funnel stage -> its records for the period; "Follow-ups due" -> inquiries?outcome=followup_due;
//   a not-interested reason -> inquiries?outcome=not_interested; a month of the inquiries chart -> that month's
//   inquiries. An expiring lease row is already a record (nothing opens).
//
//   Complaints (own section, no breakdown level): a card or a part of the status bar -> complaints?status=, a
//   category -> complaints?category=, a month of the chart -> complaints?month= (created that month).
//
// Tour inquiries have a branch (WN_Contacts.LocationId): their lists carry the dashboard's location filter like the
// rest; with no location chosen ("All my locations") the API adds the inquiries without a branch.

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
  params.locationId = positiveId(query.locationId);
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
      return rowMonth && query.type
        ? { kind: "inquiries", params: cleanParams({ type: query.type, month: rowMonth, locationId: scopeLocation(query) }) }
        : null;
    default:
      return null;
  }
}

/**
 * Funnel stage -> its records for the period (no breakdown level): inquiries -> tour inquiries,
 * quotations / accepted -> quotations?stage=, bookings -> bookings; all with the location filter. null for an
 * unknown stage.
 */
export function smRecordsForFunnelStage(stage: string, scope: SmScope, today: Date = new Date()): SmRecordsQuery | null {
  const { from, to } = periodRange(scope.period, today);
  const locationId = scopeLocation(scope);
  switch (stage) {
    case "inquiries":
      return { kind: "inquiries", params: cleanParams({ period: scope.period, from, to, locationId }) };
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

/** "Follow-ups due" -> open future prospects whose follow-up date has come (now, not the period); location filter. */
export function smFollowUpsDueRecords(scope: { locationId?: number | null } = {}): SmRecordsQuery {
  return { kind: "inquiries", params: cleanParams({ outcome: "followup_due", locationId: scopeLocation(scope) }) };
}

/** Inquiries of the period with an outcome (not interested, converted, open), with the location filter. */
export function smInquiryOutcomeRecords(outcome: Exclude<SmInquiryOutcome, "followup_due">, scope: SmScope, today: Date = new Date()): SmRecordsQuery {
  const { from, to } = periodRange(scope.period, today);
  return { kind: "inquiries", params: cleanParams({ outcome, period: scope.period, from, to, locationId: scopeLocation(scope) }) };
}

/** A not-interested reason -> the not-interested inquiries of the period (with that reason, when the API filters by it). */
export function smNotInterestedRecords(reason: string | null | undefined, scope: SmScope, today: Date = new Date()): SmRecordsQuery {
  const query = smInquiryOutcomeRecords("not_interested", scope, today);
  return { kind: "inquiries", params: cleanParams({ ...query.params, reason: reason?.trim() || null }) };
}

/** A month of the 12-month inquiries chart -> that month's inquiries (location filter); null without a month. */
export function smInquiryMonthRecords(month: string | null | undefined, scope: { locationId?: number | null } = {}): SmRecordsQuery | null {
  return isMonthKey(month) ? { kind: "inquiries", params: cleanParams({ month, locationId: scopeLocation(scope) }) } : null;
}

// ─── Complaints ───────────────────────────────────────────────────────────────────────────────────────────

/** What a complaints list is filtered by; the dashboard's location (and period) are added. */
export type SmComplaintFilter = {
  status?: SmComplaintFilterStatus | null;
  /** Exact category ("Other" also matches complaints without one). */
  category?: string | null;
  /** Exact branch; "" (no branch, WhatsApp) is sent as "none". */
  branch?: string | null;
  /** yyyy-MM: complaints created that month. */
  month?: string | null;
};

/** Statuses that describe complaints as they are now (not bound to the period). */
const CURRENT_COMPLAINT_STATUSES: ReadonlySet<string> = new Set(["open", "in_progress", "resolved", "closed", "active"]);

/**
 * The complaints list (records/complaints) for a filter, or null when it has nothing usable (an invalid month).
 * The period goes with status and category lists (the *_period statuses need it); a month list is that month.
 */
export function smComplaintRecords(filter: SmComplaintFilter, scope: SmScope): SmRecordsQuery | null {
  const month = filter.month ?? null;
  if (month != null && !isMonthKey(month)) return null;
  const branch = filter.branch == null ? null : filter.branch.trim() || "none";
  return {
    kind: "complaints",
    params: cleanParams({
      status: filter.status ?? null,
      category: filter.category?.trim() || null,
      branch,
      month,
      locationId: scopeLocation(scope),
      period: month ? null : scope.period,
    }),
  };
}

/** True for a complaints list of complaints as they are now (open, in progress, ...): not bound to the period. */
export function isCurrentComplaintsList(query: SmRecordsQuery): boolean {
  if (query.kind !== "complaints") return false;
  const status = query.params.status;
  return typeof status === "string" && CURRENT_COMPLAINT_STATUSES.has(status) && !query.params.month;
}
