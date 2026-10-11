// Phone rule shared with the API and web: only digits, spaces, dashes, parentheses and a single
// leading '+'; after keeping only the digits there must be 11 to 15 of them.
export const PHONE_ERROR = "Phone number must be at least 11 digits (numbers only), e.g. 03001234567.";

export const PHONE_MAX_LENGTH = 20;

export function isValidPhone(value: string): boolean {
  const text = (value ?? "").trim();
  if (!/^\+?[\d\s()-]+$/.test(text)) return false;
  const digits = text.replace(/\D/g, "").length;
  return digits >= 11 && digits <= 15;
}

/** Error message for a non-empty invalid phone; null when valid or empty (callers enforce "required"). */
export function phoneError(value: string): string | null {
  if (!(value ?? "").trim()) return null;
  return isValidPhone(value) ? null : PHONE_ERROR;
}

/** Drops anything but digits, spaces, dashes and parentheses while typing; keeps a single leading '+'. */
export function formatPhoneInput(text: string): string {
  const raw = (text ?? "").replace(/^\s+/, "");
  const plus = raw.startsWith("+") ? "+" : "";
  return (plus + raw.replace(/[^\d\s()-]/g, "")).slice(0, PHONE_MAX_LENGTH);
}
