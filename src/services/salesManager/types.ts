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
  DashRange,
} from "../ceo";
import type { InquiryType } from "../../theme/inquiryTypes";

// Types of the Sales Manager dashboard API (WN_APIs, contract: GET api/sales-manager/dashboard, complaints,
// breakdown, records/*). Every endpoint is GET, Sales Manager (or super admin) only, camelCase JSON in the usual
// { isSuccessful, data } envelope; dates yyyy-MM-dd (or full ISO), months yyyy-MM.
//
// No money: a sales manager sees desks, not PKR (the API sends no amounts for api/sales-manager/*). The desks of a
// booking or quotation are its seats (its own capacity, else its space's); meeting rooms count 0 desks, but their
// bookings and quotations still count in the funnel. Every desk figure is a whole number.
//
// Scope: the manager's locations (JWT location_ids), or one of them (?locationId=, anything else is 403). Tour
// inquiries follow it by their branch (WN_Contacts.LocationId); inquiries without a branch count only when no
// location is chosen ("All my locations"), the same rule as complaints.
//
// The normalisers (./normalize.ts) fill these from whatever the server sends: a missing number is 0, a missing list
// is [], a missing section is null (the screen shows its empty state) and a missing previous-period figure or rate
// is null (no "vs last period" change is shown). Shapes shared with the CEO dashboard reuse its types.

/**
 * month (default) | quarter | year: this calendar period to date, compared with the previous one; custom: a day range
 * (`range`, the server's database update CS_01), compared with the same number of days just before it.
 */
export type SmPeriod = CeoPeriod;

/**
 * What every call is narrowed to: the period and one of the manager's locations (null / 0 = all of them). `range` is
 * used only with period custom.
 */
export type SmScope = { period: SmPeriod; locationId?: number | null; range?: DashRange | null };

export type SmLocation = CeoLocation;

// ─── GET api/sales-manager/dashboard ─────────────────────────────────────────────────────────────────────

export type SmFunnelMonth = {
  month: string;
  quotations: number;
  accepted: number;
  bookings: number;
  bookedDesks: number;
  /** Quotations created that month that were booked (never more than the quotations). */
  quotationsBooked: number;
};

export type SmFunnel = {
  /** inquiries, quotations, accepted, bookings (created in the period), in that order; extra stages after them. */
  stages: CeoFunnelStage[];
  /**
   * Quotations created in the period that were booked / quotations created in the period, percent (0-100, never
   * above); null when not sent.
   */
  conversionRate: number | null;
  conversionRatePrev: number | null;
  /**
   * Quotations created in the period that were booked (never more than the quotations). An older API does not send
   * it: then the period's bookings, at most one per quotation.
   */
  quotationsBooked: number;
  /** The same for the previous period; null when not sent. */
  quotationsBookedPrev: number | null;
  /** Desks on the quotations created in the period. */
  quotedDesks: number;
  /** Desks on the bookings created in the period. */
  bookedDesks: number;
  /** The same for the previous period; null when not sent (no change shown). */
  bookedDesksPrev: number | null;
  /** Last 12 months, oldest first. */
  months: SmFunnelMonth[];
};

/**
 * A sales executive under the manager: the API sends only the sales executives working at the manager's assigned
 * locations (or the chosen one), never admins or other roles.
 */
export type SmPerson = {
  userId: number | null;
  name: string;
  /** WN_Roles.DisplayName of their role, as sent. */
  role: string;
  locations: string | null;
  inquiriesHandled: number;
  quotations: number;
  accepted: number;
  converted: number;
  /** Desks on this person's converted quotations created in the period. */
  desksSold: number;
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
  /** Desks on the converted quotations at this location created in the period. */
  desksSold: number;
};

export type SmTeam = {
  /** Ranked by desks sold, then converted, then quotations (highest first), then name. */
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
  /** Desks the lease holds (0 for a meeting room). */
  desks: number;
  daysLeft: number | null;
};

/**
 * One month of the "Desks booked & desks ending" chart: desks on bookings created that month, desks on leases
 * ending that month and how many leases end. Future months (the next 3) have no booked desks.
 */
export type SmRenewalMonth = { month: string; bookedDesks: number; endingDesks: number; expiring: number };

export type SmRenewals = {
  /** Leases ending in the next 90 days, soonest first (the list may be cut short). */
  expiring: SmLease[];
  /** Leases ending in the next 90 days, and their desks. */
  expiringCount: number;
  expiringDesks: number;
  /** Leases ending in the next 30 days, and their desks. */
  expiring30Count: number;
  expiring30Desks: number;
  /** Desks on bookings created in the period (the funnel's desks booked). */
  bookedDesks: number;
  /** Desks on leases that ended in the period. */
  endedDesks: number;
  /** Desks booked minus desks ended in the period (may be negative). */
  netDesks: number;
  /** The same for the previous period; null when not sent (no change shown). */
  netDesksPrev: number | null;
  /** Last 12 months and the next 3, oldest first. */
  months: SmRenewalMonth[];
};

export type SmDashboard = {
  period: SmPeriod;
  /** e.g. "October 2026", "1 Oct - 15 Oct 2026" ("" when not sent). */
  periodLabel: string;
  generatedAt: string | null;
  /** A custom period: the range the figures cover, and the one the previous figures cover (set only when sent). */
  range?: DashRange;
  previousRange?: DashRange;
  /** The manager's locations (for the location picker). */
  locations: SmLocation[];
  /**
   * True: the server's database update BR_02 has not run, so the tour inquiry figures count every branch (not only
   * the manager's locations); the Tour inquiries section says so.
   */
  inquiriesAllBranches: boolean;
  funnel: SmFunnel | null;
  team: SmTeam | null;
  inquiries: SmInquiries | null;
  renewals: SmRenewals | null;
};

