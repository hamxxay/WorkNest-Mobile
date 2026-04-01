import {
  default as auth,
  FirebaseAuthTypes,
  GoogleAuthProvider,
} from "@react-native-firebase/auth";
import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { FIREBASE_IOS_CLIENT_ID, FIREBASE_WEB_CLIENT_ID } from "@env";
import { clearDeviceCache, removeToken, removeUser, saveToken, saveUser } from "../utils/authStorage";
import { ApiError } from "./apiClient";
import type { AuthResponse, LoginRequest, RegisterRequest } from "./api/types";
import type { StoredUser } from "../utils/authStorage";

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

function maskEmail(email?: string | null): string | null {
  if (!email) {
    return null;
  }

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return email;
  }

  const visible = localPart.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(localPart.length - visible.length, 0))}@${domain}`;
}

function debugAuth(label: string, details?: Record<string, unknown>) {
  if (!__DEV__) {
    return;
  }

  if (details) {
    console.log(`[Firebase Auth] ${label}`, details);
    return;
  }

  console.log(`[Firebase Auth] ${label}`);
}

function mapFirebaseUser(user: FirebaseAuthTypes.User): StoredUser {
  return {
    id: user.uid,
    name: user.displayName ?? undefined,
    email: user.email ?? undefined,
  };
}

function mapFirebaseAuthResponse(
  user: FirebaseAuthTypes.User,
  idToken: string
): AuthResponse {
  return {
    token: idToken,
    email: user.email ?? null,
    userId: user.uid,
    roles: null,
  };
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

async function persistFirebaseSession(
  user: FirebaseAuthTypes.User
): Promise<{ user: StoredUser; idToken: string }> {
  const firebaseUser = mapFirebaseUser(user);
  const idToken = await user.getIdToken();
  debugAuth("persist session", {
    uid: user.uid,
    email: maskEmail(user.email),
    displayName: user.displayName ?? null,
    tokenLength: idToken.length,
    idToken: idToken.slice(0, 10) + "..." + idToken.slice(-10), // Log only the beginning and end of the token for debuggings
  });
  await saveToken(idToken);
  await saveUser(firebaseUser);
  return { user: firebaseUser, idToken };
}

export async function logoutUser(): Promise<void> {
  debugAuth("logout start");
  const tasks: Promise<unknown>[] = [];

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
  await clearDeviceCache();
  debugAuth("logout complete");
}

export async function hydrateSessionUser(): Promise<StoredUser | null> {
  let firebaseUser: FirebaseAuthTypes.User | null = null;

  try {
    firebaseUser = getFirebaseAuth().currentUser;
  } catch (error) {
    debugAuth("hydrate session skipped", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }

  if (!firebaseUser) {
    debugAuth("hydrate session", { hasUser: false });
    await removeToken();
    await removeUser();
    return null;
  }

  debugAuth("hydrate session", {
    hasUser: true,
    uid: firebaseUser.uid,
    email: maskEmail(firebaseUser.email),
  });
  const session = await persistFirebaseSession(firebaseUser);
  return session.user;
}

export function subscribeToAuthChanges(
  onChange: (user: StoredUser | null) => void
) {
  try {
    return getFirebaseAuth().onIdTokenChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        debugAuth("auth state changed", { signedIn: false });
        await removeToken();
        await removeUser();
        onChange(null);
        return;
      }

      debugAuth("auth state changed", {
        signedIn: true,
        uid: firebaseUser.uid,
        email: maskEmail(firebaseUser.email),
      });
      const session = await persistFirebaseSession(firebaseUser);
      onChange(session.user);
    });
  } catch (error) {
    debugAuth("subscribe auth changes skipped", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return () => {};
  }
}

export async function loginUser(payload: LoginRequest): Promise<AuthResponse> {
  try {
    debugAuth("login request", {
      email: maskEmail(payload.email.trim()),
      passwordLength: payload.password.length,
    });
    const credential = await getFirebaseAuth().signInWithEmailAndPassword(
      payload.email.trim(),
      payload.password
    );
    const session = await persistFirebaseSession(credential.user);
    debugAuth("login success", {
      uid: credential.user.uid,
      email: maskEmail(credential.user.email),
      isAnonymous: credential.user.isAnonymous,
    });
    return mapFirebaseAuthResponse(credential.user, session.idToken);
  } catch (error) {
    debugAuth("login error", {
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : "unknown",
    });
    throw mapFirebaseError(error, "Login failed.");
  }
}

export async function registerUser(payload: RegisterRequest): Promise<AuthResponse> {
  try {
    debugAuth("register request", {
      email: maskEmail(payload.email.trim()),
      passwordLength: payload.password.length,
      hasFirstName: Boolean(payload.firstName?.trim()),
      hasLastName: Boolean(payload.lastName?.trim()),
    });
    const credential = await getFirebaseAuth().createUserWithEmailAndPassword(
      payload.email.trim(),
      payload.password
    );

    const displayName = [payload.firstName, payload.lastName]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .trim();

    if (displayName) {
      await credential.user.updateProfile({ displayName });
      debugAuth("register profile updated", {
        uid: credential.user.uid,
        displayName,
      });
    }

    const session = await persistFirebaseSession(credential.user);
    debugAuth("register success", {
      uid: credential.user.uid,
      email: maskEmail(credential.user.email),
    });
    return mapFirebaseAuthResponse(credential.user, session.idToken);
  } catch (error) {
    debugAuth("register error", {
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : "unknown",
    });
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

    debugAuth("google account selected", {
      email: maskEmail(signInResult.data.user.email),
      idTokenLength: googleIdToken.length,
    });

    return {
      email: signInResult.data.user.email,
      name: signInResult.data.user.name ?? undefined,
      idToken: googleIdToken,
    };
  } catch (error) {
    debugAuth("google sign-in error", {
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : "unknown",
      message: error instanceof Error ? error.message : "unknown",
    });
    throw mapGoogleSigninError(error);
  }
}

async function completeGoogleAuth(idToken: string): Promise<GoogleAuthResult> {
  const googleCredential = GoogleAuthProvider.credential(idToken);
  const credentialResult = await getFirebaseAuth().signInWithCredential(googleCredential);
  debugAuth("google sign-in success", {
    uid: credentialResult.user.uid,
    email: maskEmail(credentialResult.user.email),
    displayName: credentialResult.user.displayName ?? null,
    isNewUser: credentialResult.additionalUserInfo?.isNewUser ?? false,
  });
  const session = await persistFirebaseSession(credentialResult.user);
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

export async function signUpWithGoogle(): Promise<StoredUser> {
  const pending = await beginGoogleAuth();
  const result = await completeGoogleAuth(pending.idToken);

  if (!result.isNewUser) {
    await Promise.allSettled([
      GoogleSignin.signOut(),
      getFirebaseAuth().signOut(),
      removeToken(),
      removeUser(),
    ]);
    throw new ApiError("This Google account already exists. Please log in instead.", 400);
  }

  return result.user;
}

export async function confirmGoogleLogin(idToken: string): Promise<StoredUser> {
  const result = await completeGoogleAuth(idToken);
  return result.user;
}

export async function confirmGoogleSignup(idToken: string): Promise<StoredUser> {
  const result = await completeGoogleAuth(idToken);

  if (!result.isNewUser) {
    await Promise.allSettled([
      GoogleSignin.signOut(),
      getFirebaseAuth().signOut(),
      removeToken(),
      removeUser(),
    ]);
    throw new ApiError("This Google account already exists. Please log in instead.", 400);
  }

  return result.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  try {
    debugAuth("password reset request", {
      email: maskEmail(email.trim()),
    });
    await getFirebaseAuth().sendPasswordResetEmail(email.trim());
    debugAuth("password reset sent", {
      email: maskEmail(email.trim()),
    });
  } catch (error) {
    debugAuth("password reset error", {
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : "unknown",
    });
    throw mapFirebaseError(error, "Unable to send password reset email.");
  }
}

function mapFirebaseError(error: unknown, fallbackMessage: string): ApiError {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

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
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

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
