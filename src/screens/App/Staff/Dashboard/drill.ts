import {
  CEO_DB_UPDATE_TITLE,
  dashboardErrorView,
  isMonthKey,
  joinParts,
  monthLabel,
  monthLongLabel,
  moneyFull,
  pct,
  recordCard,
  recordFields,
  statusOf,
  type CeoErrorView,
  type CeoRecordCard,
} from "../../../../services/ceo";
import { serverMessage } from "../../../../services/apiClient";
import type { DashboardOverview, OverviewDetailKind, OverviewDetailRequest, OverviewDetails } from "../../../../services/staff";
import { formatDate, formatNumber } from "../../../../utils/format";

// Chart drill-down of the staff (admin / super admin) dashboard overview, as the CMS admin dashboard does it
// (WN_CMS dashboard-overview/overview-drill.ts): each chart element opens the records behind it
// (GET dashboard/overview-details/{kind}, services/staff/dashboardDetails). Pure, unit-tested (drill.test.ts).
//
// The app's overview charts and their kinds:
//   "Invoiced and paid" bar chart, a month     -> revenue-month (that month's invoices)
//   "Occupancy" ring (in use now)             -> occupied-month (this month = the spaces in use now)
//   "By space type" bars, a type              -> space-type (the type's spaces, booked and vacant)
// The CMS's aging, top customers and lease expiries charts are not on the app's dashboard, so aging-bucket,
// top-customer and leases-ending are not opened from it; new-bookings is reached from the spaces-in-use list.

/** Chart names, used as the first part of the breadcrumb. */
export const DRILL_CHARTS = {
  revenue: "Invoiced and paid",
  occupancy: "Occupancy",
  spaceTypes: "Occupancy by space type",
} as const;

/** What a tap opens: the API request, the breadcrumb and a title shown until the server's title arrives. */
export type DrillTarget = { request: OverviewDetailRequest; trail: string[]; title: string };

/** A month bar of "Invoiced and paid": the invoices issued that month. Null for a month the API cannot read. */
export function revenueMonthTarget(month: string): DrillTarget | null {
  if (!isMonthKey(month)) return null;
  return {
    request: { kind: "revenue-month", month },
    trail: [DRILL_CHARTS.revenue, monthLabel(month)],
    title: `Invoices issued in ${monthLabel(month)}`,
  };
}

