import { ApiError, apiRequest } from "../apiClient";

// Delete your own account (Google Play rule, API script QA_04_account_delete). Customers (role "general") delete
// their account in Profile > Delete account; staff, CEO, Sales Manager and Access Officer accounts are removed by a
// WorkNest admin. The API refuses (nothing deleted) while the customer has an active or pending booking or money due.
// The same flow is on worknestpk.com/delete-account (the link given to Google Play).

/** API paths (relative to API_BASE_URL, which already ends in /api). */
export const ACCOUNT_ENDPOINTS = {
  deleteCheck: "/account/delete-check",
  delete: "/account/delete",
} as const;

/** What the user types to confirm. */
export const DELETE_CONFIRM_WORD = "DELETE";

/** The public page about account deletion (also the Google Play deletion link). */
export const DELETE_ACCOUNT_WEB_URL = "https://worknestpk.com/delete-account";

export const STAFF_DELETE_MESSAGE = "Ask a WorkNest admin to remove your account.";

/** What is removed when an account is deleted (shown before asking). */
export const DELETED_ITEMS: readonly string[] = [
  "Your sign-in: you can't sign in with this account any more.",
  "Your name, email, phone, CNIC / passport number, address and photo.",
  "App notifications on your devices. You are signed out everywhere.",
];

/** What is kept, and why (shown before asking). */
export const KEPT_ITEMS: readonly string[] = [
  "Bookings, invoices, payments, challans and signed agreements, kept for accounting and the law, no longer linked to your name.",
  "Security records such as sign-in history.",
];

export type DeleteReasonCode =
  | "staff_account"
  | "active_booking"
  | "pending_booking"
  | "unpaid_invoice"
  | "not_found"
  | "unavailable"
  | null;

export type DeleteCheck = {
  canDelete: boolean;
  /** A plain sentence from the API, ready to show (null when the account can be deleted). */
  reason: string | null;
  reasonCode: DeleteReasonCode;
  isCustomerAccount: boolean;
  activeBookings: number;
  pendingBookings: number;
  unpaidInvoices: number;
  balanceDue: number;
  /** The database script the server still needs (deleting online is not available until it runs). */
  needsDatabaseUpdate: string | null;
};

const KNOWN_CODES: readonly Exclude<DeleteReasonCode, null>[] = [
  "staff_account",
  "active_booking",
  "pending_booking",
  "unpaid_invoice",
  "not_found",
  "unavailable",
];

const count = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const amount = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Reads the API's check (camelCase or PascalCase), never trusting a missing field as "can delete". */
export function normalizeDeleteCheck(raw: unknown): DeleteCheck {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const get = (key: string) => r[key] ?? r[key.charAt(0).toUpperCase() + key.slice(1)];
  const code = text(get("reasonCode"));
  const reasonCode = (code && (KNOWN_CODES as readonly string[]).includes(code) ? code : null) as DeleteReasonCode;
  const canDelete = get("canDelete") === true && reasonCode === null;
  return {
    canDelete,
    reason: canDelete ? null : text(get("reason")),
    reasonCode,
    isCustomerAccount: get("isCustomerAccount") !== false && reasonCode !== "staff_account",
    activeBookings: count(get("activeBookings")),
    pendingBookings: count(get("pendingBookings")),
    unpaidInvoices: count(get("unpaidInvoices")),
    balanceDue: amount(get("balanceDue")),
    needsDatabaseUpdate: text(get("needsDatabaseUpdate")),
  };
}

export type DeleteEligibility =
  | { state: "can_delete"; message: string }
  | { state: "staff"; message: string }
  | { state: "blocked"; message: string }
  | { state: "unavailable"; message: string }
  | { state: "gone"; message: string };

/** What the Delete account sheet shows for a check: the form, or why not (with the contact options). */
export function deleteEligibility(check: DeleteCheck): DeleteEligibility {
  if (check.canDelete) {
    return { state: "can_delete", message: "Your account can be deleted. This can't be undone." };
  }
  switch (check.reasonCode) {
    case "staff_account":
      return { state: "staff", message: check.reason ?? `Staff accounts can't be deleted here. ${STAFF_DELETE_MESSAGE}` };
    case "unavailable":
      return {
        state: "unavailable",
        message: check.reason ?? "Deleting an account in the app isn't available yet. Please contact WorkNest and we will delete it for you.",
      };
    case "not_found":
      return { state: "gone", message: check.reason ?? "This account no longer exists or has already been switched off." };
    default:
      return { state: "blocked", message: check.reason ?? blockedMessage(check) };
  }
}

/** Fallback wording when the API sent counts but no sentence. */
export function blockedMessage(check: Pick<DeleteCheck, "activeBookings" | "pendingBookings" | "unpaidInvoices">): string {
  const parts: string[] = [];
  if (check.activeBookings > 0) parts.push(check.activeBookings === 1 ? "an active booking" : `${check.activeBookings} active bookings`);
  if (check.pendingBookings > 0)
    parts.push(
      check.pendingBookings === 1
        ? "a booking request waiting for confirmation"
        : `${check.pendingBookings} booking requests waiting for confirmation`,
    );
  if (check.unpaidInvoices > 0) parts.push(check.unpaidInvoices === 1 ? "an unpaid invoice" : `${check.unpaidInvoices} unpaid invoices`);
  if (!parts.length) return "Your account can't be deleted right now. Please contact WorkNest for help.";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `You can't delete your account while you have ${list}. Contact WorkNest for help.`;
}

/** The confirmation box holds the word DELETE (spaces and letter case ignored). */
export function isDeleteConfirmed(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().toUpperCase() === DELETE_CONFIRM_WORD;
}

/** Customers delete their own account; every other role sees "Ask a WorkNest admin". */
export function canSelfDelete(role: string | null | undefined): boolean {
  return (role ?? "general") === "general";
}

/** GET /account/delete-check: may this account be deleted, and if not, why. Changes nothing. */
export async function getDeleteCheck(): Promise<DeleteCheck> {
  return normalizeDeleteCheck(await apiRequest<unknown>(ACCOUNT_ENDPOINTS.deleteCheck, { requiresAuth: true }));
}

/**
 * POST /account/delete { confirm: "DELETE" }. Resolves when the account was deleted on the server (its sign-in token
 * stops working right away). Throws an ApiError with the API's plain message when it refuses (409: booking, money
 * due, staff account; 503: not available yet) or fails (500): nothing was deleted then.
 */
export async function deleteMyAccount(): Promise<string> {
  const payload = await apiRequest<unknown>(ACCOUNT_ENDPOINTS.delete, {
    method: "POST",
    body: { confirm: DELETE_CONFIRM_WORD },
    requiresAuth: true,
    unwrapData: false,
  });
  const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return text(p.message) ?? "Your WorkNest account has been deleted.";
}

/** The check the API sent with a refusal (409 / 503), when it sent one. */
export function refusalCheckOf(error: unknown): DeleteCheck | null {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== "object") return null;
  const data = (error.details as Record<string, unknown>).data;
  return data && typeof data === "object" ? normalizeDeleteCheck(data) : null;
}
