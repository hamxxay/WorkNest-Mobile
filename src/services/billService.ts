import { API_ENDPOINTS } from "../config/api";
import { ApiError, apiRequest } from "./apiClient";
import { openApiPdf } from "./pdfService";
import { getMyPayments, isPaid, isPendingPayment, type MyPayment } from "./paymentService";
import { formatMoney } from "../utils/format";

// The customer's bills (Payments tab): GET /invoice/my returns their invoices (WN_Invoices: quotation /
// agreement bookings, fee receipts, recurring rent) plus the booking challans that have no invoice. Every amount
// and status comes from the API; the app only adds them up for the header when the API sent no totals.

export type BillKind = "invoice" | "challan" | "payment";

/** Paid / Unpaid / Partially paid / Overdue / Expired / Cancelled (older API: the payment's own status). */
export type BillStatus = string;

export type MyBill = {
  /** Unique list key. */
  key: string;
  kind: BillKind;
  /** Invoice id for the PDF (GET /invoice/{id}/pdf); null for a challan. */
  invoiceId: number | null;
  /** Invoice or challan number. */
  number: string;
  /** "Invoice", "Rent invoice" or "Booking challan". */
  title: string;
  bookingId: number | null;
  bookingStatus: string | null;
  /** The booking was rejected, cancelled or a no show. */
  bookingClosed: boolean;
  spaceName: string | null;
  locationName: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  /** Bill total as the API sent it (null when it sent none). */
  total: number | null;
  /** Withholding tax the customer deducts (not paid to WorkNest). */
  taxWithheld: number;
  paid: number;
  /** Still to pay (0 when paid or cancelled). */
  balance: number;
  status: BillStatus;
  isOverdue: boolean;
  daysOverdue: number;
  /** Door access is suspended from this date if the bill is still unpaid. */
  accessSuspendsOn: string | null;
  /** This bill is why door access to the space is suspended now. */
  accessSuspended: boolean;
  hasPdf: boolean;
};

export type BillsSummary = {
  paidTotal: number;
  dueTotal: number;
  overdueTotal: number;
  overdueCount: number;
  count: number;
};

export type MyBills = { items: MyBill[]; summary: BillsSummary };

const text = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim());
const textOrNull = (value: unknown): string | null => text(value) || null;

function amountOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const amount = (value: unknown): number => amountOrNull(value) ?? 0;

function idOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

const bool = (value: unknown): boolean => value === true || value === 1 || text(value).toLowerCase() === "true";

const OPEN_STATUSES = ["unpaid", "partiallypaid", "overdue", "pending"];
const statusKey = (status: string) => text(status).toLowerCase().replace(/[\s_-]+/g, "");

/** The customer still has to pay this bill (unpaid, partly paid or overdue, with a balance). */
export function isOpenBill(bill: Pick<MyBill, "status" | "balance">): boolean {
  return bill.balance > 0 && OPEN_STATUSES.includes(statusKey(bill.status));
}

export function normalizeBill(input: unknown, index = 0): MyBill {
  const raw = (input ?? {}) as Record<string, unknown>;
  const kindText = text(pick(raw, "kind", "Kind")).toLowerCase();
  const kind: BillKind = kindText === "challan" ? "challan" : "invoice";
  const invoiceId = kind === "invoice" ? idOrNull(pick(raw, "invoiceId", "InvoiceId")) : null;
  const bookingId = idOrNull(pick(raw, "bookingId", "BookingId"));
  const number =
    text(pick(raw, "number", "Number")) || (invoiceId ? `Invoice #${invoiceId}` : bookingId ? `Booking #${bookingId}` : "Bill");
  return {
    key: invoiceId ? `inv-${invoiceId}` : `${kind}-${bookingId ?? number}-${index}`,
    kind,
    invoiceId,
    number,
    title: text(pick(raw, "title", "Title")) || (kind === "challan" ? "Booking challan" : "Invoice"),
    bookingId,
    bookingStatus: textOrNull(pick(raw, "bookingStatus", "BookingStatus")),
    bookingClosed: bool(pick(raw, "bookingClosed", "BookingClosed")),
    spaceName: textOrNull(pick(raw, "spaceName", "SpaceName")),
    locationName: textOrNull(pick(raw, "locationName", "LocationName")),
    issuedOn: textOrNull(pick(raw, "issuedOn", "IssuedOn")),
    dueOn: textOrNull(pick(raw, "dueOn", "DueOn")),
    periodStart: textOrNull(pick(raw, "periodStart", "PeriodStart")),
    periodEnd: textOrNull(pick(raw, "periodEnd", "PeriodEnd")),
    total: amountOrNull(pick(raw, "total", "Total")),
    taxWithheld: amount(pick(raw, "taxWithheld", "TaxWithheld")),
    paid: amount(pick(raw, "paid", "Paid")),
    balance: amount(pick(raw, "balance", "Balance")),
    status: text(pick(raw, "status", "Status")) || "Unpaid",
    isOverdue: bool(pick(raw, "isOverdue", "IsOverdue")),
    daysOverdue: amount(pick(raw, "daysOverdue", "DaysOverdue")),
    accessSuspendsOn: textOrNull(pick(raw, "accessSuspendsOn", "AccessSuspendsOn")),
    accessSuspended: bool(pick(raw, "accessSuspended", "AccessSuspended")),
    hasPdf: kind === "invoice" && !!invoiceId && pick(raw, "hasPdf", "HasPdf") !== false,
  };
}

