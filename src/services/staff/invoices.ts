import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, downloadStaffFile, staffGet, staffPost, type ActionResult, type DownloadedFile } from "./http";
import { num, optNum, optStr, pick, str, toApiDate, toPage, unwrapEnvelope, withQuery, type Page } from "./normalize";

// Invoices & billing (CMS admin.service.ts getInvoices / getInvoiceDetails / getCustomerInvoices /
// sendInvoiceEmail; API InvoiceController). Roles: list, detail, email, customer invoices: admin, super admin,
// sales executive (StaffRoles). PDFs: any signed-in user (staff see every invoice).
// Admins / sales executives only get invoices at their locations in the list.
//
// API facts the screens rely on:
//   - List / customer invoices are { isSuccessful, data, totalCount, page, limit }; no status filter on the list.
//   - Rely on statusLabel (Unpaid | Paid | Partial | Overdue | Cancelled), not statusId. The CMS shows Unpaid /
//     Partial invoices past their due date as Overdue.
//   - balanceDue in the list already subtracts WHT; the detail may lack statusLabel (the CMS merges the list row
//     into the detail; without a row the label is derived from the legacy status id or the amounts).
//   - send-email can answer HTTP 200 with isSuccessful: false (apiClient turns it into an error).
//   - Payments are recorded with fee receipts (api/fee-receipts), not invoice/{id}/record-payment (no such route).

/** Invoice types (WN_Invoices_Insert): 1 Standard, 2 Advance, 3 Recurring, 4 Custom, 5 Surcharge, 6 WHT. */
export const INVOICE_TYPES: Record<number, string> = {
  1: "Standard",
  2: "Advance",
  3: "Recurring",
  4: "Custom",
  5: "Surcharge",
  6: "WHT Invoice",
};

/** CMS rule: an Unpaid / Partial invoice whose due date (yyyy-MM-dd...) is before today shows as Overdue. */
export function effectiveInvoiceStatus(statusLabel: string | null | undefined, dueOn: string | null | undefined, today = new Date()): string {
  const label = (statusLabel ?? "").trim() || "Unpaid";
  const lower = label.toLowerCase();
  const due = (dueOn ?? "").slice(0, 10);
  if ((lower === "unpaid" || lower === "partial") && /^\d{4}-\d{2}-\d{2}$/.test(due) && due < toApiDate(today)) {
    return "Overdue";
  }
  return label;
}

/** Legacy invoice status ids (WN_Invoices.StatusId 1-5, read first by the API's StatusLabel). */
const LEGACY_INVOICE_STATUS: Record<number, string> = { 1: "Unpaid", 2: "Paid", 3: "Partial", 4: "Overdue", 5: "Cancelled" };

/**
 * The status label when the API sent none (GET invoice/{id} has no statusLabel): the legacy status ids like the
 * API, otherwise from the amounts (nothing left to pay = Paid, something paid = Partial, else Unpaid). Newer
 * status ids come from dbo.OrderStatus, which the app can't look up, so they are not mapped here.
 */
export function deriveInvoiceStatusLabel(row: {
  statusId?: number | null;
  grandTotal: number;
  paidTotal: number;
  balanceDue: number;
}): string {
  const legacy = row.statusId != null ? LEGACY_INVOICE_STATUS[row.statusId] : undefined;
  if (legacy) return legacy;
  if ((row.paidTotal > 0 || row.grandTotal > 0) && row.balanceDue <= 0.009) return "Paid";
  if (row.paidTotal > 0) return "Partial";
  return "Unpaid";
}

export type StaffInvoice = {
  id: number;
  publicId: string | null;
  invoiceNumber: string;
  bookingId: number | null;
  invoiceTypeId: number | null;
  invoiceType: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  whtAmount: number;
  /** grandTotal - WHT - paid (from the list; computed for the detail). */
  balanceDue: number;
  currencyCode: string;
  statusId: number | null;
  /** Server label (Unpaid | Paid | Partial | Overdue | Cancelled). */
  statusLabel: string;
  /** statusLabel with the CMS overdue rule applied. */
  status: string;
  customerName: string;
  customerEmail: string | null;
  companyName: string | null;
  spaceName: string | null;
  spaceCode: string | null;
  locationId: number | null;
  locationName: string | null;
  notes: string | null;
  createdOn: string | null;
};

