import { ApiError, errorMessage } from "../apiClient";

// Errors of the CEO API, in words a CEO can act on.
//
// The CEO endpoints answer 503 when the database update they need (the CEO role and its procedures) has not been
// run yet. That is not a passing outage, so it gets its own clear message instead of "try again in a few minutes".

export const CEO_DB_UPDATE_TITLE = "Database update needed";
export const CEO_DB_UPDATE_MESSAGE =
  "This part of the CEO dashboard needs a database update on the server before it can show figures. " +
  "Please ask your WorkNest administrator to run it, then pull down to refresh.";

const statusOf = (error: unknown): number | null => {
  if (error instanceof ApiError) return error.status;
  if (error && typeof error === "object" && typeof (error as { status?: unknown }).status === "number") {
    return (error as { status: number }).status;
  }
  return null;
};

/** True when the server said the CEO dashboard needs its database update (HTTP 503). */
export function needsDatabaseUpdate(error: unknown): boolean {
  return statusOf(error) === 503;
}

/** The error to throw from a CEO call: a 503 becomes the "database update needed" message, anything else is kept. */
export function toCeoError(error: unknown): unknown {
  if (!needsDatabaseUpdate(error)) return error;
  return new ApiError(CEO_DB_UPDATE_MESSAGE, 503, error instanceof ApiError ? error.details : error);
}

export type CeoErrorView = {
  title: string;
  message: string;
  /** Ionicons name for the error well. */
  icon: string;
  /** The 503 "database update" case (retrying will not help until it is run). */
  databaseUpdate: boolean;
};

/** Title, message and icon for an error state on a CEO screen. */
export function ceoErrorView(error: unknown, fallback = "Could not load the figures. Please try again."): CeoErrorView {
  const status = statusOf(error);
  if (status === 503) {
    return { title: CEO_DB_UPDATE_TITLE, message: CEO_DB_UPDATE_MESSAGE, icon: "construct-outline", databaseUpdate: true };
  }
  if (status === 403) {
    return {
      title: "Not available for your account",
      message: "Only the CEO can see these figures. If this is wrong, please ask a super admin to check your role.",
      icon: "lock-closed-outline",
      databaseUpdate: false,
    };
  }
  if (status === 0) {
    return { title: "Could not reach WorkNest", message: errorMessage(error, fallback), icon: "cloud-offline-outline", databaseUpdate: false };
  }
  return { title: "Could not load this", message: errorMessage(error, fallback), icon: "alert-circle-outline", databaseUpdate: false };
}
