// Change password form rules: current password required, the sign-up strength rule for the new one, different from the
// current one, and the confirmation must match.

import { hasErrors, NEW_PASSWORD_HINT, validatePasswordChange } from "../passwordChange";

describe("validatePasswordChange", () => {
  it("accepts a valid change", () => {
    const errors = validatePasswordChange({ current: "oldPass123", next: "newPass456", confirm: "newPass456" });
    expect(errors).toEqual({});
    expect(hasErrors(errors)).toBe(false);
  });

  it("requires every field", () => {
    expect(validatePasswordChange({ current: "", next: "", confirm: "" })).toEqual({
      current: "Enter your current password.",
      next: "Enter a new password.",
      confirm: "Re-enter the new password.",
    });
  });

  it.each(["short1", "lettersonly", "12345678", "has space 123"])("rejects a weak new password %p", (next) => {
    const errors = validatePasswordChange({ current: "oldPass123", next, confirm: next });
    expect(errors.next).toBe(NEW_PASSWORD_HINT);
  });

  it("rejects the same password again", () => {
    expect(validatePasswordChange({ current: "samePass123", next: "samePass123", confirm: "samePass123" }).next).toBe(
      "Choose a password that is different from your current one.",
    );
  });

  it("rejects a confirmation that does not match", () => {
    expect(validatePasswordChange({ current: "oldPass123", next: "newPass456", confirm: "newPass457" }).confirm).toBe(
      "The passwords do not match.",
    );
  });

  it("ignores spaces around the new password, as sign-up does", () => {
    expect(validatePasswordChange({ current: "oldPass123", next: " newPass456 ", confirm: "newPass456" })).toEqual({});
  });
});
