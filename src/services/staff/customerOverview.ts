import { ApiError, serverMessage } from "../apiClient";
import { formatMoney, formatNumber } from "../../utils/format";
import type { Tone } from "../../theme/colors";
import { listAgreements, type StaffAgreement } from "./agreements";
import { STAFF_ENDPOINTS } from "./endpoints";
import { staffGet } from "./http";
import { bool, num, optNum, optStr, pick, str, toList, unwrapEnvelope } from "./normalize";

// Customer detail overview (CMS customer-detail.service.ts getOverview; API CustomerController.Overview,
// CustomerService.GetCustomerOverviewAsync, procedure dbo.WN_Customers_GetOverview of the script CD_01).
//
// GET customer/{id}/overview -> { summary, bookings, receipts, payments, agreements, deposits, timeline }, every list
// newest first and at most 100 rows. Roles: the CustomerController staff roles. API facts the screen relies on:
//   - 404 "Customer not found." for no such customer, or (RecordScope on the controller) a customer of a location the
//     location-bound staff member is not assigned to. A customer with no booking stays open to every staff member.
//   - 503 "Database update needed: run the script CD_01_customer_detail_TEST" until the procedure exists: only the
//     overview sections say so; the profile, quotations and invoices have their own endpoints and keep working.
//   - Money follows the CEO dashboard: invoiced = invoices not void; paid = paid invoices plus what was paid on the
//     others; outstanding = open invoices less WHT and payments; overdue = the outstanding part past its due date.
// Read-only: payments stay challan-only, nothing here records or changes a payment.

/** Shown in the overview sections when the API asks for the database script but sends no readable message. */
export const CUSTOMER_DETAIL_DB_MESSAGE = "Database update needed: run the script CD_01_customer_detail_TEST";

/** Rows the API sends at most per overview list (CustomerService.OverviewRows). */
export const OVERVIEW_ROW_CAP = 100;

export type CustomerSummary = {
  totalBookings: number;
  activeBookings: number;
  invoiceCount: number;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  outstandingCount: number;
  /** The part of `outstanding` past its due date. */
  overdue: number;
  overdueCount: number;
  depositHeld: number;
  depositCount: number;
  quotationCount: number;
  /** Location names of the customer's bookings and user account ("Blue Area, I-8"); "" when none. */
  locations: string;
};

export type CustomerBooking = {
  bookingId: number;
  /** The API's status label ("" when the booking has none). */
  status: string;
  spaceName: string;
  spaceType: string;
  locationName: string;
  startOn: string | null;
  endOn: string | null;
  createdOn: string | null;
  monthlyRent: number | null;
  billingPeriod: string;
  contractTotal: number | null;
  paid: number | null;
  balance: number | null;
  nextBillingDate: string | null;
  securityDeposit: number | null;
  challanNumber: string;
  /** Running now (confirmed-like status and today inside its dates). */
  isActive: boolean;
  createdByName: string | null;
};

export type CustomerReceipt = {
  id: number;
  code: string;
  receiptDate: string | null;
  amount: number;
  paymentType: string;
  /** "Active" / "Void" from the API. */
  status: string;
  isVoid: boolean;
  voidReason: string | null;
  invoiceId: number | null;
  invoiceNumber: string;
  account: string;
  locationName: string;
  createdByName: string | null;
};

export type CustomerPayment = {
  id: number;
  amount: number;
  currency: string;
  method: string;
  /** "Pending" / "Paid" / "Failed" / "Refunded" / "Cancelled" from the API. */
  status: string;
  paidOn: string | null;
  createdOn: string | null;
  reference: string;
  invoiceId: number | null;
  invoiceNumber: string;
  bookingId: number | null;
};

export type CustomerAgreement = {
  id: number;
  status: string;
  sentAt: string | null;
  signedDate: string | null;
  createdOn: string | null;
  feeAmount: number | null;
  securityDeposit: number | null;
  quotationId: number | null;
  quotationNumber: string;
  quotationVersion: number | null;
  bookingId: number | null;
  spaceName: string;
  locationName: string;
  hasSignedPdf: boolean;
  createdByName: string | null;
};

export type CustomerDeposit = {
  id: number;
  bookingId: number | null;
  refNo: string;
  amount: number;
  /** "Held" / "Released" / "Forfeited" from the API. */
  state: string;
  createdOn: string | null;
  releasedOn: string | null;
  forfeitedOn: string | null;
  forfeitReason: string | null;
};

