import type { Tone } from "../../theme/colors";
import { INQUIRY_TYPE_LABELS } from "../../theme/inquiryTypes";
import { formatDate, formatDateTime, formatNumber, parseDate } from "../../utils/format";
import { moneyFull } from "./format";
import type { CeoBookingRecord, CeoInquiryRecord, CeoInvoiceRecord, CeoLeaseRecord, CeoQuotationRecord, CeoRecords } from "./types";

// Records (drill level 3) as read-only cards: one shape for every list, so the Records screen renders them the
// same way. Pure, unit-tested. The card builders are shared with the Sales Manager records lists.

export type CeoRecordField = { label: string; value: string };

export type CeoRecordCard = {
  key: string;
  title: string;
  /**
   * Lines right under the title, before the subtitle: `text`, then `note` in muted text (an invoice's billing period,
   * then "Issued 17 Oct 2026"). Left out on the other lists.
   */
  headline?: { text: string; note: string | null } | null;
  subtitle: string | null;
  /** Status text for a StatusPill (its tone comes from statusTone()). */
  status: string | null;
  /** Tone of the status pill when it should not come from statusTone() (e.g. the Sales Manager's complaints). */
  statusTone?: Tone;
  /** Main figure on the right (PKR; desks on the Sales Manager lists), when the record has one. */
  amount: string | null;
  fields: CeoRecordField[];
  /** The whole card as one sentence for screen readers. */
  accessibilityLabel: string;
};

/** "a · b · c" from the non-empty parts, or null. */
export const joinParts = (...parts: (string | null | undefined)[]): string | null => {
  const text = parts.filter((p) => p && p.trim()).join(" · ");
  return text || null;
};

const date = (value: string | null) => (value ? formatDate(value) : null);

/**
 * An invoice's billing period: "1 Nov - 30 Nov 2026", "21 Oct 2026 - 31 Jan 2027" across years, "From 1 Nov 2026"
 * without an end; null without a (valid) start.
 */
export function billingPeriodText(start: string | null | undefined, end: string | null | undefined): string | null {
  const from = parseDate(start);
  if (!from) return null;
  const to = parseDate(end);
  if (!to) return `From ${formatDate(from)}`;
  return `${formatDate(from, { year: from.getFullYear() !== to.getFullYear() })} - ${formatDate(to)}`;
}

/**
 * The lines under an invoice number: its billing period with "Issued <date>" under it; an older API (no period):
 * the issue date alone. Null when neither is known.
 */
export function invoiceHeadline(r: Pick<CeoInvoiceRecord, "periodStart" | "periodEnd" | "issuedOn">): CeoRecordCard["headline"] {
  const issued = date(r.issuedOn);
  const issuedText = issued ? `Issued ${issued}` : null;
  const period = billingPeriodText(r.periodStart, r.periodEnd);
  if (period) return { text: period, note: issuedText };
  return issuedText ? { text: issuedText, note: null } : null;
}

/** "12 days", "1 day", "Today", "Ended 3 days ago"; null when not sent (lease cards, CEO and Sales Manager). */
export function daysLeftText(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  const n = Math.round(days);
  if (n === 0) return "Today";
  if (n < 0) return `Ended ${formatNumber(-n, 0)} ${n === -1 ? "day" : "days"} ago`;
  return `${formatNumber(n, 0)} ${n === 1 ? "day" : "days"}`;
}

/** Fields without a value are left out. */
export function recordFields(...items: [string, string | null | undefined][]): CeoRecordField[] {
  return items.filter((it): it is [string, string] => !!it[1] && it[1].trim().length > 0).map(([label, value]) => ({ label, value }));
}

/** A record card; its accessibility label reads every part in order. */
export function recordCard(
  key: string,
  title: string,
  subtitle: string | null,
  status: string | null,
  amount: string | null,
  list: CeoRecordField[],
  headline?: CeoRecordCard["headline"],
): CeoRecordCard {
  const accessibilityLabel = [title, headline?.text, headline?.note, subtitle, status, amount, ...list.map((f) => `${f.label} ${f.value}`)]
    .filter(Boolean)
    .join(", ");
  const card: CeoRecordCard = { key, title, subtitle, status, amount, fields: list, accessibilityLabel };
  if (headline) card.headline = headline;
  return card;
}

