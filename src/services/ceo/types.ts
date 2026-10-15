import type { InquiryType } from "../../theme/inquiryTypes";

// Types of the CEO dashboard API (WN_APIs CeoController; contract: GET api/ceo/dashboard, api/ceo/breakdown,
// api/ceo/records/*). Every endpoint is GET, CEO or super admin only, camelCase JSON in the usual
// { isSuccessful, data } envelope; money in PKR, dates yyyy-MM-dd (or full ISO), months yyyy-MM.
// The normalisers (./normalize.ts) fill these from whatever the server sends: a missing number is 0, a missing
// list is [], a missing section is null (the screen shows its empty state) and a missing previous-period figure is
// null (no "vs last period" change is shown).

/** month (default) | quarter | year: this calendar period to date, compared with the previous one. */
export type CeoPeriod = "month" | "quarter" | "year";

/** What every CEO call is narrowed to: the period and one location (null / 0 = all locations). */
export type CeoScope = { period: CeoPeriod; locationId?: number | null };

export type CeoLocation = { locationId: number; name: string };

// ─── GET api/ceo/dashboard ────────────────────────────────────────────────────────────────────────────────

export type CeoMoneyMonth = { month: string; invoiced: number; collected: number };

/** Receivables aging buckets, in this order. */
export type CeoAgingBucketKey = "not_due" | "1_30" | "31_60" | "61_90" | "90_plus";
export type CeoAgingBucket = { bucket: string; label: string; amount: number; count: number };

export type CeoTopCustomer = { customerId: number | null; name: string; amount: number; invoices: number };

export type CeoMoney = {
  invoiced: number;
  /** null when the server sent no previous-period figure (no change shown). */
  invoicedPrev: number | null;
  collected: number;
  collectedPrev: number | null;
  outstanding: number;
  outstandingCount: number;
  overdue: number;
  overdueCount: number;
  /** Collected / invoiced in the period, percent; null when not sent. */
  collectionRate: number | null;
  /** Last 12 months, oldest first. */
  months: CeoMoneyMonth[];
  aging: CeoAgingBucket[];
  /** Top 5 by amount invoiced over the last 12 months. */
  topCustomers: CeoTopCustomer[];
};

export type CeoOccupancyMonth = { month: string; occupancyPct: number; newBookings: number };
export type CeoSpaceTypeOccupancy = { spaceTypeId: number | null; name: string; total: number; occupied: number };
export type CeoLocationOccupancy = { locationId: number | null; name: string; total: number; occupied: number };
export type CeoLeaseExpiring = {
  bookingId: number | null;
  customer: string;
  space: string | null;
  location: string | null;
  /** yyyy-MM-dd */
  endOn: string | null;
  monthlyAmount: number | null;
};

export type CeoOccupancy = {
  totalSpaces: number;
  occupiedSpaces: number;
  occupancyPct: number;
  occupancyPctPrev: number | null;
  activeBookings: number;
  newBookings: number;
  newBookingsPrev: number | null;
  /** Last 12 months, oldest first. */
  months: CeoOccupancyMonth[];
  byType: CeoSpaceTypeOccupancy[];
  byLocation: CeoLocationOccupancy[];
  /** Leases ending in the next 90 days, soonest first (the server sends the first 50). */
  leasesExpiring: CeoLeaseExpiring[];
  /**
   * How many leases end in the next 90 days in all, and their monthly rent; null when the server did not send it
   * (before its database update QA_07: then only the list is known and the full list cannot be opened).
   */
  leasesExpiringCount: number | null;
  leasesExpiringMonthly: number | null;
};

/** Funnel stages, in this order (created in the period). */
export type CeoFunnelStageKey = "inquiries" | "quotations" | "accepted" | "bookings";
export type CeoFunnelStage = { stage: string; label: string; count: number };

export type CeoInquiryTypeCount = {
  /** The canonical type, or null for a type the app does not know (kept with its own label). */
  type: InquiryType | null;
  /** What the breakdown is asked for (?type=): the canonical key, or the server's own text. */
  key: string;
  label: string;
  count: number;
};

export type CeoSales = {
  funnel: CeoFunnelStage[];
  /** Bookings / quotations in the period, percent; null when not sent. */
  conversionRate: number | null;
  inquiriesByType: CeoInquiryTypeCount[];
  quotationValue: number;
  bookingValue: number;
  /**
   * Tour inquiries follow the location filter by their branch (one location = only its inquiries). True when a
   * location is chosen but the figures still count every location's inquiries (the server's database update QA_07
   * has not run, or an older API that never narrowed them): the screen then says "all locations".
   */
  inquiriesAllLocations: boolean;
};

