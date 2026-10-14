import { formatDate, formatNumber } from "../../utils/format";
import { inquiryCard, joinParts, recordCard, recordFields, type CeoRecordCard } from "../ceo/records";
import { desks } from "./format";
import type { SmBookingRecord, SmLeaseRecord, SmQuotationRecord, SmRecords } from "./types";

// Sales Manager records (drill level 3) as the CEO dashboard's read-only cards (pure, unit-tested): quotations,
// bookings and expiring leases with their desks on the right (never an amount: a sales manager sees no money),
// and tour inquiries with their follow-up date.

/** "12 days", "1 day", "Today", "Ended 3 days ago"; null when not sent. */
export function daysLeftText(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  const n = Math.round(days);
  if (n === 0) return "Today";
  if (n < 0) return `Ended ${formatNumber(-n, 0)} ${n === -1 ? "day" : "days"} ago`;
  return `${formatNumber(n, 0)} ${n === 1 ? "day" : "days"}`;
}

const date = (value: string | null) => (value ? formatDate(value) : null);

/** A quotation as a card: number, customer and location, status, desks, when and by whom. */
export function smQuotationCard(r: SmQuotationRecord, i: number): CeoRecordCard {
  return recordCard(
    `quotation-${r.quotationId ?? i}-${i}`,
    r.quotationNumber ?? (r.quotationId ? `Quotation ${r.quotationId}` : "Quotation"),
    joinParts(r.customer, r.location),
    r.status,
    desks(r.desks),
    recordFields(["Created", date(r.createdOn)], ["Created by", r.createdBy]),
  );
}

/** A booking as a card: customer, space and location, status, desks, start and end. */
export function smBookingCard(r: SmBookingRecord, i: number): CeoRecordCard {
  return recordCard(
    `booking-${r.bookingId ?? i}-${i}`,
    r.customer ?? "Customer",
    joinParts(r.space, r.location),
    r.status,
    desks(r.desks),
    recordFields(["Starts", date(r.startOn)], ["Ends", date(r.endOn)], ["Booking", r.bookingId ? `#${r.bookingId}` : null]),
  );
}

/** An expiring lease as a card: customer, space and location, desks, end date, days left. */
export function leaseCard(r: SmLeaseRecord, i: number): CeoRecordCard {
  return recordCard(
    `lease-${r.bookingId ?? i}-${i}`,
    r.customer || "Customer",
    joinParts(r.space, r.location),
    null,
    desks(r.desks),
    recordFields(
      ["Ends", date(r.endOn)],
      ["Days left", daysLeftText(r.daysLeft)],
      ["Booking", r.bookingId ? `#${r.bookingId}` : null],
    ),
  );
}

/** One card per row, in the server's order (newest first). */
export function smRecordCards(records: SmRecords): CeoRecordCard[] {
  switch (records.kind) {
    case "bookings":
      return records.rows.map((r, i) => smBookingCard(r, i));
    case "inquiries":
      return records.rows.map((r, i) => inquiryCard(r, i, [["Follow up on", r.followUpOn ? formatDate(r.followUpOn) : null]]));
    case "leases":
      return records.rows.map((r, i) => leaseCard(r, i));
    case "quotations":
    default:
      return records.rows.map((r, i) => smQuotationCard(r, i));
  }
}
