// The Firebase side of Profile > Change password / Delete account: which sign-in methods a user has (password vs
// Google-only), plain error messages, confirming the current password before a change, and deleting the sign-in.

const mockUser = {
  email: "aadil@example.com",
  providerData: [{ providerId: "password" }],
};
const mockFirebase: { currentUser: typeof mockUser | null } = { currentUser: mockUser };
const mockReauth = jest.fn();
const mockUpdatePassword = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  default: () => mockFirebase,
  EmailAuthProvider: { credential: jest.fn((email: string, password: string) => ({ email, password })) },
  GoogleAuthProvider: { credential: jest.fn((idToken: string) => ({ idToken })) },
  reauthenticateWithCredential: (...args: unknown[]) => mockReauth(...args),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
}));
jest.mock("../../authService", () => ({ beginGoogleAuth: jest.fn(async () => ({ email: "aadil@example.com", idToken: "google-id" })) }));
jest.mock("../../../config/api", () => ({ API_BASE_URL: "https://api.test/api", API_ENDPOINTS: { auth: { logout: "/auth/logout" } } }));
jest.mock("../../../utils/authStorage", () => ({ getToken: jest.fn(async () => "token") }));

import {
  changePassword,
  currentSignInMethods,
  deleteFirebaseUser,
  firebaseAccountMessage,
  needsRecentLogin,
  reauthenticateWithGoogle,
  signInMethodsOf,
} from "../firebaseAccount";
import { ApiError } from "../../apiClient";

const fbError = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  mockFirebase.currentUser = mockUser;
  mockReauth.mockReset().mockResolvedValue({});
  mockUpdatePassword.mockReset().mockResolvedValue(undefined);
  mockDeleteUser.mockReset().mockResolvedValue(undefined);
});

describe("signInMethodsOf", () => {
  it("email + password", () => {
    expect(signInMethodsOf({ providerData: [{ providerId: "password" }] } as never)).toEqual({ password: true, google: false, signedIn: true });
  });

  it("Google only: no Change password", () => {
    expect(signInMethodsOf({ providerData: [{ providerId: "google.com" }] } as never)).toEqual({ password: false, google: true, signedIn: true });
  });

  it("both", () => {
    expect(signInMethodsOf({ providerData: [{ providerId: "google.com" }, { providerId: "password" }] } as never).password).toBe(true);
  });

  it("nobody signed in", () => {
    expect(signInMethodsOf(null)).toEqual({ password: false, google: false, signedIn: false });
    mockFirebase.currentUser = null;
    expect(currentSignInMethods().signedIn).toBe(false);
  });
});

describe("firebaseAccountMessage", () => {
  it.each([
    ["auth/wrong-password", "Your current password is not correct."],
    ["auth/invalid-credential", "Your current password is not correct."],
    ["auth/weak-password", "That password is too weak. Use at least 8 characters with letters and numbers."],
    ["auth/requires-recent-login", "For your security, please confirm your password (or Google account) again and retry."],
    ["auth/user-mismatch", "Choose the same Google account you signed in with."],
    ["auth/too-many-requests", "Too many attempts. Please wait a few minutes and try again."],
  ])("%s", (code, message) => {
    expect(firebaseAccountMessage(fbError(code), "fallback")).toBe(message);
  });

  it("falls back for unknown errors and keeps ApiError messages", () => {
    expect(firebaseAccountMessage(fbError("auth/internal-error"), "fallback")).toBe("fallback");
    expect(firebaseAccountMessage(new Error("boom"), "fallback")).toBe("fallback");
    expect(firebaseAccountMessage(new ApiError("Google sign-in was cancelled.", 400), "fallback")).toBe("Google sign-in was cancelled.");
  });

  it("knows when a recent sign-in is needed", () => {
    expect(needsRecentLogin(fbError("auth/requires-recent-login"))).toBe(true);
    expect(needsRecentLogin(fbError("auth/wrong-password"))).toBe(false);
  });
});

describe("changePassword", () => {
  it("checks the current password first, then sets the new one", async () => {
    await changePassword("oldPass123", "newPass456");
    expect(mockReauth).toHaveBeenCalledWith(mockUser, { email: "aadil@example.com", password: "oldPass123" });
    expect(mockUpdatePassword).toHaveBeenCalledWith(mockUser, "newPass456");
    expect(mockReauth.mock.invocationCallOrder[0]).toBeLessThan(mockUpdatePassword.mock.invocationCallOrder[0]);
  });

  it("a wrong current password changes nothing", async () => {
    mockReauth.mockRejectedValueOnce(fbError("auth/wrong-password"));
    await expect(changePassword("bad", "newPass456")).rejects.toThrow("Your current password is not correct.");
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it("a weak password refused by Firebase gets a plain message", async () => {
    mockUpdatePassword.mockRejectedValueOnce(fbError("auth/weak-password"));
    await expect(changePassword("oldPass123", "newPass456")).rejects.toThrow(/too weak/);
  });

  it("signed out: plain message", async () => {
    mockFirebase.currentUser = null;
    await expect(changePassword("a", "b")).rejects.toThrow("You are signed out. Please sign in again.");
  });
});

describe("reauthenticateWithGoogle", () => {
  it("uses the Google account chosen again", async () => {
    await reauthenticateWithGoogle();
    expect(mockReauth).toHaveBeenCalledWith(mockUser, { idToken: "google-id" });
  });

  it("another Google account is refused with a plain message", async () => {
    mockReauth.mockRejectedValueOnce(fbError("auth/user-mismatch"));
    await expect(reauthenticateWithGoogle()).rejects.toThrow("Choose the same Google account you signed in with.");
  });
});

describe("deleteFirebaseUser", () => {
  it("deletes the signed-in user", async () => {
    await expect(deleteFirebaseUser()).resolves.toBe(true);
    expect(mockDeleteUser).toHaveBeenCalledWith(mockUser);
  });

  it("reports false (never throws) when Firebase refuses", async () => {
    mockDeleteUser.mockRejectedValueOnce(fbError("auth/requires-recent-login"));
    await expect(deleteFirebaseUser()).resolves.toBe(false);
  });

  it("nobody signed in: nothing to delete", async () => {
    mockFirebase.currentUser = null;
    await expect(deleteFirebaseUser()).resolves.toBe(true);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
