import {
  default as auth,
  FirebaseAuthTypes,
  GoogleAuthProvider,
  getIdToken,
} from "@react-native-firebase/auth";
import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { FIREBASE_IOS_CLIENT_ID, FIREBASE_WEB_CLIENT_ID } from "@env";
import { buildApiPath } from "../config/api";
import {
  clearAuthStorage,
  getToken,
  getUser,
  removeToken,
  removeUser,
  saveToken,
  saveUser,
} from "../utils/authStorage";
import type { StoredUser } from "../utils/authStorage";
import {
  ApiError,
  apiRequest,
  notifySessionExpired,
  onSessionExpired,
  revokeApiToken,
  setSessionRefresher,
} from "./apiClient";
import { clearAllDoorAccess } from "./doorAccessService";
import { primaryRoleName } from "../context/roles";
import {
  sanitizeEmailInput,
  sanitizeLoginPasswordInput,
  sanitizeOptionalNameInput,
  sanitizePasswordInput,
} from "../utils/inputSanitizer";
import { setOnboardingCompleted } from "../utils/onboardingStorage";
import {
  ACCOUNT_DISABLED,
  GoogleSignInUnavailable,
  SignInCancelled,
  googleErrorKind,
  googleErrorMessage,
  isEmailNotVerified,
  isSignInRefused,
  isTemporaryFailure,
  refusalCode,
  refusalMessage,
} from "./authErrors";
import { RESEND_COOLDOWN_MS } from "./emailVerification";
import {
  WORKNEST_PASSWORD_SESSION,
  canSkipExchange,
  keepsWorkNestPasswordSession,
  needsSignupName,
  triesWorkNestPassword,
} from "./sessionRules";

// How sign-in works: Firebase owns passwords and Google sign-in. The WorkNest API verifies the Firebase ID
// token (sent as `firebaseIdToken`) and returns its own JWT with the user's role; every API call sends that JWT.
// The Firebase ID token itself is never used as the API token.
//
// - A new email account must verify its address first: sign-up sends the Firebase verification email and the
//   "Verify your email" screen signs in once the link was opened (the API refuses unverified addresses with
//   403 EMAIL_NOT_VERIFIED, which leads to the same screen).
// - Staff added in the CMS who have no Firebase account yet sign in with their WorkNest password (POST auth/login);
//   the Firebase account is then created in the background, as the CMS does.
// - The token exchange is only repeated at start-up / on a Firebase token refresh when the stored WorkNest token is
//   valid for less than an hour (sessionRules.canSkipExchange).

type AuthResponse = {
  /** The WorkNest API token (JWT), never the Firebase ID token. */
  token: string | null;
  email: string | null;
  userId: string;
  roles: string[] | null;
};

type LoginRequest = {
  email: string;
  password: string;
};

type RegisterRequest = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

/** Sign-up result: the account exists, the email address must be verified before the app opens. */
export type SignUpResult = {
  verificationRequired: true;
  email: string;
  /** False when the verification email could not be sent (the screen offers to send it again). */
  emailSent: boolean;
};

type ApiSession = { token: string; roles: string[] | null };

type ExchangeOptions = {
  /** The name typed at sign-up (saved for a new account). */
  name?: string;
  /** A real Login / Sign-up / Google button press (false for start-up and token refreshes). */
  interactive: boolean;
};

/**
 * At app start the API token exchange may not wait longer than this: offline (or on a slow network) the app
 * opens with the cached session instead of a spinner, and the exchange finishes in the background.
 */
const STARTUP_EXCHANGE_TIMEOUT_MS = 5000;

let googleSigninConfigured = false;

function getFirebaseAuth() {
  try {
    return auth();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Firebase Auth native module is unavailable.";
    throw new Error(`Firebase Auth is not ready: ${message}`);
  }
}

function currentFirebaseUser(): FirebaseAuthTypes.User | null {
  try {
    return getFirebaseAuth().currentUser;
  } catch {
    return null;
  }
}

/** Development-only trace of the sign-in flow. Never logs emails, names, tokens or other personal data. */
function debugAuth(label: string, details?: Record<string, unknown>) {
  if (!__DEV__) return;
  if (details) {
    console.log(`[Firebase Auth] ${label}`, details);
    return;
  }
  console.log(`[Firebase Auth] ${label}`);
}

function warnDev(label: string, error?: unknown) {
  if (__DEV__) console.warn(label, error instanceof Error ? error.message : error);
}

function mapFirebaseUser(user: FirebaseAuthTypes.User): StoredUser {
  return {
    id: user.uid,
    name: user.displayName ?? undefined,
    email: user.email ?? undefined,
    phoneNumber: user.phoneNumber ?? undefined,
  };
}

function sameEmail(a: unknown, b: unknown): boolean {
  const ea = typeof a === "string" ? a.trim().toLowerCase() : "";
  const eb = typeof b === "string" ? b.trim().toLowerCase() : "";
  return !!ea && ea === eb;
}

function sameAccount(a: StoredUser | null | undefined, b: StoredUser | null | undefined): boolean {
  return sameEmail(a?.email, b?.email);
}

/** Signed in to Firebase with Google (its sign-in errors may mention Google; password users never see that). */
function signedInWithGoogle(user: FirebaseAuthTypes.User): boolean {
  return Array.isArray(user.providerData) && user.providerData.some(p => p?.providerId === "google.com");
}

