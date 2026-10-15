import { isValidPassword } from "../../utils/validation";

// Change password (Profile, email + password accounts): the same strength rule as sign-up (utils/validation
// isValidPassword: at least 8 characters with letters and numbers).

export const NEW_PASSWORD_HINT = "At least 8 characters, with letters and numbers.";

export type PasswordChangeInput = { current: string; next: string; confirm: string };
export type PasswordChangeErrors = Partial<Record<keyof PasswordChangeInput, string>>;

/** Field errors for the Change password form; empty when it can be sent. */
export function validatePasswordChange({ current, next, confirm }: PasswordChangeInput): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {};
  if (!current) errors.current = "Enter your current password.";
  const trimmed = next.trim();
  if (!trimmed) errors.next = "Enter a new password.";
  else if (!isValidPassword(trimmed)) errors.next = NEW_PASSWORD_HINT;
  else if (current && trimmed === current.trim()) errors.next = "Choose a password that is different from your current one.";
  if (!confirm) errors.confirm = "Re-enter the new password.";
  else if (confirm.trim() !== trimmed) errors.confirm = "The passwords do not match.";
  return errors;
}

export function hasErrors(errors: PasswordChangeErrors): boolean {
  return Object.values(errors).some(Boolean);
}
