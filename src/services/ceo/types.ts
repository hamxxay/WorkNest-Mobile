import type { InquiryType } from "../../theme/inquiryTypes";

// Types of the CEO dashboard API (WN_APIs CeoController; contract: GET api/ceo/dashboard, api/ceo/breakdown,
// api/ceo/records/*). Every endpoint is GET, CEO or super admin only, camelCase JSON in the usual
// { isSuccessful, data } envelope; money in PKR, dates yyyy-MM-dd (or full ISO), months yyyy-MM.
// The normalisers (./normalize.ts) fill these from whatever the server sends: a missing number is 0, a missing
// list is [], a missing section is null (the screen shows its empty state) and a missing previous-period figure is
// null (no "vs last period" change is shown).

/**
 * month (default) | quarter | year: this calendar period to date, compared with the previous one. custom: a day range
 * (`range`, the server's database update CS_01), compared with the same number of days just before it.
 */
export type CeoPeriod = "month" | "quarter" | "year" | "custom";

/** A custom date range: yyyy-MM-dd, both days included (at most 366 days, not after today, 2000 or later). */
export type DashRange = { from: string; to: string };

/**
 * What every CEO call is narrowed to: the period and one location (null / 0 = all locations). `range` is used only
 * with period custom (a calendar period sends no dates, so those requests stay as they were).
 */
export type CeoScope = { period: CeoPeriod; locationId?: number | null; range?: DashRange | null };

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
  /**
   * Unpaid invoices for a billing period that has not started yet (not inside Outstanding), PKR and count; null when
   * the server does not send them (an API older than the database update CP_01): the card is hidden.
   */
  billedInAdvance: number | null;
  billedInAdvanceCount: number | null;
  /** Collected / invoiced in the period, percent; null when not sent. */
  collectionRate: number | null;
  /** Last 12 months, oldest first. */
  months: CeoMoneyMonth[];
  aging: CeoAgingBucket[];
  /** Top 5 by amount invoiced over the last 12 months. */
  topCustomers: CeoTopCustomer[];
  /**
   * CP_02 (money slice): security deposits billed on the period's invoices (left out of invoiced), the same one period
   * earlier, and how many invoices carry one. null before the database update CP_02: then invoiced / collected still
   * include deposits and collected is the paid invoices only; the deposits card is hidden.
   */
  securityDeposits: number | null;
  securityDepositsPrev: number | null;
  securityDepositsCount: number | null;
  /**
   * CP_02: money actually received in the period (fee receipts by receipt date + payments by paid date, whatever invoice
   * it was for), the same one period earlier and how many receipts / payments; null before CP_02 (card hidden).
   */
  received: number | null;
  receivedPrev: number | null;
  receivedCount: number | null;
  /** Received by month (last 12 months, oldest first); [] when not sent. */
  receivedSeries: CeoReceivedMonth[];
};

export type CeoReceivedMonth = { month: string; received: number; count: number };

/** Room categories occupancy is measured on (WN_SpaceCategories.Code), in this order. */
export type CeoRoomCategoryCode = "PrivateOffice" | "SharedSpace";

/** One room category at one moment (CP_02): rooms with a confirmed booking of the rooms that existed then. */
export type CeoCategoryOccupancyPoint = {
  categoryCode: string;
  /** WN_SpaceCategories.Label as sent ("Private Office"). */
  label: string;
  rooms: number;
  occupied: number;
  occupancyPct: number;
};

/** A room category now (CP_02): rooms and seats, and the rooms one period ago (rooms that existed then). */
export type CeoCategoryOccupancy = CeoCategoryOccupancyPoint & {
  roomsPrev: number | null;
  occupiedPrev: number | null;
  occupancyPctPrev: number | null;
  seats: number;
  seatsSold: number;
  seatOccupancyPct: number;
};

