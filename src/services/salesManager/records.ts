import { formatDate, formatNumber } from "../../utils/format";
import { moneyFull } from "../ceo/format";
import { bookingCard, inquiryCard, joinParts, quotationCard, recordCard, recordFields, type CeoRecordCard } from "../ceo/records";
import type { SmLeaseRecord, SmRecords } from "./types";

// Sales Manager records (drill level 3) as the CEO dashboard's read-only cards (pure, unit-tested): quotations and
// bookings as the CEO sees them, tour inquiries with their follow-up date, and expiring leases.

/** "12 days", "1 day", "Today", "Ended 3 days ago"; null when not sent. */
export function daysLeftText(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  const n = Math.round(days);
  if (n === 0) return "Today";
  if (n < 0) return `Ended ${formatNumber(-n, 0)} ${n === -1 ? "day" : "days"} ago`;
  return `${formatNumber(n, 0)} ${n === 1 ? "day" : "days"}`;
}

/** An expiring lease as a card: customer, space and location, monthly amount, end date, days left. */
export function leaseCard(r: SmLeaseRecord, i: number): CeoRecordCard {
  return recordCard(
    `lease-${r.bookingId ?? i}-${i}`,
    r.customer || "Customer",
    joinParts(r.space, r.location),
    null,
    r.monthlyAmount != null ? `${moneyFull(r.monthlyAmount)}/mo` : null,
    recordFields(
      ["Ends", r.endOn ? formatDate(r.endOn) : null],
      ["Days left", daysLeftText(r.daysLeft)],
      ["Booking", r.bookingId ? `#${r.bookingId}` : null],
    ),
  );
}

/** One card per row, in the server's order (newest first). */
export function smRecordCards(records: SmRecords): CeoRecordCard[] {
  switch (records.kind) {
    case "bookings":
      return records.rows.map((r, i) => bookingCard(r, i));
    case "inquiries":
      return records.rows.map((r, i) => inquiryCard(r, i, [["Follow up on", r.followUpOn ? formatDate(r.followUpOn) : null]]));
    case "leases":
      return records.rows.map((r, i) => leaseCard(r, i));
    case "quotations":
    default:
      return records.rows.map((r, i) => quotationCard(r, i));
  }
}
