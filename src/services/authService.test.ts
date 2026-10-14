// Sign-out and refused sessions (authService): POST /auth/logout before the local session is cleared, the saved
// door Access Request removed, and a sign-in the API refuses (401 / 403) never kept from the cache.

type FakeUser = { uid: string; email: string | null; displayName: string | null; phoneNumber: string | null };

const mockKeychain = new Map<string, string>();
const mockStorage = new Map<string, string>();
const mockFirebase: {
  currentUser: FakeUser | null;
  idTokenListener: ((user: FakeUser | null) => void) | null;
  signOut: jest.Mock;
  onIdTokenChanged: jest.Mock;
  signInWithEmailAndPassword: jest.Mock;
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

import { hydrateSessionUser, loginUser, logoutUser, subscribeToAuthChanges } from "./authService";
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
