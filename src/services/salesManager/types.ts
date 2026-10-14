import type {
  CeoBookingRecord,
  CeoBreakdown,
  CeoBreakdownRow,
  CeoFunnelStage,
  CeoInquiryRecord,
  CeoInquiryTypeCount,
  CeoLocation,
  CeoPeriod,
  CeoQuotationRecord,
} from "../ceo";
import type { InquiryType } from "../../theme/inquiryTypes";

// Types of the Sales Manager dashboard API (WN_APIs, contract: GET api/sales-manager/dashboard, breakdown,
// records/*). Every endpoint is GET, Sales Manager (or super admin) only, camelCase JSON in the usual
// { isSuccessful, data } envelope; money in PKR, dates yyyy-MM-dd (or full ISO), months yyyy-MM.
//
// Scope: the manager's locations (JWT location_ids), or one of them (?locationId=, anything else is 403). Tour
// inquiries have no location in the database, so their figures always cover every branch.
//
// The normalisers (./normalize.ts) fill these from whatever the server sends: a missing number is 0, a missing list
// is [], a missing section is null (the screen shows its empty state) and a missing previous-period figure or rate
// is null (no "vs last period" change is shown). Shapes shared with the CEO dashboard reuse its types.

/** month (default) | quarter | year: this calendar period to date, compared with the previous one. */
export type SmPeriod = CeoPeriod;

/** What every call is narrowed to: the period and one of the manager's locations (null / 0 = all of them). */
export type SmScope = { period: SmPeriod; locationId?: number | null };

export type SmLocation = CeoLocation;

// ─── GET api/sales-manager/dashboard ─────────────────────────────────────────────────────────────────────

export type SmFunnelMonth = { month: string; quotations: number; accepted: number; bookings: number; bookedValue: number };

export type SmFunnel = {
  /** inquiries, quotations, accepted, bookings (created in the period), in that order; extra stages after them. */
  stages: CeoFunnelStage[];
  /** Bookings / quotations in the period, percent; null when not sent. */
  conversionRate: number | null;
  conversionRatePrev: number | null;
  quotedValue: number;
  bookedValue: number;
  bookedValuePrev: number | null;
  /** Last 12 months, oldest first. */
  months: SmFunnelMonth[];
};

export type SmPerson = {
  userId: number | null;
  name: string;
  /** "Sales Executive" | "Admin" (as sent). */
  role: string;
  locations: string | null;
  inquiriesHandled: number;
  quotations: number;
  accepted: number;
  converted: number;
  convertedValue: number;
  /** Converted / quotations, percent; null when not sent and there are no quotations. */
  conversionRate: number | null;
  /** Follow-ups due now (not just in the period). */
  followUpsDue: number;
};

export type SmTeamLocation = {
  locationId: number | null;
  name: string;
  salesExecutives: number;
  quotations: number;
  converted: number;
  convertedValue: number;
};

export type SmTeam = {
  /** Ranked by converted value (highest first). */
  people: SmPerson[];
  perLocation: SmTeamLocation[];
};

/** A not-interested reason and how many inquiries gave it in the period. */
export type SmReason = { reason: string; count: number };

/** Inquiries per Type in one month (stacked chart). */
export type SmInquiryMonth = { month: string; counts: Record<InquiryType, number> };

export type SmInquiries = {
  total: number;
  totalPrev: number | null;
  followedUp: number;
  notInterested: number;
  converted: number;
  /** Future prospects whose follow-up date is today or earlier and still open. */
  followUpsDue: number;
  byType: CeoInquiryTypeCount[];
  /** Top 6 in the period. */
  notInterestedReasons: SmReason[];
  /** Last 12 months, oldest first. */
  months: SmInquiryMonth[];
};

/** A lease ending in the next 90 days. */
export type SmLease = {
  bookingId: number | null;
  customer: string;
  space: string | null;
  location: string | null;
  /** yyyy-MM-dd */
  endOn: string | null;
  monthlyAmount: number | null;
  daysLeft: number | null;
};

export type SmRenewalMonth = { month: string; newBookingRevenue: number; expiring: number };

export type SmRenewals = {
  /** Soonest first. */
  expiring: SmLease[];
  expiringCount: number;
  expiringMonthlyValue: number;
  /** Invoiced on bookings created in the period. */
  newBookingRevenue: number;
  newBookingRevenuePrev: number | null;
  /** Last 12 months (the next 3 may follow for expiring leases), oldest first. */
  months: SmRenewalMonth[];
};

export type SmDashboard = {
  period: SmPeriod;
  /** e.g. "October 2026" ("" when not sent). */
  periodLabel: string;
  generatedAt: string | null;
  /** The manager's locations (for the location picker). */
  locations: SmLocation[];
  funnel: SmFunnel | null;
  team: SmTeam | null;
  inquiries: SmInquiries | null;
  renewals: SmRenewals | null;
};

// ─── GET api/sales-manager/breakdown (drill level 2) ─────────────────────────────────────────────────────

export type SmBreakdownMetric = "funnel-month" | "staff" | "inquiries-type" | "renewals-month" | "revenue-month";

/** A breakdown request: the metric, its key (month / userId / type) and the scope. */
export type SmBreakdownQuery = {
  metric: SmBreakdownMetric;
  period: SmPeriod;
  /** Dashboard location filter (null = all the manager's locations). */
  locationId?: number | null;
  /** yyyy-MM: funnel-month, renewals-month, revenue-month. */
  month?: string;
  /** staff */
  userId?: number;
  /** inquiries-type */
  type?: string;
};

/** Same shape as the CEO breakdown: { title, subtitle, valueLabel, value2Label, rows }. */
export type SmBreakdown = CeoBreakdown;
export type SmBreakdownRow = CeoBreakdownRow;

// ─── GET api/sales-manager/records/* (drill level 3) ─────────────────────────────────────────────────────

export type SmRecordKind = "quotations" | "bookings" | "inquiries" | "leases";

export type SmRecordParams = Record<string, string | number | boolean | null | undefined>;

/** A records request: which list and its filters (sent as the query string as they are). */
export type SmRecordsQuery = { kind: SmRecordKind; params: SmRecordParams };

export type SmQuotationRecord = CeoQuotationRecord;
export type SmBookingRecord = CeoBookingRecord;
export type SmInquiryRecord = CeoInquiryRecord & {
  /** yyyy-MM-dd (or ISO): when to follow up a future prospect. */
  followUpOn: string | null;
};
export type SmLeaseRecord = SmLease;

type RecordsOf<K extends SmRecordKind, Row> = {
  kind: K;
  title: string;
  /** Full count on the server (rows are newest first, at most 200). */
  total: number;
  rows: Row[];
};

export type SmRecords =
  | RecordsOf<"quotations", SmQuotationRecord>
  | RecordsOf<"bookings", SmBookingRecord>
  | RecordsOf<"inquiries", SmInquiryRecord>
  | RecordsOf<"leases", SmLeaseRecord>;
