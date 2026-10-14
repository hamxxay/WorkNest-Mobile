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
  sanitizeOptionalNameInput,
  sanitizePasswordInput,
} from "../utils/inputSanitizer";

// How sign-in works: Firebase owns passwords and Google sign-in. The WorkNest API verifies the Firebase ID
// token (sent as `firebaseIdToken`) and returns its own JWT with the user's role; every API call sends that JWT.
// The Firebase ID token itself is never used as the API token.

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

type ApiSession = { token: string; roles: string[] | null };

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

function sameAccount(a: StoredUser | null | undefined, b: StoredUser | null | undefined): boolean {
  const ea = typeof a?.email === "string" ? a.email.trim().toLowerCase() : "";
  const eb = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
  return !!ea && ea === eb;
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
 * Updates the signed-in user's own name and phone: Firebase display name + PUT /auth/me (the API's
 * profile endpoint, identified by the JWT). Throws a readable error when the API refuses the change.
 */
export async function updateUserProfile(name: string, phone: string): Promise<StoredUser> {
  const firebaseUserObj = getFirebaseAuth().currentUser;
  if (!firebaseUserObj) {
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  const profile = await apiRequest<{ name?: string; phone?: string | null }>(buildApiPath("auth/me"), {
    method: "PUT",
    requiresAuth: true,
    body: { name, phone: phone || null },
  });

  await firebaseUserObj.updateProfile({ displayName: profile?.name || name }).catch(error => {
    warnDev("[Auth] Firebase display name not updated", error);
  });

  const currentStored = await getUser();
  const updatedUser: StoredUser = {
    ...currentStored,
    id: currentStored?.id ?? firebaseUserObj.uid,
    email: firebaseUserObj.email ?? currentStored?.email,
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
    throw new Error("Missing FIREBASE_WEB_CLIENT_ID. Add it to your environment before using Google login.");
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
    throw new Error(`Google Sign-In is not ready: ${message}`);
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

/**
 * Refreshes the stored profile from GET /auth/me (name, role, customer id). Never throws: the app keeps the
 * cached profile when the API can't be reached.
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

/**
 * Exchanges the Firebase ID token for the API's JWT (which carries the user's roles).
 * Throws an ApiError with a user-facing message on any failure; callers decide whether that
 * stops a sign-in (login) or keeps the previous session (app start).
 */
async function exchangeFirebaseTokenForJwt(
  user: FirebaseAuthTypes.User,
  displayNameOverride?: string
): Promise<ApiSession> {
  if (!user.email) {
    throw new ApiError("This account has no email address, so it can't be used with WorkNest.", 400);
  }
  let response: { token?: string; id?: string; roles?: string[]; role?: string } | null;
  try {
    const idToken = await getIdToken(user);
    const displayName = displayNameOverride ?? user.displayName ?? "";
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
        },
      }
    );
  } catch (err) {
    debugAuth("jwt exchange failed", {
      status: err instanceof ApiError ? err.status : "unknown",
    });
    if (err instanceof ApiError) {
      if (err.status === 0) {
        throw new ApiError("Can't reach WorkNest. Check your internet connection and try again.", 0, err);
      }
      // 429 and API messages (e.g. account disabled) are already user-facing.
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

/** One exchange per account at a time: app start, onIdTokenChanged and a 401 refresh share it. */
let exchangeInFlight: { uid: string; promise: Promise<ApiSession> } | null = null;

function exchangeOnce(user: FirebaseAuthTypes.User, displayNameOverride?: string): Promise<ApiSession> {
  if (!displayNameOverride && exchangeInFlight && exchangeInFlight.uid === user.uid) {
    return exchangeInFlight.promise;
  }
  const promise = exchangeFirebaseTokenForJwt(user, displayNameOverride);
  const entry = { uid: user.uid, promise };
  exchangeInFlight = entry;
  const clear = () => {
    if (exchangeInFlight === entry) exchangeInFlight = null;
  };
  promise.then(clear, clear);
  return promise;
}

class ExchangeTimeout extends Error {}

/** Sign-ins started from the Login / Sign-up screens that are still running (strict persistFirebaseSession). */
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
 * The API refused the sign-in itself (401 / 403 from auth/google-login: account turned off, sign-in not
 * verified): a verdict on the session, unlike being offline (0), rate limited (429) or a server error (5xx).
 */
function isSignInRefused(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/**
 * Ends a session the API refused, the same way as a 401 that can't be renewed (notifySessionExpired: sign out of
 * Firebase / Google, clear the stored session, the navigators open Login). Only while that account is still the
 * one signed in to Firebase.
 */
function endRefusedSession(uid: string): void {
  // A sign-in on the Login / Sign-up screen handles its own refusal (signs out, shows the API's message).
  if (interactiveSignIns > 0) return;
  let current: FirebaseAuthTypes.User | null = null;
  try {
    current = getFirebaseAuth().currentUser;
  } catch {
    return;
  }
  if (!current || current.uid !== uid) return;
  debugAuth("jwt exchange refused, ending the session");
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
  let current: FirebaseAuthTypes.User | null = null;
  try {
    current = getFirebaseAuth().currentUser;
  } catch {
    return null;
  }
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

/**
 * Saves the session after Firebase sign-in. `strict` (login, sign-up, Google sign-in): if the API
 * token can't be obtained, sign out and throw, so the user never lands in the app without an API token
 * (API calls fail and the role is wrong). Not strict (app start / token refresh): keep the API token from
 * the last successful login, e.g. when offline at startup; `timeoutMs` caps how long that may take.
 */
async function persistFirebaseSession(
  user: FirebaseAuthTypes.User,
  displayNameOverride?: string,
  options: { strict?: boolean; timeoutMs?: number } = {}
): Promise<{ user: StoredUser; apiToken: string | null }> {
  const firebaseUser = mapFirebaseUser(user);
  if (displayNameOverride) {
    firebaseUser.name = displayNameOverride;
  }
  debugAuth("persist session", { strict: !!options.strict });

  let session: ApiSession | null = null;
  const exchange = exchangeOnce(user, displayNameOverride);
  try {
    session = options.timeoutMs && !options.strict
      ? await withTimeout(exchange, options.timeoutMs)
      : await exchange;
  } catch (err) {
    if (options.strict) {
      await Promise.allSettled([
        GoogleSignin.signOut(),
        getFirebaseAuth().signOut(),
        removeToken(),
        removeUser(),
      ]);
      throw err;
    }
    if (isSignInRefused(err)) {
      // The API refused this account (turned off, sign-in not verified): never keep the cached session.
      endRefusedSession(user.uid);
      throw err;
    }
    if (err instanceof ExchangeTimeout) {
      // Slow or offline start: open with the cached session; store the new token once the exchange answers,
      // or end the session if the API refuses it.
      debugAuth("jwt exchange still running, using cached session");
      exchange
        .then(result => applyApiSession(user.uid, result))
        .then(updated => {
          if (updated) notifyAuthListeners(updated);
        })
        .catch(error => {
          if (isSignInRefused(error)) endRefusedSession(user.uid);
        });
    }
    // Otherwise (offline, rate limited, server error): keep the API token from the last successful sign-in.
  }

  // Only the API's own JWT is ever stored as the API token; without one the cached token (if any) stays.
  if (session?.token) await saveToken(session.token);

  const existing = await getUser();
  // A cached profile of another account must never be merged into this one.
  const previous = sameAccount(existing, firebaseUser) ? existing : null;
  // The highest role the API listed (e.g. "ceo"), so the right navigator shows even when several are sent.
  const primaryRole = primaryRoleName(session?.roles);
  const mergedUser: StoredUser = {
    ...(previous ?? {}),
    ...firebaseUser,
    name: firebaseUser.name ?? previous?.name,
    phoneNumber: firebaseUser.phoneNumber ?? previous?.phoneNumber,
    role: primaryRole ?? previous?.role ?? firebaseUser.role,
  };
  await saveUser(mergedUser);

  return { user: mergedUser, apiToken: session?.token ?? (await getToken()) };
}

/** Everything this device keeps about the signed-in user: API token, profile, saved door Access Request. */
async function clearLocalSession(): Promise<void> {
  await Promise.allSettled([clearAuthStorage(), clearAllDoorAccess()]);
}

export async function logoutUser(): Promise<void> {
  debugAuth("logout start");
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
  let current: FirebaseAuthTypes.User | null = null;
  try {
    current = getFirebaseAuth().currentUser;
  } catch {
    return null;
  }
  if (!current) return null;
  try {
    const session = await exchangeOnce(current);
    const updated = await applyApiSession(current.uid, session);
    if (updated) notifyAuthListeners(updated);
    return session.token;
  } catch (error) {
    warnDev("[Auth] session refresh failed", error);
    const status = error instanceof ApiError ? error.status : 0;
    // 0 = offline / timeout, 429 = rate limited, 5xx = server trouble: not a verdict on the session.
    if (status === 0 || status === 429 || status >= 500) throw error;
    return null;
  }
}

// One shared mechanism for an expired session (see apiClient): renew once, otherwise sign out everywhere.
setSessionRefresher(refreshApiSession);
onSessionExpired(() => {
  endExpiredSession().catch(error => warnDev("[Auth] ending the expired session failed", error));
});

/**
 * Restores the session at app start. Never waits more than STARTUP_EXCHANGE_TIMEOUT_MS for the API:
 * offline, the cached user and API token are used and the exchange completes in the background.
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
    // Refused by the API: the session is being ended (endRefusedSession), so open signed out.
    if (isSignInRefused(error)) return null;
    warnDev("[Auth] hydrate failed, using the cached session", error);
    return getUser();
  }

  // Non-blocking refresh of the profile (name, role, customer id).
  triggerBackgroundSync(session.user).catch((err) => {
    warnDev("[Auth] background sync failed", err);
  });

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
        debugAuth("auth state changed", { signedIn: false });
        await removeToken();
        await removeUser();
        await clearAllDoorAccess();
        notifyAuthListeners(null);
        return;
      }

      debugAuth("auth state changed", { signedIn: true });
      try {
        const session = await persistFirebaseSession(firebaseUser, undefined, {
          timeoutMs: STARTUP_EXCHANGE_TIMEOUT_MS,
        });
        notifyAuthListeners(session.user);

        // Non-blocking refresh of the profile (name, role, customer id).
        triggerBackgroundSync(session.user).catch((err) => {
          warnDev("[Auth] background sync failed", err);
        });
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

export function loginUser(payload: LoginRequest): Promise<AuthResponse> {
  return interactiveSignIn(() => loginWithPassword(payload));
}

async function loginWithPassword(payload: LoginRequest): Promise<AuthResponse> {
  try {
    const email = sanitizeEmailInput(payload.email);
    const password = sanitizePasswordInput(payload.password);
    debugAuth("login request");
    const credential = await getFirebaseAuth().signInWithEmailAndPassword(
      email,
      password
    );
    const session = await persistFirebaseSession(credential.user, undefined, { strict: true });
    debugAuth("login success");
    return {
      token: session.apiToken,
      email: credential.user.email ?? null,
      userId: credential.user.uid,
      roles: session.user.role ? [String(session.user.role)] : null,
    };
  } catch (error) {
    debugAuth("login error", { code: errorCode(error) });
    throw mapFirebaseError(error, "Login failed.");
  }
}

export function registerUser(payload: RegisterRequest): Promise<AuthResponse> {
  return interactiveSignIn(() => registerWithPassword(payload));
}

async function registerWithPassword(payload: RegisterRequest): Promise<AuthResponse> {
  try {
    const email = sanitizeEmailInput(payload.email);
    const password = sanitizePasswordInput(payload.password);
    const firstName = sanitizeOptionalNameInput(payload.firstName);
    const lastName = sanitizeOptionalNameInput(payload.lastName);
    debugAuth("register request");
    const credential = await getFirebaseAuth().createUserWithEmailAndPassword(
      email,
      password
    );

    const displayName = [firstName, lastName]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .trim();

    if (displayName) {
      await credential.user.updateProfile({ displayName });
      debugAuth("register profile updated");
    }

    const session = await persistFirebaseSession(credential.user, displayName, { strict: true });
    debugAuth("register success");
    return {
      token: session.apiToken,
      email: credential.user.email ?? null,
      userId: credential.user.uid,
      roles: session.user.role ? [String(session.user.role)] : null,
    };
  } catch (error) {
    debugAuth("register error", { code: errorCode(error) });
    throw mapFirebaseError(error, "Registration failed.");
  }
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
      throw new Error("Google sign-in was cancelled.");
    }

    if (!isSuccessResponse(signInResult)) {
      debugAuth("google sign-in incomplete");
      throw new Error("Google sign-in did not complete successfully.");
    }

    const googleTokens = await GoogleSignin.getTokens();
    const googleIdToken = signInResult.data.idToken ?? googleTokens.idToken;
    if (!googleIdToken) {
      throw new Error("Google Sign-In did not return an ID token.");
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
  const googleCredential = GoogleAuthProvider.credential(idToken);
  const credentialResult = await getFirebaseAuth().signInWithCredential(googleCredential);
  debugAuth("google sign-in success", {
    isNewUser: credentialResult.additionalUserInfo?.isNewUser ?? false,
  });
  const session = await persistFirebaseSession(credentialResult.user, undefined, { strict: true });
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
  try {
    const sanitizedEmail = sanitizeEmailInput(email);
    debugAuth("password reset request");
    await getFirebaseAuth().sendPasswordResetEmail(sanitizedEmail);
    debugAuth("password reset sent");
  } catch (error) {
    debugAuth("password reset error", { code: errorCode(error) });
    throw mapFirebaseError(error, "Unable to send password reset email.");
  }
}

function mapFirebaseError(error: unknown, fallbackMessage: string): ApiError {
  if (error instanceof ApiError) return error;
  const code = errorCode(error);

  const messageByCode: Record<string, string> = {
    "auth/email-already-in-use": "That email address is already in use.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/user-not-found": "No account exists for that email address.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please try again in a moment.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/missing-email": "Email is required.",
  };

  return new ApiError(messageByCode[code] ?? fallbackMessage, 400, error);
}

function mapGoogleSigninError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const code = errorCode(error);

  const messageByCode: Record<string, string> = {
    [statusCodes.SIGN_IN_CANCELLED]: "Google sign-in was cancelled.",
    [statusCodes.IN_PROGRESS]: "Google sign-in is already in progress.",
    [statusCodes.PLAY_SERVICES_NOT_AVAILABLE]:
      "Google Play Services is unavailable or needs an update on this device.",
    "10":
      "Google sign-in is not configured for this Android build. Add this app's release SHA fingerprint in Firebase, then download the updated google-services.json.",
    "DEVELOPER_ERROR":
      "Google sign-in is not configured for this Android build. Add this app's release SHA fingerprint in Firebase, then download the updated google-services.json.",
  };

  return new ApiError(
    messageByCode[code] ?? (error instanceof Error ? error.message : "Google sign-in failed."),
    400,
    error
  );
}
