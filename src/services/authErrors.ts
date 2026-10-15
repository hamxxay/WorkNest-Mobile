import { ApiError, errorMessage, serverMessage } from "./apiClient";

// How the app reads the API's answer to a sign-in (auth/google-login, auth/login). Pure, unit tested.
//
//   403 { isSuccessful: false, message, data: { code: "EMAIL_NOT_VERIFIED" } }  -> ask the user to verify the email
//   403 { isSuccessful: false, message, data: { code: "ACCOUNT_DISABLED" } }    -> account turned off: sign out
//   401 / 403 without a code, or 200 { isSuccessful: false }                     -> any other refusal: sign out
//   0 (offline), 408, 429, 5xx                                                   -> not a verdict: keep the session

export const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";
export const ACCOUNT_DISABLED = "ACCOUNT_DISABLED";

export const EMAIL_NOT_VERIFIED_MESSAGE =
  "Please verify your email address first. Open the link we emailed you, then try again.";
export const ACCOUNT_DISABLED_MESSAGE = "Your account is turned off. Please contact WorkNest.";
export const SIGN_IN_REFUSED_MESSAGE =
  "We couldn't sign you in to WorkNest. Please try again, or contact WorkNest if this keeps happening.";
export const GOOGLE_UNAVAILABLE_MESSAGE =
  "Google sign-in isn't available right now. Please sign in with your email and password.";

function envelope(details: unknown): Record<string, unknown> | null {
  return details && typeof details === "object" ? (details as Record<string, unknown>) : null;
}

/** The API's refusal code (`data.code`, e.g. "EMAIL_NOT_VERIFIED"), upper case, or null when it sent none. */
export function refusalCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const body = envelope(error.details);
  const data = envelope(body?.data ?? body?.Data);
  const raw = data?.code ?? data?.Code;
  return typeof raw === "string" && raw.trim() ? raw.trim().toUpperCase() : null;
}

export function isEmailNotVerified(error: unknown): boolean {
  return refusalCode(error) === EMAIL_NOT_VERIFIED;
}

export function isAccountDisabled(error: unknown): boolean {
  return refusalCode(error) === ACCOUNT_DISABLED;
}

/** A 2xx answer whose body says { isSuccessful: false } (older API versions refuse a sign-in this way). */
function refusedWithSuccessStatus(error: ApiError): boolean {
  if (error.status < 200 || error.status >= 300) return false;
  const body = envelope(error.details);
  return !!body && (body.isSuccessful === false || body.IsSuccessful === false || body.success === false);
}

/**
 * The API turned the sign-in down (a verdict on the account): 401 / 403, a refusal code, or 200 with
 * { isSuccessful: false }. Being offline (0), rate limited (429) or a server error (5xx) is not.
 */
export function isSignInRefused(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401 || error.status === 403) return true;
  if (refusalCode(error)) return true;
  return refusedWithSuccessStatus(error);
}

/** Offline, timed out, rate limited or server trouble: try again later, never a reason to sign anyone out. */
export function isTemporaryFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

/**
 * The message to show for a refused sign-in: the API's own words when it sent some (e.g. "Your account is turned
 * off. Please contact WorkNest."), a plain default otherwise. "Google login failed" is never shown to someone who
 * signed in with an email and password.
 */
export function refusalMessage(error: unknown, options: { viaGoogle: boolean }): string {
  const code = refusalCode(error);
  const fromServer = error instanceof ApiError ? serverMessage(error.details) : null;
  if (code === ACCOUNT_DISABLED) return fromServer ?? ACCOUNT_DISABLED_MESSAGE;
  if (code === EMAIL_NOT_VERIFIED) return fromServer ?? EMAIL_NOT_VERIFIED_MESSAGE;
  if (!fromServer) return SIGN_IN_REFUSED_MESSAGE;
  if (!options.viaGoogle && /google/i.test(fromServer)) return SIGN_IN_REFUSED_MESSAGE;
  return fromServer;
}

// ─── Google sign-in problems ──────────────────────────────────────────────────

/** The user closed the Google account picker: not an error, nothing is shown. */
export class SignInCancelled extends Error {
  constructor() {
    super("Sign-in was cancelled.");
    this.name = "SignInCancelled";
  }
}

export function isSignInCancelled(error: unknown): boolean {
  return error instanceof SignInCancelled;
}

/** Google sign-in is not set up in this build (no web client id, DEVELOPER_ERROR, native module missing). */
export class GoogleSignInUnavailable extends Error {
  /** What is wrong, for the developer log only (never shown). */
  detail: string;

  constructor(detail: string) {
    super(GOOGLE_UNAVAILABLE_MESSAGE);
    this.name = "GoogleSignInUnavailable";
    this.detail = detail;
  }
}

/** Google Sign-In error codes that mean the build is not configured for Google (SHA fingerprint, client id). */
const GOOGLE_SETUP_CODES = new Set(["10", "DEVELOPER_ERROR", "12500"]);

export type GoogleErrorKind = "cancelled" | "in-progress" | "play-services" | "unavailable" | "other";

/** What a Google Sign-In failure means for the user (statusCodes passed in, so this stays pure). */
export function googleErrorKind(
  error: unknown,
  codes: { SIGN_IN_CANCELLED?: string; IN_PROGRESS?: string; PLAY_SERVICES_NOT_AVAILABLE?: string },
): GoogleErrorKind {
  if (error instanceof SignInCancelled) return "cancelled";
  if (error instanceof GoogleSignInUnavailable) return "unavailable";
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code && code === codes.SIGN_IN_CANCELLED) return "cancelled";
  if (code && code === codes.IN_PROGRESS) return "in-progress";
  if (code && code === codes.PLAY_SERVICES_NOT_AVAILABLE) return "play-services";
  if (GOOGLE_SETUP_CODES.has(code)) return "unavailable";
  return "other";
}

/** Readable text for a failed Google sign-in (never developer instructions or native error text). */
export function googleErrorMessage(kind: GoogleErrorKind, error: unknown): string {
  switch (kind) {
    case "in-progress":
      return "Google sign-in is already open. Please finish it first.";
    case "play-services":
      return "Google Play Services is missing or out of date on this device. Update it, then try again.";
    case "unavailable":
      return GOOGLE_UNAVAILABLE_MESSAGE;
    default:
      return errorMessage(error, "Google sign-in didn't work. Please try again.");
  }
}
