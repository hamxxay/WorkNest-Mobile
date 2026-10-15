// Sign-out and refused sessions (authService): POST /auth/logout before the local session is cleared, the saved
// door Access Request removed, and a sign-in the API refuses (401 / 403) never kept from the cache.

type FakeUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  emailVerified?: boolean;
  providerData?: Array<{ providerId: string }>;
  reload?: jest.Mock;
  sendEmailVerification?: jest.Mock;
  updateProfile?: jest.Mock;
};

const mockKeychain = new Map<string, string>();
const mockStorage = new Map<string, string>();
const mockFirebase: {
  currentUser: FakeUser | null;
  idTokenListener: ((user: FakeUser | null) => void) | null;
  signOut: jest.Mock;
  onIdTokenChanged: jest.Mock;
  signInWithEmailAndPassword: jest.Mock;
  createUserWithEmailAndPassword: jest.Mock;
} = {
  currentUser: null,
  idTokenListener: null,
  // Like the native module: the user is signed out a moment later, not synchronously.
  signOut: jest.fn(async () => {
    await new Promise((resolve) => setImmediate(resolve));
    mockFirebase.currentUser = null;
  }),
  onIdTokenChanged: jest.fn((listener: (user: FakeUser | null) => void) => {
    mockFirebase.idTokenListener = listener;
    return () => {
      mockFirebase.idTokenListener = null;
    };
  }),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
};

jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  default: () => mockFirebase,
  getIdToken: jest.fn(async () => "firebase-id-token"),
  GoogleAuthProvider: { credential: jest.fn() },
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signOut: jest.fn(async () => null),
    revokeAccess: jest.fn(async () => null),
  },
  isCancelledResponse: jest.fn(() => false),
  isSuccessResponse: jest.fn(() => true),
  statusCodes: {},
}));

jest.mock("react-native-keychain", () => ({
  setGenericPassword: jest.fn(async (_user: string, password: string, options: { service: string }) => {
    mockKeychain.set(options.service, password);
    return true;
  }),
  getGenericPassword: jest.fn(async (options: { service: string }) =>
    mockKeychain.has(options.service) ? { password: mockKeychain.get(options.service) } : false,
  ),
  resetGenericPassword: jest.fn(async (options: { service: string }) => mockKeychain.delete(options.service)),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
    multiRemove: jest.fn(async (keys: string[]) => {
      keys.forEach((key) => mockStorage.delete(key));
    }),
    getAllKeys: jest.fn(async () => Array.from(mockStorage.keys())),
  },
}));

import {
  beginGoogleAuth,
  completeEmailVerification,
  getPendingEmailVerification,
  hydrateSessionUser,
  loginUser,
  logoutUser,
  registerUser,
  subscribeToAuthChanges,
  takeSignOutNotice,
} from "./authService";
import { onSessionExpired, resetSessionExpiredState } from "./apiClient";
import { downloadStaffFile, staffUpload } from "./staff/http";

type FetchMock = jest.Mock<Promise<Partial<Response>>, [string, RequestInit]>;

function jsonResponse(status: number, body: unknown): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null } as unknown as Headers,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

function installFetch(impl: (url: string, init: RequestInit) => Promise<Partial<Response>>): FetchMock {
  const fetchMock: FetchMock = jest.fn(impl);
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

/** Lets the promise chains started by the code under test (sign-out listeners) finish. */
async function flush() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

const USER: FakeUser = { uid: "uid-1", email: "member@example.com", displayName: "Member", phoneNumber: null };

function signedInWithCachedSession() {
  mockFirebase.currentUser = USER;
  mockKeychain.set("auth_token", "old-api-jwt");
  mockStorage.set("auth_user", JSON.stringify({ id: "uid-1", email: "member@example.com", role: "general" }));
  mockStorage.set("door_access:member@example.com", JSON.stringify({ details: { cnic: "35202-1234567-1" } }));
  mockStorage.set("onboarding_done", "true");
}

let expired: jest.Mock;
let unsubscribeExpired: () => void;

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockKeychain.clear();
  mockStorage.clear();
  mockFirebase.currentUser = null;
  mockFirebase.idTokenListener = null;
  resetSessionExpiredState();
  expired = jest.fn();
  unsubscribeExpired = onSessionExpired(expired);
});

