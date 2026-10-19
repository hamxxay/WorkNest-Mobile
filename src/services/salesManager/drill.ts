import { cleanParams, periodRange, positiveId, withDrillPeriod } from "../ceo/drill";
import { customRangeOf } from "../ceo/period";
import { count, isMonthKey, monthLabel } from "../ceo/format";
import type { QueryValue } from "../staff/normalize";
import { desks } from "./format";
import type {
  SmBreakdown,
  SmBreakdownMetric,
  SmBreakdownQuery,
  SmBreakdownRow,
  SmComplaintBranch,
  SmComplaintFilterStatus,
  SmLocation,
  SmRecordKind,
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
//   desks-month      month    the manager's locs    bookings   month + locationId = row (desks booked); leases ending
//                                                   that month when nothing was booked but desks end, and always for
//                                                   a future month; a row with both offers the other list too
//
//   Leases expiring (the KPIs and "and N more"): leases, no month = the next 90 days (or the next 30).
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
//
// A custom date range (period custom) goes to every drill-down call as period=custom&periodFrom=&periodTo= (from / to
// narrow a list on their own there); month / quarter / year drill-downs are sent exactly as before.

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
  const range = customRangeOf(query);
  if (range) {
    params.periodFrom = range.from;
    params.periodTo = range.to;
  }
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

const pad2 = (n: number) => String(n).padStart(2, "0");
/** yyyy-MM of a date (local time). */
const monthOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
/** yyyy-MM-dd of a date (local time). */
const dayOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** The two lists behind a "Desks booked & desks ending" month: bookings made in it, leases ending in it. */
export type SmDesksMonthList = "bookings" | "leases";

/**
 * Which list a desks-month row opens, and the other one it offers (null = none): a future month has no bookings
 * made in it, so it opens the leases ending then; a month with no desks booked but desks ending opens those leases
 * (and offers its bookings, e.g. meeting rooms, which hold 0 desks); otherwise the bookings, offering the leases
 * when desks end that month.
 */
export function smDesksMonthLists(
  month: string,
  row: Pick<SmBreakdownRow, "value" | "value2">,
  today: Date = new Date(),
): { primary: SmDesksMonthList; secondary: SmDesksMonthList | null } {
  const ending = row.value2 ?? 0;
  if (month > monthOf(today)) return { primary: "leases", secondary: null };
  if (row.value <= 0 && ending > 0) return { primary: "leases", secondary: "bookings" };
  return { primary: "bookings", secondary: ending > 0 ? "leases" : null };
}

const desksMonthRecords = (list: SmDesksMonthList, month: string, locationId: number): SmRecordsQuery => ({
  kind: list,
  params: cleanParams({ month, locationId }),
});

/**
 * The records list a breakdown row opens (level 3), or null when the row has no usable key (e.g. "Other"); a custom
 * period goes along (periodFrom / periodTo).
 */
export function smRecordsForBreakdownRow(query: SmBreakdownQuery, row: SmBreakdownRow, today: Date = new Date()): SmRecordsQuery | null {
  const records = smRecordsForRow(query, row, today);
  return records ? { kind: records.kind, params: withDrillPeriod(records.params, query) } : null;
}

function smRecordsForRow(query: SmBreakdownQuery, row: SmBreakdownRow, today: Date): SmRecordsQuery | null {
  const rowId = positiveId(row.key);
  const rowMonth = isMonthKey(row.key) ? row.key : null;
  const month = isMonthKey(query.month) ? query.month : null;
  switch (query.metric) {
    case "funnel-month":
      return rowId && month ? { kind: "bookings", params: cleanParams({ month, locationId: rowId }) } : null;
    case "desks-month":
      return rowId && month ? desksMonthRecords(smDesksMonthLists(month, row, today).primary, month, rowId) : null;
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
 * The other list a breakdown row offers next to the one it opens (desks-month: bookings and leases ending that
 * month), with its wording; null when there is none.
 */
export function smSecondaryRecordsForBreakdownRow(
  query: SmBreakdownQuery,
  row: SmBreakdownRow,
  today: Date = new Date(),
): { title: string; subtitle: string; records: SmRecordsQuery } | null {
  const rowId = positiveId(row.key);
  const month = isMonthKey(query.month) ? query.month : null;
  if (query.metric !== "desks-month" || !rowId || !month) return null;
  const { secondary } = smDesksMonthLists(month, row, today);
  if (!secondary) return null;
  const records = (list: SmDesksMonthList) => {
    const q = desksMonthRecords(list, month, rowId);
    return { kind: q.kind, params: withDrillPeriod(q.params, query) };
  };
  return secondary === "leases"
    ? { title: `Leases ending in ${monthLabel(month)}`, subtitle: `${desks(row.value2 ?? 0)} ending`, records: records("leases") }
    : { title: `Bookings made in ${monthLabel(month)}`, subtitle: `${desks(row.value)} booked`, records: records("bookings") };
}

/**
 * "Leases expiring" (the renewals KPIs, "and N more"): every confirmed lease ending in the next 90 days (no window:
 * the API's default), or in the next `withinDays` days (from today to today + withinDays); location filter.
 */
export function smExpiringLeasesRecords(scope: Partial<SmScope> = {}, withinDays?: number, today: Date = new Date()): SmRecordsQuery {
  const locationId = scopeLocation(scope);
  if (!withinDays || withinDays <= 0) return { kind: "leases", params: withDrillPeriod(cleanParams({ locationId }), scope) };
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + withinDays);
  return { kind: "leases", params: withDrillPeriod(cleanParams({ from: dayOf(today), to: dayOf(to), locationId }), scope) };
}

/**
 * Funnel stage -> its records for the period (no breakdown level): inquiries -> tour inquiries,
 * quotations / accepted -> quotations?stage=, bookings -> bookings; all with the location filter. null for an
 * unknown stage. A custom range is sent as periodFrom / periodTo (no from / to).
 */
export function smRecordsForFunnelStage(stage: string, scope: SmScope, today: Date = new Date()): SmRecordsQuery | null {
  const locationId = scopeLocation(scope);
  if (customRangeOf(scope)) {
    const params = (extra: Record<string, string>) => withDrillPeriod(cleanParams({ ...extra, locationId }), scope);
    switch (stage) {
      case "inquiries":
        return { kind: "inquiries", params: params({}) };
      case "quotations":
      case "accepted":
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
export function smFollowUpsDueRecords(scope: Partial<SmScope> = {}): SmRecordsQuery {
  return { kind: "inquiries", params: withDrillPeriod(cleanParams({ outcome: "followup_due", locationId: scopeLocation(scope) }), scope) };
}

/**
 * Inquiries of the period with an outcome (not interested, converted, open), with the location filter (a custom range:
 * periodFrom / periodTo instead of from / to).
 */
export function smInquiryOutcomeRecords(outcome: Exclude<SmInquiryOutcome, "followup_due">, scope: SmScope, today: Date = new Date()): SmRecordsQuery {
  const locationId = scopeLocation(scope);
  if (customRangeOf(scope)) return { kind: "inquiries", params: withDrillPeriod(cleanParams({ outcome, locationId }), scope) };
  const { from, to } = periodRange(scope.period, today);
  return { kind: "inquiries", params: cleanParams({ outcome, period: scope.period, from, to, locationId }) };
}

/** A not-interested reason -> the not-interested inquiries of the period (with that reason, when the API filters by it). */
export function smNotInterestedRecords(reason: string | null | undefined, scope: SmScope, today: Date = new Date()): SmRecordsQuery {
  const query = smInquiryOutcomeRecords("not_interested", scope, today);
  return { kind: "inquiries", params: cleanParams({ ...query.params, reason: reason?.trim() || null }) };
}

/** A month of the 12-month inquiries chart -> that month's inquiries (location filter); null without a month. */
export function smInquiryMonthRecords(month: string | null | undefined, scope: Partial<SmScope> = {}): SmRecordsQuery | null {
  return isMonthKey(month) ? { kind: "inquiries", params: withDrillPeriod(cleanParams({ month, locationId: scopeLocation(scope) }), scope) } : null;
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
  const params = cleanParams({
    status: filter.status ?? null,
    category: filter.category?.trim() || null,
    branch,
    month,
    locationId: scopeLocation(scope),
    period: month ? null : scope.period,
  });
  // A custom range goes with the period (status and category lists); a month list is that month only.
  return { kind: "complaints", params: month ? params : withDrillPeriod(params, scope) };
}

/** True for a complaints list of complaints as they are now (open, in progress, ...): not bound to the period. */
export function isCurrentComplaintsList(query: SmRecordsQuery): boolean {
  if (query.kind !== "complaints") return false;
  const status = query.params.status;
  return typeof status === "string" && CURRENT_COMPLAINT_STATUSES.has(status) && !query.params.month;
}

/**
 * True for a list not bound to the period, whose scope line names only the location: complaints as they are now,
 * every complaint of a branch, and the leases ending in the next 90 / 30 days.
 */
export function isPeriodFreeList(query: SmRecordsQuery): boolean {
  if (query.kind === "leases") return !query.params.month;
  if (query.kind !== "complaints") return false;
  return isCurrentComplaintsList(query) || (query.params.branch != null && !query.params.status && !query.params.month);
}

/**
 * Complaints by branch is worth showing when the complaints span more than one branch or include some without a
 * branch (with one location chosen it holds that branch only).
 */
export function smShowsComplaintBranches(byBranch: readonly SmComplaintBranch[]): boolean {
  const named = byBranch.filter((b) => b.branch.trim()).length;
  return named > 1 || byBranch.some((b) => !b.branch.trim());
}

// ─── Scope wording ────────────────────────────────────────────────────────────────────────────────────────

export const SM_ALL_MY_LOCATIONS = "All my locations";

/** Lists matched by branch: with no single location chosen they also hold the items without a branch. */
const BRANCH_LISTS: ReadonlySet<SmRecordKind> = new Set<SmRecordKind>(["inquiries", "complaints"]);

/**
 * The location part of a scope line: the chosen location's name; with none chosen the manager's only location (no
 * picker then) or "All my locations". `kind` (a records list or the inquiries-type breakdown): tour inquiry and
 * complaint lists then say they include the items without a branch ("I-8 (plus items without a branch)"), unless the
 * list is narrowed to one branch already (`narrowedToBranch`).
 */
export function smLocationText(opts: {
  locations: readonly SmLocation[];
  locationId?: number | null;
  kind?: SmRecordKind | "inquiries-type" | null;
  narrowedToBranch?: boolean;
}): string {
  const id = positiveId(opts.locationId);
  if (id) return opts.locations.find((l) => l.locationId === id)?.name ?? "One location";
  const base = opts.locations.length === 1 ? opts.locations[0].name : SM_ALL_MY_LOCATIONS;
  const branchList = opts.kind === "inquiries-type" || (!!opts.kind && BRANCH_LISTS.has(opts.kind));
  return branchList && !opts.narrowedToBranch ? `${base} (plus items without a branch)` : base;
}

/**
 * The notes under the Tour inquiries and Complaints headings. A manager with one location has no picker, so the
 * notes say what the figures include instead of pointing at an option they cannot see. Before the server's
 * database update BR_02 the tour inquiries count every branch: the inquiries note says so.
 */
export function smScopeNotes(opts: { singleLocation: boolean; inquiriesAllBranches: boolean }): { inquiries: string; complaints: string } {
  const inquiries = opts.inquiriesAllBranches
    ? "Counts inquiries from every branch until database update BR_02 is run"
    : opts.singleLocation
      ? "Includes inquiries without a branch"
      : `Inquiries without a branch show under ${SM_ALL_MY_LOCATIONS}`;
  const complaints = opts.singleLocation
    ? "Includes complaints without a branch (WhatsApp)"
    : `Complaints without a branch (WhatsApp) show under ${SM_ALL_MY_LOCATIONS}`;
  return { inquiries, complaints };
}
