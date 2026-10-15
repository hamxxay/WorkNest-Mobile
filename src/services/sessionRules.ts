import type { StoredUser } from "../utils/authStorage";

// Pure rules for the stored WorkNest session (unit tested): when the app may keep its API token instead of
// asking the API for a new one, and when a WorkNest-password sign-in (no Firebase account) is still valid.

/** A start-up or Firebase token refresh keeps the WorkNest token while it is good for longer than this. */
export const MIN_TOKEN_VALIDITY_MS = 60 * 60 * 1000;

/**
 * StoredUser.signInMethod of a session that came from the WorkNest password (POST auth/login): staff added in the
 * CMS who have no Firebase account yet. It lives on the API token alone until that token expires.
 */
export const WORKNEST_PASSWORD_SESSION = "worknest-password";

/**
 * Firebase answers that may only mean "no Firebase account with this password": the WorkNest password check
 * (POST auth/login) is tried next, as the CMS does.
 */
const WORKNEST_PASSWORD_FALLBACK_CODES = new Set([
  "auth/invalid-credential",
  "auth/user-not-found",
  "auth/wrong-password",
  "auth/invalid-login-credentials",
]);

export function triesWorkNestPassword(firebaseErrorCode: string): boolean {
  return WORKNEST_PASSWORD_FALLBACK_CODES.has(firebaseErrorCode);
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** base64url -> text (UTF-8). Null when the input is not valid base64url. */
function decodeBase64Url(segment: string): string | null {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*$/.test(base64) || base64.length % 4 === 1) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of base64) {
    buffer = buffer * 64 + BASE64_ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      const unit = 2 ** bits;
      bytes.push(Math.floor(buffer / unit) % 256);
      buffer %= unit;
    }
  }
  try {
    return decodeURIComponent(bytes.map(b => `%${b.toString(16).padStart(2, "0")}`).join(""));
  } catch {
    return null;
  }
}

/** The claims of a JWT (not verified: only used to know when the app's own token expires). */
export function jwtClaims(token: string | null | undefined): Record<string, unknown> | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  const json = decodeBase64Url(parts[1]);
  if (!json) return null;
  try {
    const claims = JSON.parse(json);
    return claims && typeof claims === "object" && !Array.isArray(claims) ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** When the token expires (ms since 1970), or null when it carries no expiry. */
export function jwtExpiresAt(token: string | null | undefined): number | null {
  const exp = jwtClaims(token)?.exp;
  const seconds = typeof exp === "number" ? exp : typeof exp === "string" ? Number(exp) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

const EMAIL_CLAIMS = ["email", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];

/** The email the token was issued for (lower case), or null. The API may send the claim twice (an array). */
export function jwtEmail(token: string | null | undefined): string | null {
  const claims = jwtClaims(token);
  if (!claims) return null;
  for (const key of EMAIL_CLAIMS) {
    const value = claims[key];
    const first = Array.isArray(value) ? value.find(v => typeof v === "string" && v.trim()) : value;
    if (typeof first === "string" && first.trim()) return first.trim().toLowerCase();
  }
  return null;
}

function normalEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** The token is still accepted for at least `minValidityMs` and (when it names one) belongs to this email. */
export function tokenValidFor(
  token: string | null | undefined,
  email: string | null | undefined,
  now: number,
  minValidityMs: number,
): boolean {
  const expiresAt = jwtExpiresAt(token);
  if (expiresAt === null || expiresAt - now <= minValidityMs) return false;
  const tokenEmail = jwtEmail(token);
  return !tokenEmail || tokenEmail === normalEmail(email);
}

/**
 * Start-up and Firebase token refreshes skip POST auth/google-login when the stored WorkNest token of this same
 * account is still good for more than an hour and its role is known (rate limits; the role is refreshed from
 * auth/me anyway, and a token the API no longer accepts is renewed on the first 401).
 */
export function canSkipExchange(input: {
  token: string | null | undefined;
  firebaseEmail: string | null | undefined;
  cached: StoredUser | null | undefined;
  now: number;
  minValidityMs?: number;
}): boolean {
  const email = normalEmail(input.firebaseEmail);
  if (!email || normalEmail(input.cached?.email) !== email) return false;
  if (typeof input.cached?.role !== "string" || !input.cached.role.trim()) return false;
  return tokenValidFor(input.token, email, input.now, input.minValidityMs ?? MIN_TOKEN_VALIDITY_MS);
}

/** A WorkNest-password session (no Firebase account) whose token has not expired yet. */
export function keepsWorkNestPasswordSession(
  cached: StoredUser | null | undefined,
  token: string | null | undefined,
  now: number,
): boolean {
  if (!cached || cached.signInMethod !== WORKNEST_PASSWORD_SESSION) return false;
  return tokenValidFor(token, cached.email, now, 0);
}

/**
 * After sign-up: the name typed on the form is saved (PUT auth/me) when the account has no real name yet, i.e. none
 * at all or the API's default (the part of the email before @). A name someone already set is never replaced.
 */
export function needsSignupName(
  savedName: string | null | undefined,
  typedName: string | null | undefined,
  email: string | null | undefined,
): boolean {
  const typed = typeof typedName === "string" ? typedName.trim() : "";
  if (!typed) return false;
  const saved = typeof savedName === "string" ? savedName.trim() : "";
  if (!saved) return true;
  if (saved === typed) return false;
  const emailPrefix = normalEmail(email).split("@")[0];
  return !!emailPrefix && saved.toLowerCase() === emailPrefix;
}