export type CeoTeamLocation = {
  locationId: number | null;
  name: string;
  admins: number;
  salesExecutives: number;
  quotations: number;
  converted: number;
};

export type CeoPerson = {
  userId: number | null;
  name: string;
  /** "Admin" | "Sales Executive" (as sent). */
  role: string;
  locations: string | null;
  quotations: number;
  converted: number;
  convertedValue: number;
};

export type CeoTeam = { perLocation: CeoTeamLocation[]; people: CeoPerson[] };

export type CeoDashboard = {
  period: CeoPeriod;
  /** e.g. "October 2026" ("" when not sent). */
  periodLabel: string;
  generatedAt: string | null;
  /** Every location (for the location picker). */
  locations: CeoLocation[];
  money: CeoMoney | null;
  occupancy: CeoOccupancy | null;
  sales: CeoSales | null;
  team: CeoTeam | null;
};

// ─── GET api/ceo/breakdown (drill level 2) ───────────────────────────────────────────────────────────────

export type CeoBreakdownMetric =
  | "revenue"
  | "aging"
  | "occupancy-type"
  | "occupancy-location"
  | "bookings-month"
  | "inquiries-type"
  | "staff";

/** A breakdown request: the metric, its key (one of month / bucket / spaceTypeId / locationId / type / userId) and the scope. */
export type CeoBreakdownQuery = {
  metric: CeoBreakdownMetric;
  period: CeoPeriod;
  /** Dashboard location filter; for "occupancy-location" it is the location that was tapped. */
  locationId?: number | null;
  /** yyyy-MM: revenue, bookings-month. */
  month?: string;
  /** aging */
  bucket?: string;
  /** occupancy-type */
  spaceTypeId?: number;
  /** inquiries-type */
  type?: string;
  /** staff */
  userId?: number;
};

export type CeoBreakdownRow = {
  /** Location id, space type id or yyyy-MM month, depending on the metric (always text). */
  key: string;
  label: string;
  value: number;
  value2: number | null;
  count: number | null;
};

export type CeoBreakdown = {
  title: string;
  subtitle: string | null;
  valueLabel: string;
  value2Label: string | null;
  rows: CeoBreakdownRow[];
};

// ─── GET api/ceo/records/* (drill level 3) ───────────────────────────────────────────────────────────────

export type CeoRecordKind = "invoices" | "spaces" | "bookings" | "inquiries" | "quotations" | "leases";

export type CeoRecordParams = Record<string, string | number | boolean | null | undefined>;

/** A records request: which list and its filters (sent as the query string as they are). */
export type CeoRecordsQuery = { kind: CeoRecordKind; params: CeoRecordParams };

export type CeoInvoiceRecord = {
  invoiceId: number | null;
  invoiceNumber: string | null;
  customer: string | null;
  location: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  total: number;
  paid: number;
  balance: number;
  status: string | null;
};

export type CeoSpaceRecord = {
  spaceId: number | null;
  name: string | null;
  spaceType: string | null;
  location: string | null;
  capacity: number | null;
  occupied: boolean;
  customer: string | null;
  bookingEndOn: string | null;
};

export type CeoBookingRecord = {
  bookingId: number | null;
  customer: string | null;
  space: string | null;
  location: string | null;
  startOn: string | null;
  endOn: string | null;
  status: string | null;
  totalAmount: number | null;
};

export type CeoInquiryRecord = {
  inquiryId: number | null;
  name: string | null;
  phone: string | null;
  type: InquiryType | null;
  /** The type as sent (for a type the app does not know). */
  typeText: string | null;
  referenceName: string | null;
  status: string | null;
  createdOn: string | null;
  feedback: string | null;
};

/** records/leases: a confirmed lease ending in the window, soonest first. */
export type CeoLeaseRecord = CeoLeaseExpiring & {
  /** Days from today to the end date (negative = already ended); null when not sent. */
  daysLeft: number | null;
};

export type CeoQuotationRecord = {
  quotationId: number | null;
  quotationNumber: string | null;
  customer: string | null;
  location: string | null;
  createdBy: string | null;
  status: string | null;
  total: number | null;
  createdOn: string | null;
};

type RecordsOf<K extends CeoRecordKind, Row> = {
  kind: K;
  title: string;
  /** Full count on the server (rows are newest first, at most 200). */
  total: number;
  rows: Row[];
};

export type CeoRecords =
  | RecordsOf<"invoices", CeoInvoiceRecord>
  | RecordsOf<"spaces", CeoSpaceRecord>
  | RecordsOf<"bookings", CeoBookingRecord>
  | RecordsOf<"inquiries", CeoInquiryRecord>
  | RecordsOf<"quotations", CeoQuotationRecord>
  | RecordsOf<"leases", CeoLeaseRecord>;