/** Totals of the bills' own amounts (used when the API sent none). */
export function summarizeBills(bills: MyBill[]): BillsSummary {
  return bills.reduce<BillsSummary>(
    (acc, b) => {
      acc.paidTotal += b.paid;
      if (isOpenBill(b)) {
        acc.dueTotal += b.balance;
        if (b.isOverdue) {
          acc.overdueTotal += b.balance;
          acc.overdueCount += 1;
        }
      }
      return acc;
    },
    { paidTotal: 0, dueTotal: 0, overdueTotal: 0, overdueCount: 0, count: bills.length },
  );
}

function normalizeSummary(raw: unknown, items: MyBill[]): BillsSummary {
  const s = (raw ?? null) as Record<string, unknown> | null;
  if (!s || typeof s !== "object") return summarizeBills(items);
  return {
    paidTotal: amount(pick(s, "paidTotal", "PaidTotal")),
    dueTotal: amount(pick(s, "dueTotal", "DueTotal")),
    overdueTotal: amount(pick(s, "overdueTotal", "OverdueTotal")),
    overdueCount: amount(pick(s, "overdueCount", "OverdueCount")),
    count: amountOrNull(pick(s, "count", "Count")) ?? items.length,
  };
}

export function normalizeBills(payload: unknown): MyBills {
  const p = (payload ?? {}) as Record<string, unknown>;
  const list = Array.isArray(payload) ? payload : Array.isArray(p.items) ? p.items : Array.isArray(p.Items) ? p.Items : [];
  const items = (list as unknown[]).map((row, i) => normalizeBill(row, i));
  return { items, summary: normalizeSummary(Array.isArray(payload) ? null : p.summary ?? p.Summary, items) };
}

/** An older API without GET /invoice/my: the payments list, shown the same way. */
export function billFromPayment(p: MyPayment): MyBill {
  const paid = isPaid(p);
  const pending = isPendingPayment(p);
  return {
    key: `pay-${p.id || p.publicId}`,
    kind: "payment",
    invoiceId: null,
    number: p.challanNumber ?? `Payment #${p.id}`,
    title: p.methodLabel ?? "Payment",
    bookingId: p.bookingId,
    bookingStatus: null,
    bookingClosed: false,
    spaceName: p.spaceName,
    locationName: null,
    issuedOn: p.createdOn,
    dueOn: pending ? p.challanValidUntil : null,
    periodStart: p.startOn,
    periodEnd: p.endOn,
    total: p.amount,
    taxWithheld: 0,
    paid: paid ? p.amount ?? 0 : 0,
    balance: pending ? p.amount ?? 0 : 0,
    status: pending ? "Unpaid" : p.status,
    isOverdue: false,
    daysOverdue: 0,
    accessSuspendsOn: null,
    accessSuspended: false,
    hasPdf: false,
  };
}

/**
 * GET /invoice/my — the signed-in customer's bills, to pay first, then newest. Falls back to GET /payment/my on an
 * API that does not have it yet (404 / 405). Throws a readable ApiError otherwise (screens show an error state).
 */
export async function getMyBills(): Promise<MyBills> {
  try {
    const payload = await apiRequest<unknown>(API_ENDPOINTS.invoices.my, { requiresAuth: true });
    return normalizeBills(payload);
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 405].includes(error.status)) throw error;
    const items = (await getMyPayments()).map(billFromPayment);
    return { items, summary: summarizeBills(items) };
  }
}

/** GET /invoice/{id}/pdf with the sign-in token (the customer's own invoice), opened in the share / viewer sheet. */
export async function openInvoicePdf(invoiceId: number, number?: string | null): Promise<void> {
  if (!(invoiceId > 0)) throw new ApiError("This invoice has no PDF.", 404);
  await openApiPdf(API_ENDPOINTS.invoices.pdf(invoiceId), {
    fileName: `Invoice-${number || invoiceId}`,
    title: `WorkNest Invoice ${number || `#${invoiceId}`}`,
  });
}

/**
 * Money received on a booking that will not go ahead: tell the customer plainly to ask about a refund. Null when it
 * doesn't apply. `statusLabel` is the booking status from the API (e.g. "Rejected").
 */
export function refundNote(paid: number | null | undefined, statusLabel: string | null | undefined): string | null {
  if (!paid || paid <= 0) return null;
  const status = text(statusLabel).toLowerCase() || "closed";
  return `This booking was ${status === "noshow" || status === "no show" ? "marked as a no show" : status} after you paid ${formatMoney(paid)}. Please contact WorkNest about a refund.`;
}
