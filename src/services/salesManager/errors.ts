import { serverMessage } from "../apiClient";
import { dashboardErrorView, needsDatabaseUpdate, withDatabaseUpdateMessage, type CeoErrorView } from "../ceo/errors";

// Errors of the Sales Manager API, in words a sales manager can act on (the CEO dashboard's error handling with this
// dashboard's wording).
//
// The endpoints answer 503 when a database update they need has not been run yet: SM_01 (the Sales Manager role and
// its procedures) or SM_02 (the procedures that count desks instead of PKR). That is not a passing outage, so it gets
// its own clear message, naming the update the server asked for (SM_02, the newest, when it named none).

/** The newest database update this dashboard needs (desks instead of PKR). */
export const SM_LATEST_DB_UPDATE = "SM_02";

/** The 503 message for a database update ("SM_02" by default). */
export function smDatabaseUpdateMessage(update: string = SM_LATEST_DB_UPDATE): string {
  return (
    `The sales dashboard needs the database update ${update} on the server before it can show figures. ` +
    "Please ask your WorkNest administrator to run it, then pull down to refresh."
  );
}

/** The 503 message when the server names no update (SM_02). */
export const SM_DB_UPDATE_MESSAGE = smDatabaseUpdateMessage();

export const SM_FORBIDDEN_MESSAGE =
  "Only a sales manager can see these figures, for their own locations. If this is wrong, please ask a super admin " +
  "to check your role and locations.";

const UPDATE_NAME = /\bSM_(\d{2})\b/i;

/**
 * The database update a 503 names ("...needs the database update SM_01."), read from the error's message or the
 * server's answer kept with it; SM_02 when it names none.
 */
export function smDatabaseUpdateOf(error: unknown): string {
  const texts: unknown[] = [];
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; details?: unknown };
    texts.push(e.message, serverMessage(e.details));
  }
  for (const text of texts) {
    const m = typeof text === "string" ? UPDATE_NAME.exec(text) : null;
    if (m) return `SM_${m[1]}`;
  }
  return SM_LATEST_DB_UPDATE;
}

/** The error to throw from a Sales Manager call: a 503 becomes the database update message, anything else is kept. */
export function toSalesManagerError(error: unknown): unknown {
  return needsDatabaseUpdate(error) ? withDatabaseUpdateMessage(error, smDatabaseUpdateMessage(smDatabaseUpdateOf(error))) : error;
}

/** Title, message and icon for an error state on a Sales Manager screen. */
export function salesManagerErrorView(error: unknown, fallback?: string): CeoErrorView {
  const databaseUpdate = smDatabaseUpdateMessage(smDatabaseUpdateOf(error));
  return dashboardErrorView(error, { databaseUpdate, forbidden: SM_FORBIDDEN_MESSAGE }, fallback);
}
