import type { Tone } from "./colors";

/**
 * One status vocabulary for the whole app, matching the CMS badge colours.
 * Covers bookings, quotations, invoices/payments, agreements, KYC, complaints and tour inquiries.
 *
 * Keys are normalised: lower-case with spaces, underscores and hyphens removed
 * ("In Progress", "in_progress" and "InProgress" all become "inprogress").
 */
const TONE_BY_STATUS: Record<string, Tone> = {
  // ── Success: done / approved / money received ──────────────────────────────
  confirmed: "success",
  approved: "success",
  accepted: "success",
  active: "success",
  paid: "success",
  verified: "success",
  signed: "success",
  completed: "success",
  complete: "success",
  resolved: "success",
  converted: "success",
  released: "success",
  success: "success",
  successful: "success",
  succeeded: "success",
  delivered: "success",
  checkedout: "success",

  // ── Primary (teal): currently booked / in use ──────────────────────────────
  booked: "primary",
  reserved: "primary",
  checkedin: "primary",
  ongoing: "primary",
  inuse: "primary",
  occupied: "primary",

  // ── Info (blue): sent out / new / partly done ──────────────────────────────
  sent: "info",
  agreementsent: "info",
  quotationsent: "info",
  new: "info",
  open: "info",
  submitted: "info",
  issued: "info",
  generated: "info",
  scheduled: "info",
  contacted: "info",
  upcoming: "info",
  partial: "info",
  partiallypaid: "info",
  read: "info",

  // ── Warning (amber): waiting on someone ────────────────────────────────────
  pending: "warning",
  unpaid: "warning",
  due: "warning",
  awaiting: "warning",
  awaitingpayment: "warning",
  waiting: "warning",
  inprogress: "warning",
  processing: "warning",
  underreview: "warning",
  inreview: "warning",
  review: "warning",
  signeduploaded: "warning",
  held: "warning",
  onhold: "warning",
  followup: "warning",
  futureprospect: "warning",
  reopened: "warning",
  expiring: "warning",
  modificationrequested: "warning",

  // ── Danger (red): failed / refused / lost ──────────────────────────────────
  cancelled: "danger",
  canceled: "danger",
  rejected: "danger",
  declined: "danger",
  failed: "danger",
  emailfailed: "danger",
  overdue: "danger",
  expired: "danger",
  forfeited: "danger",
  notinterested: "danger",
  blocked: "danger",
  suspended: "danger",
  void: "danger",
  voided: "danger",
  error: "danger",
  noshow: "danger",

  // ── Indigo: quoted / refunded (CMS badge-quoted, status-refunded) ──────────
  quoted: "indigo",
  refunded: "indigo",

  // ── Neutral (slate): not started / archived ────────────────────────────────
  draft: "neutral",
  inactive: "neutral",
  closed: "neutral",
  archived: "neutral",
  available: "neutral",
  notstarted: "neutral",
  none: "neutral",
  unknown: "neutral",
};

/** Friendly labels where the API value is not readable as-is. */
const LABEL_BY_STATUS: Record<string, string> = {
  agreementsent: "Sent",
  quotationsent: "Sent",
  emailfailed: "Email failed",
  signeduploaded: "Signed (under review)",
  inprogress: "In progress",
  underreview: "Under review",
  inreview: "In review",
  onhold: "On hold",
  followup: "Follow-up",
  futureprospect: "Future prospect",
  notinterested: "Not interested",
  partiallypaid: "Partially paid",
  awaitingpayment: "Awaiting payment",
  checkedin: "Checked in",
  checkedout: "Checked out",
  inuse: "In use",
  noshow: "No show",
  notstarted: "Not started",
  modificationrequested: "Modification requested",
  canceled: "Cancelled",
};

/** "In Progress" / "in_progress" / "InProgress" -> "inprogress". */
export function normalizeStatus(status: string | null | undefined): string {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * Maps any status string from the API to a colour tone. Unknown or empty statuses are "neutral".
 * Numeric codes (e.g. KYC 0/1/2) must be mapped to their names first.
 */
export function statusTone(status: string | null | undefined): Tone {
  const key = normalizeStatus(status);
  if (!key) return "neutral";
  const exact = TONE_BY_STATUS[key];
  if (exact) return exact;
  // Loose matches for compound API values such as "PaymentPending" or "BookingCancelled".
  if (key.includes("cancel") || key.includes("reject") || key.includes("fail") || key.includes("declin")) return "danger";
  if (key.includes("overdue") || key.includes("expire")) return "danger";
  if (key.includes("pending") || key.includes("await") || key.includes("review")) return "warning";
  if (key.includes("confirm") || key.includes("approv") || key.includes("verif") || key.includes("paid")) return "success";
  if (key.includes("complet") || key.includes("resolv") || key.includes("signed")) return "success";
  if (key.includes("sent")) return "info";
  return "neutral";
}

/**
 * Human label for a status: known API codes get a friendly label, anything else is
 * split on camelCase / underscores and sentence-cased ("AgreementSent" -> "Sent", "on_hold" -> "On hold").
 */
export function statusLabel(status: string | null | undefined): string {
  const raw = String(status ?? "").trim();
  if (!raw) return "Unknown";
  const known = LABEL_BY_STATUS[normalizeStatus(raw)];
  if (known) return known;
  const words = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
