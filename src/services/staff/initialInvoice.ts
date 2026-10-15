import { ApiError } from "../apiClient";
import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, staffGet, staffPost, type ActionResult } from "./http";
import { bool, isApiDate, num, optNum, optStr, str, toList, unwrapEnvelope, withQuery } from "./normalize";

// The booking's first ("initial") invoice: 1st billing cycle rent, security deposit and the bank payment procedure,
// emailed to the customer (CMS manage.ts sendInitialInvoice / "Preview Initial Payment Invoice"; API
// POST booking/{id}/send-initial-invoice?preview=&issuedOn=&invoiceType=&whTaxId=). Roles: admin, super admin, sales
// executive. The CMS opens it after a booking is created or an agreement is signed, and keeps a per-booking button
// until it is sent; the app does the same (GET booking/{id}/initial-invoice tells whether it was sent).
//
// The preview saves nothing. An existing first invoice is only re-sent as it was posted (hasExistingInvoice), so no
// invoice type is sent with it. Invoice type: Standard, or Withholding tax with a WHT rate (saved on the booking).

/** Standard / WHT with its rate (WN_WHTaxRate id) / undefined = the booking's own setting (first preview). */
export type InitialInvoiceChoice = { type: "standard" } | { type: "wht"; whTaxId: number } | undefined;

export type InitialInvoicePreview = {
  bookingId: number;
  issuedOn: string | null;
  dueOn: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  description: string | null;
  monthlyRent: number;
  billingMonths: number;
  isProrated: boolean;
  rent: number;
  discount: number;
  discountPercentage: number;
  tax: number;
  serviceCharge: number;
  securityDeposit: number;
  grandTotal: number;
  /** The first invoice exists already: sending emails it again as it is (the type can't change). */
  hasExistingInvoice: boolean;
  /** The WHT rate the booking already has (preselects the choice), or null. */
  bookingWhTaxId: number | null;
  isWhtInvoice: boolean;
  whTaxId: number | null;
  whtRatePercent: number;
  whtGrossUp: number;
  whtAmount: number;
  netPayableAfterWht: number;
};

export function normalizeInitialInvoicePreview(raw: unknown, bookingId: number): InitialInvoicePreview {
  const d = unwrapEnvelope<any>(raw) ?? {};
  const grandTotal = num(d, "grandTotal");
  const whtAmount = num(d, "whtAmount");
  return {
    bookingId: num(d, "bookingId") || bookingId,
    issuedOn: optStr(d, "issuedOn"),
    dueOn: optStr(d, "dueOn"),
    periodStart: optStr(d, "periodStart"),
    periodEnd: optStr(d, "periodEnd"),
    description: optStr(d, "description"),
    monthlyRent: num(d, "monthlyRent"),
    billingMonths: num(d, "billingMonths"),
    isProrated: bool(d, "isProrated"),
    rent: num(d, "rent"),
    discount: num(d, "discount"),
    discountPercentage: num(d, "discountPercentage"),
    tax: num(d, "tax"),
    serviceCharge: num(d, "serviceCharge"),
    securityDeposit: num(d, "securityDeposit"),
    grandTotal,
    hasExistingInvoice: bool(d, "hasExistingInvoice"),
    bookingWhTaxId: optNum(d, "bookingWhTaxId"),
    isWhtInvoice: bool(d, "isWhtInvoice"),
    whTaxId: optNum(d, "whTaxId"),
    whtRatePercent: num(d, "whtRatePercent"),
    whtGrossUp: num(d, "whtGrossUp"),
    whtAmount,
    netPayableAfterWht: optNum(d, "netPayableAfterWht") ?? grandTotal - whtAmount,
  };
}

/** Query of the send / preview call: preview flag, the invoice date (yyyy-MM-dd) and the type choice. */
export function initialInvoiceQuery(options: { preview?: boolean; issuedOn?: string | null; choice?: InitialInvoiceChoice }) {
  const choice = options.choice;
  return {
    preview: options.preview ? "true" : undefined,
    issuedOn: options.issuedOn && isApiDate(options.issuedOn) ? options.issuedOn : undefined,
    invoiceType: choice ? choice.type : undefined,
    whTaxId: choice?.type === "wht" ? choice.whTaxId : undefined,
  };
}

/** The choice the preview shows first: the booking's own WHT rate, else Standard. */
export function initialChoiceFromPreview(preview: Pick<InitialInvoicePreview, "bookingWhTaxId">): Exclude<InitialInvoiceChoice, undefined> {
  return preview.bookingWhTaxId != null && preview.bookingWhTaxId > 0
    ? { type: "wht", whTaxId: preview.bookingWhTaxId }
    : { type: "standard" };
}

/** POST booking/{id}/send-initial-invoice?preview=true — the server's figures; nothing is saved or sent. */
export async function previewInitialInvoice(
  bookingId: number,
  options: { issuedOn?: string | null; choice?: InitialInvoiceChoice } = {},
): Promise<InitialInvoicePreview> {
  const raw = await staffPost(withQuery(STAFF_ENDPOINTS.bookings.sendInitialInvoice(bookingId), initialInvoiceQuery({ ...options, preview: true })));
  return normalizeInitialInvoicePreview(raw, bookingId);
}

/**
 * POST booking/{id}/send-initial-invoice — creates the first invoice and emails it (or emails the existing one again).
 * `choice` is left out for an invoice that already exists.
 */
export async function sendInitialInvoice(
  bookingId: number,
  options: { issuedOn?: string | null; choice?: InitialInvoiceChoice } = {},
): Promise<ActionResult> {
  if (options.choice?.type === "wht" && !(options.choice.whTaxId > 0)) throw new Error("Choose the WHT rate.");
  const raw = await staffPost(withQuery(STAFF_ENDPOINTS.bookings.sendInitialInvoice(bookingId), initialInvoiceQuery(options)));
  return actionResult(raw, "Initial invoice sent to the customer.");
}

export type InitialInvoiceStatus = { sent: boolean; invoiceId: number | null; invoiceNumber: string | null };

/**
 * GET booking/{id}/initial-invoice — whether the first invoice exists. Null when the server can't say (an older API
 * without the route): the screen then still offers the button and the preview tells whether it exists.
 */
export async function getInitialInvoiceStatus(bookingId: number): Promise<InitialInvoiceStatus | null> {
  try {
    const d = unwrapEnvelope<any>(await staffGet(STAFF_ENDPOINTS.bookings.initialInvoiceStatus(bookingId)));
    if (!d || typeof d !== "object" || !("sent" in d || "Sent" in d)) return null;
    return { sent: bool(d, "sent"), invoiceId: optNum(d, "invoiceId"), invoiceNumber: optStr(d, "invoiceNumber") };
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}

export type WhtRate = { id: number; description: string; rate: number };

/** GET amount-fields/wht-rates — the WHT rates to choose from (description shown, rate %). */
export async function getWhtRates(): Promise<WhtRate[]> {
  const rows = toList(await staffGet(STAFF_ENDPOINTS.lookups.whtRates), (r) => ({
    id: num(r, "id"),
    description: str(r, "description"),
    rate: num(r, "rate"),
  }));
  return rows.filter((r) => r.id > 0 && r.description && r.rate > 0);
}

/** Bookings whose first invoice can be sent: not cancelled / rejected (pure). */
export function canSendInitialInvoice(statusLabel: string | null | undefined): boolean {
  const s = (statusLabel ?? "").trim().toLowerCase();
  return !!s && s !== "cancelled" && s !== "rejected";
}
