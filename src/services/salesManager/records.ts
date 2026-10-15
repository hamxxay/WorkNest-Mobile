import { formatDate } from "../../utils/format";
import { daysLeftText, inquiryCard, joinParts, recordCard, recordFields, type CeoRecordCard } from "../ceo/records";
import {
  SM_COMPLAINT_STATUS_LABELS,
  complaintAgeText,
  complaintSourceLabel,
  complaintStatusTone,
  desks,
} from "./format";
import type { SmBookingRecord, SmComplaintRecord, SmLeaseRecord, SmQuotationRecord, SmRecords } from "./types";

// Sales Manager records (drill level 3) as the CEO dashboard's read-only cards (pure, unit-tested): quotations,
// bookings and expiring leases with their desks on the right (never an amount: a sales manager sees no money),
// tour inquiries with their follow-up date, and complaints with their status, age and description.

// "12 days", "Today", "Ended 3 days ago": shared with the CEO's lease cards.
export { daysLeftText };

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

/**
 * A complaint as a card: complaint no, customer and phone, status (in the status bar's colours) with "Reopened"
 * under it when the customer said the problem persists, then category, branch, received, age, source and the
 * start of the description.
 */
export function complaintCard(r: SmComplaintRecord, i: number): CeoRecordCard {
  const card = recordCard(
    `complaint-${r.complaintId ?? i}-${i}`,
    r.complaintNo ?? (r.complaintId ? `Complaint ${r.complaintId}` : "Complaint"),
    joinParts(r.customerName, r.phone),
    r.status ? SM_COMPLAINT_STATUS_LABELS[r.status] : r.statusText,
    r.isFollowUp ? "Reopened" : null,
    recordFields(
      ["Category", r.category],
      ["Branch", r.branch ?? "No branch"],
      ["Received", date(r.createdOn)],
      ["Age", complaintAgeText(r.ageDays)],
      ["Updated", r.status === "resolved" || r.status === "closed" ? date(r.updatedOn) : null],
      ["Source", complaintSourceLabel(r.source)],
      ["Description", r.description],
    ),
  );
  return { ...card, statusTone: complaintStatusTone(r.status) };
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
    case "complaints":
      return records.rows.map((r, i) => complaintCard(r, i));
    case "quotations":
    default:
      return records.rows.map((r, i) => smQuotationCard(r, i));
  }
}
