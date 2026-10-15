import { ApiError, errorMessage, serverMessage } from "../apiClient";
import { dashboardErrorView, needsDatabaseUpdate, statusOf, withDatabaseUpdateMessage, type CeoErrorView } from "../ceo/errors";

// Errors of the Access Officer API, in words an access officer can act on (the CEO / Sales Manager error handling
// with this page's wording).
//
//   503  the database update AO_01 (the role and its procedures) has not been run: its own message, naming the
//        update the server asked for (AO_01 when it named none). Retrying will not help until it is run.
//   404  on a lookup: nobody with this CNIC is on a confirmed booking at the officer's locations. Not an error: the
//        screen shows the API's message (ours when it sent none).
//   403  the room is not at one of the officer's locations (or the account lost the role).
//   409  already done (e.g. already on the room): the server's message, then the screen looks the person up again.
//   0    no answer: offline, or (for an enrolment) no answer within the long capture window.

/** The database update the Access page needs. */
export const AO_DB_UPDATE = "AO_01";

/** The 503 message ("AO_01" by default). */
export function aoDatabaseUpdateMessage(update: string = AO_DB_UPDATE): string {
  return (
    `The Access page needs the database update ${update} on the server before it can look anyone up. ` +
    "Please ask your WorkNest administrator to run it, then pull down to refresh."
  );
}

/** The 503 message when the server names no update (AO_01). */
export const AO_DB_UPDATE_MESSAGE = aoDatabaseUpdateMessage();

/** Shown when a lookup finds nobody and the server sent no message of its own (the contract's wording). */
export const AO_NOT_FOUND_MESSAGE =
  "No customer has added this CNIC to a confirmed booking at your locations. Ask the customer to add them under " +
  "My Bookings > Employees, or ask the sales team.";

export const AO_FORBIDDEN_MESSAGE =
  "This is not at one of your locations, so it cannot be changed from your account. If this is wrong, please ask a " +
  "super admin to check your role and locations.";

export const AO_CONFLICT_MESSAGE = "This was already done. The details below have been refreshed.";

export const AO_GONE_MESSAGE = "This person or room could not be found any more. Look the CNIC up again.";

export const AO_OFFLINE_MESSAGE = "Could not reach WorkNest. Check your internet connection and try again.";

/** An enrolment that got no answer within the capture window (or lost the connection on the way). */
export const AO_ENROL_NO_ANSWER_MESSAGE =
  "No answer from the server in time, or the connection dropped. The enrolment may still have finished on the " +
  "machine: pull down to refresh to check, then try again if it is not shown as enrolled.";

const UPDATE_NAME = /\bAO_(\d{2})\b/i;

/**
 * The database update a 503 names ("...needs the database update AO_01."), read from the error's message or the
 * server's answer kept with it; `fallback` (AO_01) when it names none.
 */
export function aoDatabaseUpdateOf(error: unknown, fallback: string = AO_DB_UPDATE): string {
  const texts: unknown[] = [];
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; details?: unknown };
    texts.push(e.message, serverMessage(e.details));
  }
  for (const text of texts) {
    const m = typeof text === "string" ? UPDATE_NAME.exec(text) : null;
    if (m) return `AO_${m[1]}`;
  }
  return fallback;
}

/** The error to throw from an Access Officer call: a 503 becomes the database update message, anything else is kept. */
export function toAccessOfficerError(error: unknown): unknown {
  return needsDatabaseUpdate(error) ? withDatabaseUpdateMessage(error, aoDatabaseUpdateMessage(aoDatabaseUpdateOf(error))) : error;
}

/** The server's own readable message kept with an ApiError (its `details`), or null. */
export function apiMessageOf(error: unknown): string | null {
  return error instanceof ApiError ? serverMessage(error.details) : null;
}

/** True for a lookup's "nobody found" answer (HTTP 404). */
export function isNotFound(error: unknown): boolean {
  return statusOf(error) === 404;
}

/** Title, message and icon for the Access screen's error state (503 AO_01, 403, offline, anything else). */
export function accessOfficerErrorView(error: unknown, fallback = "Could not look this up. Please try again."): CeoErrorView {
  const databaseUpdate = aoDatabaseUpdateMessage(aoDatabaseUpdateOf(error));
  const forbidden = apiMessageOf(error) ?? AO_FORBIDDEN_MESSAGE;
  const view = dashboardErrorView(error, { databaseUpdate, forbidden }, fallback);
  return statusOf(error) === 0 ? { ...view, message: AO_OFFLINE_MESSAGE } : view;
}

/**
 * One line for a failed action (add to room, enrol, remove / restore access), for a toast or the enrolment sheet.
 * The server's own message wins where it sent one (except for a 503, which always names the update).
 */
export function accessOfficerActionMessage(error: unknown, fallback = "That did not work. Please try again."): string {
  const status = statusOf(error);
  if (status === 503) return aoDatabaseUpdateMessage(aoDatabaseUpdateOf(error));
  const sent = apiMessageOf(error);
  if (status === 403) return sent ?? AO_FORBIDDEN_MESSAGE;
  if (status === 409) return sent ?? AO_CONFLICT_MESSAGE;
  if (status === 404) return sent ?? AO_GONE_MESSAGE;
  if (status === 0) return AO_OFFLINE_MESSAGE;
  return errorMessage(error, fallback);
}

/** Like accessOfficerActionMessage, for an enrolment: no answer (status 0, 408, 504) gets the long-wait wording. */
export function accessOfficerEnrolMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === 0 || status === 408 || status === 504) return AO_ENROL_NO_ANSWER_MESSAGE;
  return accessOfficerActionMessage(error, "The enrolment did not finish. Please try again.");
}
