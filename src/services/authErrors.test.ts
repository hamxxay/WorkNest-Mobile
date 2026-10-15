import { ApiError } from "./apiClient";
import {
  ACCOUNT_DISABLED_MESSAGE,
  GOOGLE_UNAVAILABLE_MESSAGE,
  GoogleSignInUnavailable,
  SIGN_IN_REFUSED_MESSAGE,
  SignInCancelled,
  googleErrorKind,
  googleErrorMessage,
  isAccountDisabled,
  isEmailNotVerified,
  isSignInCancelled,
  isSignInRefused,
  isTemporaryFailure,
  refusalCode,
  refusalMessage,
} from "./authErrors";

jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

const notVerified = new ApiError("Please verify your email address first.", 403, {
  isSuccessful: false,
  message: "Please verify your email address first. Open the link we sent to a@b.co, then sign in again.",
  data: { code: "EMAIL_NOT_VERIFIED" },
});
const turnedOff = new ApiError("Your account is turned off. Please contact WorkNest.", 403, {
  isSuccessful: false,
  message: "Your account is turned off. Please contact WorkNest.",
  data: { code: "ACCOUNT_DISABLED" },
});

describe("refusal codes from the API", () => {
  it("reads data.code (any case)", () => {
    expect(refusalCode(notVerified)).toBe("EMAIL_NOT_VERIFIED");
    expect(refusalCode(new ApiError("x", 403, { data: { Code: "account_disabled" } }))).toBe("ACCOUNT_DISABLED");
    expect(isEmailNotVerified(notVerified)).toBe(true);
    expect(isAccountDisabled(turnedOff)).toBe(true);
  });

  it("has no code for other errors (including a Firebase error kept as details)", () => {
    expect(refusalCode(new ApiError("x", 400, { code: "auth/invalid-credential" }))).toBeNull();
    expect(refusalCode(new Error("x"))).toBeNull();
    expect(refusalCode(undefined)).toBeNull();
  });
});

describe("isSignInRefused", () => {
  it("is a verdict for 401, 403, a refusal code and 200 { isSuccessful: false }", () => {
    expect(isSignInRefused(new ApiError("x", 401))).toBe(true);
    expect(isSignInRefused(new ApiError("x", 403))).toBe(true);
    expect(isSignInRefused(notVerified)).toBe(true);
    expect(isSignInRefused(turnedOff)).toBe(true);
    expect(
      isSignInRefused(new ApiError("Google login failed. Please try again.", 200, { isSuccessful: false, data: null })),
    ).toBe(true);
  });

  it("is not a verdict when offline, rate limited or on a server error", () => {
    for (const status of [0, 408, 429, 500, 503]) {
      expect(isSignInRefused(new ApiError("x", status))).toBe(false);
      expect(isTemporaryFailure(new ApiError("x", status))).toBe(true);
    }
    expect(isTemporaryFailure(new ApiError("x", 403))).toBe(false);
    expect(isSignInRefused(new Error("x"))).toBe(false);
  });
});

describe("refusalMessage", () => {
  it("shows the API's own words for a turned-off account and an unverified email", () => {
    expect(refusalMessage(turnedOff, { viaGoogle: false })).toBe(ACCOUNT_DISABLED_MESSAGE);
    expect(refusalMessage(notVerified, { viaGoogle: false })).toMatch(/^Please verify your email address first/);
    expect(refusalMessage(new ApiError("x", 403, { data: { code: "ACCOUNT_DISABLED" } }), { viaGoogle: true })).toBe(
      ACCOUNT_DISABLED_MESSAGE,
    );
  });

  it("never says 'Google login failed' to someone who signed in with a password", () => {
    const googleFailed = new ApiError("Google login failed. Please try again.", 200, {
      isSuccessful: false,
      message: "Google login failed. Please try again.",
    });
    expect(refusalMessage(googleFailed, { viaGoogle: false })).toBe(SIGN_IN_REFUSED_MESSAGE);
    expect(refusalMessage(googleFailed, { viaGoogle: true })).toBe("Google login failed. Please try again.");
  });

  it("uses a plain default when the API sent no message", () => {
    expect(refusalMessage(new ApiError("You don't have permission to do this.", 403, null), { viaGoogle: false })).toBe(
      SIGN_IN_REFUSED_MESSAGE,
    );
  });
});

describe("Google sign-in problems", () => {
  const codes = { SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED", IN_PROGRESS: "IN_PROGRESS", PLAY_SERVICES_NOT_AVAILABLE: "PLAY" };

  it("closing the account picker is a cancel (nothing is shown)", () => {
    expect(isSignInCancelled(new SignInCancelled())).toBe(true);
    expect(googleErrorKind({ code: "SIGN_IN_CANCELLED" }, codes)).toBe("cancelled");
    expect(isSignInCancelled(new Error("Google sign-in was cancelled."))).toBe(false);
  });

  it("a build that is not set up for Google shows a plain message, never developer instructions", () => {
    for (const error of [{ code: "10" }, { code: "DEVELOPER_ERROR" }, new GoogleSignInUnavailable("FIREBASE_WEB_CLIENT_ID missing")]) {
      const kind = googleErrorKind(error, codes);
      expect(kind).toBe("unavailable");
      expect(googleErrorMessage(kind, error)).toBe(GOOGLE_UNAVAILABLE_MESSAGE);
      expect(googleErrorMessage(kind, error)).not.toMatch(/SHA|google-services|FIREBASE_WEB_CLIENT_ID/);
    }
  });

  it("other failures get readable text (technical text is replaced)", () => {
    expect(googleErrorMessage(googleErrorKind({ code: "IN_PROGRESS" }, codes), null)).toMatch(/already open/);
    expect(googleErrorMessage("other", new Error("java.lang.NullPointerException at com.google.Foo(Foo.java:1)"))).toBe(
      "Google sign-in didn't work. Please try again.",
    );
  });
});
