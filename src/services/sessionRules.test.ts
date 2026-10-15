import {
  MIN_TOKEN_VALIDITY_MS,
  WORKNEST_PASSWORD_SESSION,
  canSkipExchange,
  jwtEmail,
  jwtExpiresAt,
  keepsWorkNestPasswordSession,
  needsSignupName,
  tokenValidFor,
  triesWorkNestPassword,
} from "./sessionRules";

const NOW = Date.UTC(2026, 9, 15, 9, 0, 0);

/** An unsigned JWT with these claims (the app never verifies the signature, only reads exp / email). */
function jwt(claims: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(claims)}.signature`;
}

const expIn = (ms: number) => Math.floor((NOW + ms) / 1000);
const member = { email: "Member@Example.com", role: "general" };

describe("reading the WorkNest token", () => {
  it("reads exp and the email claim (also when the API sends it twice, or with a non-ASCII name)", () => {
    const token = jwt({ exp: expIn(3600_000), email: ["member@example.com", "member@example.com"], name: "Zoë" });
    expect(jwtExpiresAt(token)).toBe(expIn(3600_000) * 1000);
    expect(jwtEmail(token)).toBe("member@example.com");
    expect(jwtEmail(jwt({ "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "A@B.co" }))).toBe("a@b.co");
  });

  it("is null for anything that is not a JWT", () => {
    for (const value of [null, undefined, "", "old-api-jwt", "a.b", "a.!!!.c", "a.e30.c"]) {
      expect(jwtExpiresAt(value)).toBeNull();
    }
  });
});

describe("tokenValidFor", () => {
  it("needs more than the given time left, for the same email", () => {
    const token = jwt({ exp: expIn(2 * 3600_000), email: "member@example.com" });
    expect(tokenValidFor(token, "member@example.com", NOW, MIN_TOKEN_VALIDITY_MS)).toBe(true);
    expect(tokenValidFor(token, "other@example.com", NOW, MIN_TOKEN_VALIDITY_MS)).toBe(false);
    expect(tokenValidFor(token, "member@example.com", NOW, 3 * 3600_000)).toBe(false);
  });
});

describe("canSkipExchange (start-up and token refresh)", () => {
  it("skips the exchange while the stored token of this account is good for more than an hour", () => {
    const token = jwt({ exp: expIn(23 * 3600_000), email: "member@example.com" });
    expect(canSkipExchange({ token, firebaseEmail: "member@example.com", cached: member, now: NOW })).toBe(true);
  });

  it("exchanges when the token has an hour or less left, is not a JWT, or is missing", () => {
    expect(
      canSkipExchange({ token: jwt({ exp: expIn(59 * 60_000) }), firebaseEmail: "member@example.com", cached: member, now: NOW }),
    ).toBe(false);
    expect(canSkipExchange({ token: "old-api-jwt", firebaseEmail: "member@example.com", cached: member, now: NOW })).toBe(false);
    expect(canSkipExchange({ token: null, firebaseEmail: "member@example.com", cached: member, now: NOW })).toBe(false);
  });

  it("exchanges for another account, a token issued to another email, or an unknown role", () => {
    const token = jwt({ exp: expIn(23 * 3600_000), email: "member@example.com" });
    expect(canSkipExchange({ token, firebaseEmail: "other@example.com", cached: member, now: NOW })).toBe(false);
    expect(
      canSkipExchange({ token, firebaseEmail: "member@example.com", cached: { email: "other@example.com", role: "general" }, now: NOW }),
    ).toBe(false);
    expect(canSkipExchange({ token, firebaseEmail: "member@example.com", cached: { email: "member@example.com" }, now: NOW })).toBe(false);
    expect(canSkipExchange({ token, firebaseEmail: "member@example.com", cached: null, now: NOW })).toBe(false);
    const someoneElse = jwt({ exp: expIn(23 * 3600_000), email: "other@example.com" });
    expect(canSkipExchange({ token: someoneElse, firebaseEmail: "member@example.com", cached: member, now: NOW })).toBe(false);
  });
});

describe("WorkNest-password sessions (staff without a Firebase account)", () => {
  const staff = { email: "staff@worknest.com", role: "admin", signInMethod: WORKNEST_PASSWORD_SESSION };

  it("are kept until the token expires", () => {
    expect(keepsWorkNestPasswordSession(staff, jwt({ exp: expIn(60_000), email: "staff@worknest.com" }), NOW)).toBe(true);
    expect(keepsWorkNestPasswordSession(staff, jwt({ exp: expIn(-60_000), email: "staff@worknest.com" }), NOW)).toBe(false);
  });

  it("only for a session that came from the WorkNest password", () => {
    const token = jwt({ exp: expIn(3600_000), email: "staff@worknest.com" });
    expect(keepsWorkNestPasswordSession({ ...staff, signInMethod: undefined }, token, NOW)).toBe(false);
    expect(keepsWorkNestPasswordSession(null, token, NOW)).toBe(false);
  });

  it("are tried after the Firebase answers that can mean 'no Firebase account with this password'", () => {
    for (const code of ["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"]) {
      expect(triesWorkNestPassword(code)).toBe(true);
    }
    for (const code of ["auth/network-request-failed", "auth/too-many-requests", "auth/user-disabled", "unknown"]) {
      expect(triesWorkNestPassword(code)).toBe(false);
    }
  });
});

describe("needsSignupName", () => {
  it("saves the typed name when the account has none or only the API's default (the email prefix)", () => {
    expect(needsSignupName(null, "Sara Khan", "sara.k@example.com")).toBe(true);
    expect(needsSignupName("", "Sara Khan", "sara.k@example.com")).toBe(true);
    expect(needsSignupName("sara.k", "Sara Khan", "Sara.K@example.com")).toBe(true);
  });

  it("never replaces a real name, and does nothing without a typed name", () => {
    expect(needsSignupName("Sara Khan", "Sara Khan", "sara.k@example.com")).toBe(false);
    expect(needsSignupName("Sara A. Khan", "Sara Khan", "sara.k@example.com")).toBe(false);
    expect(needsSignupName("sara.k", "  ", "sara.k@example.com")).toBe(false);
    expect(needsSignupName("sara.k", undefined, "sara.k@example.com")).toBe(false);
  });
});