/** A booking as a card (CEO and Sales Manager bookings lists). */
export function bookingCard(r: CeoBookingRecord, i: number): CeoRecordCard {
  return recordCard(
    `booking-${r.bookingId ?? i}-${i}`,
    r.customer ?? "Customer",
    joinParts(r.space, r.location),
    r.status,
    r.totalAmount != null ? moneyFull(r.totalAmount) : null,
    recordFields(["Starts", date(r.startOn)], ["Ends", date(r.endOn)], ["Booking", r.bookingId ? `#${r.bookingId}` : null]),
  );
}

/**
 * A tour inquiry as a card. `extra` fields (e.g. the Sales Manager's follow-up date) are listed after "Received".
 */
export function inquiryCard(r: CeoInquiryRecord, i: number, extra: [string, string | null | undefined][] = []): CeoRecordCard {
  const type = r.type ? INQUIRY_TYPE_LABELS[r.type] : r.typeText;
  return recordCard(
    `inquiry-${r.inquiryId ?? i}-${i}`,
    r.name ?? "Visitor",
    joinParts(r.phone, type),
    r.status,
    null,
    recordFields(["Received", r.createdOn ? formatDateTime(r.createdOn) : null], ...extra, ["Reference", r.referenceName], ["Feedback", r.feedback]),
  );
}

/** A quotation as a card (CEO and Sales Manager quotations lists). */
export function quotationCard(r: CeoQuotationRecord, i: number): CeoRecordCard {
  return recordCard(
    `quotation-${r.quotationId ?? i}-${i}`,
    r.quotationNumber ?? (r.quotationId ? `Quotation ${r.quotationId}` : "Quotation"),
    joinParts(r.customer, r.location),
    r.status,
    r.total != null ? moneyFull(r.total) : null,
    recordFields(["Created", date(r.createdOn)], ["Created by", r.createdBy]),
  );
}

/** A lease ending soon as a card: customer, space and location, monthly rent, end date, days left. */
export function ceoLeaseCard(r: CeoLeaseRecord, i: number): CeoRecordCard {
  return recordCard(
    `lease-${r.bookingId ?? i}-${i}`,
    r.customer || "Customer",
    joinParts(r.space, r.location),
    null,
    r.monthlyAmount != null ? `${moneyFull(r.monthlyAmount)}/mo` : null,
    recordFields(["Ends", date(r.endOn)], ["Days left", daysLeftText(r.daysLeft)], ["Booking", r.bookingId ? `#${r.bookingId}` : null]),
  );
}

/** One card per row, in the server's order (newest first; leases soonest first). */
export function recordCards(records: CeoRecords): CeoRecordCard[] {
  switch (records.kind) {
    case "invoices":
      return records.rows.map((r, i) =>
        recordCard(
          `invoice-${r.invoiceId ?? i}-${i}`,
          r.invoiceNumber ?? (r.invoiceId ? `Invoice ${r.invoiceId}` : "Invoice"),
          joinParts(r.customer, r.location),
          r.status,
          moneyFull(r.total),
          // The issue date is under the invoice number (./invoiceHeadline), with the billing period.
          recordFields(["Due", date(r.dueOn)], ["Paid", moneyFull(r.paid)], ["Balance", moneyFull(r.balance)]),
          invoiceHeadline(r),
        ),
      );
    case "spaces":
      return records.rows.map((r, i) =>
        recordCard(
          `space-${r.spaceId ?? i}-${i}`,
          r.name ?? (r.spaceId ? `Space ${r.spaceId}` : "Space"),
          joinParts(r.spaceType, r.location),
          r.occupied ? "Occupied" : "Available",
          null,
          recordFields(
            ["Capacity", r.capacity != null ? `${formatNumber(r.capacity, 0)} ${r.capacity === 1 ? "person" : "people"}` : null],
            ["Customer", r.occupied ? r.customer : null],
            ["Booked until", r.occupied ? date(r.bookingEndOn) : null],
          ),
        ),
      );
    case "bookings":
      return records.rows.map((r, i) => bookingCard(r, i));
    case "inquiries":
      return records.rows.map((r, i) => inquiryCard(r, i));
    case "leases":
      return records.rows.map((r, i) => ceoLeaseCard(r, i));
    case "quotations":
    default:
      return records.rows.map((r, i) => quotationCard(r, i));
  }
}

/** "Showing 200 of 340" (the API sends at most 200 rows), or "" when there is nothing. */
export function showingText(shown: number, total: number): string {
  if (shown <= 0) return "";
  return `Showing ${formatNumber(shown, 0)} of ${formatNumber(Math.max(shown, total), 0)}`;
}