/** A space type bar: its spaces, in use now or not. Null for a blank type (the API needs the name). */
export function spaceTypeTarget(spaceType: string): DrillTarget | null {
  const name = (spaceType ?? "").trim();
  if (!name) return null;
  return { request: { kind: "space-type", spaceType }, trail: [DRILL_CHARTS.spaceTypes, name], title: `${name} spaces` };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * yyyy-MM of "now" for the server: the month of the overview's generatedAt (business time, so a phone in another
 * time zone still asks for the dashboard's month), else its latest trend month, else the device's month.
 */
export function currentMonthOf(overview: Pick<DashboardOverview, "generatedAt" | "months">, now: Date = new Date()): string {
  const fromGenerated = (overview.generatedAt ?? "").slice(0, 7);
  if (isMonthKey(fromGenerated)) return fromGenerated;
  const latest = overview.months[overview.months.length - 1]?.month;
  if (isMonthKey(latest)) return latest;
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

/** The occupancy ring (in use now): the spaces in use now, i.e. occupied-month for this month. */
export function occupancyNowTarget(overview: Pick<DashboardOverview, "generatedAt" | "months">, now?: Date): DrillTarget {
  return {
    request: { kind: "occupied-month", month: currentMonthOf(overview, now) },
    trail: [DRILL_CHARTS.occupancy, "In use now"],
    title: "Spaces in use now",
  };
}

/** "Spaces in use now" for this month (or later), else "Spaces in use at the end of September 2026" (CMS wording). */
export function spacesInUseLabel(month: string, currentMonth: string): string {
  return month >= currentMonth ? "Spaces in use now" : `Spaces in use at the end of ${monthLongLabel(month)}`;
}

/** A link to another list about the same month, shown above the records. */
export type RelatedTarget = DrillTarget & { label: string };

/**
 * The CMS's related list of a month (spaces in use <-> new bookings made that month), offered only on a list opened
 * from a chart (`isRelated` false), so the path never grows beyond two.
 */
export function relatedTarget(
  request: OverviewDetailRequest,
  trail: readonly string[],
  details: Pick<OverviewDetails, "generatedAt"> | null,
  isRelated: boolean,
): RelatedTarget | null {
  if (isRelated || !("month" in request) || !isMonthKey(request.month)) return null;
  const month = request.month;
  if (request.kind === "occupied-month") {
    return {
      label: `New bookings made in ${monthLongLabel(month)}`,
      request: { kind: "new-bookings", month },
      trail: [...trail, "New bookings"],
      title: `Bookings made in ${monthLabel(month)}`,
    };
  }
  if (request.kind === "new-bookings") {
    const generated = (details?.generatedAt ?? "").slice(0, 7);
    const label = spacesInUseLabel(month, isMonthKey(generated) ? generated : month);
    return { label, request: { kind: "occupied-month", month }, trail: [...trail, "Spaces in use"], title: label };
  }
  return null;
}

// ─── Totals line ──────────────────────────────────────────────────────────────────────────────────────────

const count = (n: number) => formatNumber(n, 0);

/** The line on the totals, as the chart counts them (CMS overview-drill summaryOf); null when there is none. */
export function detailsSummary(kind: OverviewDetailKind, d: OverviewDetails): string | null {
  switch (kind) {
    case "revenue-month":
      return `${moneyFull(d.amount)} invoiced, ${moneyFull(d.paidAmount)} of it paid`;
    case "aging-bucket":
      return `${moneyFull(d.balance)} owed`;
    case "top-customer":
      return `${moneyFull(d.amount)} invoiced`;
    case "new-bookings":
    case "leases-ending":
      return `${moneyFull(d.amount)} booking value`;
    case "occupied-month":
      return d.totalSpaces > 0 ? `${pct(Math.round((d.occupied * 1000) / d.totalSpaces) / 10)} of ${count(d.totalSpaces)} active spaces` : null;
    case "space-type":
      return `${count(d.occupied)} of ${count(d.total)} in use`;
    default:
      return null;
  }
}

const NOUNS: Record<OverviewDetails["records"], [string, string]> = {
  invoices: ["invoice", "invoices"],
  bookings: ["booking", "bookings"],
  spaces: ["space", "spaces"],
};

/** "12 invoices", or "Showing 200 of 340 invoices" when the API sent only the first rows. */
export function detailsCountText(d: OverviewDetails): string {
  const [one, many] = NOUNS[d.records];
  const shown = d.rows.length;
  if (shown > 0 && d.total > shown) return `Showing ${count(shown)} of ${count(d.total)} ${many}`;
  return `${count(d.total)} ${d.total === 1 ? one : many}`;
}

/** Count and totals on one line: "12 invoices · PKR 1,200,000 invoiced, PKR 900,000 of it paid". */
export function detailsTotalsLine(kind: OverviewDetailKind, d: OverviewDetails): string {
  return [detailsCountText(d), detailsSummary(kind, d)].filter(Boolean).join(" · ");
}

// ─── Record cards ─────────────────────────────────────────────────────────────────────────────────────────

/** The screen a record opens. */
export type DetailTarget = { route: "BookingDetail"; bookingId: number } | { route: "InvoiceDetail"; invoiceId: number };

/** A read-only record card that may open its booking or invoice. */
export type DetailCard = CeoRecordCard & { target: DetailTarget | null; hint?: string };

const date = (value: string | null) => (value ? formatDate(value) : null);
const bookingRef = (id: number | null) => (id && id > 0 ? `#${id}` : null);

const toBooking = (bookingId: number | null): Pick<DetailCard, "target" | "hint"> =>
  bookingId && bookingId > 0 ? { target: { route: "BookingDetail", bookingId }, hint: "Opens the booking" } : { target: null };

/** One card per row, in the server's order; invoices open the invoice, bookings and booked spaces the booking. */
export function detailCards(d: OverviewDetails): DetailCard[] {
  switch (d.records) {
    case "invoices":
      return d.rows.map((r, i) => ({
        ...recordCard(
          `invoice-${r.invoiceId || "row"}-${i}`,
          r.invoiceNumber ?? (r.invoiceId ? `Invoice ${r.invoiceId}` : "Invoice"),
          joinParts(r.customer, r.space, r.location),
          r.status,
          moneyFull(r.total),
          recordFields(
            ["Issued", date(r.issuedOn)],
            ["Due", date(r.dueOn)],
            ["Paid", moneyFull(r.paid)],
            ["Balance", r.isOpen ? moneyFull(r.balance) : null],
            ["Overdue", r.isOpen && r.daysOverdue > 0 ? `${count(r.daysOverdue)} ${r.daysOverdue === 1 ? "day" : "days"}` : null],
            ["Withholding tax", r.wht > 0 ? moneyFull(r.wht) : null],
            ["Booking", bookingRef(r.bookingId)],
          ),
        ),
        ...(r.invoiceId > 0 ? { target: { route: "InvoiceDetail" as const, invoiceId: r.invoiceId }, hint: "Opens the invoice" } : { target: null }),
      }));
    case "bookings":
      return d.rows.map((r, i) => ({
        ...recordCard(
          `booking-${r.bookingId || "row"}-${i}`,
          r.customer,
          joinParts(r.space, r.location),
          r.status,
          moneyFull(r.totalAmount),
          recordFields(
            ["Booked on", date(r.createdOn)],
            ["Starts", date(r.startOn)],
            ["Ends", date(r.endOn)],
            ["Space type", r.spaceType],
            ["Seats", r.seats != null ? count(r.seats) : null],
            ["Booking", bookingRef(r.bookingId)],
          ),
        ),
        ...toBooking(r.bookingId),
      }));
    case "spaces":
    default:
      return d.rows.map((r, i) => ({
        ...recordCard(
          `space-${r.spaceId || "row"}-${i}`,
          r.name,
          joinParts(r.spaceType, r.location),
          r.occupied ? "Occupied" : "Available",
          null,
          recordFields(
            ["Capacity", r.capacity != null ? `${count(r.capacity)} ${r.capacity === 1 ? "person" : "people"}` : null],
            ["Customer", r.occupied ? r.customer : null],
            ["Booked until", r.occupied ? date(r.bookingEndOn) : null],
            ["Bookings", r.occupied && r.bookingCount > 1 ? count(r.bookingCount) : null],
            ["Booking", r.occupied ? bookingRef(r.bookingId) : null],
          ),
        ),
        ...(r.occupied ? toBooking(r.bookingId) : { target: null }),
      }));
  }
}

// ─── Errors ───────────────────────────────────────────────────────────────────────────────────────────────

/** Shown for the 503 when the API sent no wording of its own (CMS OVERVIEW_DETAILS_DB_MESSAGE). */
export const DASHBOARD_DETAILS_DB_MESSAGE = "Database update needed: run the script DASH_02_main_dashboard_drilldown_TEST.";

const FORBIDDEN_MESSAGE = "Your account cannot see these records. If this is wrong, please ask a super admin to check your role.";

/**
 * Error state of the details screen. A 503 before the database update shows the API's own message (it names the
 * script to run); a 503 that says nothing about a database update is an outage, worded as such.
 */
export function overviewDetailsErrorView(error: unknown): CeoErrorView {
  const fallback = "Could not load the records. Please try again.";
  if (statusOf(error) === 503) {
    const details = error && typeof error === "object" ? (error as { details?: unknown }).details : undefined;
    const ownMessage = error instanceof Error ? error.message : null;
    const fromApi = [serverMessage(details), ownMessage].find((t): t is string => !!t && /database update/i.test(t));
    if (fromApi) return { title: CEO_DB_UPDATE_TITLE, message: fromApi, icon: "construct-outline", databaseUpdate: true };
    return {
      title: "Could not load this",
      message: ownMessage || "The service is temporarily unavailable. Please try again in a few minutes.",
      icon: "cloud-offline-outline",
      databaseUpdate: false,
    };
  }
  return dashboardErrorView(error, { databaseUpdate: DASHBOARD_DETAILS_DB_MESSAGE, forbidden: FORBIDDEN_MESSAGE }, fallback);
}
