import {
  INPUT_LIMITS,
  passwordForState,
  sanitizeLoginPasswordInput,
  sanitizePasswordInput,
} from "../inputSanitizer";

describe("signing in: the password is used exactly as typed", () => {
  it.each(["mypassword", "Secret,123", "pa$$w0rd~", "abc123", "  two  spaces  ", "émoji-é", "a"])(
    "accepts %p unchanged",
    (password) => {
      expect(sanitizeLoginPasswordInput(password)).toBe(password);
      expect(passwordForState(password)).toBe(password);
    },
  );

  it("only asks for a password when it is empty", () => {
    expect(() => sanitizeLoginPasswordInput("")).toThrow("Enter your password.");
  });

  it("the field keeps spaces inside the password (no folding), only capped at the field limit", () => {
    expect(passwordForState("a  b\tc")).toBe("a  b\tc");
    expect(passwordForState("x".repeat(INPUT_LIMITS.password + 5))).toHaveLength(INPUT_LIMITS.password);
  });
});

describe("signing up: new passwords still follow the strength rule", () => {
  it("rejects weak new passwords", () => {
    for (const password of ["mypassword", "abc123", "12345678"]) {
      expect(() => sanitizePasswordInput(password)).toThrow(/at least 8 characters/);
    }
  });

  it("accepts a strong new password", () => {
    expect(sanitizePasswordInput("Secret123")).toBe("Secret123");
  });
});
