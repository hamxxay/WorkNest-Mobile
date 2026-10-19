import type { DashboardPeriod } from "./dashboard";
import { STAFF_ENDPOINTS } from "./endpoints";
import { staffGet } from "./http";
import { bool, idList, num, optNum, optStr, pick, str, unwrapEnvelope, withQuery } from "./normalize";

// Chart drill-down of the admin dashboard overview (mirrors WN_CMS services/dashboard-details.service.ts):
// GET dashboard/overview-details/{kind} answers the records behind one bar / slice / point of an overview chart,
// on exactly the overview's rules, so its totals are the chart's figure. Read-only. Same roles (sales executive,
// admin, super admin) and location scope as GET dashboard/overview. Before the database update DASH_02 the API
// answers 503 with a message naming the script; bad parameters answer 400 with the API's message.
//
//   revenue-month  (month)     invoices issued that month                         -> invoices
//   aging-bucket   (bucket)    open invoices of that aging bucket                 -> invoices
//   top-customer   (customer)  that customer's invoices in the period             -> invoices
//   new-bookings   (month)     bookings made that month                           -> bookings
//   leases-ending  (month)     live bookings ending that month                    -> bookings
//   space-type     (spaceType) the type's active spaces, in use now or not        -> spaces
//   occupied-month (month)     spaces in use at the end of that month (now for this month) -> spaces

export type OverviewDetailKind =
  | "revenue-month"
  | "aging-bucket"
  | "top-customer"
  | "new-bookings"
  | "leases-ending"
  | "space-type"
  | "occupied-month";

/** Row shape of a list. */
export type OverviewDetailRecords = "invoices" | "bookings" | "spaces";

/** The API's kinds, each with the row shape it answers. */
export const OVERVIEW_DETAIL_RECORDS: Record<OverviewDetailKind, OverviewDetailRecords> = {
  "revenue-month": "invoices",
  "aging-bucket": "invoices",
  "top-customer": "invoices",
  "new-bookings": "bookings",
  "leases-ending": "bookings",
  "space-type": "spaces",
  "occupied-month": "spaces",
};

/** Aging bucket keys of the API, in the overview's order (not due, 1-30, 31-60, 61-90, 90+ days). */
export const AGING_BUCKET_KEYS = ["not_due", "1_30", "31_60", "61_90", "90_plus"] as const;
export type AgingBucketKey = (typeof AGING_BUCKET_KEYS)[number];

/** One chart element: the kind and the parameter that kind reads (month = yyyy-MM). */
export type OverviewDetailRequest =
  | { kind: "revenue-month" | "new-bookings" | "leases-ending" | "occupied-month"; month: string }
  | { kind: "aging-bucket"; bucket: AgingBucketKey }
  | { kind: "top-customer"; customer: string }
  | { kind: "space-type"; spaceType: string };

/** The dashboard's period and locations, sent exactly as GET dashboard/overview sends them. */
export type OverviewDetailScope = {
  period?: DashboardPeriod;
  /** Locations to total; empty / omitted = all the user may see. */
  locationIds?: readonly number[];
};

export type OverviewInvoiceRow = {
  invoiceId: number;
  invoiceNumber: string | null;
  bookingId: number | null;
  customer: string;
  space: string | null;
  location: string | null;
  /** yyyy-MM-dd */
  issuedOn: string | null;
  dueOn: string | null;
  /** GrandTotal. */
  total: number;
  paid: number;
  /** Withholding tax the customer keeps (not owed). */
  wht: number;
  /** Still owed (GrandTotal - WHT - paid) of an open invoice, else 0. */
  balance: number;
  isOpen: boolean;
  isPaid: boolean;
  daysOverdue: number;
  status: string | null;
};

export type OverviewBookingRow = {
  bookingId: number;
  customer: string;
  space: string | null;
  spaceType: string | null;
  locationId: number | null;
  location: string | null;
  /** yyyy-MM-ddTHH:mm:ss (business time). */
  createdOn: string | null;
  startOn: string | null;
  endOn: string | null;
  statusId: number;
  status: string | null;
  totalAmount: number;
  /** Seats the booking took, when it records them. */
  seats: number | null;
};

export type OverviewSpaceRow = {
  spaceId: number;
  /** Space name, or its code when it has no name. */
  name: string;
  spaceCode: string | null;
  spaceType: string | null;
  locationId: number | null;
  location: string | null;
  capacity: number | null;
  /** In use at the moment the list is for. */
  occupied: boolean;
  /** The live booking shown; null when vacant. */
  bookingId: number | null;
  customer: string | null;
  bookingStartOn: string | null;
  bookingEndOn: string | null;
  status: string | null;
  /** Live bookings on the space at that moment (more than 1 for e.g. morning + evening shifts). */
  bookingCount: number;
};

type DetailsOf<R extends OverviewDetailRecords, T> = { records: R; rows: T[] };

export type OverviewDetails = {
  kind: string;
  title: string;
  /** Every matching record (rows holds the first 200; spaces: 500). */
  total: number;
  /** Invoices: invoiced (GrandTotal) of all; bookings: their TotalAmount. */
  amount: number;
  /** Invoices: invoiced and now paid (the chart's Paid). */
  paidAmount: number;
  /** Invoices: still owed (the aging amount). */
  balance: number;
  /** Spaces: in use at the moment the list is for. */
  occupied: number;
  /** Spaces: active spaces in the locations. */
  totalSpaces: number;
  /** The window the list covers, yyyy-MM-dd (to null = no end). */
  from: string | null;
  to: string | null;
  /** Business time the list was taken at, yyyy-MM-ddTHH:mm:ss. */
  generatedAt: string;
} & (
  | DetailsOf<"invoices", OverviewInvoiceRow>
  | DetailsOf<"bookings", OverviewBookingRow>
  | DetailsOf<"spaces", OverviewSpaceRow>
);

