import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";

// Customers pay by bank challan only (1Bill / HBL), exactly like worknestpk.com: the challan is shown on
// My Bookings / Payments and paid at the bank. The app never creates payments or marks anything "Paid";
// every status below comes from GET /payment/my.

/** Older app versions kept made-up "Paid" vouchers on the device under this key; they are deleted. */
const LEGACY_LOCAL_VOUCHERS_KEY = "local_payment_vouchers";

export type PaymentStatus = "Paid" | "Pending" | "Failed" | "Refunded" | "Cancelled" | string;

export type MyPayment = {
  id: number;
  publicId: string | null;
  bookingId: number | null;
  /** Amount exactly as the API sent it (null when it sent none). */
  amount: number | null;
  currencyCode: string;
  /** Status from the API: Paid / Pending / Failed / Refunded / Cancelled. */
  status: PaymentStatus;
  statusId: number | null;
  methodLabel: string | null;
  methodCode: string | null;
  transactionRef: string | null;
  createdOn: string | null;
  paidOn: string | null;
  expiresOn: string | null;
  spaceName: string | null;
  spaceCode: string | null;
  startOn: string | null;
  endOn: string | null;
  challanNumber: string | null;
  challanValidUntil: string | null;
  billingPeriod: string | null;
  billingPeriodMonths: number | null;
  monthlyRent: number | null;
  currentCycleAmount: number | null;
  totalPaidAmount: number | null;
  balanceLeft: number | null;
  nextBillDueDate: string | null;
  securityDeposit: number | null;
};

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();
const textOrNull = (value: unknown): string | null => text(value) || null;

function amountOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/**
 * Some list procedures format dates as "DD/MM/YYYY hh:mm:ss am"; turn those into ISO-like text that
 * `new Date()` reads (same rule as the website's My Payments). Other values are returned unchanged.
 */
export function parseApiDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}${m[4]}`;
  return raw;
}

export function normalizePayment(input: unknown): MyPayment {
  const raw = (input ?? {}) as Record<string, unknown>;
  const id = Number(pick(raw, "id", "Id"));
  const bookingId = Number(pick(raw, "bookingId", "BookingId"));
  const statusId = amountOrNull(pick(raw, "statusId", "StatusId"));
  return {
    id: Number.isFinite(id) ? id : 0,
    publicId: textOrNull(pick(raw, "publicId", "PublicId")),
    bookingId: Number.isFinite(bookingId) && bookingId > 0 ? bookingId : null,
    amount: amountOrNull(pick(raw, "amount", "Amount")),
    currencyCode: text(pick(raw, "currencyCode", "CurrencyCode")) || "PKR",
    status: text(pick(raw, "paymentStatus", "PaymentStatus", "status")) || "Pending",
    statusId,
    methodLabel: textOrNull(pick(raw, "paymentMethodLabel", "PaymentMethodLabel", "paymentMethod")),
    methodCode: textOrNull(pick(raw, "paymentMethodCode", "PaymentMethodCode")),
    transactionRef: textOrNull(pick(raw, "transactionRef", "TransactionRef")),
    createdOn: parseApiDate(pick(raw, "createdOn", "CreatedOn", "createdAt")),
    paidOn: parseApiDate(pick(raw, "paidOn", "PaidOn", "paidAt")),
    expiresOn: parseApiDate(pick(raw, "expiresOn", "ExpiresOn")),
    spaceName: textOrNull(pick(raw, "spaceName", "SpaceName")),
    spaceCode: textOrNull(pick(raw, "spaceCode", "SpaceCode")),
    startOn: parseApiDate(pick(raw, "startOn", "StartOn", "startDateTime")),
    endOn: parseApiDate(pick(raw, "endOn", "EndOn", "endDateTime")),
    challanNumber: textOrNull(pick(raw, "challanNumber", "ChallanNumber")),
    challanValidUntil: parseApiDate(pick(raw, "challanValidUntil", "ChallanValidUntil", "validity")),
    billingPeriod: textOrNull(pick(raw, "billingPeriod", "BillingPeriod")),
    billingPeriodMonths: amountOrNull(pick(raw, "billingPeriodMonths", "BillingPeriodMonths")),
    monthlyRent: amountOrNull(pick(raw, "monthlyRent", "MonthlyRent")),
    currentCycleAmount: amountOrNull(pick(raw, "currentCycleAmount", "CurrentCycleAmount")),
    totalPaidAmount: amountOrNull(pick(raw, "totalPaidAmount", "TotalPaidAmount")),
    balanceLeft: amountOrNull(pick(raw, "balanceLeft", "BalanceLeft")),
    nextBillDueDate: parseApiDate(pick(raw, "nextBillDueDate", "NextBillDueDate", "nextBillingDate", "NextBillingDate")),
    securityDeposit: amountOrNull(pick(raw, "securityDeposit", "SecurityDeposit")),
  };
}

/** True only when the API says the payment is Paid. */
export function isPaid(payment: Pick<MyPayment, "status">): boolean {
  return text(payment.status).toLowerCase() === "paid";
}

/** True while the API still reports the payment as Pending (challan not paid yet). */
export function isPendingPayment(payment: Pick<MyPayment, "status">): boolean {
  return text(payment.status).toLowerCase() === "pending";
}

/** Totals of the API's own amounts by the API's own status (nothing is estimated). */
export function summarizePayments(payments: MyPayment[]): { paid: number; pending: number } {
  return payments.reduce(
    (acc, p) => {
      if (p.amount === null) return acc;
      if (isPaid(p)) acc.paid += p.amount;
      else if (isPendingPayment(p)) acc.pending += p.amount;
      return acc;
    },
    { paid: 0, pending: 0 },
  );
}

/**
 * GET /payment/my — the signed-in customer's payments, newest first.
 * Throws a readable ApiError on failure (callers show an error state, never an empty list).
 */
export async function getMyPayments(): Promise<MyPayment[]> {
  AsyncStorage.removeItem(LEGACY_LOCAL_VOUCHERS_KEY).catch(() => undefined);
  const payload = await apiRequest<unknown>(API_ENDPOINTS.payments.my, { requiresAuth: true });
  const rows: unknown[] = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown[] })?.items)
      ? (payload as { items: unknown[] }).items
      : [];
  return rows.map(normalizePayment).sort((a, b) => {
    const at = new Date(a.createdOn ?? a.paidOn ?? 0).getTime() || 0;
    const bt = new Date(b.createdOn ?? b.paidOn ?? 0).getTime() || 0;
    return bt - at || b.id - a.id;
  });
}
