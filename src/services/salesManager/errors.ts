import { dashboardErrorView, withDatabaseUpdateMessage, type CeoErrorView } from "../ceo/errors";

// Errors of the Sales Manager API, in words a sales manager can act on (the CEO dashboard's error handling with this
// dashboard's wording).
//
// The endpoints answer 503 when the database update they need (SM_01: the Sales Manager role and its procedures)
// has not been run yet. That is not a passing outage, so it gets its own clear message.

export const SM_DB_UPDATE_MESSAGE =
  "The sales dashboard needs a database update on the server (SM_01) before it can show figures. " +
  "Please ask your WorkNest administrator to run it, then pull down to refresh.";

export const SM_FORBIDDEN_MESSAGE =
  "Only a sales manager can see these figures, for their own locations. If this is wrong, please ask a super admin " +
  "to check your role and locations.";

/** The error to throw from a Sales Manager call: a 503 becomes the SM_01 message, anything else is kept. */
export function toSalesManagerError(error: unknown): unknown {
  return withDatabaseUpdateMessage(error, SM_DB_UPDATE_MESSAGE);
}

/** Title, message and icon for an error state on a Sales Manager screen. */
export function salesManagerErrorView(error: unknown, fallback?: string): CeoErrorView {
  return dashboardErrorView(error, { databaseUpdate: SM_DB_UPDATE_MESSAGE, forbidden: SM_FORBIDDEN_MESSAGE }, fallback);
}