export type TimelineKind = "customer" | "quotation" | "booking" | "invoice" | "receipt" | "payment" | "agreement" | "deposit" | "other";

export type TimelineEvent = {
  kind: TimelineKind;
  action: string;
  /** What happened, ready to show (a quotation activity is worded from its type: "AgreementSent" -> "Agreement sent"). */
  title: string;
  reference: string;
  detail: string | null;
  /** The customer's own note on a quotation activity. */
  note: string | null;
  amount: number | null;
  actorName: string | null;
  /** Id of the record (quotation, booking, invoice, receipt, payment, agreement, deposit, customer). */
  refId: number | null;
  /** An instant (UTC from the API) or, for events known by date only, the date. */
  at: string | null;
  dateOnly: boolean;
};

export type CustomerOverview = {
  summary: CustomerSummary;
  bookings: CustomerBooking[];
  receipts: CustomerReceipt[];
  payments: CustomerPayment[];
  agreements: CustomerAgreement[];
  deposits: CustomerDeposit[];
  timeline: TimelineEvent[];
};

// ─── Mapping ──────────────────────────────────────────────────────────────────────────────────────────────

/** "AgreementSent" -> "Agreement sent", "version_created" -> "Version created". */
export function humanize(code: string | null | undefined): string {
  const words = String(code ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toLowerCase())).join(" ");
}

const KINDS: readonly TimelineKind[] = ["customer", "quotation", "booking", "invoice", "receipt", "payment", "agreement", "deposit"];

/** A positive id, else null (the API sends 0 / null for "none"). */
const optId = (row: any, ...keys: string[]): number | null => {
  const id = optNum(row, ...keys);
  return id != null && id > 0 ? id : null;
};

export function normalizeCustomerSummary(raw: any): CustomerSummary {
  return {
    totalBookings: num(raw, "totalBookings"),
    activeBookings: num(raw, "activeBookings"),
    invoiceCount: num(raw, "invoiceCount"),
    totalInvoiced: num(raw, "totalInvoiced"),
    totalPaid: num(raw, "totalPaid"),
    outstanding: num(raw, "outstanding"),
    outstandingCount: num(raw, "outstandingCount"),
    overdue: num(raw, "overdue"),
    overdueCount: num(raw, "overdueCount"),
    depositHeld: num(raw, "depositHeld"),
    depositCount: num(raw, "depositCount"),
    quotationCount: num(raw, "quotationCount"),
    locations: str(raw, "locations").trim(),
  };
}

export function normalizeCustomerBooking(raw: any): CustomerBooking {
  return {
    bookingId: num(raw, "bookingId", "id"),
    status: str(raw, "bookingStatusLabel", "status").trim(),
    spaceName: str(raw, "spaceName") || str(raw, "spaceCode"),
    spaceType: str(raw, "spaceTypeName"),
    locationName: str(raw, "locationName"),
    startOn: optStr(raw, "startOn"),
    endOn: optStr(raw, "endOn"),
    createdOn: optStr(raw, "createdOn"),
    monthlyRent: optNum(raw, "monthlyRent"),
    billingPeriod: str(raw, "billingPeriodLabel"),
    contractTotal: optNum(raw, "totalContractAmount"),
    paid: optNum(raw, "totalPaidAmount"),
    balance: optNum(raw, "balanceLeft"),
    nextBillingDate: optStr(raw, "nextBillingDate"),
    securityDeposit: optNum(raw, "securityDeposit"),
    challanNumber: str(raw, "challanNumber"),
    isActive: bool(raw, "isActive"),
    createdByName: optStr(raw, "createdByName"),
  };
}

export function normalizeCustomerReceipt(raw: any): CustomerReceipt {
  // Status is 1 (active) or 0 (void); a missing status is not "void".
  const status = optNum(raw, "status");
  return {
    id: num(raw, "id"),
    code: str(raw, "code"),
    receiptDate: optStr(raw, "receiptDate"),
    amount: num(raw, "totalAmount", "amount"),
    paymentType: str(raw, "paymentType"),
    status: str(raw, "statusLabel"),
    isVoid: status === 0,
    voidReason: optStr(raw, "voidReason"),
    invoiceId: optId(raw, "invoiceId"),
    invoiceNumber: str(raw, "invoiceNumber"),
    account: str(raw, "cashInHandAccountName"),
    locationName: str(raw, "locationName"),
    createdByName: optStr(raw, "createdByName"),
  };
}