/** The current Firebase user's ID token, or undefined when nobody is signed in to Firebase. */
async function currentFirebaseIdToken(): Promise<string | undefined> {
  try {
    const current = getFirebaseAuth().currentUser;
    return current ? await getIdToken(current) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * POST /auth/sync — creates or updates the user row (name / phone). Sends the Firebase ID token the API
 * verifies (`firebaseIdToken`); the email is taken from that token by the API.
 */
export async function syncUserWithBackend(user: StoredUser): Promise<void> {
  if (!user.email) return;
  try {
    await apiRequest(buildApiPath("auth/sync"), {
      method: "POST",
      body: {
        firebaseIdToken: await currentFirebaseIdToken(),
        email: user.email,
        name: user.name ?? undefined,
        phone: (user.phoneNumber as string) || undefined,
      },
    });
  } catch (error) {
    warnDev("[Auth Sync] Failed to sync user", error);
  }
}

/**
 * Updates the signed-in user's own name and phone: PUT /auth/me (the API's profile endpoint, identified by the
 * JWT) and the Firebase display name when there is a Firebase account. Throws a readable error when the API
 * refuses the change.
 */
export async function updateUserProfile(name: string, phone: string): Promise<StoredUser> {
  const firebaseUserObj = currentFirebaseUser();
  const currentStored = await getUser();
  if (!firebaseUserObj && !currentStored) {
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  const profile = await apiRequest<{ name?: string; phone?: string | null }>(buildApiPath("auth/me"), {
    method: "PUT",
    requiresAuth: true,
    body: { name, phone: phone || null },
  });

  if (firebaseUserObj) {
    await firebaseUserObj.updateProfile({ displayName: profile?.name || name }).catch(error => {
      warnDev("[Auth] Firebase display name not updated", error);
    });
  }

  const updatedUser: StoredUser = {
    ...currentStored,
    id: currentStored?.id ?? firebaseUserObj?.uid,
    email: firebaseUserObj?.email ?? currentStored?.email,
    name: profile?.name || name,
    phoneNumber: profile?.phone ?? phone,
  };
  await saveUser(updatedUser);
  notifyAuthListeners(updatedUser);
  return updatedUser;
}

function configureGoogleAuth() {
  if (googleSigninConfigured) {
    return;
  }

  if (!FIREBASE_WEB_CLIENT_ID?.trim()) {
    throw new GoogleSignInUnavailable("FIREBASE_WEB_CLIENT_ID is missing from .env: Google sign-in can't start.");
  }

  try {
    GoogleSignin.configure({
      webClientId: FIREBASE_WEB_CLIENT_ID.trim(),
      iosClientId: FIREBASE_IOS_CLIENT_ID?.trim() || undefined,
      offlineAccess: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google Sign-In native module is unavailable.";
    throw new GoogleSignInUnavailable(`Google Sign-In is not ready: ${message}`);
  }

  googleSigninConfigured = true;
}

type AuthListener = (user: StoredUser | null) => void;
const authListeners = new Set<AuthListener>();

function notifyAuthListeners(user: StoredUser | null) {
  for (const listener of authListeners) {
    try {
      listener(user);
    } catch (err) {
      warnDev("[Auth] listener failed", err);
    }
  }
}

/** WN_Roles.DisplayName from GET auth/me ("CEO", "Sales Manager"), or undefined when it was not sent. */
function roleDisplayNameOf(profile: { roleDisplayName?: unknown; RoleDisplayName?: unknown }): string | undefined {
  const value = profile.roleDisplayName ?? profile.RoleDisplayName;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Refreshes the stored profile from GET /auth/me: name (WN_Users.Name, shown as it is), role, role display name
 * (WN_Roles.DisplayName) and customer id. Never throws: the app keeps the cached profile when the API can't be
 * reached.
 */
export async function triggerBackgroundSync(currentUser: StoredUser) {
  if (!currentUser.email) return;
  try {
    const profile = await apiRequest<{
      id: string | number | null;
      email: string;
      name: string;
      phone: string;
      role: string;
      roles?: string[] | null;
      roleDisplayName?: string | null;
      RoleDisplayName?: string | null;
      customerCode?: string | number;
      customerId?: string | number;
      CustomerCode?: string | number;
      CustomerId?: string | number;
    }>(buildApiPath("auth/me"), {
      requiresAuth: true,
    });
    if (profile) {
      const activeUser = await getUser();
      if (activeUser && sameAccount(activeUser, currentUser)) {
        const rawCustomerId =
          profile.customerId ??
          profile.customerCode ??
          profile.CustomerId ??
          profile.CustomerCode;
        const customerCode =
          rawCustomerId !== null && rawCustomerId !== undefined && rawCustomerId !== ""
            ? String(rawCustomerId)
            : activeUser.customerCode;

        const updatedUser: StoredUser = {
          ...activeUser,
          id: profile.id ?? activeUser.id,
          name: profile.name || activeUser.name,
          phoneNumber: profile.phone || activeUser.phoneNumber,
          // e.g. "ceo": the highest role the API lists (RootNavigator shows that role's app).
          role: primaryRoleName([...(Array.isArray(profile.roles) ? profile.roles : []), profile.role]) || activeUser.role || "general",
          // The role's name in the database; missing = the app's own label (context/userDisplay.ts).
          roleDisplayName: roleDisplayNameOf(profile),
          customerCode: customerCode,
          customerId: customerCode,
        };
        await saveUser(updatedUser);
        notifyAuthListeners(updatedUser);
      }
    }
  } catch (err) {
    warnDev("[Background Sync] Failed", err);
  }
}

/** Starts the auth/me refresh without waiting for it (name and role display name from the database). */
function refreshProfileInBackground(user: StoredUser): void {
  triggerBackgroundSync(user).catch((err) => {
    warnDev("[Auth] background sync failed", err);
  });
}

// ─── Waiting for the email link ────────────────────────────────────────────────
// A new email account (or one the API answered EMAIL_NOT_VERIFIED for) stays signed in to Firebase, but not to
// WorkNest, until the address is verified: the "Verify your email" screen sends the link again, reloads the
// account and then signs in. Nothing exchanges a token for that account meanwhile.

type PendingVerification = { uid: string; email: string; name?: string; sentAt: number | null };
let pendingVerification: PendingVerification | null = null;
/** The last verification email this app sent (kept across sign-in attempts, for the once-a-minute limit). */
let lastVerificationEmail: { uid: string; at: number } | null = null;

function markVerificationPending(user: FirebaseAuthTypes.User, name?: string, sentAt?: number | null): void {
  const same = pendingVerification?.uid === user.uid ? pendingVerification : null;
  const lastSent = lastVerificationEmail?.uid === user.uid ? lastVerificationEmail.at : null;
  pendingVerification = {
    uid: user.uid,
    email: user.email ?? same?.email ?? "",
    name: name || same?.name || user.displayName || undefined,
    sentAt: sentAt !== undefined && sentAt !== null ? sentAt : same?.sentAt ?? lastSent,
  };
}

/** Sends the Firebase verification email (throws the Firebase error) and remembers when. */
async function sendVerificationEmail(user: FirebaseAuthTypes.User): Promise<number> {
  await user.sendEmailVerification();
  const at = Date.now();
  lastVerificationEmail = { uid: user.uid, at };
  markVerificationPending(user, undefined, at);
  return at;
}

/**
 * Sign-in found an account whose email is not verified (e.g. made before verification was required, which never got
 * the email): send the link now, unless this app sent one in the last minute. Never throws.
 */
async function sendVerificationEmailIfDue(user: FirebaseAuthTypes.User): Promise<void> {
  if (lastVerificationEmail?.uid === user.uid && Date.now() - lastVerificationEmail.at < RESEND_COOLDOWN_MS) return;
  try {
    await sendVerificationEmail(user);
  } catch (error) {
    debugAuth("verification email not sent", { code: errorCode(error) });
  }
}

/** The account waiting for its email link (start-up opens the "Verify your email" screen for it), or null. */
export function getPendingEmailVerification(): { email: string; sentAt: number | null } | null {
  const pending = pendingVerification;
  if (!pending) return null;
  const current = currentFirebaseUser();
  if (!current || current.uid !== pending.uid) return null;
  return { email: pending.email, sentAt: pending.sentAt };
}

/** Start-up / token refresh found an unverified new account: no WorkNest session, keep the Firebase sign-in. */
async function waitForEmailVerification(user: FirebaseAuthTypes.User): Promise<void> {
  markVerificationPending(user);
  await Promise.allSettled([removeToken(), removeUser()]);
  notifyAuthListeners(null);
}

// ─── Why the app signed someone out ────────────────────────────────────────────

/** The API's reason for ending a session (e.g. "Your account is turned off..."), shown once on the Login screen. */
let signOutNotice: string | null = null;

/** Returns and forgets the reason the last session ended, if the API gave one. */
export function takeSignOutNotice(): string | null {
  const notice = signOutNotice;
  signOutNotice = null;
  return notice;
}

// ─── Token exchange ────────────────────────────────────────────────────────────

/** POST auth/google-login with the Firebase ID token. Throws a readable ApiError on any failure. */
async function postTokenExchange(
  user: FirebaseAuthTypes.User,
  options: ExchangeOptions,
  forceRefresh: boolean,
): Promise<ApiSession> {
  let response: { token?: string; id?: string; roles?: string[]; role?: string } | null;
  try {
    const idToken = await getIdToken(user, forceRefresh);
    const displayName = options.name ?? user.displayName ?? "";
    response = await apiRequest<{ token?: string; id?: string; roles?: string[]; role?: string }>(
      buildApiPath("auth/google-login"),
      {
        method: "POST",
        body: {
          // The field the API verifies (GoogleLoginRequest.FirebaseIdToken); idToken is kept for older servers.
          firebaseIdToken: idToken,
          idToken,
          email: user.email,
          name: displayName || undefined,
          // A real button press; start-up and token refreshes send false.
          interactive: options.interactive,
        },
      }
    );
  } catch (err) {
    debugAuth("jwt exchange failed", {
      status: err instanceof ApiError ? err.status : "unknown",
      code: refusalCode(err),
    });
    if (err instanceof ApiError) {
      if (err.status === 0) {
        throw new ApiError("Can't reach WorkNest. Check your internet connection and try again.", 0, err);
      }
      if (isSignInRefused(err)) {
        // Account turned off, email not verified, any other refusal: the API's words (never "Google login
        // failed" for someone who signed in with a password). details keeps the API's answer (and its code).
        throw new ApiError(refusalMessage(err, { viaGoogle: signedInWithGoogle(user) }), err.status, err.details);
      }
      // 429 and server errors are already user-facing.
      throw err;
    }
    throw new ApiError("Couldn't sign you in to WorkNest. Please try again.", 0, err);
  }
  if (!response?.token) {
    debugAuth("jwt exchange failed", { reason: "no token in response" });
    throw new ApiError("Couldn't sign you in to WorkNest. Please try again.", 500);
  }
  const roles = response.roles ?? (response.role ? [response.role] : null);
  debugAuth("jwt exchange success", { roles });
  return { token: response.token, roles };
}

/** Reloads the Firebase account (e.g. after the email link was opened); null when it is no longer signed in. */
async function reloadFirebaseUser(user: FirebaseAuthTypes.User): Promise<FirebaseAuthTypes.User | null> {
  try {
    await user.reload();
  } catch (error) {
    warnDev("[Auth] reloading the account failed", error);
  }
  const current = currentFirebaseUser();
  return current && current.uid === user.uid ? current : null;
}

/**
 * Exchanges the Firebase ID token for the API's JWT (which carries the user's roles).
 * Throws an ApiError with a user-facing message on any failure; callers decide whether that
 * stops a sign-in (login) or keeps the previous session (app start).
 */
async function exchangeFirebaseTokenForJwt(
  user: FirebaseAuthTypes.User,
  options: ExchangeOptions,
): Promise<ApiSession> {
  if (!user.email) {
    throw new ApiError("This account has no email address, so it can't be used with WorkNest.", 400);
  }
  try {
    return await postTokenExchange(user, options, false);
  } catch (error) {
    if (!isEmailNotVerified(error)) throw error;
    // The ID token can be older than the click on the email link: reload the account and, once Firebase says the
    // address is verified, try once more with a new ID token.
    const fresh = await reloadFirebaseUser(user);
    if (!fresh?.emailVerified) throw error;
    return postTokenExchange(fresh, options, true);
  }
}

/** One exchange per account at a time: app start, onIdTokenChanged and a 401 refresh share it. */
let exchangeInFlight: { uid: string; interactive: boolean; promise: Promise<ApiSession> } | null = null;

async function exchangeOnce(user: FirebaseAuthTypes.User, options: ExchangeOptions): Promise<ApiSession> {
  const running = exchangeInFlight;
  if (running && running.uid === user.uid) {
    // A silent exchange shares the running one. A sign-in that sends the typed name (or a button press after a
    // silent one) waits for it first, so two requests never create the same user row at the same time.
    if (!options.name && (!options.interactive || running.interactive)) return running.promise;
    await running.promise.catch(() => undefined);
  }
  const promise = exchangeFirebaseTokenForJwt(user, options);
  const entry = { uid: user.uid, interactive: options.interactive, promise };
  exchangeInFlight = entry;
  const clear = () => {
    if (exchangeInFlight === entry) exchangeInFlight = null;
  };
  promise.then(clear, clear);
  return promise;
}

class ExchangeTimeout extends Error {}

/** Sign-ins started from the Login / Sign-up / Verify email screens that are still running. */
let interactiveSignIns = 0;

async function interactiveSignIn<T>(run: () => Promise<T>): Promise<T> {
  interactiveSignIns += 1;
  try {
    return await run();
  } finally {
    interactiveSignIns -= 1;
  }
}

/**
 * Ends a session the API refused, the same way as a 401 that can't be renewed (notifySessionExpired: sign out of
 * Firebase / Google, clear the stored session, the navigators open Login). Only while that account is still the
 * one signed in to Firebase. The API's reason is shown on the Login screen.
 */
function endRefusedSession(uid: string, reason?: string): void {
  // A sign-in on the Login / Sign-up screen handles its own refusal (signs out, shows the API's message).
  if (interactiveSignIns > 0) return;
  const current = currentFirebaseUser();
  if (!current || current.uid !== uid) return;
  debugAuth("jwt exchange refused, ending the session");
  if (reason) signOutNotice = reason;
  notifySessionExpired();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ExchangeTimeout("timeout")), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Stores a new API token (and role) for the account that is still signed in. */
async function applyApiSession(uid: string, session: ApiSession): Promise<StoredUser | null> {
  const current = currentFirebaseUser();
  if (!current || current.uid !== uid) return null;
  await saveToken(session.token);
  const stored = await getUser();
  const role = primaryRoleName(session.roles);
  if (stored && role && stored.role !== role) {
    const updated = { ...stored, role };
    await saveUser(updated);
    return updated;
  }
  return stored;
}

type PersistOptions = {
  /**
   * Login, sign-up, Google sign-in: if the API token can't be obtained, sign out and throw, so the user never lands
   * in the app without an API token (API calls fail and the role is wrong).
   */
  strict?: boolean;
  /** Start-up / token refresh: the longest wait for the exchange when the cached session can be used meanwhile. */
  timeoutMs?: number;
  /** Strict sign-ins only: errors after which the Firebase sign-in is kept (email not verified, offline...). */
  keepFirebaseOn?: (error: unknown) => boolean;
};

/**
 * Saves the session after Firebase sign-in. Not strict (app start / token refresh): keeps the API token while it
 * is valid for more than an hour (no exchange at all), and otherwise keeps the token of the last successful login
 * when the API can't be reached; a refusal by the API ends the session.
 */
async function persistFirebaseSession(
  user: FirebaseAuthTypes.User,
  displayNameOverride?: string,
  options: PersistOptions = {}
): Promise<{ user: StoredUser; apiToken: string | null }> {
  const firebaseUser = mapFirebaseUser(user);
  if (displayNameOverride) {
    firebaseUser.name = displayNameOverride;
  }
  debugAuth("persist session", { strict: !!options.strict });

  const [existing, cachedToken] = await Promise.all([getUser(), getToken()]);
  // A cached profile of another account must never be merged into this one.
  const previous = sameAccount(existing, firebaseUser) ? existing : null;

  let session: ApiSession | null = null;
  const skipExchange =
    !options.strict &&
    canSkipExchange({ token: cachedToken, firebaseEmail: user.email, cached: previous, now: Date.now() });

  if (skipExchange) {
    debugAuth("api token still valid, exchange skipped");
  } else {
    const exchange = exchangeOnce(user, { name: displayNameOverride, interactive: !!options.strict });
    try {
      // Without a known role the app can't pick the right navigator (staff would briefly get the customer app):
      // then the splash stays until the exchange answers instead of opening with a guess.
      const canOpenEarly = !options.strict && !!options.timeoutMs && !!previous?.role;
      session = canOpenEarly ? await withTimeout(exchange, options.timeoutMs as number) : await exchange;
    } catch (err) {
      if (options.strict) {
        if (isEmailNotVerified(err)) markVerificationPending(user, displayNameOverride);
        if (options.keepFirebaseOn?.(err)) {
          await Promise.allSettled([removeToken(), removeUser()]);
          throw err;
        }
        await Promise.allSettled([
          GoogleSignin.signOut(),
          getFirebaseAuth().signOut(),
          removeToken(),
          removeUser(),
        ]);
        throw err;
      }
      if (isEmailNotVerified(err)) {
        // A WorkNest-password session (staff whose Firebase email isn't verified) stays until its token expires.
        if (!keepsWorkNestPasswordSession(previous, cachedToken, Date.now())) {
          await waitForEmailVerification(user);
          throw err;
        }
      } else if (isSignInRefused(err)) {
        // The API refused this account (turned off): never keep the cached session.
        endRefusedSession(user.uid, err instanceof ApiError ? err.message : undefined);
        throw err;
      } else if (err instanceof ExchangeTimeout) {
        // Slow or offline start: open with the cached session; store the new token once the exchange answers,
        // or end the session if the API refuses it.
        debugAuth("jwt exchange still running, using cached session");
        exchange
          .then(result => applyApiSession(user.uid, result))
          .then(updated => {
            if (updated) notifyAuthListeners(updated);
          })
          .catch(error => {
            if (isEmailNotVerified(error)) {
              waitForEmailVerification(user).catch(() => undefined);
            } else if (isSignInRefused(error)) {
              endRefusedSession(user.uid, error instanceof ApiError ? error.message : undefined);
            }
          });
      }
      // Otherwise (offline, rate limited, server error): keep the API token from the last successful sign-in.
    }
  }

  // Only the API's own JWT is ever stored as the API token; without one the cached token (if any) stays.
  if (session?.token) await saveToken(session.token);

  // The highest role the API listed (e.g. "ceo"), so the right navigator shows even when several are sent.
  const primaryRole = primaryRoleName(session?.roles);
  const mergedUser: StoredUser = {
    ...(previous ?? {}),
    ...firebaseUser,
    // The name auth/me stored (WN_Users.Name) wins over the Firebase display name, which can differ; a new name
    // typed at sign-up wins over both. auth/me refreshes it right after (triggerBackgroundSync).
    name: displayNameOverride || previous?.name || firebaseUser.name,
    phoneNumber: firebaseUser.phoneNumber ?? previous?.phoneNumber,
    role: primaryRole ?? previous?.role ?? firebaseUser.role,
  };
  // A Firebase sign-in that went through the exchange is no longer a WorkNest-password session.
  if (session) delete mergedUser.signInMethod;
  await saveUser(mergedUser);

  return { user: mergedUser, apiToken: session?.token ?? cachedToken };
}

/** Everything this device keeps about the signed-in user: API token, profile, saved door Access Request. */
async function clearLocalSession(): Promise<void> {
  await Promise.allSettled([clearAuthStorage(), clearAllDoorAccess()]);
}

export async function logoutUser(): Promise<void> {
  debugAuth("logout start");
  pendingVerification = null;
  // The API revokes the token it is sent (POST /auth/logout), so read it before anything is cleared.
  // Best effort, at most ~1.5 s, alongside the Google / Firebase sign-out.
  const apiToken = await getToken();
  const tasks: Promise<unknown>[] = [revokeApiToken(apiToken)];

  tasks.push(
    GoogleSignin.revokeAccess().catch((error) => {
      debugAuth("logout revoke access skipped", {
        message: error instanceof Error ? error.message : "unknown",
      });
    })
  );
  tasks.push(GoogleSignin.signOut());

  try {
    tasks.push(getFirebaseAuth().signOut());
  } catch (error) {
    debugAuth("logout skipped firebase signOut", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  await Promise.allSettled(tasks);
  await clearLocalSession();
  debugAuth("logout complete");
}

/**
 * Ends the session after the API refused it (401 that a token refresh could not fix): signs out of
 * Firebase / Google, removes the stored token and user, and tells AuthContext (user becomes null).
 * The navigators listen to the same event (onSessionExpired) and open Login.
 */
export async function endExpiredSession(): Promise<void> {
  debugAuth("session expired");
  pendingVerification = null;
  const tasks: Promise<unknown>[] = [GoogleSignin.signOut()];
  try {
    tasks.push(getFirebaseAuth().signOut());
  } catch {
    // Firebase not available: the stored session is still cleared below.
  }
  await Promise.allSettled(tasks);
  await clearLocalSession();
  notifyAuthListeners(null);
}

/**
 * Renews the API token from the Firebase sign-in after a 401. Null when nobody is signed in to Firebase or
 * the API refuses (account turned off): the session then ends. Throws when the API could not be reached,
 * so a network problem never signs anyone out.
 */
async function refreshApiSession(): Promise<string | null> {
  const current = currentFirebaseUser();
  // A WorkNest-password session has nothing to renew from: it ends and the user signs in again.
  if (!current) return null;
  try {
    const session = await exchangeOnce(current, { interactive: false });
    const updated = await applyApiSession(current.uid, session);
    if (updated) notifyAuthListeners(updated);
    return session.token;
  } catch (error) {
    warnDev("[Auth] session refresh failed", error);
    // 0 = offline / timeout, 429 = rate limited, 5xx = server trouble: not a verdict on the session.
    if (isTemporaryFailure(error)) throw error;
    if (isSignInRefused(error) && error instanceof ApiError) signOutNotice = error.message;
    return null;
  }
}

// One shared mechanism for an expired session (see apiClient): renew once, otherwise sign out everywhere.
setSessionRefresher(refreshApiSession);
onSessionExpired(() => {
  endExpiredSession().catch(error => warnDev("[Auth] ending the expired session failed", error));
});

/** The stored WorkNest-password session (no Firebase account) when it is still valid, otherwise null. */
async function validWorkNestPasswordSession(): Promise<StoredUser | null> {
  const [cached, token] = await Promise.all([getUser(), getToken()]);
  return keepsWorkNestPasswordSession(cached, token, Date.now()) ? cached : null;
}

/**
 * Restores the session at app start. Never waits more than STARTUP_EXCHANGE_TIMEOUT_MS for the API when the
 * cached role is known: offline, the cached user and API token are used and the exchange completes in the
 * background. With a WorkNest token valid for more than an hour there is no exchange at all.
 */
export async function hydrateSessionUser(): Promise<StoredUser | null> {
  let firebaseUser: FirebaseAuthTypes.User | null = null;

  try {
    firebaseUser = getFirebaseAuth().currentUser;
  } catch (error) {
    debugAuth("hydrate session skipped", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return getUser();
  }

  if (!firebaseUser) {
    const passwordSession = await validWorkNestPasswordSession();
    if (passwordSession) {
      debugAuth("hydrate session", { hasUser: true, worknestPassword: true });
      refreshProfileInBackground(passwordSession);
      return passwordSession;
    }
    debugAuth("hydrate session", { hasUser: false });
    await removeToken();
    await removeUser();
    return null;
  }

  debugAuth("hydrate session", { hasUser: true });
  let session: { user: StoredUser; apiToken: string | null };
  try {
    session = await persistFirebaseSession(firebaseUser, undefined, {
      timeoutMs: STARTUP_EXCHANGE_TIMEOUT_MS,
    });
  } catch (error) {
    // Waiting for the email link, or refused by the API (the session is being ended): open signed out.
    if (isEmailNotVerified(error) || isSignInRefused(error)) return null;
    warnDev("[Auth] hydrate failed, using the cached session", error);
    return getUser();
  }

  // Non-blocking refresh of the profile (name, role, customer id).
  refreshProfileInBackground(session.user);

  return session.user;
}

export function subscribeToAuthChanges(
  onChange: (user: StoredUser | null) => void
) {
  authListeners.add(onChange);

  let firebaseUnsubscribe = () => { };
  try {
    firebaseUnsubscribe = getFirebaseAuth().onIdTokenChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        pendingVerification = null;
        // Signed in with the WorkNest password (no Firebase account): that session is not Firebase's to end.
        if (await validWorkNestPasswordSession()) return;
        debugAuth("auth state changed", { signedIn: false });
        await removeToken();
        await removeUser();
        await clearAllDoorAccess();
        notifyAuthListeners(null);
        return;
      }

      // The Login / Sign-up / Verify screen saves and announces the session itself (one exchange, with the
      // typed name): a second one here could create the same user twice or announce the user before the role.
      if (interactiveSignIns > 0) return;
      // Waiting for the email link: there is no WorkNest session to refresh for this account yet.
      if (pendingVerification?.uid === firebaseUser.uid) return;

      debugAuth("auth state changed", { signedIn: true });
      try {
        const session = await persistFirebaseSession(firebaseUser, undefined, {
          timeoutMs: STARTUP_EXCHANGE_TIMEOUT_MS,
        });
        notifyAuthListeners(session.user);

        // Non-blocking refresh of the profile (name, role, customer id).
        refreshProfileInBackground(session.user);
      } catch (err) {
        warnDev("[Auth] token change not saved", err);
      }
    });
  } catch (error) {
    debugAuth("subscribe auth changes skipped", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  return () => {
    authListeners.delete(onChange);
    firebaseUnsubscribe();
  };
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : "unknown";
}

/** After any successful sign-in: tell the app (AuthContext), skip the introduction from now on, refresh auth/me. */
function announceSignedIn(user: StoredUser): void {
  notifyAuthListeners(user);
  setOnboardingCompleted().catch(() => undefined);
  refreshProfileInBackground(user);
}

function toAuthResponse(user: StoredUser, apiToken: string | null, uid: string): AuthResponse {
  return {
    token: apiToken,
    email: typeof user.email === "string" ? user.email : null,
    userId: uid,
    roles: user.role ? [String(user.role)] : null,
  };
}

/** The input checks' own message ("Enter your password.") instead of a generic "Login failed.". */
function inputError(error: unknown): ApiError {
  return new ApiError(error instanceof Error ? error.message : "Check your details and try again.", 400, error);
}

export function loginUser(payload: LoginRequest): Promise<AuthResponse> {
  return interactiveSignIn(() => loginWithPassword(payload));
}

async function loginWithPassword(payload: LoginRequest): Promise<AuthResponse> {
  pendingVerification = null;
  let email: string;
  let password: string;
  try {
    email = sanitizeEmailInput(payload.email);
    // As typed: the sign-up strength rule is never applied to signing in.
    password = sanitizeLoginPasswordInput(payload.password);
  } catch (error) {
    throw inputError(error);
  }

  debugAuth("login request");
  let credential: FirebaseAuthTypes.UserCredential;
  try {
    credential = await getFirebaseAuth().signInWithEmailAndPassword(email, password);
  } catch (firebaseError) {
    debugAuth("login error", { code: errorCode(firebaseError) });
    if (!triesWorkNestPassword(errorCode(firebaseError))) throw mapFirebaseError(firebaseError, "Login failed.");
    // No Firebase account with this password: staff added in the CMS sign in with their WorkNest password.
    return signInWithWorkNestPassword(email, password, firebaseError);
  }

  let session: { user: StoredUser; apiToken: string | null };
  try {
    session = await persistFirebaseSession(credential.user, undefined, {
      strict: true,
      keepFirebaseOn: isEmailNotVerified,
    });
  } catch (error) {
    debugAuth("login error", { code: refusalCode(error) ?? errorCode(error) });
    if (isEmailNotVerified(error)) {
      // A WorkNest password (staff added in the CMS) is proof enough; everyone else verifies the email first.
      const viaPassword = await worknestPasswordSession(email, password).catch(() => null);
      if (viaPassword) {
        pendingVerification = null;
        const user = await saveWorkNestPasswordSession(viaPassword, email);
        announceSignedIn(user);
        return toAuthResponse(user, viaPassword.token, credential.user.uid);
      }
      // Accounts made before verification was required never got the email: send it now (the Verify screen opens).
      await sendVerificationEmailIfDue(credential.user);
    }
    throw mapFirebaseError(error, "Login failed.");
  }
  announceSignedIn(session.user);
  debugAuth("login success");
  return toAuthResponse(session.user, session.apiToken, credential.user.uid);
}

type WorkNestPasswordSession = {
  token: string;
  id?: string | number | null;
  roles: string[] | null;
  roleDisplayName?: string;
  name?: string;
};

/** POST auth/login with the WorkNest password (the CMS's fallback). Throws ApiError when refused. */
async function worknestPasswordSession(email: string, password: string): Promise<WorkNestPasswordSession> {
  const response = await apiRequest<{
    token?: string;
    id?: string | number | null;
    role?: string;
    roles?: string[] | null;
    roleDisplayName?: string | null;
    name?: string | null;
  }>(buildApiPath("auth/login"), { method: "POST", body: { email, password } });
  if (!response?.token) throw new ApiError("Couldn't sign you in to WorkNest. Please try again.", 500);
  const roles = Array.isArray(response.roles) && response.roles.length ? response.roles : response.role ? [response.role] : null;
  return {
    token: response.token,
    id: response.id,
    roles,
    roleDisplayName: roleDisplayNameOf(response),
    name: typeof response.name === "string" && response.name.trim() ? response.name.trim() : undefined,
  };
}

async function saveWorkNestPasswordSession(session: WorkNestPasswordSession, email: string): Promise<StoredUser> {
  await saveToken(session.token);
  const cached = await getUser();
  const previous = cached && sameEmail(cached.email, email) ? cached : null;
  const user: StoredUser = {
    ...(previous ?? {}),
    id: session.id ?? previous?.id ?? email,
    email,
    name: session.name ?? previous?.name,
    role: primaryRoleName(session.roles) ?? previous?.role ?? "general",
    roleDisplayName: session.roleDisplayName ?? previous?.roleDisplayName,
    signInMethod: WORKNEST_PASSWORD_SESSION,
  };
  await saveUser(user);
  return user;
}

/**
 * Staff added in the CMS have a WorkNest password but no Firebase account until they sign in to the CMS once. The
 * API's own password check signs them in; the Firebase account is then created in the background (as the CMS does)
 * so later sign-ins take the normal path.
 */
async function signInWithWorkNestPassword(
  email: string,
  password: string,
  firebaseError: unknown,
): Promise<AuthResponse> {
  let session: WorkNestPasswordSession;
  try {
    session = await worknestPasswordSession(email, password);
  } catch (apiError) {
    // The API's verdict on the account itself (turned off) is the clearer message; otherwise Firebase's.
    if (refusalCode(apiError) === ACCOUNT_DISABLED) throw apiError;
    throw mapFirebaseError(firebaseError, "Login failed.");
  }
  const user = await saveWorkNestPasswordSession(session, email);
  announceSignedIn(user);
  createFirebaseAccountInBackground(email, password);
  debugAuth("login success", { worknestPassword: true });
  return toAuthResponse(user, session.token, String(user.id ?? ""));
}

function createFirebaseAccountInBackground(email: string, password: string): void {
  if (password.length < 6) return;
  try {
    getFirebaseAuth()
      .createUserWithEmailAndPassword(email, password)
      .then(() => debugAuth("firebase account created for the WorkNest password"))
      .catch(error => debugAuth("firebase account not created", { code: errorCode(error) }));
  } catch (error) {
    warnDev("[Auth] Firebase account not created", error);
  }
}

/**
 * Sign-up: creates the Firebase account, saves the typed name and sends the verification email. The app does not
 * sign in to WorkNest yet: the "Verify your email" screen does that once the link was opened.
 */
export function registerUser(payload: RegisterRequest): Promise<SignUpResult> {
  return interactiveSignIn(() => registerWithPassword(payload));
}

async function registerWithPassword(payload: RegisterRequest): Promise<SignUpResult> {
  pendingVerification = null;
  let email: string;
  let password: string;
  let displayName: string;
  try {
    email = sanitizeEmailInput(payload.email);
    // New passwords follow the strength rule (signing in never does).
    password = sanitizePasswordInput(payload.password);
    const firstName = sanitizeOptionalNameInput(payload.firstName);
    const lastName = sanitizeOptionalNameInput(payload.lastName);
    displayName = [firstName, lastName]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .trim();
  } catch (error) {
    throw inputError(error);
  }

  let credential: FirebaseAuthTypes.UserCredential;
  try {
    debugAuth("register request");
    credential = await getFirebaseAuth().createUserWithEmailAndPassword(email, password);
  } catch (error) {
    debugAuth("register error", { code: errorCode(error) });
    throw mapFirebaseError(error, "Registration failed.");
  }

  if (displayName) {
    // Kept on the Firebase account too, so the name survives the app being closed before the link is opened.
    await credential.user.updateProfile({ displayName }).catch(error => warnDev("[Auth] display name not saved", error));
  }
  markVerificationPending(credential.user, displayName || undefined, null);

  let emailSent = false;
  try {
    await sendVerificationEmail(credential.user);
    emailSent = true;
  } catch (error) {
    debugAuth("verification email not sent", { code: errorCode(error) });
  }
  debugAuth("register success, waiting for the email link");
  return { verificationRequired: true, email: credential.user.email ?? email, emailSent };
}

/** Sends the verification link again to the account waiting for it. Returns when it was sent. */
export async function resendVerificationEmail(): Promise<number> {
  const current = currentFirebaseUser();
  if (!current) {
    throw new ApiError("Your sign-up has ended. Please sign in again.", 401);
  }
  try {
    return await sendVerificationEmail(current);
  } catch (error) {
    debugAuth("verification email not sent", { code: errorCode(error) });
    throw mapFirebaseError(error, "We couldn't send the email. Please try again in a moment.");
  }
}

export type VerificationCheck = { verified: false } | { verified: true; user: StoredUser };

/**
 * "I've verified my email": reloads the Firebase account and, once the address is verified, gets a new ID token and
 * signs in to WorkNest (with the name typed at sign-up). { verified: false } while the link was not opened yet.
 * Offline or a server error keeps the Firebase sign-in, so the user can simply try again.
 */
export function completeEmailVerification(): Promise<VerificationCheck> {
  return interactiveSignIn(async () => {
    const current = currentFirebaseUser();
    if (!current) {
      throw new ApiError("Your sign-up has ended. Please sign in again.", 401);
    }
    const fresh = (await reloadFirebaseUser(current)) ?? current;
    if (!fresh.emailVerified) return { verified: false };

    // The new ID token carries the verified address (email_verified), which the API checks.
    await getIdToken(fresh, true).catch(error => warnDev("[Auth] new ID token not fetched", error));
    const typedName = pendingVerification?.uid === fresh.uid ? pendingVerification.name : fresh.displayName ?? undefined;
    let session: { user: StoredUser; apiToken: string | null };
    try {
      session = await persistFirebaseSession(fresh, typedName || undefined, {
        strict: true,
        keepFirebaseOn: error => isEmailNotVerified(error) || isTemporaryFailure(error),
      });
    } catch (error) {
      // Refused for another reason (account turned off): signed out, the Login screen says why.
      if (!isEmailNotVerified(error) && isSignInRefused(error) && error instanceof ApiError) {
        pendingVerification = null;
        signOutNotice = error.message;
      }
      throw error;
    }
    pendingVerification = null;
    await saveSignupName(typedName, session.user);
    announceSignedIn(session.user);
    return { verified: true, user: session.user };
  });
}

/**
 * The name typed at sign-up is saved in WorkNest (PUT auth/me) when the account has no real name yet: an earlier
 * sign-in may have created the row with the API's default (the email prefix). Never throws.
 */
async function saveSignupName(typedName: string | undefined, user: StoredUser): Promise<void> {
  if (!typedName?.trim()) return;
  try {
    const profile = await apiRequest<{ name?: string | null; phone?: string | null; email?: string | null }>(
      buildApiPath("auth/me"),
      { requiresAuth: true },
    );
    if (!needsSignupName(profile?.name, typedName, profile?.email ?? user.email)) return;
    await apiRequest(buildApiPath("auth/me"), {
      method: "PUT",
      requiresAuth: true,
      body: { name: typedName.trim(), phone: profile?.phone || null },
    });
    debugAuth("sign-up name saved");
  } catch (error) {
    warnDev("[Auth] sign-up name not saved", error);
  }
}

/** "Use a different account" on the Verify screen: signs out of Firebase, nothing is kept. */
export async function cancelEmailVerification(): Promise<void> {
  pendingVerification = null;
  const tasks: Promise<unknown>[] = [GoogleSignin.signOut()];
  try {
    tasks.push(getFirebaseAuth().signOut());
  } catch {
    // Firebase not available: the stored session is still cleared below.
  }
  await Promise.allSettled(tasks);
  await clearLocalSession();
}

type GoogleAuthResult = {
  user: StoredUser;
  isNewUser: boolean;
};

export type PendingGoogleAuth = {
  email: string;
  name?: string;
  idToken: string;
};

/**
 * Opens the Google account picker. Throws SignInCancelled when the user closes it (show nothing) and a readable
 * ApiError otherwise (never developer instructions: those go to the log).
 */
export async function beginGoogleAuth(): Promise<PendingGoogleAuth> {
  try {
    configureGoogleAuth();
    debugAuth("google sign-in start");

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const hasCachedGoogleSession = GoogleSignin.hasPreviousSignIn();
    if (hasCachedGoogleSession) {
      debugAuth("google cached session found, revoking before sign-in");
      await GoogleSignin.revokeAccess().catch((revokeError) => {
        debugAuth("google revoke access skipped", {
          message: revokeError instanceof Error ? revokeError.message : "unknown",
        });
      });
      await GoogleSignin.signOut();
    }

    // Allow the Android Activity to fully resume before launching the sign-in intent
    await new Promise<void>(resolve => setTimeout(resolve, 300));

    const signInResult = await GoogleSignin.signIn();
    if (isCancelledResponse(signInResult)) {
      debugAuth("google sign-in cancelled");
      throw new SignInCancelled();
    }

    if (!isSuccessResponse(signInResult)) {
      debugAuth("google sign-in incomplete");
      throw new Error("Google sign-in did not complete. Please try again.");
    }

    const googleTokens = await GoogleSignin.getTokens();
    const googleIdToken = signInResult.data.idToken ?? googleTokens.idToken;
    if (!googleIdToken) {
      throw new GoogleSignInUnavailable("Google Sign-In returned no ID token (check the web client id).");
    }

    debugAuth("google account selected");

    return {
      email: signInResult.data.user.email,
      name: signInResult.data.user.name ?? undefined,
      idToken: googleIdToken,
    };
  } catch (error) {
    debugAuth("google sign-in error", { code: errorCode(error) });
    throw mapGoogleSigninError(error);
  }
}

function completeGoogleAuth(idToken: string): Promise<GoogleAuthResult> {
  return interactiveSignIn(() => signInWithGoogleCredential(idToken));
}

async function signInWithGoogleCredential(idToken: string): Promise<GoogleAuthResult> {
  pendingVerification = null;
  let credentialResult: FirebaseAuthTypes.UserCredential;
  try {
    const googleCredential = GoogleAuthProvider.credential(idToken);
    credentialResult = await getFirebaseAuth().signInWithCredential(googleCredential);
  } catch (error) {
    debugAuth("google firebase sign-in error", { code: errorCode(error) });
    throw mapFirebaseError(error, "Google sign-in didn't work. Please try again.");
  }
  debugAuth("google sign-in success", {
    isNewUser: credentialResult.additionalUserInfo?.isNewUser ?? false,
  });
  const session = await persistFirebaseSession(credentialResult.user, undefined, { strict: true });
  announceSignedIn(session.user);
  return {
    user: session.user,
    isNewUser: credentialResult.additionalUserInfo?.isNewUser ?? false,
  };
}

export async function cancelGoogleAuth(): Promise<void> {
  await Promise.allSettled([
    GoogleSignin.signOut(),
    GoogleSignin.revokeAccess(),
  ]);
}

export async function signInWithGoogle(): Promise<StoredUser> {
  const pending = await beginGoogleAuth();
  const result = await completeGoogleAuth(pending.idToken);
  return result.user;
}

async function rejectExistingGoogleAccount(): Promise<never> {
  await Promise.allSettled([
    GoogleSignin.signOut(),
    getFirebaseAuth().signOut(),
    removeToken(),
    removeUser(),
  ]);
  notifyAuthListeners(null);
  throw new ApiError("This Google account already exists. Please log in instead.", 400);
}

export async function signUpWithGoogle(): Promise<StoredUser> {
  const pending = await beginGoogleAuth();
  const result = await completeGoogleAuth(pending.idToken);
  if (!result.isNewUser) return rejectExistingGoogleAccount();
  return result.user;
}

export async function confirmGoogleLogin(idToken: string): Promise<StoredUser> {
  const result = await completeGoogleAuth(idToken);
  return result.user;
}

export async function confirmGoogleSignup(idToken: string): Promise<StoredUser> {
  const result = await completeGoogleAuth(idToken);
  if (!result.isNewUser) return rejectExistingGoogleAccount();
  return result.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  let sanitizedEmail: string;
  try {
    sanitizedEmail = sanitizeEmailInput(email);
  } catch (error) {
    throw inputError(error);
  }
  try {
    debugAuth("password reset request");
    await getFirebaseAuth().sendPasswordResetEmail(sanitizedEmail);
    debugAuth("password reset sent");
  } catch (error) {
    debugAuth("password reset error", { code: errorCode(error) });
    if (errorCode(error) === "auth/user-not-found") {
      throw new ApiError("No account exists for that email address.", 400, error);
    }
    throw mapFirebaseError(error, "Unable to send password reset email.");
  }
}

function mapFirebaseError(error: unknown, fallbackMessage: string): ApiError {
  if (error instanceof ApiError) return error;
  const code = errorCode(error);

  const messageByCode: Record<string, string> = {
    "auth/email-already-in-use": "That email address is already in use.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/user-not-found": "The email or password is incorrect.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-login-credentials": "The email or password is incorrect.",
    "auth/user-disabled": "Your account is turned off. Please contact WorkNest.",
    "auth/too-many-requests": "Too many attempts. Please try again in a moment.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/missing-email": "Email is required.",
    "auth/account-exists-with-different-credential":
      "This email is already used with another sign-in method. Sign in with your email and password.",
  };

  return new ApiError(messageByCode[code] ?? fallbackMessage, 400, error);
}

function mapGoogleSigninError(error: unknown): Error {
  if (error instanceof ApiError || error instanceof SignInCancelled) return error;
  const kind = googleErrorKind(error, statusCodes);
  if (kind === "cancelled") return new SignInCancelled();
  if (kind === "unavailable") {
    // For the developer (logcat / Metro): what to fix. The user only sees a plain message.
    const detail =
      error instanceof GoogleSignInUnavailable
        ? error.detail
        : `Google Sign-In is not configured for this build (code ${errorCode(error)}): add this build's SHA fingerprint in Firebase and download the updated google-services.json.`;
    console.warn(`[Google Sign-In] ${detail}`);
  }
  return new ApiError(googleErrorMessage(kind, error), 400, error);
}