// ─── GET api/sales-manager/complaints ─────────────────────────────────────────────────────────────────────
//
// Loaded on its own (the rest of the dashboard keeps working when it fails). Complaints have no location column:
// their free-text Branch is matched to the manager's location names; complaints without a branch (WhatsApp) count
// only under "All my locations". Status counts are CURRENT (every complaint in scope, not bound to the period); the
// *InPeriod figures and category totals are for the period.

/** A complaint's status: open (new), in_progress, resolved (fixed, waiting for the customer's reply) or closed. */
export type SmComplaintStatus = "open" | "in_progress" | "resolved" | "closed";

/** Complaints in each status right now. */
export type SmComplaintStatusCounts = { open: number; inProgress: number; resolved: number; closed: number };

/** A category: open / in progress now, and how many were created in the period ("Other" for none). */
export type SmComplaintCategory = { category: string; open: number; inProgress: number; total: number };

/** A branch ("" = no branch, labelled "No branch"): open / in progress now, created in the period. */
export type SmComplaintBranch = { branch: string; label: string; open: number; inProgress: number; total: number };

/** One month: complaints created, and resolved or closed (by when they were last updated). */
export type SmComplaintMonth = { month: string; created: number; resolved: number };

/** An open or in-progress complaint (the oldest ones are listed). */
export type SmActiveComplaint = {
  complaintId: number | null;
  complaintNo: string | null;
  customerName: string | null;
  category: string;
  branch: string | null;
  /** open or in_progress (null when the server sent something else). */
  status: SmComplaintStatus | null;
  createdOn: string | null;
  /** Days since it was created; null when not sent. */
  ageDays: number | null;
};

export type SmComplaints = {
  period: SmPeriod;
  periodLabel: string;
  /** A custom period: the range the figures cover (set only when sent). */
  range?: DashRange;
  status: SmComplaintStatusCounts;
  /** Open + in progress. */
  activeTotal: number;
  /** Created in the period; the previous period's figure is null when not sent (no change shown). */
  newInPeriod: number;
  newInPeriodPrev: number | null;
  /** Resolved or closed in the period (by when they were last updated). */
  resolvedInPeriod: number;
  /** Follow-ups created in the period: the customer said the problem persists. */
  reopenedInPeriod: number;
  /** Average days from created to resolved of the period's resolved complaints; null when none. */
  avgResolutionDays: number | null;
  /** Most open + in progress first, then most created in the period. */
  byCategory: SmComplaintCategory[];
  byBranch: SmComplaintBranch[];
  /** Last 12 months, oldest first. */
  months: SmComplaintMonth[];
  /** The oldest open / in-progress complaints, oldest first (at most 8). */
  oldestActive: SmActiveComplaint[];
};

// ─── GET api/sales-manager/breakdown (drill level 2) ─────────────────────────────────────────────────────

export type SmBreakdownMetric = "funnel-month" | "staff" | "inquiries-type" | "renewals-month" | "desks-month";

/** A breakdown request: the metric, its key (month / userId / type) and the scope. */
export type SmBreakdownQuery = {
  metric: SmBreakdownMetric;
  period: SmPeriod;
  /** period custom: the dashboard's range (sent as periodFrom / periodTo). */
  range?: DashRange | null;
  /** Dashboard location filter (null = all the manager's locations). */
  locationId?: number | null;
  /** yyyy-MM: funnel-month, renewals-month, desks-month. */
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

export type SmRecordKind = "quotations" | "bookings" | "inquiries" | "leases" | "complaints";

export type SmRecordParams = Record<string, string | number | boolean | null | undefined>;

/** A records request: which list and its filters (sent as the query string as they are). */
export type SmRecordsQuery = { kind: SmRecordKind; params: SmRecordParams };

/** A quotation as the CEO sees it, without its amount: its desks instead. */
export type SmQuotationRecord = Omit<CeoQuotationRecord, "total"> & { desks: number };

/** A booking as the CEO sees it, without its amount: its desks instead. */
export type SmBookingRecord = Omit<CeoBookingRecord, "totalAmount"> & { desks: number };
export type SmInquiryRecord = CeoInquiryRecord & {
  /** yyyy-MM-dd (or ISO): when to follow up a future prospect. */
  followUpOn: string | null;
};
export type SmLeaseRecord = SmLease;

/**
 * records/complaints `status` filter: one status, active (open + in progress), or the period's resolved / new /
 * reopened complaints.
 */
export type SmComplaintFilterStatus = SmComplaintStatus | "active" | "resolved_period" | "new_period" | "reopened_period";

/** A complaint in records/complaints (no money). */
export type SmComplaintRecord = {
  complaintId: number | null;
  complaintNo: string | null;
  customerName: string | null;
  phone: string | null;
  category: string;
  branch: string | null;
  /** Normalised status (null when the server sent something unknown; `statusText` keeps it). */
  status: SmComplaintStatus | null;
  statusText: string | null;
  /** "whatsapp" or a staff source, as sent. */
  source: string | null;
  /** Reopened: the customer said the problem persists. */
  isFollowUp: boolean;
  createdOn: string | null;
  updatedOn: string | null;
  ageDays: number | null;
  /** At most 200 characters (cut by the server). */
  description: string | null;
};

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
  | RecordsOf<"leases", SmLeaseRecord>
  | RecordsOf<"complaints", SmComplaintRecord>;