export function normalizeCustomerPayment(raw: any): CustomerPayment {
  return {
    id: num(raw, "id"),
    amount: num(raw, "amount"),
    currency: str(raw, "currencyCode"),
    method: str(raw, "paymentMethodLabel"),
    status: str(raw, "paymentStatus"),
    paidOn: optStr(raw, "paidOn"),
    createdOn: optStr(raw, "createdOn"),
    reference: str(raw, "transactionRef"),
    invoiceId: optId(raw, "invoiceId"),
    invoiceNumber: str(raw, "invoiceNumber"),
    bookingId: optId(raw, "bookingId"),
  };
}

export function normalizeCustomerAgreement(raw: any): CustomerAgreement {
  return {
    id: num(raw, "id"),
    status: str(raw, "status"),
    sentAt: optStr(raw, "sentAt", "sentDate"),
    signedDate: optStr(raw, "signedDate"),
    createdOn: optStr(raw, "createdOn"),
    feeAmount: optNum(raw, "feeAmount"),
    securityDeposit: optNum(raw, "securityDeposit"),
    quotationId: optId(raw, "quotationId"),
    quotationNumber: str(raw, "quotationNumber"),
    quotationVersion: optNum(raw, "quotationVersion"),
    bookingId: optId(raw, "bookingId"),
    spaceName: str(raw, "spaceName"),
    locationName: str(raw, "locationName"),
    hasSignedPdf: bool(raw, "hasSignedPdf"),
    createdByName: optStr(raw, "createdByName"),
  };
}

export function normalizeCustomerDeposit(raw: any): CustomerDeposit {
  return {
    id: num(raw, "id"),
    bookingId: optId(raw, "bookingId"),
    refNo: str(raw, "refNo"),
    amount: num(raw, "amount"),
    state: str(raw, "state"),
    createdOn: optStr(raw, "createdOn"),
    releasedOn: optStr(raw, "releasedOn"),
    forfeitedOn: optStr(raw, "forfeitedOn"),
    forfeitReason: optStr(raw, "forfeitReason"),
  };
}

export function normalizeTimelineEvent(raw: any): TimelineEvent {
  const kind = str(raw, "kind").trim().toLowerCase() as TimelineKind;
  const action = str(raw, "action").trim();
  const createdOn = optStr(raw, "createdOn");
  return {
    kind: KINDS.includes(kind) ? kind : "other",
    action,
    // Title null = a quotation activity: worded from its type (WN_QuotationActivities.ActivityType).
    title: optStr(raw, "title") ?? (humanize(action) || "Update"),
    reference: str(raw, "reference"),
    detail: optStr(raw, "detail"),
    note: optStr(raw, "note"),
    amount: optNum(raw, "amount"),
    actorName: optStr(raw, "actorName"),
    refId: optId(raw, "refId"),
    at: createdOn ?? optStr(raw, "eventDate"),
    dateOnly: !createdOn,
  };
}

/** The overview payload (inside the ApiResponse envelope or bare); missing lists are empty, never an error. */
export function normalizeCustomerOverview(raw: unknown): CustomerOverview {
  const d = unwrapEnvelope<any>(raw) ?? {};
  const summary = pick(d, "summary");
  return {
    summary: normalizeCustomerSummary(summary && typeof summary === "object" ? summary : {}),
    bookings: toList(pick(d, "bookings") ?? [], normalizeCustomerBooking),
    receipts: toList(pick(d, "receipts") ?? [], normalizeCustomerReceipt),
    payments: toList(pick(d, "payments") ?? [], normalizeCustomerPayment),
    agreements: toList(pick(d, "agreements") ?? [], normalizeCustomerAgreement),
    deposits: toList(pick(d, "deposits") ?? [], normalizeCustomerDeposit),
    timeline: toList(pick(d, "timeline") ?? [], normalizeTimelineEvent),
  };
}

/** GET customer/{id}/overview (int id). Throws ApiError: 404 not found / not this user's location, 503 script not run. */
export async function getCustomerOverview(customerId: number): Promise<CustomerOverview> {
  return normalizeCustomerOverview(await staffGet(STAFF_ENDPOINTS.customers.overview(customerId)));
}