/** Path and query of one drill-down: period and locationIds as the overview sends them, then the kind's parameter. */
export function overviewDetailsPath(request: OverviewDetailRequest, scope: OverviewDetailScope = {}): string {
  return withQuery(STAFF_ENDPOINTS.dashboard.overviewDetails(request.kind), {
    period: scope.period ?? "month",
    locationIds: idList(scope.locationIds),
    month: "month" in request ? request.month : undefined,
    bucket: "bucket" in request ? request.bucket : undefined,
    spaceType: "spaceType" in request ? request.spaceType : undefined,
    customer: "customer" in request ? request.customer : undefined,
  });
}

const rowsOf = <T>(value: unknown, map: (row: any) => T): T[] => (Array.isArray(value) ? value.map(map) : []);

const toInvoice = (r: any): OverviewInvoiceRow => ({
  invoiceId: num(r, "invoiceId"),
  invoiceNumber: optStr(r, "invoiceNumber"),
  bookingId: optNum(r, "bookingId"),
  customer: optStr(r, "customer") ?? "Customer",
  space: optStr(r, "space"),
  location: optStr(r, "location"),
  issuedOn: optStr(r, "issuedOn"),
  dueOn: optStr(r, "dueOn"),
  total: num(r, "total"),
  paid: num(r, "paid"),
  wht: num(r, "wht"),
  balance: num(r, "balance"),
  isOpen: bool(r, "isOpen"),
  isPaid: bool(r, "isPaid"),
  daysOverdue: num(r, "daysOverdue"),
  status: optStr(r, "status"),
});

const toBooking = (r: any): OverviewBookingRow => ({
  bookingId: num(r, "bookingId"),
  customer: optStr(r, "customer") ?? "Customer",
  space: optStr(r, "space"),
  spaceType: optStr(r, "spaceType"),
  locationId: optNum(r, "locationId"),
  location: optStr(r, "location"),
  createdOn: optStr(r, "createdOn"),
  startOn: optStr(r, "startOn"),
  endOn: optStr(r, "endOn"),
  statusId: num(r, "statusId"),
  status: optStr(r, "status"),
  totalAmount: num(r, "totalAmount"),
  seats: optNum(r, "seats"),
});

const toSpace = (r: any): OverviewSpaceRow => {
  const spaceId = num(r, "spaceId");
  const code = optStr(r, "spaceCode");
  return {
    spaceId,
    name: optStr(r, "name") ?? code ?? (spaceId ? `Space ${spaceId}` : "Space"),
    spaceCode: code,
    spaceType: optStr(r, "spaceType"),
    locationId: optNum(r, "locationId"),
    location: optStr(r, "location"),
    capacity: optNum(r, "capacity"),
    occupied: bool(r, "occupied"),
    bookingId: optNum(r, "bookingId"),
    customer: optStr(r, "customer"),
    bookingStartOn: optStr(r, "bookingStartOn"),
    bookingEndOn: optStr(r, "bookingEndOn"),
    status: optStr(r, "status"),
    bookingCount: num(r, "bookingCount"),
  };
};

const isRecords = (value: string): value is OverviewDetailRecords => value === "invoices" || value === "bookings" || value === "spaces";

/**
 * The API's answer (envelope or plain DashboardOverviewDetailsDto) as OverviewDetails; a missing field shows as
 * 0 / null / []. The row shape is the one the server names, else the one of `kind`.
 */
export function normalizeOverviewDetails(raw: unknown, kind: OverviewDetailKind): OverviewDetails {
  const d = unwrapEnvelope<any>(raw) ?? {};
  const named = str(d, "records").toLowerCase();
  const records: OverviewDetailRecords = isRecords(named) ? named : OVERVIEW_DETAIL_RECORDS[kind];
  const rawRows = pick(d, "rows");
  const head = {
    kind: str(d, "kind") || kind,
    title: str(d, "title"),
    amount: num(d, "amount"),
    paidAmount: num(d, "paidAmount"),
    balance: num(d, "balance"),
    occupied: num(d, "occupied"),
    totalSpaces: num(d, "totalSpaces"),
    from: optStr(d, "from"),
    to: optStr(d, "to"),
    generatedAt: str(d, "generatedAt"),
  };
  const total = (shown: number) => Math.max(num(d, "total"), shown);
  if (records === "invoices") {
    const rows = rowsOf(rawRows, toInvoice);
    return { ...head, total: total(rows.length), records, rows };
  }
  if (records === "bookings") {
    const rows = rowsOf(rawRows, toBooking);
    return { ...head, total: total(rows.length), records, rows };
  }
  const rows = rowsOf(rawRows, toSpace);
  return { ...head, total: total(rows.length), records, rows };
}

/**
 * GET dashboard/overview-details/{kind}?period=&locationIds=&<kind's parameter> — the records behind one chart
 * element of the overview. Roles: sales executive, admin, super admin. Throws ApiError (503 before DASH_02, with
 * the API's message naming the script; 400 for bad parameters).
 */
export async function getOverviewDetails(request: OverviewDetailRequest, scope: OverviewDetailScope = {}): Promise<OverviewDetails> {
  const raw = await staffGet(overviewDetailsPath(request, scope));
  return normalizeOverviewDetails(raw, request.kind);
}