export type CeoOccupancyMonth = {
  month: string;
  occupancyPct: number;
  newBookings: number;
  /** CP_02: each room category at that month end (this month: now); [] before it. */
  categories: CeoCategoryOccupancyPoint[];
};
export type CeoSpaceTypeOccupancy = { spaceTypeId: number | null; name: string; total: number; occupied: number };
export type CeoLocationOccupancy = {
  /** 0 = the "No location" row (rooms not tied to a shown location; its records ask locationId=none). */
  locationId: number | null;
  name: string;
  total: number;
  occupied: number;
  /** CP_02: seats of the location's rooms and seats sold now (null before it). */
  seats?: number | null;
  seatsSold?: number | null;
  /** CP_02: each room category at this location now; [] / left out before it. */
  categories?: CeoCategoryOccupancy[];
};
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
  /**
   * CP_02 (occupancy slice): occupancy shown apart for Private Office and Shared Space (confirmed bookings, rooms only),
   * with seats; [] before the database update (then the old single figure and by space type are shown).
   */
  categories: CeoCategoryOccupancy[];
  /** CP_02: seats of both room categories and the seats sold now; null before it. */
  totalSeats: number | null;
  seatsSold: number | null;
  seatOccupancyPct: number | null;
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
  /**
   * Quotations created in the period that were booked / quotations created in the period, percent (0-100, never
   * above); null when not sent.
   */
  conversionRate: number | null;
  /**
   * Quotations created in the period that were booked (never more than the quotations). An older API does not send
   * it: then the period's bookings, at most one per quotation.
   */
  quotationsBooked: number;
  inquiriesByType: CeoInquiryTypeCount[];
  quotationValue: number;
  bookingValue: number;
  /**
   * Tour inquiries follow the location filter by their branch (one location = only its inquiries). True when a
   * location is chosen but the figures still count every location's inquiries (the server's database update QA_07
   * has not run, or an older API that never narrowed them): the screen then says "all locations".
   */
  inquiriesAllLocations: boolean;
  /**
   * What bookingValue is (CP_02): "contract" = the contract value of the period's new bookings, "firstInvoice" = the
   * first invoice of each (before CP_02); null when not sent (an older API: first invoices).
   */
  bookingValueBasis: "contract" | "firstInvoice" | null;
  /** CP_02: of the Bookings stage, those made from a converted quotation (the rest are direct); null before it. */
  bookingsFromQuotations: number | null;
  /** CP_02, one location chosen: the period's inquiries with no branch (not counted); null otherwise. */
  inquiriesNoBranch: number | null;
};

/** A location: its sales executives and the quotations made on its spaces in the period (by anyone, as the funnel). */
export type CeoTeamLocation = {
  locationId: number | null;
  name: string;
  salesExecutives: number;
  quotations: number;
  converted: number;
  /** CP_02: quotations / converted count only quotations made by sales executives (before it: anyone's). */
  salesExecutivesOnly: boolean;
};

/** A sales executive: the API sends no other role on the Team section. */
export type CeoPerson = {
  userId: number | null;
  name: string;
  /** WN_Roles.DisplayName of their role, as sent ("" when not sent). */
  role: string;
  locations: string | null;
  quotations: number;
  converted: number;
  /**
   * Revenue (PKR): the value of the quotations they created in the period that were converted to a booking (the
   * dashboard's converted value; an older API sends it as convertedValue).
   */
  revenue: number;
  /** CP_02: how many new bookings make up the revenue (null before it). */
  bookings: number | null;
};

/** Team section: only the sales executives (filtered by the API), highest revenue first, and their totals. */
export type CeoTeam = {
  perLocation: CeoTeamLocation[];
  people: CeoPerson[];
  /** How many sales executives `people` lists. */
  salesExecutives: number;
  /** Their revenue together (PKR). */
  revenue: number;
  /**
   * What revenue is: "bookings" (CP_02) = contract value of the new live bookings each sold (their quotation, else the
   * booking they made); "quotations" = value of their converted quotations (before CP_02, or not sent).
   */
  revenueBasis: "bookings" | "quotations";
};