// ─── Section errors ───────────────────────────────────────────────────────────────────────────────────────

export type SectionError = {
  status: number;
  message: string;
  /** The API asks for the database script CD_01 (503): retrying will not help until it has run. */
  needsDbUpdate: boolean;
  /** No such customer, or one of a location this staff member is not assigned to. */
  notFound: boolean;
};

/** One part of the screen: its data, or why it could not be loaded. */
export type SectionResult<T> = { ok: true; data: T } | { ok: false; error: SectionError };

export const CUSTOMER_NOT_FOUND_MESSAGE = "Customer not found.";
const NOT_ON_SERVER_MESSAGE = "Not available on this server yet. It will work once the API update is live.";
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";
const DB_UPDATE_TEXT = /database update needed|CD_01/i;

/**
 * A failed section request, worded for the screen (as the CMS describeSectionError):
 *   - 503 asking for the database script: needsDbUpdate, with the API's own message.
 *   - 404 with the API's message ("Customer not found."): notFound. A 404 without one is an API that does not have
 *     the endpoint yet.
 *   - A refusal ({ isSuccessful: false }) saying "not found": notFound (GET customer/{id} answers 200 that way).
 */
export function describeSectionError(error: unknown): SectionError {
  const status = error instanceof ApiError ? error.status : 0;
  const details = error instanceof ApiError ? error.details : undefined;
  const fromServer = serverMessage(details);
  const message = error instanceof ApiError ? error.message : error instanceof Error && error.message ? error.message : FALLBACK_MESSAGE;
  const base = { status, needsDbUpdate: false, notFound: false };
  if (status === 503 && (DB_UPDATE_TEXT.test(fromServer ?? "") || DB_UPDATE_TEXT.test(message))) {
    return { ...base, needsDbUpdate: true, message: fromServer && DB_UPDATE_TEXT.test(fromServer) ? fromServer : CUSTOMER_DETAIL_DB_MESSAGE };
  }
  if (status === 404) {
    return fromServer ? { ...base, notFound: true, message: CUSTOMER_NOT_FOUND_MESSAGE } : { ...base, message: NOT_ON_SERVER_MESSAGE };
  }
  if (status >= 200 && status < 300 && /not found/i.test(message)) {
    return { ...base, notFound: true, message: CUSTOMER_NOT_FOUND_MESSAGE };
  }
  return { ...base, message: message || FALLBACK_MESSAGE };
}

/** Runs one section's request; a failure becomes its SectionResult (never thrown), so one section never blanks another. */
export async function loadSection<T>(load: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    return { ok: false, error: describeSectionError(error) };
  }
}

// ─── Summary figures and display helpers ──────────────────────────────────────────────────────────────────

/** "1 booking" / "3 bookings". */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/** Share of the invoiced amount that is paid, as a whole percent; null when nothing was invoiced. */
export function paidPercent(summary: Pick<CustomerSummary, "totalInvoiced" | "totalPaid">): number | null {
  if (!(summary.totalInvoiced > 0)) return null;
  return Math.round((summary.totalPaid / summary.totalInvoiced) * 100);
}

/** Line under the outstanding figure: the overdue part first (as the CMS), else the open invoices. */
export function outstandingNote(summary: Pick<CustomerSummary, "outstandingCount" | "overdue" | "overdueCount">): string {
  if (summary.overdue > 0) return `${formatMoney(summary.overdue, { compact: true })} overdue (${summary.overdueCount})`;
  if (summary.outstandingCount > 0) return countLabel(summary.outstandingCount, "open invoice");
  return "Nothing to pay";
}

export function outstandingTone(summary: Pick<CustomerSummary, "outstanding" | "overdue">): Tone {
  if (summary.overdue > 0) return "danger";
  if (summary.outstanding > 0) return "warning";
  return "success";
}

export type SummaryFigure = { label: string; value: string; sub: string; tone: Tone; icon: string };

