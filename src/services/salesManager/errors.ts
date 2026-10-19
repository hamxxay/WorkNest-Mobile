import { ApiError, serverMessage } from "../apiClient";
import {
  customRangeUpdateMessage,
  dashboardErrorView,
  needsDatabaseUpdate,
  withDatabaseUpdateMessage,
  type CeoErrorView,
} from "../ceo/errors";

// Errors of the Sales Manager API, in words a sales manager can act on (the CEO dashboard's error handling with this
// dashboard's wording).
//
// The endpoints answer 503 when a database update they need has not been run yet: SM_01 (the Sales Manager role and
// its procedures), SM_02 (the procedures that count desks instead of PKR) or SM_03 (the complaints section, loaded
// on its own from api/sales-manager/complaints and records/complaints). That is not a passing outage, so it gets its
// own clear message, naming the update the server asked for (SM_02 for the dashboard, SM_03 for complaints, when it
// named none). A custom date range before CS_01 (the CEO and Sales dashboards' dates update) shows the server's own
// message, which names the script to run.

/** The newest database update the dashboard (funnel, team, inquiries, renewals) needs: desks instead of PKR. */
export const SM_LATEST_DB_UPDATE = "SM_02";

/** The database update the complaints section (and its records) needs. */
export const SM_COMPLAINTS_DB_UPDATE = "SM_03";

/** The 503 message for a database update ("SM_02" by default); `subject` names what needs it. */
export function smDatabaseUpdateMessage(update: string = SM_LATEST_DB_UPDATE, subject = "The sales dashboard"): string {
  return (
    `${subject} needs the database update ${update} on the server before it can show figures. ` +
    "Please ask your WorkNest administrator to run it, then pull down to refresh."
  );
}

/** The complaints section's 503 message ("SM_03" by default). */
export function smComplaintsDatabaseUpdateMessage(update: string = SM_COMPLAINTS_DB_UPDATE): string {
  return smDatabaseUpdateMessage(update, "The complaints section");
}

/** The 503 message when the server names no update (SM_02). */
export const SM_DB_UPDATE_MESSAGE = smDatabaseUpdateMessage();

export const SM_FORBIDDEN_MESSAGE =
  "Only a sales manager can see these figures, for their own locations. If this is wrong, please ask a super admin " +
  "to check your role and locations.";

const UPDATE_NAME = /\bSM_(\d{2})\b/i;

/**
 * The database update a 503 names ("...needs the database update SM_01."), read from the error's message or the
 * server's answer kept with it; `fallback` (SM_02) when it names none.
 */
export function smDatabaseUpdateOf(error: unknown, fallback: string = SM_LATEST_DB_UPDATE): string {
  const texts: unknown[] = [];
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; details?: unknown };
    texts.push(e.message, serverMessage(e.details));
  }
  for (const text of texts) {
    const m = typeof text === "string" ? UPDATE_NAME.exec(text) : null;
    if (m) return `SM_${m[1]}`;
  }
  return fallback;
}

/** The error to throw from a Sales Manager call: a 503 becomes the database update message, anything else is kept. */
export function toSalesManagerError(error: unknown): unknown {
  if (!needsDatabaseUpdate(error)) return error;
  return withDatabaseUpdateMessage(error, customRangeUpdateMessage(error) ?? smDatabaseUpdateMessage(smDatabaseUpdateOf(error)));
}

/**
 * A 403's wording: the server's own message when it sent one (e.g. "Your account has no location yet. Ask a Super
 * Admin to assign your locations."), else the general one.
 */
export function smForbiddenMessage(error: unknown): string {
  return (error instanceof ApiError ? serverMessage(error.details) : null) ?? SM_FORBIDDEN_MESSAGE;
}

/** Title, message and icon for an error state on a Sales Manager screen. */
export function salesManagerErrorView(error: unknown, fallback?: string): CeoErrorView {
  const databaseUpdate = customRangeUpdateMessage(error) ?? smDatabaseUpdateMessage(smDatabaseUpdateOf(error));
  return dashboardErrorView(error, { databaseUpdate, forbidden: smForbiddenMessage(error) }, fallback);
}

/** The error to throw from a complaints call: a 503 becomes the complaints section's database update message. */
export function toSalesManagerComplaintsError(error: unknown): unknown {
  if (!needsDatabaseUpdate(error)) return error;
  return withDatabaseUpdateMessage(
    error,
    customRangeUpdateMessage(error) ?? smComplaintsDatabaseUpdateMessage(smDatabaseUpdateOf(error, SM_COMPLAINTS_DB_UPDATE)),
  );
}

/** Title, message and icon for an error state of the complaints section or a complaints list (503: SM_03). */
export function salesManagerComplaintsErrorView(error: unknown, fallback = "Could not load the complaints. Please try again."): CeoErrorView {
  const databaseUpdate = customRangeUpdateMessage(error) ?? smComplaintsDatabaseUpdateMessage(smDatabaseUpdateOf(error, SM_COMPLAINTS_DB_UPDATE));
  return dashboardErrorView(error, { databaseUpdate, forbidden: smForbiddenMessage(error) }, fallback);
}
