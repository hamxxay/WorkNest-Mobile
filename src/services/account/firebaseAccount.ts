import {
  default as auth,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { beginGoogleAuth } from "../authService";
import { ApiError } from "../apiClient";

// The signed-in person's Firebase sign-in, for the Profile screen: which ways they sign in (email + password and / or
// Google), confirming who they are again (Firebase asks for a recent sign-in before a password change or a deletion),
// changing the password and deleting the Firebase user after the WorkNest account was deleted.

export type SignInMethods = {
  /** Signs in with email + password: can change the password here. */
  password: boolean;
  /** Signs in with Google. */
  google: boolean;
  /** Somebody is signed in to Firebase at all. */
  signedIn: boolean;
};

const NOBODY: SignInMethods = { password: false, google: false, signedIn: false };

function currentUser(): FirebaseAuthTypes.User | null {
  try {
    return auth().currentUser;
  } catch {
    return null;
  }
}

/** The sign-in methods of a Firebase user (pure: providerData only). */
export function signInMethodsOf(user: Pick<FirebaseAuthTypes.User, "providerData"> | null | undefined): SignInMethods {
  if (!user) return NOBODY;
  const ids = (user.providerData ?? []).map((p) => p?.providerId);
  return { password: ids.includes("password"), google: ids.includes("google.com"), signedIn: true };
}

/** The sign-in methods of whoever is signed in now. */
export function currentSignInMethods(): SignInMethods {
  return signInMethodsOf(currentUser());
}

/** Plain messages for the Firebase errors these actions can hit. */
const MESSAGES: Record<string, string> = {
  "auth/wrong-password": "Your current password is not correct.",
  "auth/invalid-credential": "Your current password is not correct.",
  "auth/invalid-login-credentials": "Your current password is not correct.",
  "auth/weak-password": "That password is too weak. Use at least 8 characters with letters and numbers.",
  "auth/requires-recent-login": "For your security, please confirm your password (or Google account) again and retry.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/user-mismatch": "Choose the same Google account you signed in with.",
  "auth/user-not-found": "This sign-in no longer exists. Please sign in again.",
  "auth/user-disabled": "This sign-in has been switched off. Please contact WorkNest.",
  "auth/no-current-user": "You are signed out. Please sign in again.",
};

function codeOf(error: unknown): string {
  if (error && typeof error === "object") {
    const c = (error as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return "";
}

/** A readable message for a failed Firebase action (the fallback when the code is unknown). */
export function firebaseAccountMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return MESSAGES[codeOf(error)] ?? fallback;
}

/** True when Firebase refused because the sign-in is too old (the user must confirm who they are again). */
export function needsRecentLogin(error: unknown): boolean {
  return codeOf(error) === "auth/requires-recent-login";
}

function requireUser(): FirebaseAuthTypes.User {
  const user = currentUser();
  if (!user) throw new ApiError(MESSAGES["auth/no-current-user"], 401);
  return user;
}

/** Confirms who this is with their current password (email + password accounts). */
export async function reauthenticateWithPassword(password: string): Promise<void> {
  const user = requireUser();
  if (!user.email) throw new ApiError("This account has no email to confirm.", 400);
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } catch (error) {
    throw new ApiError(firebaseAccountMessage(error, "Your password could not be checked. Please try again."), 400, error);
  }
}

/** Confirms who this is by choosing their Google account again (Google accounts). */
export async function reauthenticateWithGoogle(): Promise<void> {
  const user = requireUser();
  const pending = await beginGoogleAuth(); // readable ApiError when cancelled or not available
  try {
    await reauthenticateWithCredential(user, GoogleAuthProvider.credential(pending.idToken));
  } catch (error) {
    throw new ApiError(firebaseAccountMessage(error, "Your Google account could not be confirmed. Please try again."), 400, error);
  }
}

/** Checks the current password, then sets the new one (Firebase owns passwords; the API never sees them). */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await reauthenticateWithPassword(currentPassword);
  try {
    await updatePassword(requireUser(), newPassword);
  } catch (error) {
    throw new ApiError(firebaseAccountMessage(error, "Your password could not be changed. Please try again."), 400, error);
  }
}

/**
 * Deletes the Firebase sign-in of whoever is signed in (after the WorkNest account was deleted). Resolves true when
 * it is gone (or nobody was signed in), false when Firebase refused: the caller still signs out.
 */
export async function deleteFirebaseUser(): Promise<boolean> {
  const user = currentUser();
  if (!user) return true;
  try {
    await deleteUser(user);
    return true;
  } catch (error) {
    if (__DEV__) console.warn("[Account] Firebase user could not be deleted", codeOf(error));
    return false;
  }
}