export type CeoDashboard = {
  period: CeoPeriod;
  /** e.g. "October 2026", "1 Oct - 15 Oct 2026" ("" when not sent). */
  periodLabel: string;
  generatedAt: string | null;
  /** A custom period: the range the figures cover, and the one the previous figures cover (set only when sent). */
  range?: DashRange;
  previousRange?: DashRange;
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
  | "occupancy-category"
  | "bookings-month"
  | "inquiries-type"
  | "staff";

/**
 * A breakdown request: the metric, its key (one of month / bucket / spaceTypeId / locationId / type / userId) and the
 * scope. A custom period carries its `range` (sent as periodFrom / periodTo; revenue without a month: the invoices
 * whose billing period starts in the range, sent as from / to).
 */
export type CeoBreakdownQuery = {
  metric: CeoBreakdownMetric;
  period: CeoPeriod;
  /** period custom: the dashboard's range. */
  range?: DashRange | null;
  /** Dashboard location filter; for "occupancy-location" it is the location that was tapped. */
  locationId?: number | null;
  /** yyyy-MM: revenue, bookings-month. */
  month?: string;
  /** aging */
  bucket?: string;
  /** occupancy-type */
  spaceTypeId?: number;
  /** occupancy-category: "PrivateOffice" | "SharedSpace" (CP_02). */
  category?: string;
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

// ─── KPI drill-downs ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Where a dashboard figure leads: a breakdown screen (GET api/ceo/breakdown; `recordsParams` are added to the records
 * its rows open, e.g. status=paid for Collected) or a records list (GET api/ceo/records/*; `keepTitle` shows `title`
 * instead of the server's, `timeless` names only the location under it: not bound to the period).
 */
export type CeoDrillStep =
  | { kind: "breakdown"; query: CeoBreakdownQuery; recordsParams?: CeoRecordParams }
  | { kind: "records"; query: CeoRecordsQuery; title?: string; keepTitle?: boolean; timeless?: boolean };

/** A row of a list built from the dashboard's own figures (months of the period, aging buckets, locations). */
export type CeoDrillListRow = CeoBreakdownRow & { open: CeoDrillStep | null };

/** Drill level 2 built on the device from the dashboard's answer (no API call), shown like a breakdown. */
export type CeoDrillList = {
  title: string;
  subtitle: string | null;
  valueLabel: string;
  value2Label: string | null;
  /** money (PKR), count, or occupancy (value = occupied, value2 = total spaces). */
  unit: "money" | "count" | "occupancy";
  /** Spoken after a row: what it opens ("Opens this month by location"). */
  rowHint: string;
  rows: CeoDrillListRow[];
};

/** What a KPI tile opens: one of the steps above, or a list built from the dashboard. */
export type CeoDrillTarget = CeoDrillStep | { kind: "list"; list: CeoDrillList };

// ─── GET api/ceo/records/* (drill level 3) ───────────────────────────────────────────────────────────────

export type CeoRecordKind = "invoices" | "spaces" | "bookings" | "inquiries" | "quotations" | "leases" | "receipts";

export type CeoRecordParams = Record<string, string | number | boolean | null | undefined>;

/** A records request: which list and its filters (sent as the query string as they are). */
export type CeoRecordsQuery = { kind: CeoRecordKind; params: CeoRecordParams };

export type CeoInvoiceRecord = {
  invoiceId: number | null;
  invoiceNumber: string | null;
  customer: string | null;
  location: string | null;
  issuedOn: string | null;
  /** Billing period, yyyy-MM-dd; null when not sent (an older API: the card shows the issue date instead). */
  periodStart: string | null;
  periodEnd: string | null;
  dueOn: string | null;
  total: number;
  paid: number;
  /** GrandTotal - WHT - paid; 0 for a Paid invoice (CP_02; before it GrandTotal - paid). */
  balance: number;
  status: string | null;
  /** CP_02 (null before it): WHT withheld, the security deposit inside total, what Invoiced / Collected count of it. */
  wht?: number | null;
  deposit?: number | null;
  billed?: number | null;
  collected?: number | null;
};

/** CP_02: totals of every matching invoice (the list holds at most 200); balance = the positive balances. */
export type CeoInvoiceTotals = { billed: number; collected: number; balance: number };

/** records/receipts (CP_02): money received, a fee receipt or a payment, newest first. */
export type CeoReceiptRecord = {
  kind: "receipt" | "payment";
  refId: number | null;
  /** Receipt code (FR-...), or the payment's transaction reference. */
  reference: string | null;
  receivedOn: string | null;
  customer: string | null;
  location: string | null;
  invoiceId: number | null;
  invoiceNumber: string | null;
  bookingId: number | null;
  amount: number;
  /** Cash / Bank / Cheque / Online Payment ... */
  method: string | null;
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
  /** CP_02: the room category's label / code and the seats sold now (null before it). */
  category?: string | null;
  categoryCode?: string | null;
  seatsSold?: number | null;
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
  /** CP_02 sales lists (records/bookings?sales=true / sellerId=): who sold it and whether it came from a quotation. */
  sellerId?: number | null;
  seller?: string | null;
  fromQuotation?: boolean | null;
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
  | (RecordsOf<"invoices", CeoInvoiceRecord> & { invoiceTotals?: CeoInvoiceTotals | null })
  | (RecordsOf<"receipts", CeoReceiptRecord> & { amount?: number | null })
  | RecordsOf<"spaces", CeoSpaceRecord>
  | RecordsOf<"bookings", CeoBookingRecord>
  | RecordsOf<"inquiries", CeoInquiryRecord>
  | RecordsOf<"quotations", CeoQuotationRecord>
  | RecordsOf<"leases", CeoLeaseRecord>;

// ─── GET api/ceo/rooms (room report) ─────────────────────────────────────────────────────────────────────

/** A booking's shift (the API's ShiftType normalised): "24/7" for full-time and anything unknown. */
export type CeoRoomShift = "24/7" | "Morning" | "Evening";

/** Sold per seat against the expected price (list price; shift price for Morning / Evening), 0.5% either way is "at". */
export type CeoRoomPricing = "under" | "at" | "over";

/** A sale's pricing: under / at / over, or "unpriced" when no list price is known (not compared). */
export type CeoRoomSalePricing = CeoRoomPricing | "unpriced";

/** A confirmed booking on a room that overlaps the period. Money in PKR a month (whole room / all its seats). */
export type CeoRoomSale = {
  bookingId: number | null;
  /** Company, else the customer's name (as sent; "Customer" when missing). */
  customer: string;
  shift: CeoRoomShift;
  seatsSold: number;
  /** yyyy-MM-dd */
  startOn: string | null;
  endOn: string | null;
  /** List price per seat when it was sold (the booking's own price row, else today's); null when none is known. */
  listSeatPriceAtSale: number | null;
  /**
   * The shift's discount cap stored for this location, percent. Only Morning / Evening bookings are compared with
   * the price less this cap; a 24/7 booking may carry a cap that does not apply to it.
   */
  shiftDiscountCapPct: number;
  /** What a seat should sell for: the list price (24/7) or the list price less the shift cap; null when unpriced. */
  expectedSeatPrice: number | null;
  expectedMonthly: number | null;
  soldMonthly: number;
  soldSeatPrice: number;
  /** (sold - expected) per seat x seats: negative = under the expected price; null when unpriced. */
  varianceMonthly: number | null;
  /** Sold per seat against expected, percent (-12.5 = 12.5% under); null when unpriced. */
  variancePct: number | null;
  pricing: CeoRoomSalePricing;
  /** CP_02: the booking's fixed PKR discount a month, already off soldMonthly (0 / left out when none or an older API). */
  fixedMonthly?: number;
  /** CP_02: the booking's discount is a fixed PKR amount (false / left out otherwise). */
  fixedDiscount?: boolean;
};

/** A room sold monthly (private office or shared space) and its sales in the period, in the server's order. */
export type CeoRoom = {
  spaceId: number | null;
  name: string;
  code: string | null;
  locationId: number | null;
  location: string | null;
  spaceType: string | null;
  categoryCode: string | null;
  seats: number;
  /** Today's monthly list price per seat; null when the room has none. */
  listSeatPrice: number | null;
  listRoomPrice: number | null;
  /** A confirmed booking covers this moment. */
  occupiedNow: boolean;
  /** Days of the period so far with a confirmed booking, percent (0..100). */
  periodOccupancyPct: number;
  /** The days behind periodOccupancyPct (null when the server does not send them). */
  occupiedDays: number | null;
  periodDays: number | null;
  /** [] = no booking in the period (shown as not let). */
  sales: CeoRoomSale[];
  /**
   * CP_02: start (yyyy-MM-dd) of the next confirmed booking that starts after the period; null / left out when none
   * or an older API.
   */
  upcomingStartOn?: string | null;
};

/** Occupancy of one room category (private offices, shared spaces): the server's summary.byCategory. */
export type CeoRoomCategory = {
  /** WN_SpaceCategories.Code: "PrivateOffice" | "SharedSpace" ("" = rooms without one). */
  categoryCode: string;
  /** The category's label from the database (e.g. "Private Office"). */
  label: string;
  rooms: number;
  occupiedNow: number;
  vacantNow: number;
  /** Occupied now / rooms, percent. */
  occupancyNowPct: number;
  /** Days occupied: room-days with a confirmed booking / room-days of the period so far, percent. */
  periodOccupancyPct: number;
};

export type CeoRoomShiftSummary = {
  shift: CeoRoomShift;
  /** under + at + over + unpriced */
  sales: number;
  under: number;
  at: number;
  over: number;
  /** Sales without a list price (not compared). */
  unpriced: number;
  expectedMonthly: number;
  soldMonthly: number;
  varianceMonthly: number;
};

export type CeoRoomSummary = {
  rooms: number;
  occupiedNow: number;
  vacantNow: number;
  occupancyNowPct: number;
  periodOccupancyPct: number;
  /** under + at + over + unpriced */
  sales: number;
  under: number;
  at: number;
  over: number;
  /** Sales without a list price (not compared). */
  unpriced: number;
  /** Expected monthly of the priced sales (list or shift price x seats). */
  listMonthly: number;
  /** Sold monthly of every sale. */
  soldMonthly: number;
  /** Net of the priced sales: sold - expected (negative = under overall). */
  varianceMonthly: number;
  /** The gap of the under-priced sales a month (zero or negative). */
  underMonthly: number;
  /** The premium of the over-priced sales a month (zero or positive). */
  overMonthly: number;
  /** Always 24/7, Morning, Evening in that order (a shift without sales as zeros). */
  byShift: CeoRoomShiftSummary[];
  /**
   * Always Private Office then Shared Space (zeros when there are none), then any other category the rooms carry;
   * the same rooms as the totals above, so they add up to them.
   */
  byCategory: CeoRoomCategory[];
};

/** The room report (available: the server's database update CEO_02 has run). */
export type CeoRoomReport = {
  available: true;
  period: CeoPeriod;
  /** e.g. "October 2026" ("" when not sent). */
  periodLabel: string;
  generatedAt: string | null;
  /** A custom period: the range the report covers (set only when sent). */
  range?: DashRange;
  summary: CeoRoomSummary;
  /** By location, then room code / name (the server's order). */
  rooms: CeoRoom[];
};

/** The server cannot build the report yet (its procedure is missing): only its message is shown. */
export type CeoRoomsUnavailable = { available: false; message: string };

export type CeoRooms = CeoRoomReport | CeoRoomsUnavailable;
