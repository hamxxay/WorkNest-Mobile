import { STAFF_ENDPOINTS } from "./endpoints";
import { staffGet } from "./http";
import { listFilterQuery, type ListFilters } from "./listFilters";
import { num, optNum, optStr, toPage, withQuery, type Page } from "./normalize";

// Payments (CMS manage.ts "payments" list, admin.service.ts getPayments; API PaymentController GET api/payment).
// Read-only in the app: staff never mark a payment Paid here (customers pay by challan; the CMS keeps the status
// menu). Roles: the CMS opens Payments for admins and super admins only (not in SALES_EXECUTIVE_ROUTES); the API
// also lets sales executives / receptionists read it, location-bound staff only get their locations' payments.
//
// API facts the screens rely on:
//   - GET payment?page=&limit=&search= -> { data, total }, newest first; limit at most 100. Search matches the
//     customer's name / email and the transaction reference.
//   - The list filters (./listFilters): locationId, status (a payment StatusId from GET payment/statuses),
//     from / to (payment date = paid on, else created on; business dates, both days included).
//   - Rows (dbo.WN_Payments_GetList): id, publicId, invoiceId, bookingId, userName, userEmail, paymentMethodLabel,
//     amount, currencyCode, transactionRef, gatewayRef, statusId, paymentStatus (Pending / Paid / Failed /
//     Refunded / Cancelled), paidOn, createdOn (UTC), expiresOn, notes, spaceNumber, challanNumber.

export type StaffPayment = {
  id: number;
  publicId: string | null;
  /** The invoice the payment was made for (opens the invoice); null when it has none. */
  invoiceId: number | null;
  bookingId: number | null;
  /** WN_Users.Name of the customer, else their email. */
  customerName: string;
  customerEmail: string | null;
  amount: number;
  currencyCode: string;
  methodLabel: string | null;
  transactionRef: string | null;
  gatewayRef: string | null;
  statusId: number | null;
  /** As the API names it (Pending / Paid / Failed / Refunded / Cancelled). */
  status: string;
  paidOn: string | null;
  createdOn: string | null;
  /** The date the list shows and filters on: paid on, else created on. */
  paymentDate: string | null;
  expiresOn: string | null;
  notes: string | null;
  spaceName: string | null;
  challanNumber: string | null;
};

export function normalizeStaffPayment(raw: any): StaffPayment {
  const paidOn = optStr(raw, "paidOn", "paidAt");
  const createdOn = optStr(raw, "createdOn", "createdAt");
  const invoiceId = optNum(raw, "invoiceId");
  const bookingId = optNum(raw, "bookingId");
  const customerEmail = optStr(raw, "userEmail", "customerEmail");
  return {
    id: num(raw, "id"),
    publicId: optStr(raw, "publicId", "idGUID", "idGuid"),
    invoiceId: invoiceId != null && invoiceId > 0 ? invoiceId : null,
    bookingId: bookingId != null && bookingId > 0 ? bookingId : null,
    customerName: optStr(raw, "userName", "customerName") ?? customerEmail ?? "",
    customerEmail,
    amount: num(raw, "amount"),
    currencyCode: optStr(raw, "currencyCode") ?? "PKR",
    methodLabel: optStr(raw, "paymentMethodLabel", "paymentMethod"),
    transactionRef: optStr(raw, "transactionRef"),
    gatewayRef: optStr(raw, "gatewayRef"),
    statusId: optNum(raw, "statusId"),
    status: optStr(raw, "paymentStatus", "statusLabel", "status") ?? "Pending",
    paidOn,
    createdOn,
    paymentDate: paidOn ?? createdOn,
    expiresOn: optStr(raw, "expiresOn"),
    notes: optStr(raw, "notes"),
    spaceName: optStr(raw, "spaceName", "spaceNumber", "spaceCode"),
    challanNumber: optStr(raw, "challanNumber"),
  };
}

/** The API answers at most this many rows per page. */
export const PAYMENTS_MAX_PAGE_SIZE = 100;

/** GET payment?page=&limit=&search= plus the list filters (newest first). */
export async function listPayments(
  query: { page?: number; limit?: number; search?: string } & Partial<ListFilters> = {},
): Promise<Page<StaffPayment>> {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, PAYMENTS_MAX_PAGE_SIZE);
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.payments.list, { page, limit, search: query.search?.trim(), ...listFilterQuery(query) }),
  );
  return toPage(raw, normalizeStaffPayment, { page, limit });
}