export function normalizeInvoice(raw: any): StaffInvoice {
  const grandTotal = num(raw, "grandTotal");
  const paidTotal = num(raw, "paidTotal");
  const whtAmount = num(raw, "whtAmount");
  const balanceDue = optNum(raw, "balanceDue") ?? Math.max(0, grandTotal - whtAmount - paidTotal);
  const statusId = optNum(raw, "statusId");
  const statusLabel =
    optStr(raw, "statusLabel") ?? deriveInvoiceStatusLabel({ statusId, grandTotal, paidTotal, balanceDue });
  const dueOn = optStr(raw, "dueOn");
  const typeId = optNum(raw, "invoiceTypeId");
  const company = optStr(raw, "companyName");
  return {
    id: num(raw, "id", "invoiceId"),
    publicId: optStr(raw, "publicId", "idGuid"),
    invoiceNumber: str(raw, "invoiceNumber") || String(num(raw, "id")),
    bookingId: optNum(raw, "bookingId"),
    invoiceTypeId: typeId,
    invoiceType: typeId != null ? INVOICE_TYPES[typeId] ?? null : null,
    issuedOn: optStr(raw, "issuedOn"),
    dueOn,
    billingPeriodStart: optStr(raw, "billingPeriodStart"),
    billingPeriodEnd: optStr(raw, "billingPeriodEnd"),
    subTotal: num(raw, "subTotal"),
    discountTotal: num(raw, "discountTotal"),
    taxTotal: num(raw, "taxTotal"),
    grandTotal,
    paidTotal,
    whtAmount,
    balanceDue,
    currencyCode: str(raw, "currencyCode") || "PKR",
    statusId,
    statusLabel,
    status: effectiveInvoiceStatus(statusLabel, dueOn),
    customerName: str(raw, "customerName", "companyName"),
    customerEmail: optStr(raw, "customerEmail"),
    companyName: company && company !== "-" ? company : null,
    spaceName: optStr(raw, "spaceName"),
    spaceCode: optStr(raw, "spaceCode"),
    locationId: optNum(raw, "locationId"),
    locationName: optStr(raw, "locationName"),
    notes: optStr(raw, "notes"),
    createdOn: optStr(raw, "createdOn"),
  };
}

/** GET invoice?page=&limit=&search=&typeId=&locationId= — search: invoice number, customer name, email. */
export async function listInvoices(
  query: { page?: number; limit?: number; search?: string; typeId?: number | null; locationId?: number | null } = {},
): Promise<Page<StaffInvoice>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.invoices.list, {
      page,
      limit,
      search: query.search?.trim(),
      typeId: query.typeId && query.typeId > 0 ? query.typeId : undefined,
      locationId: query.locationId && query.locationId > 0 ? query.locationId : undefined,
    }),
  );
  return toPage(raw, normalizeInvoice, { page, limit });
}

export type InvoiceLine = {
  id: number;
  description: string;
  chargeTypeLabel: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
};

export type StaffInvoiceDetail = StaffInvoice & {
  advanceRentMonths: number | null;
  securityDepositMonths: number | null;
  securityDepositAmount: number;
  roomRentExclTax: number;
  serviceCharges: number;
  taxOnServiceCharges: number;
  whtRate: number;
  lines: InvoiceLine[];
};

/**
 * GET invoice/{id} — invoice with its lines. Pass the list row (when there is one) so the status label and
 * balance carry over, as the CMS does.
 */
export async function getInvoice(id: number | string, listRow?: StaffInvoice): Promise<StaffInvoiceDetail> {
  const d = unwrapEnvelope<any>(await staffGet(STAFF_ENDPOINTS.invoices.byId(id))) ?? {};
  const merged = listRow
    ? { ...listRow, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v != null)) }
    : d;
  const base = normalizeInvoice(merged);
  const lines = pick(d, "lines");
  return {
    ...base,
    advanceRentMonths: optNum(d, "advanceRentMonths"),
    securityDepositMonths: optNum(d, "securityDepositMonths"),
    securityDepositAmount: num(d, "securityDepositAmount"),
    roomRentExclTax: num(d, "roomRentExclTax"),
    serviceCharges: num(d, "serviceCharges"),
    taxOnServiceCharges: num(d, "taxOnServiceCharges"),
    whtRate: num(d, "whtRate"),
    lines: Array.isArray(lines)
      ? lines.map((l: any) => ({
          id: num(l, "id"),
          description: str(l, "description"),
          chargeTypeLabel: optStr(l, "chargeTypeLabel"),
          quantity: num(l, "quantity"),
          unitPrice: num(l, "unitPrice"),
          discountAmount: num(l, "discountAmount"),
          taxRate: num(l, "taxRate"),
        }))
      : [],
  };
}

/** GET customer/{customerId}/invoices?page=&limit=&statusId= */
export async function listCustomerInvoices(
  customerId: number,
  query: { page?: number; limit?: number; statusId?: number | null } = {},
): Promise<Page<StaffInvoice>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.customers.invoices(customerId), {
      page,
      limit,
      statusId: query.statusId && query.statusId > 0 ? query.statusId : undefined,
    }),
  );
  return toPage(raw, normalizeInvoice, { page, limit });
}

/** POST invoice/{id}/send-email — emails the invoice with its statement PDF to the customer. */
export async function emailInvoice(id: number | string): Promise<ActionResult> {
  const raw = await staffPost(STAFF_ENDPOINTS.invoices.sendEmail(id));
  return actionResult(raw, "Invoice emailed.");
}

/** GET invoice/{id}/pdf (the statement invoice PDF), downloaded with the login token. */
export function downloadInvoicePdf(id: number | string, invoiceNumber?: string | null): Promise<DownloadedFile> {
  return downloadStaffFile(STAFF_ENDPOINTS.invoices.pdf(id), {
    fileName: `Statement-Invoice-${invoiceNumber || id}.pdf`,
    mimeType: "application/pdf",
  });
}
