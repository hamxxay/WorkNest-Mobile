import { INQUIRY_TYPE_LABELS } from "../../theme/inquiryTypes";
import { formatDate, formatDateTime, formatNumber } from "../../utils/format";
import { moneyFull } from "./format";
import type { CeoRecords } from "./types";

// Records (drill level 3) as read-only cards: one shape for every list, so the Records screen renders them the
// same way. Pure, unit-tested.

export type CeoRecordField = { label: string; value: string };

export type CeoRecordCard = {
  key: string;
  title: string;
  subtitle: string | null;
  /** Status text for a StatusPill (its tone comes from statusTone()). */
  status: string | null;
  /** Main figure on the right (PKR), when the record has one. */
  amount: string | null;
  fields: CeoRecordField[];
  /** The whole card as one sentence for screen readers. */
  accessibilityLabel: string;
};

const join = (...parts: (string | null | undefined)[]): string | null => {
  const text = parts.filter((p) => p && p.trim()).join(" · ");
  return text || null;
};

const date = (value: string | null) => (value ? formatDate(value) : null);

/** Fields without a value are left out. */
function fields(...items: [string, string | null | undefined][]): CeoRecordField[] {
  return items.filter((it): it is [string, string] => !!it[1] && it[1].trim().length > 0).map(([label, value]) => ({ label, value }));
}

function card(key: string, title: string, subtitle: string | null, status: string | null, amount: string | null, list: CeoRecordField[]): CeoRecordCard {
  const accessibilityLabel = [title, subtitle, status, amount, ...list.map((f) => `${f.label} ${f.value}`)].filter(Boolean).join(", ");
  return { key, title, subtitle, status, amount, fields: list, accessibilityLabel };
}

/** One card per row, in the server's order (newest first). */
export function recordCards(records: CeoRecords): CeoRecordCard[] {
  switch (records.kind) {
    case "invoices":
      return records.rows.map((r, i) =>
        card(
          `invoice-${r.invoiceId ?? i}-${i}`,
          r.invoiceNumber ?? (r.invoiceId ? `Invoice ${r.invoiceId}` : "Invoice"),
          join(r.customer, r.location),
          r.status,
          moneyFull(r.total),
          fields(["Issued", date(r.issuedOn)], ["Due", date(r.dueOn)], ["Paid", moneyFull(r.paid)], ["Balance", moneyFull(r.balance)]),
        ),
      );
    case "spaces":
      return records.rows.map((r, i) =>
        card(
          `space-${r.spaceId ?? i}-${i}`,
          r.name ?? (r.spaceId ? `Space ${r.spaceId}` : "Space"),
          join(r.spaceType, r.location),
          r.occupied ? "Occupied" : "Available",
          null,
          fields(
            ["Capacity", r.capacity != null ? `${formatNumber(r.capacity, 0)} ${r.capacity === 1 ? "person" : "people"}` : null],
            ["Customer", r.occupied ? r.customer : null],
            ["Booked until", r.occupied ? date(r.bookingEndOn) : null],
          ),
        ),
      );
    case "bookings":
      return records.rows.map((r, i) =>
        card(
          `booking-${r.bookingId ?? i}-${i}`,
          r.customer ?? "Customer",
          join(r.space, r.location),
          r.status,
          r.totalAmount != null ? moneyFull(r.totalAmount) : null,
          fields(["Starts", date(r.startOn)], ["Ends", date(r.endOn)], ["Booking", r.bookingId ? `#${r.bookingId}` : null]),
        ),
      );
    case "inquiries":
      return records.rows.map((r, i) => {
        const type = r.type ? INQUIRY_TYPE_LABELS[r.type] : r.typeText;
        return card(
          `inquiry-${r.inquiryId ?? i}-${i}`,
          r.name ?? "Visitor",
          join(r.phone, type),
          r.status,
          null,
          fields(
            ["Received", r.createdOn ? formatDateTime(r.createdOn) : null],
            ["Reference", r.referenceName],
            ["Feedback", r.feedback],
          ),
        );
      });
    case "quotations":
    default:
      return records.rows.map((r, i) =>
        card(
          `quotation-${r.quotationId ?? i}-${i}`,
          r.quotationNumber ?? (r.quotationId ? `Quotation ${r.quotationId}` : "Quotation"),
          join(r.customer, r.location),
          r.status,
          r.total != null ? moneyFull(r.total) : null,
          fields(["Created", date(r.createdOn)], ["Created by", r.createdBy]),
        ),
      );
  }
}

/** "Showing 200 of 340" (the API sends at most 200 rows), or "" when there is nothing. */
export function showingText(shown: number, total: number): string {
  if (shown <= 0) return "";
  return `Showing ${formatNumber(shown, 0)} of ${formatNumber(Math.max(shown, total), 0)}`;
}