/** The five summary cards of the CMS page: active bookings, invoiced, paid, outstanding (overdue part), deposit held. */
export function summaryFigures(s: CustomerSummary): SummaryFigure[] {
  const percent = paidPercent(s);
  return [
    {
      label: "Active bookings",
      value: formatNumber(s.activeBookings),
      sub: `${countLabel(s.totalBookings, "booking")} in all`,
      tone: s.activeBookings > 0 ? "success" : "neutral",
      icon: "calendar-outline",
    },
    {
      label: "Total invoiced",
      value: formatMoney(s.totalInvoiced, { compact: true }),
      sub: countLabel(s.invoiceCount, "invoice"),
      tone: "primary",
      icon: "receipt-outline",
    },
    {
      label: "Paid",
      value: formatMoney(s.totalPaid, { compact: true }),
      sub: percent == null ? "Nothing invoiced yet" : `${percent}% of invoiced`,
      tone: "success",
      icon: "checkmark-circle-outline",
    },
    {
      label: "Outstanding",
      value: formatMoney(s.outstanding, { compact: true }),
      sub: outstandingNote(s),
      tone: outstandingTone(s),
      icon: "alert-circle-outline",
    },
    {
      label: "Security deposit held",
      value: formatMoney(s.depositHeld, { compact: true }),
      sub: `${countLabel(s.depositCount, "deposit")} held`,
      tone: "info",
      icon: "shield-checkmark-outline",
    },
  ];
}

/** Rows of the Payments section: fee receipts, payments and security deposits together. */
export function paymentsCount(o: Pick<CustomerOverview, "receipts" | "payments" | "deposits">): number {
  return o.receipts.length + o.payments.length + o.deposits.length;
}

/** Name of an event's kind, as the CMS timeline tags it. */
export function timelineKindLabel(kind: TimelineKind): string {
  if (kind === "other") return "Update";
  if (kind === "deposit") return "Security deposit";
  return humanize(kind);
}

const KIND_ICONS: Record<TimelineKind, string> = {
  customer: "person-add-outline",
  quotation: "document-text-outline",
  booking: "calendar-outline",
  invoice: "receipt-outline",
  receipt: "cash-outline",
  payment: "card-outline",
  agreement: "document-attach-outline",
  deposit: "shield-checkmark-outline",
  other: "ellipse-outline",
};

export function timelineIcon(kind: TimelineKind): string {
  return KIND_ICONS[kind];
}

/** Colour of an event from what happened (voided / failed / forfeited = danger, paid / signed / released = success). */
export function timelineTone(event: Pick<TimelineEvent, "action" | "kind">): Tone {
  const a = event.action.toLowerCase();
  if (/(void|fail|forfeit|cancel|reject|declin|expire)/.test(a)) return "danger";
  if (/(paid|signed|released|accept|convert|confirm)/.test(a)) return "success";
  if (event.kind === "deposit" || event.kind === "receipt") return "info";
  return "primary";
}

/** Screens a timeline event opens (the staff stack has detail screens for these kinds). */
export type TimelineTarget =
  | { kind: "quotation"; quotationId: number }
  | { kind: "booking"; bookingId: number }
  | { kind: "invoice"; invoiceId: number }
  | { kind: "agreement"; agreementId: number };

export function timelineTarget(event: Pick<TimelineEvent, "kind" | "refId">): TimelineTarget | null {
  const id = event.refId;
  if (!id) return null;
  switch (event.kind) {
    case "quotation":
      return { kind: "quotation", quotationId: id };
    case "booking":
      return { kind: "booking", bookingId: id };
    case "invoice":
      return { kind: "invoice", invoiceId: id };
    case "agreement":
      return { kind: "agreement", agreementId: id };
    default:
      return null;
  }
}

// ─── Opening an agreement ─────────────────────────────────────────────────────────────────────────────────

/** Rows looked through per search when finding an agreement in the agreements list. */
const AGREEMENT_SEARCH_LIMIT = 50;

/**
 * The full agreement row for the agreement screen (the API has no GET agreement/{id}): searched in GET agreement by
 * each hint in turn (quotation number first, then the customer's name) and matched by id. Null when the agreements
 * list of this staff member does not have it (the list is location-filtered by the API).
 */
export async function findAgreement(agreementId: number, hints: ReadonlyArray<string | null | undefined>): Promise<StaffAgreement | null> {
  const seen = new Set<string>();
  for (const hint of hints) {
    const search = (hint ?? "").trim();
    if (!search || seen.has(search.toLowerCase())) continue;
    seen.add(search.toLowerCase());
    const page = await listAgreements({ page: 1, limit: AGREEMENT_SEARCH_LIMIT, search });
    const match = page.items.find((a) => a.id === agreementId);
    if (match) return match;
  }
  return null;
}