afterEach(() => {
  unsubscribeExpired();
  jest.useRealTimers();
});

describe("logoutUser", () => {
  it("revokes the API token (POST /auth/logout with it), then clears the session and the door Access Request", async () => {
    signedInWithCachedSession();
    const fetchMock = installFetch(async () => jsonResponse(200, { isSuccessful: true, message: "Logged out successfully." }));

    await logoutUser();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/logout$/);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer old-api-jwt");

    expect(mockFirebase.signOut).toHaveBeenCalled();
    expect(mockKeychain.has("auth_token")).toBe(false);
    expect(mockStorage.has("auth_user")).toBe(false);
    expect(mockStorage.has("door_access:member@example.com")).toBe(false);
    expect(mockStorage.get("onboarding_done")).toBe("true");
  });

  it("still signs out when the API can't be reached", async () => {
    signedInWithCachedSession();
    installFetch(async () => {
      throw new TypeError("Network request failed");
    });

    await expect(logoutUser()).resolves.toBeUndefined();
    expect(mockKeychain.has("auth_token")).toBe(false);
    expect(mockStorage.has("door_access:member@example.com")).toBe(false);
  });

  it("gives up on a slow logout request after about 1.5 s", async () => {
    jest.useFakeTimers();
    signedInWithCachedSession();
    const fetchMock = installFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    let finished = false;
    const done = logoutUser().then(() => {
      finished = true;
    });
    await jest.advanceTimersByTimeAsync(1400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(finished).toBe(false);

    await jest.advanceTimersByTimeAsync(200);
    await done;
    expect(finished).toBe(true);
    expect(mockKeychain.has("auth_token")).toBe(false);
  });

  it("sends no logout request when there is no API token", async () => {
    mockFirebase.currentUser = USER;
    const fetchMock = installFetch(async () => jsonResponse(200, {}));

    await logoutUser();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("hydrateSessionUser (app start)", () => {
  it.each([401, 403])("signs out instead of keeping the cached session when auth/google-login answers %i", async (status) => {
    signedInWithCachedSession();
    installFetch(async () => jsonResponse(status, { isSuccessful: false, message: "Your access is turned off." }));

    const user = await hydrateSessionUser();
    await flush();

    expect(user).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(mockFirebase.signOut).toHaveBeenCalled();
    expect(mockKeychain.has("auth_token")).toBe(false);
    expect(mockStorage.has("auth_user")).toBe(false);
    expect(mockStorage.has("door_access:member@example.com")).toBe(false);
  });

  it("keeps the cached session when the API can't be reached", async () => {
    signedInWithCachedSession();
    installFetch(async () => {
      throw new TypeError("Network request failed");
    });

    const user = await hydrateSessionUser();
    await flush();

    expect(user).toMatchObject({ email: "member@example.com", role: "general" });
    expect(expired).not.toHaveBeenCalled();
    expect(mockFirebase.signOut).not.toHaveBeenCalled();
    expect(mockKeychain.get("auth_token")).toBe("old-api-jwt");
  });

  it("keeps the cached session on a server error", async () => {
    signedInWithCachedSession();
    installFetch(async () => jsonResponse(503, undefined));

    const user = await hydrateSessionUser();
    await flush();

    expect(user).toMatchObject({ email: "member@example.com" });
    expect(expired).not.toHaveBeenCalled();
    expect(mockKeychain.get("auth_token")).toBe("old-api-jwt");
  });

  it.each([
    [{ token: "ceo-jwt", roles: ["ceo"] }],
    [{ token: "ceo-jwt", role: "ceo" }],
    [{ token: "ceo-jwt", roles: ["general", "ceo"] }],
  ])("stores the CEO role from the exchange (%p), so the CEO app opens", async (data) => {
    signedInWithCachedSession();
    installFetch(async (url) =>
      /google-login$/.test(url)
        ? jsonResponse(200, { isSuccessful: true, data })
        : jsonResponse(200, { isSuccessful: true, data: null }),
    );

    const user = await hydrateSessionUser();
    await flush();

    expect(user).toMatchObject({ email: "member@example.com", role: "ceo" });
    expect(mockKeychain.get("auth_token")).toBe("ceo-jwt");
  });

  it.each([
    [{ token: "sm-jwt", roles: ["sales_manager"] }, "sales_manager"],
    [{ token: "sm-jwt", role: "Sales Manager" }, "Sales Manager"],
    [{ token: "sm-jwt", roles: ["general", "sales_manager"] }, "sales_manager"],
    [{ token: "sm-jwt", roles: ["super_admin", "sales_manager"] }, "sales_manager"],
  ])("stores the Sales Manager role from the exchange (%p), so the Sales Manager app opens", async (data, stored) => {
    signedInWithCachedSession();
    installFetch(async (url) =>
      /google-login$/.test(url)
        ? jsonResponse(200, { isSuccessful: true, data })
        : jsonResponse(200, { isSuccessful: true, data: null }),
    );

    const user = await hydrateSessionUser();
    await flush();

    expect(user).toMatchObject({ email: "member@example.com", role: stored });
    expect(mockKeychain.get("auth_token")).toBe("sm-jwt");
  });

  it("stores the new token and role when the exchange succeeds", async () => {
    signedInWithCachedSession();
    installFetch(async (url) =>
      /google-login$/.test(url)
        ? jsonResponse(200, { isSuccessful: true, data: { token: "new-api-jwt", roles: ["admin"] } })
        : jsonResponse(200, { isSuccessful: true, data: null }),
    );

    const user = await hydrateSessionUser();
    await flush();

    expect(user).toMatchObject({ email: "member@example.com", role: "admin" });
    expect(mockKeychain.get("auth_token")).toBe("new-api-jwt");
    expect(expired).not.toHaveBeenCalled();
  });
});

describe("names and role labels come from auth/me (the database)", () => {
  const storedUser = () => JSON.parse(mockStorage.get("auth_user") ?? "null");

  function apiAnswers(me: unknown) {
    return installFetch(async (url) =>
      /google-login$/.test(url)
        ? jsonResponse(200, { isSuccessful: true, data: { token: "ceo-jwt", roles: ["ceo"] } })
        : /auth\/me$/.test(url)
          ? jsonResponse(200, { isSuccessful: true, data: me })
          : jsonResponse(200, { isSuccessful: true, data: null }),
    );
  }

  it("stores WN_Users.Name as it is and WN_Roles.DisplayName after the app starts", async () => {
    signedInWithCachedSession();
    const fetchMock = apiAnswers({ id: 7, email: "member@example.com", name: "CEO1", role: "ceo", roleDisplayName: "CEO" });

    await hydrateSessionUser();
    await flush();

    expect(fetchMock.mock.calls.some(([url, init]) => /auth\/me$/.test(url) && (init.method ?? "GET") === "GET")).toBe(true);
    expect(storedUser()).toMatchObject({ name: "CEO1", role: "ceo", roleDisplayName: "CEO" });
  });

  it("keeps the database name over the Firebase display name on the next start (auth/me unreachable)", async () => {
    signedInWithCachedSession();
    mockStorage.set("auth_user", JSON.stringify({ id: "uid-1", email: "member@example.com", role: "ceo", name: "CEO1", roleDisplayName: "CEO" }));
    installFetch(async () => {
      throw new TypeError("Network request failed");
    });

    const user = await hydrateSessionUser();
    await flush();

    // USER.displayName in Firebase is "Member".
    expect(user).toMatchObject({ name: "CEO1", roleDisplayName: "CEO" });
    expect(storedUser()).toMatchObject({ name: "CEO1", roleDisplayName: "CEO" });
  });

  it("drops the role display name when auth/me no longer sends it (the app's label is shown)", async () => {
    signedInWithCachedSession();
    mockStorage.set("auth_user", JSON.stringify({ id: "uid-1", email: "member@example.com", role: "ceo", name: "CEO1", roleDisplayName: "Old" }));
    apiAnswers({ email: "member@example.com", name: "CEO1", role: "ceo" });

    await hydrateSessionUser();
    await flush();

    expect(storedUser().roleDisplayName).toBeUndefined();
    expect(storedUser().name).toBe("CEO1");
  });

  it("refreshes the profile from auth/me right after signing in on the Login screen", async () => {
    mockFirebase.signInWithEmailAndPassword.mockImplementation(async () => {
      mockFirebase.currentUser = USER;
      return { user: USER };
    });
    apiAnswers({ email: "member@example.com", name: "Sales Manager 1", role: "sales_manager", roleDisplayName: "Sales Manager" });

    await loginUser({ email: "member@example.com", password: "secret123" });
    await flush();

    expect(storedUser()).toMatchObject({ name: "Sales Manager 1", role: "sales_manager", roleDisplayName: "Sales Manager" });
  });
});

describe("a refused sign-in on the Login screen", () => {
  it("is handled by the login itself (its message), not reported as an expired session", async () => {
    const unsubscribe = subscribeToAuthChanges(() => undefined);
    mockFirebase.signInWithEmailAndPassword.mockImplementation(async () => {
      mockFirebase.currentUser = USER;
      mockFirebase.idTokenListener?.(USER);
      return { user: USER };
    });
    installFetch(async () => jsonResponse(403, { isSuccessful: false, message: "Your access is turned off." }));

    await expect(loginUser({ email: "member@example.com", password: "secret123" })).rejects.toMatchObject({
      status: 403,
      message: "Your access is turned off.",
    });
    await flush();

    expect(expired).not.toHaveBeenCalled();
    expect(mockFirebase.signOut).toHaveBeenCalled();
    unsubscribe();
  });
});

describe("staff file downloads / uploads use the same 401 handling", () => {
  function refusedTokenThenRenewal(renewed: Partial<Response>) {
    return installFetch(async (url) => {
      if (/google-login$/.test(url)) {
        return jsonResponse(200, { isSuccessful: true, data: { token: "fresh-api-jwt", roles: ["general"] } });
      }
      return renewed;
    });
  }

  it("a download refused with 401 renews the token once, re-sends it, and ends the session if still refused", async () => {
    signedInWithCachedSession();
    const fetchMock = refusedTokenThenRenewal(jsonResponse(401, undefined));

    await expect(downloadStaffFile("/kyc/document/5/download", { fileName: "doc" })).rejects.toMatchObject({ status: 401 });
    await flush();

    const downloads = fetchMock.mock.calls.filter(([url]) => /kyc\/document/.test(url));
    expect(downloads).toHaveLength(2);
    expect((downloads[0][1].headers as Record<string, string>).Authorization).toBe("Bearer old-api-jwt");
    expect((downloads[1][1].headers as Record<string, string>).Authorization).toBe("Bearer fresh-api-jwt");
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("an upload refused with 401 is re-sent with the renewed token", async () => {
    signedInWithCachedSession();
    let uploads = 0;
    const fetchMock = installFetch(async (url) => {
      if (/google-login$/.test(url)) {
        return jsonResponse(200, { isSuccessful: true, data: { token: "fresh-api-jwt", roles: ["admin"] } });
      }
      uploads += 1;
      return uploads === 1 ? jsonResponse(401, undefined) : jsonResponse(200, { isSuccessful: true, message: "Saved." });
    });

    await expect(staffUpload("/Agreement/3/upload-signed", { note: "signed" })).resolves.toMatchObject({ message: "Saved." });

    const sent = fetchMock.mock.calls.filter(([url]) => /upload-signed/.test(url));
    expect(sent).toHaveLength(2);
    expect((sent[1][1].headers as Record<string, string>).Authorization).toBe("Bearer fresh-api-jwt");
    expect(expired).not.toHaveBeenCalled();
  });
});

// ─── QA fixes: sign-in rules ────────────────────────────────────────────────────

/** An unsigned JWT with this expiry (the app only reads exp / email from its own token). */
function jwtFor(email: string, msLeft: number): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256" })}.${part({ email, exp: Math.floor((Date.now() + msLeft) / 1000) })}.sig`;
}

function bodyOf(init: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init.body ?? "{}"));
}

const mockedGetIdToken = (jest.requireMock("@react-native-firebase/auth") as { getIdToken: jest.Mock }).getIdToken;

function fakeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    ...USER,
    emailVerified: false,
    providerData: [{ providerId: "password" }],
    reload: jest.fn(async () => undefined),
    sendEmailVerification: jest.fn(async () => undefined),
    updateProfile: jest.fn(async () => undefined),
    ...overrides,
  };
}

const NOT_VERIFIED_BODY = {
  isSuccessful: false,
  message: "Please verify your email address first. Open the link we sent to member@example.com, then sign in again.",
  data: { code: "EMAIL_NOT_VERIFIED" },
};

describe("login uses the password exactly as typed", () => {
  it.each(["mypassword", "Secret,123", "pa$$w0rd~", "abc123", "two  spaces "])("sends %p to Firebase unchanged", async (password) => {
    mockFirebase.signInWithEmailAndPassword.mockImplementation(async () => {
      mockFirebase.currentUser = USER;
      return { user: USER };
    });
    installFetch(async (url) =>
      /google-login$/.test(url)
        ? jsonResponse(200, { isSuccessful: true, data: { token: "api-jwt", roles: ["general"] } })
        : jsonResponse(200, { isSuccessful: true, data: null }),
    );

    await expect(loginUser({ email: "member@example.com", password })).resolves.toMatchObject({ token: "api-jwt" });
    expect(mockFirebase.signInWithEmailAndPassword).toHaveBeenCalledWith("member@example.com", password);
  });

  it("an empty password is asked for, not 'Login failed.'", async () => {
    await expect(loginUser({ email: "member@example.com", password: "" })).rejects.toMatchObject({
      message: "Enter your password.",
    });
    expect(mockFirebase.signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("sends interactive: true for the button press, and the listener adds no second exchange", async () => {
    const unsubscribe = subscribeToAuthChanges(() => undefined);
    mockFirebase.signInWithEmailAndPassword.mockImplementation(async () => {
      mockFirebase.currentUser = USER;
      mockFirebase.idTokenListener?.(USER);
      return { user: USER };
    });
    const fetchMock = installFetch(async (url) =>
      /google-login$/.test(url)
        ? jsonResponse(200, { isSuccessful: true, data: { token: "staff-jwt", roles: ["admin"] } })
        : jsonResponse(200, { isSuccessful: true, data: null }),
    );

    await loginUser({ email: "member@example.com", password: "secret123" });
    await flush();

    const exchanges = fetchMock.mock.calls.filter(([url]) => /google-login$/.test(url));
    expect(exchanges).toHaveLength(1);
    expect(bodyOf(exchanges[0][1]).interactive).toBe(true);
    unsubscribe();
  });
});

describe("staff added in the CMS (no Firebase account yet)", () => {
  it("sign in with the WorkNest password, and the Firebase account is created in the background", async () => {
    mockFirebase.signInWithEmailAndPassword.mockRejectedValue({ code: "auth/invalid-credential" });
    mockFirebase.createUserWithEmailAndPassword.mockResolvedValue({ user: USER });
    const token = jwtFor("staff@worknest.com", 24 * 3600_000);
    const fetchMock = installFetch(async (url) =>
      /auth\/login$/.test(url)
        ? jsonResponse(200, { isSuccessful: true, data: { id: "pub-9", token, role: "admin", roleDisplayName: "Admin" } })
        : jsonResponse(200, { isSuccessful: true, data: null }),
    );

    const result = await loginUser({ email: "staff@worknest.com", password: "Staff,Pass 1" });
    await flush();

    const login = fetchMock.mock.calls.find(([url]) => /auth\/login$/.test(url));
    expect(bodyOf(login![1])).toEqual({ email: "staff@worknest.com", password: "Staff,Pass 1" });
    expect(result).toMatchObject({ token, roles: ["admin"] });
    expect(mockKeychain.get("auth_token")).toBe(token);
    expect(JSON.parse(mockStorage.get("auth_user")!)).toMatchObject({
      email: "staff@worknest.com",
      role: "admin",
      signInMethod: "worknest-password",
    });
    expect(mockFirebase.createUserWithEmailAndPassword).toHaveBeenCalledWith("staff@worknest.com", "Staff,Pass 1");
  });

  it("the WorkNest-password session survives a restart without a Firebase account", async () => {
    mockKeychain.set("auth_token", jwtFor("staff@worknest.com", 3600_000));
    mockStorage.set(
      "auth_user",
      JSON.stringify({ email: "staff@worknest.com", role: "admin", signInMethod: "worknest-password" }),
    );
    installFetch(async () => jsonResponse(200, { isSuccessful: true, data: null }));

    await expect(hydrateSessionUser()).resolves.toMatchObject({ email: "staff@worknest.com", role: "admin" });
  });

  it("a wrong password still says the email or password is incorrect", async () => {
    mockFirebase.signInWithEmailAndPassword.mockRejectedValue({ code: "auth/invalid-credential" });
    installFetch(async () => jsonResponse(401, { isSuccessful: false, message: "Invalid email or password." }));

    await expect(loginUser({ email: "staff@worknest.com", password: "nope" })).rejects.toMatchObject({
      message: "The email or password is incorrect.",
    });
    expect(mockKeychain.has("auth_token")).toBe(false);
    expect(mockFirebase.createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("a turned-off account shows the API's reason", async () => {
    mockFirebase.signInWithEmailAndPassword.mockRejectedValue({ code: "auth/invalid-credential" });
    installFetch(async () =>
      jsonResponse(403, {
        isSuccessful: false,
        message: "Your account is turned off. Please contact WorkNest.",
        data: { code: "ACCOUNT_DISABLED" },
      }),
    );

    await expect(loginUser({ email: "staff@worknest.com", password: "pass1234" })).rejects.toMatchObject({
      message: "Your account is turned off. Please contact WorkNest.",
    });
  });
});

describe("email verification", () => {
  it("sign-up sends the verification email and does not sign in to WorkNest yet", async () => {
    const created = fakeUser({ uid: "uid-new", email: "new@example.com", displayName: null });
    mockFirebase.createUserWithEmailAndPassword.mockImplementation(async () => {
      mockFirebase.currentUser = created;
      return { user: created };
    });
    const fetchMock = installFetch(async () => jsonResponse(200, { isSuccessful: true, data: null }));

    const result = await registerUser({ email: "new@example.com", password: "Secret123", firstName: "Sara", lastName: "Khan" });

    expect(result).toEqual({ verificationRequired: true, email: "new@example.com", emailSent: true });
    expect(created.updateProfile).toHaveBeenCalledWith({ displayName: "Sara Khan" });
    expect(created.sendEmailVerification).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getPendingEmailVerification()).toMatchObject({ email: "new@example.com" });
  });

  it("'I've verified' before opening the link: not verified yet, nothing sent to the API", async () => {
    mockFirebase.currentUser = fakeUser({ uid: "uid-new", email: "new@example.com" });
    const fetchMock = installFetch(async () => jsonResponse(200, {}));

    await expect(completeEmailVerification()).resolves.toEqual({ verified: false });
    expect(mockFirebase.currentUser.reload).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("after the link: reload, a new ID token, sign in with the typed name and save it when the API kept the default", async () => {
    const created = fakeUser({ uid: "uid-new", email: "sara.k@example.com", displayName: null });
    mockFirebase.createUserWithEmailAndPassword.mockImplementation(async () => {
      mockFirebase.currentUser = created;
      return { user: created };
    });
    installFetch(async () => jsonResponse(200, { isSuccessful: true, data: null }));
    await registerUser({ email: "sara.k@example.com", password: "Secret123", firstName: "Sara", lastName: "Khan" });

    const verified = { ...created, emailVerified: true };
    created.reload!.mockImplementation(async () => {
      mockFirebase.currentUser = verified;
    });
    const fetchMock = installFetch(async (url, init) => {
      if (/google-login$/.test(url)) return jsonResponse(200, { isSuccessful: true, data: { token: "new-jwt", roles: ["general"] } });
      if (/auth\/me$/.test(url) && (init.method ?? "GET") === "GET") {
        return jsonResponse(200, { isSuccessful: true, data: { email: "sara.k@example.com", name: "sara.k", phone: null } });
      }
      return jsonResponse(200, { isSuccessful: true, data: { name: "Sara Khan" } });
    });

    const result = await completeEmailVerification();
    await flush();

    expect(result).toMatchObject({ verified: true, user: { email: "sara.k@example.com", name: "Sara Khan" } });
    expect(mockedGetIdToken).toHaveBeenCalledWith(verified, true);
    const exchange = fetchMock.mock.calls.find(([url]) => /google-login$/.test(url))!;
    expect(bodyOf(exchange[1])).toMatchObject({ name: "Sara Khan", interactive: true });
    const put = fetchMock.mock.calls.find(([url, init]) => /auth\/me$/.test(url) && init.method === "PUT")!;
    expect(bodyOf(put[1])).toEqual({ name: "Sara Khan", phone: null });
    expect(mockKeychain.get("auth_token")).toBe("new-jwt");
    expect(getPendingEmailVerification()).toBeNull();
  });

  it("login of an unverified account: keeps Firebase, sends the link and asks to verify (after trying the WorkNest password)", async () => {
    const user = fakeUser({ uid: "uid-old", email: "old@example.com" });
    mockFirebase.signInWithEmailAndPassword.mockImplementation(async () => {
      mockFirebase.currentUser = user;
      return { user };
    });
    const fetchMock = installFetch(async (url) =>
      /google-login$/.test(url)
        ? jsonResponse(403, NOT_VERIFIED_BODY)
        : jsonResponse(401, { isSuccessful: false, message: "Invalid email or password." }),
    );

    await expect(loginUser({ email: "old@example.com", password: "oldpass" })).rejects.toMatchObject({
      status: 403,
      details: { data: { code: "EMAIL_NOT_VERIFIED" } },
    });

    expect(fetchMock.mock.calls.some(([url]) => /auth\/login$/.test(url))).toBe(true);
    expect(mockFirebase.signOut).not.toHaveBeenCalled();
    expect(user.sendEmailVerification).toHaveBeenCalledTimes(1);
    expect(getPendingEmailVerification()).toMatchObject({ email: "old@example.com" });
    expect(mockKeychain.has("auth_token")).toBe(false);
  });

  it("login of an unverified staff account with a WorkNest password signs in with that password", async () => {
    const user = fakeUser({ uid: "uid-staff", email: "staff2@worknest.com" });
    mockFirebase.signInWithEmailAndPassword.mockImplementation(async () => {
      mockFirebase.currentUser = user;
      return { user };
    });
    installFetch(async (url) =>
      /google-login$/.test(url)
        ? jsonResponse(403, NOT_VERIFIED_BODY)
        : /auth\/login$/.test(url)
          ? jsonResponse(200, { isSuccessful: true, data: { token: "staff-jwt", role: "sales_executive" } })
          : jsonResponse(200, { isSuccessful: true, data: null }),
    );

    await expect(loginUser({ email: "staff2@worknest.com", password: "pass1234" })).resolves.toMatchObject({
      token: "staff-jwt",
      roles: ["sales_executive"],
    });
    expect(user.sendEmailVerification).not.toHaveBeenCalled();
  });

  it("start-up of an account waiting for the link: signed out of WorkNest, Firebase kept, Verify screen next", async () => {
    mockFirebase.currentUser = fakeUser({ uid: "uid-wait", email: "wait@example.com" });
    mockStorage.set("auth_user", JSON.stringify({ email: "wait@example.com", role: "general" }));
    installFetch(async () => jsonResponse(403, NOT_VERIFIED_BODY));

    await expect(hydrateSessionUser()).resolves.toBeNull();
    await flush();

    expect(mockFirebase.signOut).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
    expect(getPendingEmailVerification()).toMatchObject({ email: "wait@example.com" });
    expect(mockStorage.has("auth_user")).toBe(false);
  });
});

describe("start-up exchange (rate limits)", () => {
  it("skips auth/google-login while the stored token is valid for more than an hour", async () => {
    signedInWithCachedSession();
    mockKeychain.set("auth_token", jwtFor("member@example.com", 20 * 3600_000));
    const fetchMock = installFetch(async () => jsonResponse(200, { isSuccessful: true, data: null }));

    await expect(hydrateSessionUser()).resolves.toMatchObject({ email: "member@example.com", role: "general" });
    await flush();

    expect(fetchMock.mock.calls.some(([url]) => /google-login$/.test(url))).toBe(false);
  });

  it("renews it silently (interactive: false) when less than an hour is left", async () => {
    signedInWithCachedSession();
    mockKeychain.set("auth_token", jwtFor("member@example.com", 30 * 60_000));
    const fetchMock = installFetch(async (url) =>
      /google-login$/.test(url)
        ? jsonResponse(200, { isSuccessful: true, data: { token: "renewed-jwt", roles: ["general"] } })
        : jsonResponse(200, { isSuccessful: true, data: null }),
    );

    await hydrateSessionUser();
    await flush();

    const exchange = fetchMock.mock.calls.find(([url]) => /google-login$/.test(url))!;
    expect(bodyOf(exchange[1]).interactive).toBe(false);
    expect(mockKeychain.get("auth_token")).toBe("renewed-jwt");
  });
});

describe("a refused session at start-up", () => {
  it("a turned-off account signs out and the Login screen gets the API's reason", async () => {
    signedInWithCachedSession();
    installFetch(async () =>
      jsonResponse(403, {
        isSuccessful: false,
        message: "Your account is turned off. Please contact WorkNest.",
        data: { code: "ACCOUNT_DISABLED" },
      }),
    );

    await expect(hydrateSessionUser()).resolves.toBeNull();
    await flush();

    expect(expired).toHaveBeenCalledTimes(1);
    expect(takeSignOutNotice()).toBe("Your account is turned off. Please contact WorkNest.");
    expect(takeSignOutNotice()).toBeNull();
  });

  it("200 { isSuccessful: false } is a refusal too, and a password user never reads 'Google login failed'", async () => {
    signedInWithCachedSession();
    mockFirebase.currentUser = fakeUser();
    installFetch(async () => jsonResponse(200, { isSuccessful: false, message: "Google login failed. Please try again." }));

    await expect(hydrateSessionUser()).resolves.toBeNull();
    await flush();

    expect(expired).toHaveBeenCalledTimes(1);
    expect(mockKeychain.has("auth_token")).toBe(false);
    expect(takeSignOutNotice()).not.toMatch(/google/i);
  });
});

describe("Google sign-in", () => {
  it("a build without the web client id shows a plain message (details only in the log)", async () => {
    const warn = console.warn as jest.Mock;
    warn.mockClear();

    await expect(beginGoogleAuth()).rejects.toMatchObject({
      message: "Google sign-in isn't available right now. Please sign in with your email and password.",
    });
    expect(warn.mock.calls.some(([line]) => /FIREBASE_WEB_CLIENT_ID/.test(String(line)))).toBe(true);
  });
});
