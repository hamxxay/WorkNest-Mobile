import { ApiError, errorMessage, serverMessage } from "../apiClient";

// Errors of the CEO API, in words a CEO can act on.
//
// The CEO endpoints answer 503 when the database update they need (the CEO role and its procedures) has not been
// run yet. That is not a passing outage, so it gets its own clear message instead of "try again in a few minutes".
//
// The generic pieces (dashboardErrorView, withDatabaseUpdateMessage) are shared with the Sales Manager dashboard,
// which has its own database update (SM_01) and its own wording.

export const CEO_DB_UPDATE_TITLE = "Database update needed";
export const CEO_DB_UPDATE_MESSAGE =
  "This part of the CEO dashboard needs a database update on the server before it can show figures. " +
  "Please ask your WorkNest administrator to run it, then pull down to refresh.";

const CEO_FORBIDDEN_MESSAGE = "Only the CEO can see these figures. If this is wrong, please ask a super admin to check your role.";

/** The CEO dashboard's own update: its 503 keeps the general wording above. */
const CEO_BASE_UPDATE = "CEO_01";

/** A database update's name: 2 to 4 letters, "_", 2 digits (CEO_01, QA_07, AO_01, EMP_01); returned in capitals. */
const UPDATE_NAME = /\b([A-Z]{2,4}_\d{2})\b/i;

/**
 * The database update a 503 names ("...needs the database update EMP_01."), read from the error's message or the
 * server's answer kept with it (ApiError details); `fallback` when it names none. Any update name the server sends is
 * kept as it is, whatever its prefix.
 */
export function databaseUpdateNameOf<F extends string | null>(error: unknown, fallback: F): string | F {
  const texts: unknown[] = [];
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; details?: unknown };
    texts.push(e.message, serverMessage(e.details));
  }
  for (const text of texts) {
    const m = typeof text === "string" ? UPDATE_NAME.exec(text) : null;
    if (m) return m[1].toUpperCase();
  }
  return fallback;
}

/**
 * The CEO's 503 message: the general one for the dashboard's own update (CEO_01, or none named); a later update the
 * server names (e.g. QA_07 for the full list of leases expiring) is named.
 */
export function ceoDatabaseUpdateMessage(update: string | null): string {
  if (!update || update === CEO_BASE_UPDATE) return CEO_DB_UPDATE_MESSAGE;
  return (
    `This part of the CEO dashboard needs the database update ${update} on the server before it can show it. ` +
    "Please ask your WorkNest administrator to run it, then pull down to refresh."
  );
}

/**
 * The custom date range's own update (CS_01_ceo_sales_dates_TEST / _LIVE): no word boundary after its number, since
 * the script name goes on with "_ceo...".
 */
const RANGE_UPDATE = /\bCS_\d{2}(?!\d)/i;

/**
 * The server's own message for a 503 that names the custom date range's database update ("Database update needed:
 * run the script CS_01_ceo_sales_dates_TEST ... to use a custom date range."), shown as it is; null for anything else.
 */
export function customRangeUpdateMessage(error: unknown): string | null {
  if (statusOf(error) !== 503 || !error || typeof error !== "object") return null;
  const e = error as { message?: unknown; details?: unknown };
  for (const text of [serverMessage(e.details), e.message]) {
    if (typeof text === "string" && RANGE_UPDATE.test(text) && text.trim().length <= 300) return text.trim();
  }
  return null;
}

/** The HTTP status of an error (ApiError or anything with a numeric `status`), or null. */
export const statusOf = (error: unknown): number | null => {
  if (error instanceof ApiError) return error.status;
  if (error && typeof error === "object" && typeof (error as { status?: unknown }).status === "number") {
    return (error as { status: number }).status;
  }
  return null;
};

/** True when the server said the dashboard needs its database update (HTTP 503). */
export function needsDatabaseUpdate(error: unknown): boolean {
  return statusOf(error) === 503;
}

/** A 503 becomes an ApiError with `message` (status 503, the original kept as details); anything else is kept. */
export function withDatabaseUpdateMessage(error: unknown, message: string): unknown {
  if (!needsDatabaseUpdate(error)) return error;
  return new ApiError(message, 503, error instanceof ApiError ? error.details : error);
}

/**
 * The error to throw from a CEO call: a 503 becomes the "database update needed" message (the custom date range's
 * update: the server's own words), anything else is kept.
 */
export function toCeoError(error: unknown): unknown {
  return withDatabaseUpdateMessage(error, customRangeUpdateMessage(error) ?? ceoDatabaseUpdateMessage(databaseUpdateNameOf(error, null)));
}

export type CeoErrorView = {
  title: string;
  message: string;
  /** Ionicons name for the error well. */
  icon: string;
  /** The 503 "database update" case (retrying will not help until it is run). */
  databaseUpdate: boolean;
};

/** What a read-only dashboard says for its two special cases. */
export type DashboardErrorTexts = {
  /** 503: the database update this dashboard needs has not been run. */
  databaseUpdate: string;
  /** 403: the account may not see these figures. */
  forbidden: string;
};

/** Title, message and icon for an error state on a read-only dashboard screen (CEO, Sales Manager). */
export function dashboardErrorView(error: unknown, texts: DashboardErrorTexts, fallback = "Could not load the figures. Please try again."): CeoErrorView {
  const status = statusOf(error);
  if (status === 503) {
    return { title: CEO_DB_UPDATE_TITLE, message: texts.databaseUpdate, icon: "construct-outline", databaseUpdate: true };
  }
  if (status === 403) {
    return { title: "Not available for your account", message: texts.forbidden, icon: "lock-closed-outline", databaseUpdate: false };
  }
  if (status === 0) {
    return { title: "Could not reach WorkNest", message: errorMessage(error, fallback), icon: "cloud-offline-outline", databaseUpdate: false };
  }
  return { title: "Could not load this", message: errorMessage(error, fallback), icon: "alert-circle-outline", databaseUpdate: false };
}

/** Title, message and icon for an error state on a CEO screen. */
export function ceoErrorView(error: unknown, fallback = "Could not load the figures. Please try again."): CeoErrorView {
  const databaseUpdate = customRangeUpdateMessage(error) ?? ceoDatabaseUpdateMessage(databaseUpdateNameOf(error, null));
  return dashboardErrorView(error, { databaseUpdate, forbidden: CEO_FORBIDDEN_MESSAGE }, fallback);
}
